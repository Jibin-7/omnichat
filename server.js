const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const { connectDB, User, Message, Group, VanishMode } = require("./db");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const activeUsers = new Map(); // username -> Set of socket IDs
const socketToUser = new Map(); // socket.id -> username

app.prepare().then(async () => {
  await connectDB();
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    maxHttpBufferSize: 1e8 // 100MB
  });

  const emitToUser = (username, event, payload) => {
    const sockets = activeUsers.get(username);
    if (sockets) {
      sockets.forEach(sid => io.to(sid).emit(event, payload));
    }
  };

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // ==========================================
    // AUTHENTICATION
    // ==========================================
    socket.on("register", async ({ phone, username, pinHash, publicKey, encryptedPrivateKey, iv }) => {
      try {
        const existing = await User.findOne({ $or: [{ phone }, { username }] });
        if (existing) {
          socket.emit("register_error", "Phone number or username already exists");
          return;
        }
        const newUser = new User({ phone, username, pinHash, publicKey, encryptedPrivateKey, iv });
        await newUser.save();
        socket.emit("register_success", { phone, username });
        
        const allUsers = await User.find({}, 'username publicKey avatar bio');
        io.emit("users_update", allUsers);
      } catch (e) {
        console.error(e);
        socket.emit("register_error", "Server error");
      }
    });

    socket.on("login", async ({ phone, username }) => {
      try {
        let user;
        if (phone) user = await User.findOne({ phone });
        else if (username) user = await User.findOne({ username });

        if (user) {
          socket.emit("login_success", { 
             phone: user.phone, username: user.username, pinHash: user.pinHash, 
             publicKey: user.publicKey, encryptedPrivateKey: user.encryptedPrivateKey, 
             iv: user.iv, avatar: user.avatar, bio: user.bio 
          });
        } else {
          socket.emit("login_error", "Account not found");
        }
      } catch (e) {
         socket.emit("login_error", "Server error");
      }
    });

    socket.on("update_pin", async ({ phone, pinHash, encryptedPrivateKey, iv }) => {
      try {
        await User.updateOne({ phone }, { $set: { pinHash, encryptedPrivateKey, iv } });
      } catch (e) {
        console.error("Failed to update pin", e);
      }
    });

    socket.on("auth_success", async ({ username }) => {
      if (!activeUsers.has(username)) activeUsers.set(username, new Set());
      activeUsers.get(username).add(socket.id);
      socketToUser.set(socket.id, username);

      // Presence
      await User.updateOne({ username }, { $set: { "presence.online": true } }, { strict: false });
      io.emit("presence_update", { username, online: true, lastSeen: null });

      // All users
      const allUsers = await User.find({}, 'username publicKey avatar bio presence');
      socket.emit("users_update", allUsers.map(u => ({ ...u.toObject(), online: u.get("presence")?.online || false, lastSeen: u.get("presence")?.lastSeen })));

      // Groups Syncing
      const groups = await Group.find({ "members.username": username });
      const syncData = groups.map(group => {
         const member = group.members.find(m => m.username === username);
         return {
            groupId: group.groupId, name: group.name, isChannel: group.isChannel, admin: group.admin,
            encryptedGroupKey: member.encryptedGroupKey, iv: member.iv,
            status: member.status, isDeleted: group.isDeleted, members: group.members
         };
      });
      socket.emit("sync_groups", syncData);

      // Friends Syncing
      const userDoc = await User.findOne({ username });
      if (userDoc) {
         socket.emit("sync_friends", { friends: userDoc.friends, requests: userDoc.friendRequests, sent: userDoc.sentRequests });
      }

      // Vanish Modes
      const vanishModes = await VanishMode.find({ key: new RegExp(`(^|:)${username}(:|$)`) });
      const myVanishModes = {};
      vanishModes.forEach(vm => {
         const other = vm.key.split(":").find(p => p !== username);
         myVanishModes[other] = vm.enabled;
      });
      socket.emit("sync_vanish_modes", myVanishModes);

      // History Sync
      const history = await Message.find({
         $or: [
            { from: username },
            { to: username },
            { type: "group", to: { $in: groups.map(g => g.groupId) } }
         ],
         deletedFor: { $ne: username }
      }).sort({ timestamp: 1 });
      
      const parsedHistory = history.map(msg => ({
         id: msg.id, type: msg.type, from: msg.from, to: msg.to,
         ciphertext: msg.ciphertext, iv: msg.iv, text: msg.text,
         image: msg.image, audio: msg.audio, file: msg.file,
         timestamp: msg.timestamp, read: msg.read, isDeleted: msg.isDeleted,
         isEdited: msg.isEdited, reaction: msg.reaction, reactionBy: msg.reactionBy,
         isVanishMode: msg.isVanishMode, isSystem: msg.isSystem, replyTo: msg.replyTo,
         groupId: msg.type === "group" ? msg.to : undefined
      }));
      socket.emit("chat_history", parsedHistory);
      
      const allPresence = {};
      allUsers.forEach(u => allPresence[u.username] = { online: u.get("presence")?.online || false, lastSeen: u.get("presence")?.lastSeen });
      socket.emit("initial_presence", allPresence);
    });

    // ==========================================
    // FRIENDS & PRIVACY
    // ==========================================

    socket.on("update_profile", async ({ avatar, bio }) => {
      const username = socketToUser.get(socket.id);
      if (username) {
        await User.updateOne({ username }, { $set: { ...(avatar !== undefined && {avatar}), ...(bio !== undefined && {bio}) } });
        const allUsers = await User.find({}, 'username publicKey avatar bio');
        io.emit("users_update", allUsers);
      }
    });

    socket.on("users_sync", async () => {
      const allUsers = await User.find({}, 'username publicKey avatar bio presence');
      const username = socketToUser.get(socket.id);
      if (username) {
         const userDoc = await User.findOne({ username });
         if (userDoc) {
            const vanishModes = await VanishMode.find({ key: new RegExp(`(^|:)${username}(:|$)`) });
            const vanishMap = {};
            vanishModes.forEach(vm => vanishMap[vm.key] = vm.enabled);
            
            const res = allUsers.filter(u => userDoc.friends.includes(u.username)).map(targetUser => {
               const key = [username, targetUser.username].sort().join(":");
               return {
                  username: targetUser.username,
                  bio: targetUser.bio || "",
                  avatar: targetUser.avatar || null,
                  publicKey: targetUser.publicKey,
                  online: targetUser.get("presence")?.online || false,
                  lastSeen: targetUser.get("presence")?.lastSeen || null,
                  vanishMode: vanishMap[key] || false
               };
            });
            socket.emit("sync_friends", res);
         }
      }
    });

    socket.on("add_friend", async ({ target }) => {
      const from = socketToUser.get(socket.id);
      if (!from) return;
      await User.updateOne({ username: from }, { $addToSet: { sentRequests: target } });
      await User.updateOne({ username: target }, { $addToSet: { friendRequests: from } });
      
      const [fromUser, targetUser] = await Promise.all([User.findOne({username: from}), User.findOne({username: target})]);
      socket.emit("sync_friends", { friends: fromUser.friends, requests: fromUser.friendRequests, sent: fromUser.sentRequests });
      emitToUser(target, "sync_friends", { friends: targetUser.friends, requests: targetUser.friendRequests, sent: targetUser.sentRequests });
      emitToUser(target, "friend_request_received", { from });
    });

    socket.on("accept_friend", async ({ target }) => {
      const username = socketToUser.get(socket.id);
      if (!username) return;
      
      await User.updateOne({ username }, { $pull: { friendRequests: target }, $addToSet: { friends: target } });
      await User.updateOne({ username: target }, { $pull: { sentRequests: username }, $addToSet: { friends: username } });
      
      const [fromUser, targetUser] = await Promise.all([User.findOne({username}), User.findOne({username: target})]);
      socket.emit("sync_friends", { friends: fromUser.friends, requests: fromUser.friendRequests, sent: fromUser.sentRequests });
      emitToUser(target, "sync_friends", { friends: targetUser.friends, requests: targetUser.friendRequests, sent: targetUser.sentRequests });
    });

    socket.on("reject_friend", async ({ target }) => {
      const username = socketToUser.get(socket.id);
      if (!username) return;
      
      await User.updateOne({ username }, { $pull: { friendRequests: target } });
      await User.updateOne({ username: target }, { $pull: { sentRequests: username } });
      
      const [fromUser, targetUser] = await Promise.all([User.findOne({username}), User.findOne({username: target})]);
      socket.emit("sync_friends", { friends: fromUser.friends, requests: fromUser.friendRequests, sent: fromUser.sentRequests });
      emitToUser(target, "sync_friends", { friends: targetUser.friends, requests: targetUser.friendRequests, sent: targetUser.sentRequests });
    });

    socket.on("remove_friend", async ({ target }) => {
      const username = socketToUser.get(socket.id);
      if (!username) return;
      
      await User.updateOne({ username }, { $pull: { friends: target } });
      await User.updateOne({ username: target }, { $pull: { friends: username } });
      
      const [fromUser, targetUser] = await Promise.all([User.findOne({username}), User.findOne({username: target})]);
      socket.emit("sync_friends", { friends: fromUser.friends, requests: fromUser.friendRequests, sent: fromUser.sentRequests });
      emitToUser(target, "sync_friends", { friends: targetUser.friends, requests: targetUser.friendRequests, sent: targetUser.sentRequests });
      emitToUser(target, "friend_removed", { from: username });
    });

    // ==========================================
    // MESSAGING
    // ==========================================
    socket.on("send_message", async (msg) => {
      const from = socketToUser.get(socket.id);
      if (from) msg.from = from;
      
      if (!msg.isSystem) {
         await Message.create({
            id: msg.id, type: "1on1", from: msg.from, to: msg.to,
            ciphertext: msg.ciphertext, iv: msg.iv, timestamp: msg.timestamp,
            image: msg.image, audio: msg.audio, file: msg.file,
            isVanishMode: msg.isVanishMode, replyTo: msg.replyTo
         });
         emitToUser(msg.to, "receive_message", msg);
      }
    });

    socket.on("send_group_message", async (msg) => {
      const from = socketToUser.get(socket.id);
      if (from) msg.from = from;

      if (!msg.isSystem) {
         await Message.create({
            id: msg.id, type: "group", from: msg.from, to: msg.groupId,
            ciphertext: msg.ciphertext, iv: msg.iv, timestamp: msg.timestamp,
            image: msg.image, audio: msg.audio, file: msg.file,
            replyTo: msg.replyTo
         });
         
         const group = await Group.findOne({ groupId: msg.groupId });
         if (group) {
            group.members.forEach(member => {
               if (member.username !== from && member.status === "accepted") {
                  emitToUser(member.username, "receive_group_message", msg);
               }
            });
         }
      }
    });

    socket.on("messages_read", async ({ to }) => {
      const from = socketToUser.get(socket.id);
      if (!from) return;
      await Message.updateMany(
         { type: "1on1", from: to, to: from, read: false },
         { $set: { read: true } }
      );
      emitToUser(to, "messages_read", { by: from });
    });

    socket.on("chat_closed", async ({ chatId }) => {
      const from = socketToUser.get(socket.id);
      if (!from) return;
      
      const purgeMsgs = await Message.find({
         type: "1on1", isVanishMode: true, read: true, isDeleted: false,
         $or: [
            { from, to: chatId },
            { to: from, from: chatId }
         ]
      });
      
      if (purgeMsgs.length > 0) {
         await Message.updateMany({ _id: { $in: purgeMsgs.map(m => m._id) } }, { $set: { isDeleted: true, ciphertext: "" } });
         purgeMsgs.forEach(msg => {
            emitToUser(msg.to, "message_deleted", { messageId: msg.id, chatId: msg.from, isVanishMode: true });
            emitToUser(msg.from, "message_deleted", { messageId: msg.id, chatId: msg.to, isVanishMode: true });
         });
      }
    });

    socket.on("toggle_vanish_mode", async ({ to, vanishMode }) => {
      const from = socketToUser.get(socket.id);
      if (!from) return;
      const key = [from, to].sort().join(":");
      await VanishMode.updateOne({ key }, { $set: { enabled: vanishMode } }, { upsert: true });
      emitToUser(from, "vanish_mode_update", { chatId: to, vanishMode });
      emitToUser(to, "vanish_mode_update", { chatId: from, vanishMode });
    });

    socket.on("typing", ({ to, isGroup }) => {
      const from = socketToUser.get(socket.id);
      if (isGroup) {
         Group.findOne({ groupId: to }).then(group => {
            if (group) group.members.forEach(m => {
               if (m.username !== from && m.status === "accepted") emitToUser(m.username, "typing", { from, chatId: to });
            });
         });
      } else {
         emitToUser(to, "typing", { from, chatId: from });
      }
    });

    socket.on("stop_typing", ({ to, isGroup }) => {
      const from = socketToUser.get(socket.id);
      if (isGroup) {
         Group.findOne({ groupId: to }).then(group => {
            if (group) group.members.forEach(m => {
               if (m.username !== from && m.status === "accepted") emitToUser(m.username, "stop_typing", { from, chatId: to });
            });
         });
      } else {
         emitToUser(to, "stop_typing", { from, chatId: from });
      }
    });

    socket.on("reaction", async ({ messageId, chatId, reaction, reactionBy }) => {
      await Message.updateOne({ id: messageId }, { $set: { reaction, reactionBy } });
      const msg = await Message.findOne({ id: messageId });
      if (msg) {
         if (msg.type === "1on1") {
            emitToUser(msg.from, "reaction", { messageId, chatId, reaction, reactionBy });
            emitToUser(msg.to, "reaction", { messageId, chatId, reaction, reactionBy });
         } else {
            const group = await Group.findOne({ groupId: msg.to });
            if (group) {
               group.members.forEach(m => {
                  if (m.status === "accepted") emitToUser(m.username, "group_reaction", { groupId: msg.to, messageId, reaction, reactionBy });
               });
            }
         }
      }
    });

    socket.on("edit_message", async ({ messageId, newCiphertext, newIv }) => {
      await Message.updateOne({ id: messageId }, { $set: { ciphertext: newCiphertext, iv: newIv, isEdited: true } });
      const msg = await Message.findOne({ id: messageId });
      if (msg) {
         if (msg.type === "1on1") {
            emitToUser(msg.to, "message_edited", { messageId, chatId: msg.from, newCiphertext, newIv });
            emitToUser(msg.from, "message_edited", { messageId, chatId: msg.to, newCiphertext, newIv });
         } else {
            const group = await Group.findOne({ groupId: msg.to });
            if (group) {
               group.members.forEach(m => {
                  if (m.status === "accepted") emitToUser(m.username, "message_edited", { messageId, chatId: msg.to, newCiphertext, newIv });
               });
            }
         }
      }
    });

    socket.on("delete_message", async ({ messageId }) => {
      const from = socketToUser.get(socket.id);
      const msg = await Message.findOne({ id: messageId });
      if (msg && msg.from === from) {
         await Message.updateOne({ id: messageId }, { $set: { isDeleted: true, ciphertext: "", isVanishMode: false } });
         if (msg.type === "1on1") {
            emitToUser(msg.to, "message_deleted", { messageId, chatId: msg.from });
            emitToUser(msg.from, "message_deleted", { messageId, chatId: msg.to });
         } else {
            const group = await Group.findOne({ groupId: msg.to });
            if (group) {
               group.members.forEach(m => {
                  if (m.status === "accepted") emitToUser(m.username, "message_deleted", { messageId, chatId: msg.to });
               });
            }
         }
      }
    });

    socket.on("delete_message_for_me", async ({ messageId }) => {
      const username = socketToUser.get(socket.id);
      if (username) {
         await Message.updateOne({ id: messageId }, { $addToSet: { deletedFor: username } });
         socket.emit("message_deleted_for_me", { messageId });
      }
    });

    // ==========================================
    // GROUPS
    // ==========================================
    socket.on("create_group", async ({ groupId, name, members, isChannel }) => {
      const creator = socketToUser.get(socket.id);
      const memberData = members.map(m => ({ username: m.username, status: m.username === creator ? "accepted" : "pending", encryptedGroupKey: m.encryptedGroupKey, iv: m.iv }));
      await Group.create({ groupId, name, admin: creator, isChannel, members: memberData });
      
      members.forEach(m => {
        if (m.username !== creator) {
          emitToUser(m.username, "group_invite", { groupId, name, createdBy: creator, isChannel });
        }
      });
    });

    socket.on("add_members_to_group", async ({ groupId, members }) => {
      const admin = socketToUser.get(socket.id);
      const group = await Group.findOne({ groupId });
      if (group && group.admin === admin) {
        members.forEach(m => {
          const existing = group.members.find(gm => gm.username === m.username);
          if (!existing || existing.status === "left") {
            if (existing) group.members = group.members.filter(gm => gm.username !== m.username);
            group.members.push({ username: m.username, status: "pending", encryptedGroupKey: m.encryptedGroupKey, iv: m.iv });
            emitToUser(m.username, "group_invite", { groupId, name: group.name, createdBy: admin, isChannel: group.isChannel });
          }
        });
        await group.save();
        io.emit("group_metadata_update", { groupId, members: group.members, isChannel: group.isChannel });
      }
    });

    socket.on("accept_group_invite", async ({ groupId }) => {
      const username = socketToUser.get(socket.id);
      const group = await Group.findOne({ groupId });
      if (group) {
        const member = group.members.find(m => m.username === username);
        if (member && member.status === "pending") {
          member.status = "accepted";
          await group.save();
          socket.emit("group_join_success", { groupId, name: group.name, admin: group.admin, isChannel: group.isChannel, members: group.members, encryptedGroupKey: member.encryptedGroupKey, iv: member.iv });
          io.emit("group_metadata_update", { groupId, members: group.members, isChannel: group.isChannel });
          
          const sysMsg = { id: Date.now().toString(), type: "group", to: groupId, isSystem: true, text: `${username} joined the group`, timestamp: Date.now(), from: "system" };
          await Message.create(sysMsg);
          
          group.members.forEach(m => {
            if (m.status === "accepted") {
              emitToUser(m.username, "receive_group_message", { ...sysMsg, groupId });
            }
          });
        }
      }
    });

    socket.on("reject_group_invite", async ({ groupId }) => {
      const username = socketToUser.get(socket.id);
      const group = await Group.findOne({ groupId });
      if (group) { 
         group.members = group.members.filter(m => m.username !== username); 
         await group.save(); 
      }
    });

    socket.on("leave_group", async ({ groupId }) => {
      const username = socketToUser.get(socket.id);
      const group = await Group.findOne({ groupId });
      if (group) {
        const member = group.members.find(m => m.username === username);
        if (!member || member.status === "left") return;
        member.status = "left"; 
        await group.save();
        socket.emit("removed_from_group", { groupId, left: true });
        io.emit("group_metadata_update", { groupId, members: group.members, isChannel: group.isChannel });

        const sysMsg = { id: Date.now().toString(), type: "group", to: groupId, isSystem: true, text: `${username} left the group`, timestamp: Date.now(), from: "system" };
        await Message.create(sysMsg);

        group.members.forEach(m => {
          if (m.status === "accepted") {
            emitToUser(m.username, "receive_group_message", { ...sysMsg, groupId });
          }
        });
      }
    });

    socket.on("delete_group", async ({ groupId }) => {
      const username = socketToUser.get(socket.id);
      const group = await Group.findOne({ groupId });
      if (group && group.admin === username) {
        group.isDeleted = true; 
        await group.save(); 
        io.emit("group_deleted", { groupId });
      }
    });

    // ==========================================
    // WEBRTC SIGNALING (CALLS)
    // ==========================================
    socket.on("call_user", ({ to, offer, isGroupCall, groupId, isVideo }) => {
      const from = socketToUser.get(socket.id);
      emitToUser(to, "incoming_call", { from, offer, isGroupCall, groupId, isVideo });
    });

    socket.on("call_accepted", ({ to, answer }) => {
      const from = socketToUser.get(socket.id);
      emitToUser(to, "call_accepted", { from, answer });
    });

    socket.on("call_rejected", ({ to }) => {
      const from = socketToUser.get(socket.id);
      emitToUser(to, "call_rejected", { from });
    });
    
    socket.on("call_ended", ({ to }) => {
      const from = socketToUser.get(socket.id);
      emitToUser(to, "call_ended", { from });
    });

    socket.on("webrtc_ice_candidate", ({ to, candidate }) => {
      const from = socketToUser.get(socket.id);
      emitToUser(to, "webrtc_ice_candidate", { from, candidate });
    });

    socket.on("group_call_invite", async ({ groupId, offer, isVideo }) => {
      const from = socketToUser.get(socket.id);
      const group = await Group.findOne({ groupId });
      if (group) {
        group.members.forEach(m => {
          if (m.username !== from && m.status === "accepted") {
            emitToUser(m.username, "incoming_call", { from, offer, isGroupCall: true, groupId, isVideo });
          }
        });
      }
    });

    socket.on("disconnect", async () => {
      console.log(`Client disconnected: ${socket.id}`);
      const username = socketToUser.get(socket.id);
      if (username) { 
        const sockets = activeUsers.get(username);
        if (sockets) {
           sockets.delete(socket.id);
           if (sockets.size === 0) {
              activeUsers.delete(username);
              await User.updateOne({ username }, { $set: { "presence.online": false, "presence.lastSeen": Date.now() } }, { strict: false });
              io.emit("presence_update", { username, online: false, lastSeen: Date.now() });
           }
        }
        socketToUser.delete(socket.id);
      }
    });
  });

  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`> Server listening at http://0.0.0.0:${port} as ${dev ? "development" : process.env.NODE_ENV}`);
  });
});
