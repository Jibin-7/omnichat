"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { Send, Search, MessageSquare, Users, Settings, Plus, Lock, UsersRound, Check, X, Info, UserPlus, Trash2, Phone, Video, PhoneOff, LogOut, Megaphone, CheckCheck, Paperclip, Smile, Smartphone, Key, ArrowLeft, Shield, ChevronDown, Copy, CornerUpLeft, UserCheck, UserMinus, UserX, Mic, Square, Edit2, Play, Pause, FileText, Download, Camera, User, Timer, Ghost } from "lucide-react";
import { 
  generateKeyPair, exportPublicKey, importPublicKey, deriveSecretKey, encryptMessage, decryptMessage,
  generateGroupKey, exportGroupKey, importGroupKey, deriveBackupKey, exportEncryptedPrivateKey, importEncryptedPrivateKey,
  exportPrivateKey, importPrivateKey
} from "../lib/crypto";

type User = { username: string; publicKey: string; avatar?: string; bio?: string; online?: boolean; lastSeen?: number | null; vanishMode?: boolean };
type GroupMember = { username: string; status: "pending" | "accepted" | "left" };
type Group = { id: string; name: string; isGroup: true; isChannel?: boolean; admin: string; isDeleted?: boolean; hasLeft?: boolean };
type PendingInvite = { groupId: string; name: string; createdBy: string; isChannel?: boolean };
type ChatMessage = { id: string; text: string; image?: string; audio?: string; file?: { name: string, data: string, size: number }; sender: "me" | "them" | "system" | string; isSystem?: boolean; timestamp: number; read?: boolean; reaction?: string; reactionBy?: string; isDeleted?: boolean; isEdited?: boolean; replyTo?: string; isVanishMode?: boolean };

type CallState = {
  isActive: boolean;
  isReceiving: boolean;
  isGroupCall: boolean;
  groupId?: string;
  caller?: string;
  remoteUsers: string[];
  isVideo: boolean;
};

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const WALLPAPERS = [
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1080&auto=format&fit=crop", // Vibrant liquid gradient
  "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1080&auto=format&fit=crop", // Dark minimal wireframe liquid
  "https://images.unsplash.com/photo-1614850715649-1d0106293bd1?q=80&w=1080&auto=format&fit=crop", // Abstract 3D waves
  "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=1080&auto=format&fit=crop", // Purple flow gradient
  "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=1080&auto=format&fit=crop", // Sunset gradient
  "https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?q=80&w=1080&auto=format&fit=crop", // Dark moody forest
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1080&auto=format&fit=crop", // Night sky mountains
  "none"
];

function VideoPlayer({ stream, isLocal = false }: { stream: MediaStream | null, isLocal?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (videoRef.current && stream) videoRef.current.srcObject = stream; }, [stream]);
  if (!stream) return null;
  return <video ref={videoRef} autoPlay playsInline muted={isLocal} style={{ width: "100%", height: "100%", objectFit: "cover", transform: isLocal ? "scaleX(-1)" : "none" }} />;
}

function AudioPlayer({ stream }: { stream: MediaStream | null }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => { if (audioRef.current && stream) audioRef.current.srcObject = stream; }, [stream]);
  if (!stream) return null;
  return <audio ref={audioRef} autoPlay />;
}

function VoiceMessagePlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100 || 0);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const time = (Number(e.target.value) / 100) * audioRef.current.duration;
      audioRef.current.currentTime = time;
      setProgress(Number(e.target.value));
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: 'var(--radius-full)', width: '250px', maxWidth: '100%', boxSizing: 'border-box', marginBottom: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
      <button onClick={togglePlay} style={{ background: 'var(--primary-color)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer', flexShrink: 0 }}>
        {isPlaying ? <Pause size={16} fill='currentColor' /> : <Play size={16} fill='currentColor' style={{ marginLeft: '2px' }} />}
      </button>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <input type='range' min='0' max='100' value={progress} onChange={handleSeek} style={{ width: '100%', height: '4px', accentColor: 'var(--primary-color)', cursor: 'pointer' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
          <span>{formatTime(audioRef.current?.currentTime || 0)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
      <audio ref={audioRef} src={src} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} onEnded={() => { setIsPlaying(false); setProgress(0); }} style={{ display: 'none' }} />
    </div>
  );
}

const playNotificationSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) {}
};

const triggerWebNotification = (title: string, body: string) => {
  if (document.visibilityState === "visible") return;
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: "https://cdn-icons-png.flaticon.com/512/1041/1041916.png" });
    playNotificationSound();
  }
};

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [detailsTab, setDetailsTab] = useState<"info" | "media">("info");
  const [hiddenChats, setHiddenChats] = useState<string[]>([]);
  const usersRef = useRef<User[]>([]);
  
  const hideChatLocally = (chatId: string) => {
    setHiddenChats(prev => {
      if (prev.includes(chatId)) return prev;
      const next = [...prev, chatId];
      if (myUsername.current) localStorage.setItem(`omnichat_hidden_${myUsername.current}`, JSON.stringify(next));
      return next;
    });
  };
  
  const unhideChatLocally = (chatId: string) => {
    setHiddenChats(prev => {
      if (!prev.includes(chatId)) return prev;
      const next = prev.filter(id => id !== chatId);
      if (myUsername.current) localStorage.setItem(`omnichat_hidden_${myUsername.current}`, JSON.stringify(next));
      return next;
    });
  };

  const [profileBio, setProfileBio] = useState("");
  const [isEditingBio, setIsEditingBio] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<"chats" | "friends" | "notifications">("chats");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [showChatContextMenuFor, setShowChatContextMenuFor] = useState<string | null>(null);
  
  // Auth State
  const [isRegistered, setIsRegistered] = useState(false);
  const [authStep, setAuthStep] = useState<"phone" | "pin">("phone");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [username, setUsername] = useState("");
  const [authError, setAuthError] = useState("");
  
  // App State
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [groupMembersMap, setGroupMembersMap] = useState<Record<string, GroupMember[]>>({});
  const [friends, setFriends] = useState<string[]>([]);
  const [friendRequests, setFriendRequests] = useState<string[]>([]);
  const [sentRequests, setSentRequests] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [wallpaper, setWallpaper] = useState(WALLPAPERS[0]);
  
  const [activeChat, setActiveChat] = useState<User | Group | null>(null);
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>({});
  const [input, setInput] = useState("");
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [presence, setPresence] = useState<Record<string, { online: boolean, lastSeen: number }>>({});
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Voice Notes
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  
  // Editing
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  
  // UI Modals
  const [showDetails, setShowDetails] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [selectedNewMembers, setSelectedNewMembers] = useState<string[]>([]);
  const [vanishModes, setVanishModes] = useState<Record<string, boolean>>({});
  
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [showReactionsFor, setShowReactionsFor] = useState<string | null>(null);
  const [showContextMenuFor, setShowContextMenuFor] = useState<string | null>(null);
  
  // Settings UI
  const [showUpdatePin, setShowUpdatePin] = useState(false);
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [pinUpdateStatus, setPinUpdateStatus] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Crypto Refs
  const keyPairRef = useRef<CryptoKeyPair | null>(null);
  const sharedSecretsRef = useRef<Record<string, CryptoKey>>({});
  const groupKeysRef = useRef<Record<string, CryptoKey>>({});
  const activeChatIdRef = useRef<string | null>(null);

  // WebRTC
  const [callState, setCallState] = useState<CallState>({ isActive: false, isReceiving: false, isGroupCall: false, remoteUsers: [], isVideo: false });
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const myUsername = useRef<string>("");

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth <= 768);
    handleResize(); window.addEventListener("resize", handleResize);
    const savedBg = localStorage.getItem("omnichat_bg"); if (savedBg) setWallpaper(savedBg);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => { activeChatIdRef.current = activeChat ? ("isGroup" in activeChat ? activeChat.id : activeChat.username) : null; }, [activeChat]);

  // Connect & Auto-Login
  useEffect(() => {
    const socketInstance = io(process.env.NEXT_PUBLIC_API_URL || undefined);
    socketInstance.on("connect", () => {
      setIsConnected(true);
      const cached = localStorage.getItem("omnichat_identity");
      if (cached) {
        try {
           const id = JSON.parse(cached);
           myUsername.current = id.username;
           setUsername(id.username); setPhone(id.phone);
           importPrivateKey(id.privStr).then(priv => {
              importPublicKey(id.pubStr).then(pub => {
                 keyPairRef.current = { privateKey: priv, publicKey: pub };
                 socketInstance.emit("auth_success", { username: id.username, publicKey: id.pubStr });
                 setIsRegistered(true);
                 if ("Notification" in window) Notification.requestPermission();
                 try { const hidden = localStorage.getItem(`omnichat_hidden_${id.username}`); if (hidden) setHiddenChats(JSON.parse(hidden)); } catch(e){}
              });
           });
        } catch (e) { localStorage.removeItem("omnichat_identity"); }
      }
    });
    
    socketInstance.on("disconnect", () => setIsConnected(false));
    socketInstance.on("users_update", (updatedUsers: User[]) => { setUsers(updatedUsers); usersRef.current = updatedUsers; });
    setSocket(socketInstance);
    return () => { socketInstance.disconnect(); };
  }, []);



  // ----------------------------------------------------
  // AUTHENTICATION LOGIC
  // ----------------------------------------------------
  useEffect(() => {
    if (!socket) return;
    socket.on("register_error", (message: string) => { setAuthError(message); setAuthStep("phone"); });
    socket.on("register_success", async () => {
      if (!keyPairRef.current) return;
      const pubStr = await exportPublicKey(keyPairRef.current.publicKey);
      const privStr = await exportPrivateKey(keyPairRef.current.privateKey);
      localStorage.setItem("omnichat_identity", JSON.stringify({ username, phone, pubStr, privStr }));
      myUsername.current = username;
      socket.emit("auth_success", { username, publicKey: pubStr });
      setIsRegistered(true);
      if ("Notification" in window) Notification.requestPermission();
      try { const hidden = localStorage.getItem(`omnichat_hidden_${username}`); if (hidden) setHiddenChats(JSON.parse(hidden)); } catch(e){}
    });

    socket.on("login_error", (message: string) => { setAuthError(message); setAuthStep("phone"); });
    socket.on("login_success", async ({ encryptedPrivateKey, iv, username: uname }) => {
      try {
        const backupKey = await deriveBackupKey(pin, phone);
        const privateKey = await importEncryptedPrivateKey(encryptedPrivateKey, iv, backupKey);
        const newKeys = await generateKeyPair();
        keyPairRef.current = { privateKey, publicKey: newKeys.publicKey }; 
        const pubStr = await exportPublicKey(newKeys.publicKey);
        const privStr = await exportPrivateKey(privateKey);
        
        localStorage.setItem("omnichat_identity", JSON.stringify({ username: uname, phone, pubStr, privStr }));
        myUsername.current = uname;
        setUsername(uname);
        
        socket.emit("auth_success", { username: uname, publicKey: pubStr });
        setIsRegistered(true);
        if ("Notification" in window) Notification.requestPermission();
        try { const hidden = localStorage.getItem(`omnichat_hidden_${uname}`); if (hidden) setHiddenChats(JSON.parse(hidden)); } catch(e){}
      } catch (e) { setAuthError("Incorrect PIN."); setAuthStep("pin"); }
    });

    return () => { socket.off("register_error"); socket.off("register_success"); socket.off("login_error"); socket.off("login_success"); };
  }, [socket, username, phone, pin]);

  const proceedToPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !socket) return;
    if (authMode === "register" && !username) return setAuthError("Username required.");
    setAuthStep("pin");
  };

  const handleFinalAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (!socket || !phone || pin.length !== 5) return setAuthError("PIN must be 5 digits.");
    
    if (authMode === "register") {
      const keys = await generateKeyPair();
      keyPairRef.current = keys;
      const pubStr = await exportPublicKey(keys.publicKey);
      const backupKey = await deriveBackupKey(pin, phone);
      const { encrypted, iv } = await exportEncryptedPrivateKey(keys.privateKey, backupKey);
      const digestBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
      const pinHash = Array.from(new Uint8Array(digestBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      socket.emit("register", { phone, username, pinHash, publicKey: pubStr, encryptedPrivateKey: encrypted, iv });
    } else {
      socket.emit("login", { phone });
    }
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (oldPin.length !== 5 || newPin.length !== 5 || !socket || !keyPairRef.current) return setPinUpdateStatus("PINs must be 5 digits.");
    try {
      // Re-derive backup key to prove they know the old PIN? Actually, since they are logged in, we trust they own the session.
      // We just encrypt their current PrivateKey with the NEW PIN.
      const backupKey = await deriveBackupKey(newPin, phone);
      const { encrypted, iv } = await exportEncryptedPrivateKey(keyPairRef.current.privateKey, backupKey);
      const digestBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(newPin));
      const pinHash = Array.from(new Uint8Array(digestBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      socket.emit("update_pin", { phone, pinHash, encryptedPrivateKey: encrypted, iv });
      setPinUpdateStatus("PIN Updated Successfully!");
      setTimeout(() => setShowUpdatePin(false), 2000);
    } catch(e) { setPinUpdateStatus("Error updating PIN."); }
  };

  const handleLogout = () => { localStorage.removeItem("omnichat_identity"); window.location.reload(); };

  // ----------------------------------------------------
  // MESSAGING & SYNCING
  // ----------------------------------------------------
  useEffect(() => {
    if (!socket) return;
    const decryptPayload = async (ciphertext: string, iv: string, secretKey: CryptoKey) => {
       const decrypted = await decryptMessage(ciphertext, iv, secretKey);
       let text = decrypted; let image = undefined; let audio = undefined; let file = undefined;
       try { const parsed = JSON.parse(decrypted); if (parsed.text !== undefined) text = parsed.text; if (parsed.image) image = parsed.image; if (parsed.audio) audio = parsed.audio; if (parsed.file) file = parsed.file; } catch(e){}
       return { text, image, audio, file };
    };

    const deriveShared = async (otherUser: string) => {
       try {
          if (sharedSecretsRef.current[otherUser]) return sharedSecretsRef.current[otherUser];
          const userObj = usersRef.current.find(u => u.username === otherUser);
          if (!userObj || !keyPairRef.current || !userObj.publicKey) return null;
          const theirPubKey = await importPublicKey(userObj.publicKey);
          const secret = await deriveSecretKey(keyPairRef.current.privateKey, theirPubKey);
          sharedSecretsRef.current[otherUser] = secret;
          return secret;
       } catch (e) {
          console.error("Failed to derive shared secret for", otherUser, e);
          return null;
       }
    };

    socket.on("sync_groups", async (syncedGroups: any[]) => {
       const loadedGroups: Group[] = [];
       const loadedMembers: Record<string, GroupMember[]> = {};
       for (const g of syncedGroups) {
          try {
             loadedGroups.push({ id: g.groupId, name: g.name, isGroup: true, isChannel: g.isChannel, admin: g.admin, isDeleted: g.isDeleted, hasLeft: g.status === "left" });
             loadedMembers[g.groupId] = g.members;
             if (g.status === "accepted" && !g.isDeleted && g.encryptedGroupKey) {
                const secret = await deriveShared(g.admin);
                if (secret) {
                   const groupKeyBase64 = await decryptMessage(g.encryptedGroupKey, g.iv, secret);
                   if (groupKeyBase64 && !groupKeyBase64.includes("[Encrypted Message")) {
                      groupKeysRef.current[g.groupId] = await importGroupKey(groupKeyBase64);
                   }
                }
             }
          } catch(e) { console.error("Error syncing group", g.groupId, e); }
       }
       setGroups(loadedGroups); setGroupMembersMap(loadedMembers);
    });

    socket.on("sync_friends", ({ friends: fList, requests, sent }) => {
       setFriends(fList || []); setFriendRequests(requests || []); setSentRequests(sent || []);
    });

    socket.on("chat_history", async (history: any[]) => {
       await new Promise(resolve => setTimeout(resolve, 500));
       const newChats: Record<string, ChatMessage[]> = {};
       for (const msg of history) {
          try {
             if (msg.isDeleted) continue;
             if (msg.type === "1on1") {
                const otherUser = msg.from === myUsername.current ? msg.to : msg.from;
                const secret = await deriveShared(otherUser);
                if (secret) {
                   const { text, image, audio, file } = await decryptPayload(msg.ciphertext, msg.iv, secret);
                   if (!newChats[otherUser]) newChats[otherUser] = [];
                   newChats[otherUser].push({ id: msg.id, text, image, audio: audio || msg.audio, file: file || msg.file, sender: msg.from === myUsername.current ? "me" : msg.from, timestamp: msg.timestamp, read: msg.read, reaction: msg.reaction, reactionBy: msg.reactionBy, isDeleted: msg.isDeleted, isEdited: msg.isEdited, replyTo: msg.replyTo, isVanishMode: msg.isVanishMode });
                }
             } else {
                if (msg.isSystem) {
                   if (!newChats[msg.groupId]) newChats[msg.groupId] = [];
                   newChats[msg.groupId].push({ id: msg.id, text: msg.text, sender: "system", isSystem: true, timestamp: msg.timestamp });
                   continue;
                }
                const groupKey = groupKeysRef.current[msg.groupId];
                if (groupKey) {
                   const { text, image, audio, file } = await decryptPayload(msg.ciphertext, msg.iv, groupKey);
                   if (!newChats[msg.groupId]) newChats[msg.groupId] = [];
                   newChats[msg.groupId].push({ id: msg.id, text, image, audio: audio || msg.audio, file: file || msg.file, sender: msg.from === myUsername.current ? "me" : msg.from, timestamp: msg.timestamp, reaction: msg.reaction, reactionBy: msg.reactionBy, isDeleted: msg.isDeleted, isEdited: msg.isEdited, replyTo: msg.replyTo });
                }
             }
          } catch(e) { console.error("Error parsing msg", msg.id, e); }
       }
       setChats(newChats);
    });

    const handleReceiveMessage = async (msg: any) => {
      try {
        const otherUser = msg.from;
        const secret = await deriveShared(otherUser);
        if (secret) {
          const { text, image, audio, file } = await decryptPayload(msg.ciphertext, msg.iv, secret);
          setChats(prev => ({ ...prev, [otherUser]: [...(prev[otherUser] || []), { id: msg.id, text, image, audio: audio || msg.audio, file: file || msg.file, sender: otherUser, timestamp: msg.timestamp, reaction: msg.reaction, reactionBy: msg.reactionBy, isDeleted: msg.isDeleted, isEdited: msg.isEdited, replyTo: msg.replyTo, isVanishMode: msg.isVanishMode }] }));
          unhideChatLocally(otherUser);
          if (activeChatIdRef.current === otherUser && document.visibilityState === "visible") {
             socket.emit("messages_read", { to: otherUser });
          }
          setUnreadCounts(prev => {
            if (activeChatIdRef.current === otherUser && document.visibilityState === "visible") return prev;
            triggerWebNotification(`Message from ${otherUser}`, text || (image ? "Sent an image" : (audio ? "Sent a voice note" : "Sent an attachment")));
            return { ...prev, [otherUser]: (prev[otherUser] || 0) + 1 };
          });
        }
      } catch(e) { console.error("Error in handleReceiveMessage", e); }
    };

    const handleReceiveGroupMessage = async (msg: any) => {
      try {
        if (msg.isSystem) {
          setChats(prev => ({ ...prev, [msg.groupId]: [...(prev[msg.groupId] || []), { id: msg.id, text: msg.text, sender: "system", isSystem: true, timestamp: msg.timestamp }] }));
          return;
        }
        const groupKey = groupKeysRef.current[msg.groupId];
        if (groupKey) {
          const { text, image, audio, file } = await decryptPayload(msg.ciphertext, msg.iv, groupKey);
          setChats(prev => ({ ...prev, [msg.groupId]: [...(prev[msg.groupId] || []), { id: msg.id, text, image, audio: audio || msg.audio, file: file || msg.file, sender: msg.from === myUsername.current ? "me" : msg.from, timestamp: msg.timestamp, reaction: msg.reaction, reactionBy: msg.reactionBy, isDeleted: msg.isDeleted, isEdited: msg.isEdited, replyTo: msg.replyTo }] }));
          unhideChatLocally(msg.groupId);
          setUnreadCounts(prev => {
            if (activeChatIdRef.current === msg.groupId && document.visibilityState === "visible") return prev;
            triggerWebNotification(`Group message from ${msg.from}`, text || (image ? "Sent an image" : (audio ? "Sent a voice note" : "Sent an attachment")));
            return { ...prev, [msg.groupId]: (prev[msg.groupId] || 0) + 1 };
          });
        } else {
          console.error("CRITICAL ERROR: groupKey is missing in handleReceiveGroupMessage! msg.groupId: " + msg.groupId);
        }
      } catch(e) { console.error("Error in handleReceiveGroupMessage", e); }
    };

    const handleMessageDeleted = (data: { messageId: string, chatId: string, isVanishMode?: boolean }) => {
       if (data.isVanishMode) {
          setChats(prev => ({ ...prev, [data.chatId]: (prev[data.chatId] || []).filter(m => m.id !== data.messageId) }));
       } else {
          setChats(prev => ({ ...prev, [data.chatId]: (prev[data.chatId] || []).map(m => m.id === data.messageId ? { ...m, isDeleted: true, text: "", image: "" } : m) }));
       }
    };
    socket.off("message_deleted"); socket.on("message_deleted", handleMessageDeleted);

    const handleMessageEdited = async (data: { messageId: string, chatId: string, newCiphertext: string, newIv: string }) => {
       const groupKey = groupKeysRef.current[data.chatId];
       let text = "", image = "";
       if (groupKey) {
          const decrypted = await decryptPayload(data.newCiphertext, data.newIv, groupKey); text = decrypted.text; image = decrypted.image || "";
       } else {
          const userObj = usersRef.current.find(u => u.username === data.chatId);
          if (userObj) {
             const theirPubKey = await importPublicKey(userObj.publicKey);
             const secret = await deriveSecretKey(keyPairRef.current!.privateKey, theirPubKey);
             if (secret) { const decrypted = await decryptPayload(data.newCiphertext, data.newIv, secret); text = decrypted.text; image = decrypted.image || ""; }
          }
       }
       setChats(prev => ({ ...prev, [data.chatId]: (prev[data.chatId] || []).map(m => m.id === data.messageId ? { ...m, text, image, isEdited: true } : m) }));
    };
    socket.off("message_edited"); socket.on("message_edited", handleMessageEdited);

    socket.on("friend_request_received", () => {
       // Refresh list via request or we already get sync_friends
    });

    const handleMessagesRead = (data: { by: string }) => setChats(prev => ({ ...prev, [data.by]: (prev[data.by] || []).map(m => m.sender === "me" ? { ...m, read: true } : m) }));
    const handleMessageReaction = (data: { chatId: string, messageId: string, reaction: string, reactionBy: string }) => setChats(prev => ({ ...prev, [data.chatId]: (prev[data.chatId] || []).map(m => m.id === data.messageId ? { ...m, reaction: data.reaction, reactionBy: data.reactionBy } : m) }));
    const handleGroupMessageReaction = (data: { groupId: string, messageId: string, reaction: string, reactionBy: string }) => setChats(prev => ({ ...prev, [data.groupId]: (prev[data.groupId] || []).map(m => m.id === data.messageId ? { ...m, reaction: data.reaction, reactionBy: data.reactionBy } : m) }));
    const handleChatCleared = (data: { chatId: string }) => setChats(prev => { const next = { ...prev }; delete next[data.chatId]; return next; });

    socket.on("sync_vanish_modes", (modes: Record<string, boolean>) => {
       setVanishModes(modes);
    });
    
    socket.on("vanish_mode_update", (data: { chatId: string, vanishMode: boolean }) => {
       setVanishModes(prev => ({ ...prev, [data.chatId]: data.vanishMode }));
    });

    const handleInitialPresence = (data: any) => setPresence(data);
    const handlePresenceUpdate = (data: { username: string, online: boolean, lastSeen: number }) => setPresence(prev => ({ ...prev, [data.username]: { online: data.online, lastSeen: data.lastSeen } }));
    const handleTyping = (data: { from: string, chatId: string }) => setTypingUsers(prev => ({ ...prev, [data.chatId]: [...new Set([...(prev[data.chatId] || []), data.from])] }));
    const handleStopTyping = (data: { from: string, chatId: string }) => setTypingUsers(prev => ({ ...prev, [data.chatId]: (prev[data.chatId] || []).filter(u => u !== data.from) }));

    const handleGroupInvite = (data: PendingInvite) => setPendingInvites(prev => [...prev, data]);
    const handleGroupJoinSuccess = async (data: any) => {
      const secret = await deriveShared(data.admin);
      if (secret) {
        const groupKeyBase64 = await decryptMessage(data.encryptedGroupKey, data.iv, secret);
        if (groupKeyBase64.includes("Decryption Failed")) {
           alert("CRITICAL ERROR: Failed to decrypt group key in handleGroupJoinSuccess!");
           return;
        }
        groupKeysRef.current[data.groupId] = await importGroupKey(groupKeyBase64);
        setGroups(prev => {
           const idx = prev.findIndex(g => g.id === data.groupId);
           if (idx > -1) {
              const updated = [...prev];
              updated[idx] = { id: data.groupId, name: data.name, isGroup: true, isChannel: data.isChannel, admin: data.admin, hasLeft: false };
              return updated;
           }
           return [...prev, { id: data.groupId, name: data.name, isGroup: true, isChannel: data.isChannel, admin: data.admin, hasLeft: false }];
        });
        setGroupMembersMap(prev => ({ ...prev, [data.groupId]: data.members }));
      } else {
        alert("CRITICAL ERROR: Failed to derive secret in handleGroupJoinSuccess!");
      }
    };
    const handleGroupMetadataUpdate = (data: any) => setGroupMembersMap(prev => ({ ...prev, [data.groupId]: data.members }));
    const handleRemovedFromGroup = (data: any) => setGroups(prev => prev.map(g => g.id === data.groupId ? { ...g, hasLeft: true } : g));
    const handleGroupDeleted = (data: any) => setGroups(prev => prev.map(g => g.id === data.groupId ? { ...g, isDeleted: true } : g));

    socket.off("initial_presence"); socket.on("initial_presence", handleInitialPresence);
    socket.off("presence_update"); socket.on("presence_update", handlePresenceUpdate);
    socket.off("typing"); socket.on("typing", handleTyping);
    socket.off("stop_typing"); socket.on("stop_typing", handleStopTyping);
    
    socket.off("receive_message"); socket.on("receive_message", handleReceiveMessage);
    socket.off("receive_group_message"); socket.on("receive_group_message", handleReceiveGroupMessage);
    socket.off("messages_read");    socket.on("messages_read", handleMessagesRead);
    socket.on("message_reaction", handleMessageReaction);
    socket.on("group_message_reaction", handleGroupMessageReaction);
    socket.on("chat_cleared", handleChatCleared);
    socket.off("group_message_reaction"); socket.on("group_message_reaction", handleGroupMessageReaction);
    socket.off("group_invite"); socket.on("group_invite", handleGroupInvite);
    socket.off("group_join_success"); socket.on("group_join_success", handleGroupJoinSuccess);
    socket.off("group_metadata_update"); socket.on("group_metadata_update", handleGroupMetadataUpdate);
    socket.off("removed_from_group"); socket.on("removed_from_group", handleRemovedFromGroup);
    socket.off("group_deleted"); socket.on("group_deleted", handleGroupDeleted);
  }, [socket]);

  // ----------------------------------------------------
  // WEBRTC SIGNALING (Voice Audio Fixed)
  // ----------------------------------------------------
  useEffect(() => {
    if (!socket) return;
    socket.on("incoming_call", async ({ from, offer, isGroupCall, groupId, isVideo }) => {
      setCallState(prev => {
        if (!prev.isActive) {
          triggerWebNotification(`Incoming ${isVideo ? 'Video ' : ''}Call`, `Incoming call from ${from}`);
          (window as any).pendingOffers = { [from]: offer };
          return { isActive: false, isReceiving: true, isGroupCall, groupId, caller: from, remoteUsers: [from], isVideo };
        } else {
          if (prev.isGroupCall && prev.groupId === groupId) { handleIncomingMeshOffer(from, offer); return { ...prev, remoteUsers: [...new Set([...prev.remoteUsers, from])] }; }
          return prev;
        }
      });
    });
    socket.on("call_accepted", async ({ from, answer }) => { const pc = peerConnectionsRef.current[from]; if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer)); });
    socket.on("webrtc_ice_candidate", async ({ from, candidate }) => { const pc = peerConnectionsRef.current[from]; if (pc) { try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) { } } });
    socket.on("call_rejected", ({ from }) => { if (!callState.isGroupCall) clearCallState(); else removeRemoteUser(from); });
    socket.on("call_ended", ({ from }) => { if (!callState.isGroupCall) clearCallState(); else removeRemoteUser(from); });
    return () => { socket.off("incoming_call"); socket.off("call_accepted"); socket.off("webrtc_ice_candidate"); socket.off("call_rejected"); socket.off("call_ended"); };
  }, [socket, callState]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (activeChatIdRef.current && socket) {
         socket.emit("chat_closed", { chatId: activeChatIdRef.current });
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [socket]);

  const removeRemoteUser = (from: string) => {
    const pc = peerConnectionsRef.current[from];
    if (pc) pc.close();
    delete peerConnectionsRef.current[from];
    setRemoteStreams(prev => { const next = {...prev}; delete next[from]; return next; });
    setCallState(prev => {
       const nextUsers = prev.remoteUsers.filter(u => u !== from);
       if (nextUsers.length === 0) { clearCallState(); return prev; }
       return { ...prev, remoteUsers: nextUsers };
    });
  };

  const clearCallState = () => {
    if (localStream) { localStream.getTracks().forEach(track => track.stop()); setLocalStream(null); }
    Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    peerConnectionsRef.current = {}; setRemoteStreams({});
    setCallState({ isActive: false, isReceiving: false, isGroupCall: false, remoteUsers: [], isVideo: false });
    (window as any).pendingOffers = null;
  };

  const initLocalStream = async (isVideo: boolean) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: isVideo, 
        audio: true 
      });
      setLocalStream(stream); return stream; } 
    catch(e) { console.error("Media Error", e); return null; }
  };

  const createPeerConnection = (targetUser: string, myStream: MediaStream) => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    pc.onicecandidate = (event) => { if (event.candidate && socket) socket.emit("webrtc_ice_candidate", { to: targetUser, candidate: event.candidate }); };
    pc.ontrack = (event) => { if (event.streams[0]) setRemoteStreams(prev => ({ ...prev, [targetUser]: event.streams[0] })); };
    myStream.getTracks().forEach(track => pc.addTrack(track, myStream));
    peerConnectionsRef.current[targetUser] = pc;
    return pc;
  };

  const handleIncomingMeshOffer = async (from: string, offer: any) => {
    if (!localStream) return;
    const pc = createPeerConnection(from, localStream);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    if (socket) socket.emit("call_accepted", { to: from, answer });
  };

  const startCall = async (isVideo: boolean) => {
    if (!activeChat || !socket) return;
    const stream = await initLocalStream(isVideo);
    if (!stream) return;
    if ("isGroup" in activeChat) {
       setCallState({ isActive: true, isReceiving: false, isGroupCall: true, groupId: activeChat.id, remoteUsers: [], isVideo });
       const members = groupMembersMap[activeChat.id] || [];
       members.forEach(async m => {
          if (m.username !== myUsername.current && m.status === "accepted") {
             const pc = createPeerConnection(m.username, stream);
             const offer = await pc.createOffer();
             await pc.setLocalDescription(offer);
             socket.emit("call_user", { to: m.username, offer, isGroupCall: true, groupId: activeChat.id, isVideo });
             setCallState(prev => ({ ...prev, remoteUsers: [...prev.remoteUsers, m.username] }));
          }
       });
    } else {
       setCallState({ isActive: true, isReceiving: false, isGroupCall: false, remoteUsers: [activeChat.username], isVideo });
       const pc = createPeerConnection(activeChat.username, stream);
       const offer = await pc.createOffer();
       await pc.setLocalDescription(offer);
       socket.emit("call_user", { to: activeChat.username, offer, isGroupCall: false, isVideo });
    }
  };

  const acceptCall = async () => {
    const stream = await initLocalStream(callState.isVideo);
    if (!stream) return;
    setCallState(prev => ({ ...prev, isActive: true, isReceiving: false }));
    const offers = (window as any).pendingOffers || {};
    for (const [from, offer] of Object.entries(offers)) {
       const pc = createPeerConnection(from, stream);
       await pc.setRemoteDescription(new RTCSessionDescription(offer as any));
       const answer = await pc.createAnswer();
       await pc.setLocalDescription(answer);
       if (socket) socket.emit("call_accepted", { to: from, answer });
    }
  };

  const rejectCall = () => { if (socket && callState.caller) socket.emit("call_rejected", { to: callState.caller }); clearCallState(); };
  const endCall = () => { if (socket) callState.remoteUsers.forEach(u => socket.emit("call_ended", { to: u })); clearCallState(); };

  // ----------------------------------------------------
  // MESSAGE INTERACTIONS
  // ----------------------------------------------------
  const handleSelectChat = async (chatTarget: User | Group | null) => {
    if (activeChat && !("isGroup" in activeChat) && socket) {
       socket.emit("chat_closed", { chatId: activeChat.username });
    }
    setActiveChat(chatTarget); setShowDetails(false); setShowSettings(false); setReplyingTo(null);
    if (!chatTarget) return;
    const chatId = "isGroup" in chatTarget ? chatTarget.id : chatTarget.username;
    setUnreadCounts(prev => ({ ...prev, [chatId]: 0 }));
    if (!("isGroup" in chatTarget) && socket) {
      socket.emit("messages_read", { to: chatTarget.username });
      setChats(prev => {
         const newChats = { ...prev };
         if (newChats[chatId]) {
            newChats[chatId] = newChats[chatId].map(m => {
               if (!m.read && m.sender !== "me") {
                  return { ...m, read: true };
               }
               return m;
            });
         }
         return newChats;
      });
    }
  };

  const sendPayload = async (text: string, base64Image?: string, audio?: string, file?: { name: string, data: string, size: number }) => {
    if (!activeChat || !socket) return;
    const chatId = "isGroup" in activeChat ? activeChat.id : activeChat.username;
    const msgId = Date.now().toString();
    const isVanishMode = !("isGroup" in activeChat) ? vanishModes[activeChat.username] : undefined;
    const newMsg: ChatMessage = { id: msgId, text, image: base64Image, audio, file, sender: "me", timestamp: Date.now(), read: false, replyTo: replyingTo || undefined, isVanishMode };
    setChats(prev => ({ ...prev, [chatId]: [...(prev[chatId] || []), newMsg] }));
    const payload = JSON.stringify({ text, image: base64Image, audio, file });
    const replyContext = replyingTo;
    setReplyingTo(null);
    if ("isGroup" in activeChat) {
      const groupKey = groupKeysRef.current[activeChat.id];
      if (groupKey) {
        const { ciphertext, iv } = await encryptMessage(payload, groupKey);
        socket.emit("send_group_message", { id: msgId, groupId: activeChat.id, ciphertext, iv, replyTo: replyContext });
      } else {
        alert("CRITICAL ERROR: groupKey is missing in sendPayload! activeChat.id: " + activeChat.id);
      }
    } else {
      const secret = await deriveSecretKey(keyPairRef.current!.privateKey, await importPublicKey(activeChat.publicKey));
      const { ciphertext, iv } = await encryptMessage(payload, secret);
      const isVanishMode = vanishModes[activeChat.username];
      socket.emit("send_message", { id: msgId, to: activeChat.username, ciphertext, iv, replyTo: replyContext, isVanishMode });
    }
  };

  const handleSend = async (e?: React.FormEvent) => { if(e) e.preventDefault(); if ((!input.trim() && !isRecording) || !activeChat || !socket) return; if ("isGroup" in activeChat && (activeChat.isDeleted || activeChat.hasLeft)) return; 
    if (editingMsgId) {
      const textToSend = input;
      setInput(""); setEditingMsgId(null);
      const payload = JSON.stringify({ text: textToSend });
      const chatId = "isGroup" in activeChat ? activeChat.id : activeChat.username;
      setChats(prev => ({ ...prev, [chatId]: (prev[chatId] || []).map(m => m.id === editingMsgId ? { ...m, text: textToSend, isEdited: true } : m) }));
      let ciphertext, iv;
      if ("isGroup" in activeChat) {
         const groupKey = groupKeysRef.current[activeChat.id];
         const enc = await encryptMessage(payload, groupKey); ciphertext = enc.ciphertext; iv = enc.iv;
      } else {
         const secret = await deriveSecretKey(keyPairRef.current!.privateKey, await importPublicKey(activeChat.publicKey));
         const enc = await encryptMessage(payload, secret); ciphertext = enc.ciphertext; iv = enc.iv;
      }
      socket.emit("edit_message", { messageId: editingMsgId, newCiphertext: ciphertext, newIv: iv });
      return;
    }
    const textToSend = input; setInput(""); await sendPayload(textToSend); 
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     setInput(e.target.value);
     if (socket && activeChat) {
        const to = "isGroup" in activeChat ? activeChat.id : activeChat.username;
        const isGroup = "isGroup" in activeChat;
        socket.emit("typing", { to, isGroup });
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => { socket.emit("stop_typing", { to, isGroup }); }, 1500);
     }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
         const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
         const reader = new FileReader();
         reader.onloadend = () => { sendPayload("", undefined, reader.result as string); };
         reader.readAsDataURL(audioBlob);
         stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (e) { console.error("Error accessing microphone:", e); alert("Microphone access denied."); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); }
  };
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 15 * 1024 * 1024) return alert("File exceeds 15MB limit.");
    const reader = new FileReader(); reader.onload = async () => { 
      if (file.type.startsWith('image/')) {
        await sendPayload("", reader.result as string);
      } else {
        await sendPayload("", undefined, undefined, { name: file.name, data: reader.result as string, size: file.size });
      }
    };
    reader.readAsDataURL(file); if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleReact = (msgId: string, reaction: string) => {
    if (!activeChat || !socket) return;
    socket.emit("reaction", { messageId: msgId, chatId: "isGroup" in activeChat ? activeChat.id : activeChat.username, reaction });
    setShowReactionsFor(null);
    setShowContextMenuFor(null);
  };
  
  const handleDeleteMessageForMe = (msgId: string) => {
    if (!activeChat || !socket) return;
    const chatId = "isGroup" in activeChat ? activeChat.id : activeChat.username;
    setChats(prev => ({ ...prev, [chatId]: (prev[chatId] || []).filter(m => m.id !== msgId) }));
    socket.emit("delete_message_for_me", { messageId: msgId });
    setShowContextMenuFor(null);
  };
  
  const handleDeleteMessageForEveryone = (msgId: string) => {
    if (!activeChat || !socket) return;
    const chatId = "isGroup" in activeChat ? activeChat.id : activeChat.username;
    setChats(prev => ({ ...prev, [chatId]: (prev[chatId] || []).map(m => m.id === msgId ? { ...m, isDeleted: true, text: "", image: undefined } : m) }));
    socket.emit("delete_message", { messageId: msgId });
    setShowContextMenuFor(null);
  };
  const handleCopyMessage = (text: string) => { navigator.clipboard.writeText(text); setShowContextMenuFor(null); };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || selectedMembers.length === 0 || !socket || !keyPairRef.current) return;
    const groupId = "group_" + Date.now();
    const groupKey = await generateGroupKey();
    const groupKeyBase64 = await exportGroupKey(groupKey);
    groupKeysRef.current[groupId] = groupKey;
    setGroups(prev => [...prev, { id: groupId, name: newGroupName, isGroup: true, isChannel: creatingChannel, admin: myUsername.current }]);
    const memberData: GroupMember[] = [{ username: myUsername.current, status: "accepted" }];
    const memberPayloads: any[] = [];
    const allMembersToProcess = [myUsername.current, ...selectedMembers];
    for (const memberName of allMembersToProcess) {
      if (memberName !== myUsername.current) memberData.push({ username: memberName, status: "pending" });
      const userObj = usersRef.current.find(u => u.username === memberName);
      if (userObj) {
         const pubKey = await importPublicKey(userObj.publicKey);
         const secret = await deriveSecretKey(keyPairRef.current.privateKey, pubKey);
         const { ciphertext, iv } = await encryptMessage(groupKeyBase64, secret);
         memberPayloads.push({ username: memberName, encryptedGroupKey: ciphertext, iv });
      }
    }
    setGroupMembersMap(prev => ({ ...prev, [groupId]: memberData }));
    socket.emit("create_group", { groupId, name: newGroupName, members: memberPayloads, isChannel: creatingChannel });
    setShowCreateGroup(false); setNewGroupName(""); setSelectedMembers([]);
  };

  const handleAddMembers = async () => {
    if (selectedNewMembers.length === 0 || !socket || !keyPairRef.current || !activeChat || !("isGroup" in activeChat)) return;
    const groupId = activeChat.id;
    const groupKey = groupKeysRef.current[groupId];
    if (!groupKey) {
       alert("Error: The encryption key for this group is missing (likely because you reloaded the page in an older version of the app where creators didn't backup their own keys). Please create a new group.");
       setShowAddMembers(false);
       return;
    }
    const groupKeyBase64 = await exportGroupKey(groupKey);
    const memberPayloads = [];
    for (const memberName of selectedNewMembers) {
      const userObj = usersRef.current.find(u => u.username === memberName);
      if (userObj) {
         const pubKey = await importPublicKey(userObj.publicKey);
         const secret = await deriveSecretKey(keyPairRef.current.privateKey, pubKey);
         const { ciphertext, iv } = await encryptMessage(groupKeyBase64, secret);
         memberPayloads.push({ username: memberName, encryptedGroupKey: ciphertext, iv });
      }
    }
    socket.emit("add_members_to_group", { groupId, members: memberPayloads });
    setShowAddMembers(false); setSelectedNewMembers([]);
  };

  // ----------------------------------------------------
  // RENDER - AUTH
  // ----------------------------------------------------
  if (!isRegistered) {
    return (
      <div style={{ display: "flex", height: "100vh", backgroundColor: "var(--bg-color)", alignItems: "center", justifyContent: "center" }}>
        <div className="glass-panel" style={{ padding: "40px", width: "100%", maxWidth: "450px", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "20px", background: "linear-gradient(135deg, var(--primary-color), #60a5fa)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 16px rgba(59, 130, 246, 0.3)" }}>
              <Shield color="white" size={32} />
            </div>
          </div>
          <h1 style={{ fontSize: "28px", fontWeight: "600", marginBottom: "8px", color: "var(--text-color)" }}>OmniChat</h1>
          <p style={{ color: "var(--text-muted)", marginBottom: "32px" }}>E2EE Secure Messaging.</p>
          
          {authStep === "phone" && (
            <form onSubmit={proceedToPin} style={{ display: "flex", flexDirection: "column", gap: "16px", animation: "slideIn 0.3s ease" }}>
              <div style={{ display: "flex", alignItems: "center", backgroundColor: "var(--bg-color-secondary)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", padding: "0 16px" }}>
                 <Smartphone size={20} color="var(--text-muted)" />
                 <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Mobile Number" style={{ width: "100%", padding: "14px", border: "none", backgroundColor: "transparent", color: "white", outline: "none", fontSize: "16px" }} required />
              </div>
              {authMode === "register" && (
                <div style={{ display: "flex", alignItems: "center", backgroundColor: "var(--bg-color-secondary)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", padding: "0 16px" }}>
                   <Users size={20} color="var(--text-muted)" />
                   <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Unique Username" style={{ width: "100%", padding: "14px", border: "none", backgroundColor: "transparent", color: "white", outline: "none", fontSize: "16px" }} required />
                </div>
              )}
              {authError && <p style={{ color: "var(--danger-color)", fontSize: "14px" }}>{authError}</p>}
              <button type="submit" className="button-primary" style={{ padding: "14px", fontSize: "16px", marginTop: "8px" }}>Proceed</button>
            </form>
          )}

          {authStep === "pin" && (
            <form onSubmit={handleFinalAuth} style={{ display: "flex", flexDirection: "column", gap: "16px", animation: "slideIn 0.3s ease" }}>
              <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Enter your 5-digit Security PIN to decrypt your identity keys.</p>
              <div className="pin-container">
                 {[0,1,2,3,4].map(idx => (
                    <input key={idx} type="password" maxLength={1} className="pin-box"
                           value={pin[idx] || ""}
                           onChange={e => {
                              const val = e.target.value;
                              if (val.match(/^[0-9]$/)) { const newPin = pin.substring(0, idx) + val + pin.substring(idx + 1); setPin(newPin); if (idx < 4) document.getElementById(`pin-${idx+1}`)?.focus(); }
                              else if (val === "") { const newPin = pin.substring(0, idx) + " " + pin.substring(idx + 1); setPin(newPin.trim()); if (idx > 0) document.getElementById(`pin-${idx-1}`)?.focus(); }
                           }} id={`pin-${idx}`} required />
                 ))}
              </div>
              {authError && <p style={{ color: "var(--danger-color)", fontSize: "14px" }}>{authError}</p>}
              <button type="submit" className="button-primary button-success" style={{ padding: "14px", fontSize: "16px", marginTop: "8px" }}>{authMode === "login" ? "Secure Login" : "Generate Keys & Register"}</button>
            </form>
          )}
          
          {authStep === "phone" && (
             <p style={{ marginTop: "24px", color: "var(--text-muted)", fontSize: "14px", cursor: "pointer" }} onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthError(""); }}>
                {authMode === "login" ? "Don't have an account? Register" : "Already have an account? Login"}
             </p>
          )}
        </div>
      </div>
    );
  }

  // Derived values for render
  const activeChatId = activeChat ? ("isGroup" in activeChat ? activeChat.id : activeChat.username) : null;
  const activeMessages = activeChatId ? (chats[activeChatId] || []) : [];
  const otherUsers = users.filter(u => u.username !== myUsername.current);

  return (
    <div className="app-container">
      {/* CALL OVERLAYS */}
      {callState.isReceiving && (
         <div style={{ position: "absolute", inset: 0, zIndex: 100, backgroundColor: "rgba(15, 23, 42, 0.95)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="glass-panel" style={{ padding: "40px", display: "flex", flexDirection: "column", alignItems: "center", animation: "slideIn 0.3s ease" }}>
               <div style={{ width: "80px", height: "80px", borderRadius: "50%", backgroundColor: "var(--primary-color)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px", animation: "pulse 1.5s infinite" }}>
                 {callState.isVideo ? <Video size={40} color="white" /> : <Phone size={40} color="white" />}
               </div>
               <h2 style={{ fontSize: "24px", color: "white", marginBottom: "8px" }}>Incoming {callState.isGroupCall ? "Group " : ""}{callState.isVideo ? "Video" : "Audio"} Call</h2>
               <p style={{ color: "var(--text-muted)", marginBottom: "32px" }}>{callState.caller} is calling you</p>
               <div style={{ display: "flex", gap: "24px" }}>
                 <button onClick={rejectCall} style={{ width: "64px", height: "64px", borderRadius: "50%", backgroundColor: "var(--danger-color)", border: "none", color: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 10px 15px -3px rgba(239, 68, 68, 0.4)" }}><PhoneOff size={28} /></button>
                 <button onClick={acceptCall} style={{ width: "64px", height: "64px", borderRadius: "50%", backgroundColor: "var(--success-color)", border: "none", color: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 10px 15px -3px rgba(16, 185, 129, 0.4)" }}><Phone size={28} /></button>
               </div>
            </div>
         </div>
      )}

      {callState.isActive && (
         <div style={{ position: "absolute", inset: 0, zIndex: 90, backgroundColor: "#000", display: "flex", flexDirection: "column" }}>
            <div style={{ flex: 1, position: "relative", display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: "16px", padding: "16px" }}>
               {callState.isVideo ? (
                 <>
                   {Object.entries(remoteStreams).map(([user, stream]) => (
                      <div key={user} style={{ flex: "1 1 40%", minWidth: "300px", maxWidth: "600px", aspectRatio: "16/9", backgroundColor: "#111", borderRadius: "var(--radius-lg)", overflow: "hidden", position: "relative" }}>
                         <VideoPlayer stream={stream} />
                         <div style={{ position: "absolute", bottom: "16px", left: "16px", backgroundColor: "rgba(0,0,0,0.6)", padding: "4px 12px", borderRadius: "var(--radius-full)", color: "white" }}>{user}</div>
                      </div>
                   ))}
                   <div style={{ flex: "1 1 40%", minWidth: "300px", maxWidth: "600px", aspectRatio: "16/9", backgroundColor: "#222", borderRadius: "var(--radius-lg)", overflow: "hidden", position: "relative", border: "2px solid var(--primary-color)" }}>
                      <VideoPlayer stream={localStream} isLocal={true} />
                      <div style={{ position: "absolute", bottom: "16px", left: "16px", backgroundColor: "rgba(0,0,0,0.6)", padding: "4px 12px", borderRadius: "var(--radius-full)", color: "white" }}>You</div>
                   </div>
                 </>
               ) : (
                 <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px" }}>
                   <div style={{ width: "120px", height: "120px", borderRadius: "50%", backgroundColor: "var(--bg-color-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--primary-color)" }}>
                     <Phone size={60} color="var(--primary-color)" />
                   </div>
                   <h2 style={{ fontSize: "24px", color: "white" }}>{callState.isGroupCall ? `Group Audio Call` : `Audio Call with ${callState.remoteUsers[0]}`}</h2>
                   <p style={{ color: "var(--text-muted)" }}>Connected End-to-End</p>
                   {/* AUDIO PLAYERS FOR VOICE CALL */}
                   {Object.values(remoteStreams).map((stream, i) => <AudioPlayer key={i} stream={stream} />)}
                 </div>
               )}
               <div style={{ position: "absolute", top: "32px", left: "32px", padding: "12px 24px", backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", borderRadius: "var(--radius-full)", display: "flex", alignItems: "center", gap: "12px" }}>
                  <Shield size={16} color="var(--primary-color)" />
                  <span style={{ color: "white", fontWeight: "500" }}>{callState.isGroupCall ? `E2EE Group Call (${Object.keys(remoteStreams).length + 1} participants)` : `E2EE Call with ${callState.remoteUsers[0]}`}</span>
               </div>
            </div>
            <div style={{ height: "100px", backgroundColor: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
               <button onClick={endCall} style={{ width: "64px", height: "64px", borderRadius: "50%", backgroundColor: "var(--danger-color)", border: "none", color: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "transform 0.2s" }} onMouseOver={e => e.currentTarget.style.transform="scale(1.1)"} onMouseOut={e => e.currentTarget.style.transform="scale(1)"}><PhoneOff size={28} /></button>
            </div>
         </div>
      )}

      {/* NAVIGATION SIDEBAR */}
      <nav className="nav-sidebar">
        {!isMobileView && (
          <div style={{ width: "48px", height: "48px", borderRadius: "16px", background: "linear-gradient(135deg, var(--primary-color), #60a5fa)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 16px rgba(59, 130, 246, 0.3)" }}>
            <Shield color="white" size={24} />
          </div>
        )}
        <div style={{ display: "flex", flexDirection: isMobileView ? "row" : "column", gap: "24px", marginTop: isMobileView ? "0" : "24px", width: "100%", justifyContent: isMobileView ? "space-around" : "flex-start", alignItems: "center" }}>
          <button className="nav-btn" style={iconButtonStyle(activeTab === "chats" && !showSettings)} onClick={() => { setActiveTab("chats"); setSearchQuery(""); setShowSettings(false); setActiveChat(null); }}><MessageSquare size={24} /></button>
          <button className="nav-btn" style={iconButtonStyle(activeTab === "friends" && !showSettings)} onClick={() => { setActiveTab("friends"); setSearchQuery(""); setShowSettings(false); setActiveChat(null); }}><Users size={24} /></button>
          <button className="nav-btn" style={{...iconButtonStyle(activeTab === "notifications" && !showSettings), position: "relative"}} onClick={() => { setActiveTab("notifications"); setSearchQuery(""); setShowSettings(false); setActiveChat(null); }}>
             <Shield size={24} />
             {(friendRequests.length > 0 || pendingInvites.length > 0) && <span style={{ position: "absolute", top: 4, right: 4, background: "var(--danger-color)", width: 10, height: 10, borderRadius: "50%", animation: "pulse 1.5s infinite" }}></span>}
          </button>
          <button className="nav-btn" style={iconButtonStyle(showSettings)} onClick={() => { setShowSettings(true); setActiveChat(null); setShowDetails(false); }}><Settings size={24} /></button>
        </div>
      </nav>

      {/* CHAT/FRIENDS LIST SIDEBAR */}
      <aside className={`chat-list-sidebar ${isMobileView && (activeChat || showSettings) ? 'chat-list-hidden' : ''}`}>
        <div style={{ padding: "24px", borderBottom: "1px solid var(--border-color)" }}>
          <h2 style={{ fontSize: "24px", fontWeight: "600", color: "var(--text-color)", marginBottom: "16px" }}>{activeTab === "chats" ? "Chats" : (activeTab === "friends" ? "Friends" : "Notifications")}</h2>
          <div style={{ display: "flex", alignItems: "center", backgroundColor: "var(--bg-color)", borderRadius: "var(--radius-md)", padding: "10px 16px", border: "1px solid var(--border-color)", transition: "border-color 0.2s" }} onFocus={e => e.currentTarget.style.borderColor="var(--primary-color)"} onBlur={e => e.currentTarget.style.borderColor="var(--border-color)"}>
            <Search size={18} color="var(--text-muted)" />
            <input type="text" placeholder={`Search ${activeTab}...`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ background: "transparent", border: "none", color: "var(--text-color)", outline: "none", marginLeft: "12px", width: "100%", fontSize: "15px" }} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
          
          {/* TAB: CHATS */}
          {activeTab === "chats" && (
            <>

              {groups.filter((g, i, self) => i === self.findIndex(t => t.id === g.id)).filter(g => !hiddenChats.includes(g.id) && (!searchQuery || g.name.toLowerCase().includes(searchQuery.toLowerCase()))).map(group => (
                <div key={group.id} onMouseLeave={() => setShowChatContextMenuFor(null)} style={{ position: "relative" }}>
                  <div onClick={() => handleSelectChat(group)} onContextMenu={(e) => { e.preventDefault(); setShowChatContextMenuFor(group.id); }} style={{ display: "flex", alignItems: "center", padding: "12px", borderRadius: "var(--radius-md)", backgroundColor: activeChatId === group.id ? "var(--bg-color-tertiary)" : "transparent", cursor: "pointer", transition: "background 0.2s" }} onMouseOver={e => { if (activeChatId !== group.id) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)"; }} onMouseOut={e => { if (activeChatId !== group.id) e.currentTarget.style.backgroundColor = "transparent"; }}>
                    <div style={{ width: "48px", height: "48px", borderRadius: "50%", backgroundColor: group.isDeleted || group.hasLeft ? "var(--bg-color-tertiary)" : "var(--primary-color)", marginRight: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {group.isChannel ? <Megaphone size={20} color={group.isDeleted || group.hasLeft ? "var(--text-muted)" : "white"} /> : <UsersRound size={20} color={group.isDeleted || group.hasLeft ? "var(--text-muted)" : "white"} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: "16px", fontWeight: "500", color: group.isDeleted || group.hasLeft ? "var(--text-muted)" : "white" }}>{group.name}</h3>
                      <p style={{ fontSize: "13px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}><Shield size={10} /> {group.isDeleted ? "Deleted" : (group.hasLeft ? "Left" : "Encrypted")}</p>
                    </div>
                    {unreadCounts[group.id] > 0 && !group.isDeleted && !group.hasLeft && <div style={{ backgroundColor: "var(--primary-color)", color: "white", fontSize: "12px", fontWeight: "bold", width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", marginLeft: "8px" }}>{unreadCounts[group.id]}</div>}
                  </div>
                  {showChatContextMenuFor === group.id && (
                    <div className="glass-panel" style={{ position: "absolute", top: "50%", right: "12px", transform: "translateY(-50%)", display: "flex", flexDirection: "column", padding: "8px", borderRadius: "var(--radius-md)", zIndex: 50, minWidth: "160px", boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }}>
                      <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete chat history for ${group.name}?`)) { socket?.emit("clear_chat", { chatId: group.id, isGroup: true }); hideChatLocally(group.id); setShowChatContextMenuFor(null); if(activeChatId === group.id) setActiveChat(null); } }} style={{ background: "none", border: "none", color: "white", padding: "10px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", borderRadius: "4px" }} onMouseOver={e=>e.currentTarget.style.backgroundColor="rgba(255,255,255,0.1)"} onMouseOut={e=>e.currentTarget.style.backgroundColor="transparent"}><Trash2 size={16}/> Delete Chat</button>
                      {group.admin === myUsername.current ? (
                        !group.isDeleted && <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete group ${group.name}? This cannot be undone.`)) { socket?.emit("delete_group", { groupId: group.id }); setShowChatContextMenuFor(null); if(activeChatId === group.id) setActiveChat(null); } }} style={{ background: "none", border: "none", color: "var(--danger-color)", padding: "10px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", borderRadius: "4px" }} onMouseOver={e=>e.currentTarget.style.backgroundColor="rgba(239,68,68,0.1)"} onMouseOut={e=>e.currentTarget.style.backgroundColor="transparent"}><Trash2 size={16}/> Delete Group</button>
                      ) : (
                        !group.hasLeft && !group.isDeleted && <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`Leave ${group.name}?`)) { socket?.emit("leave_group", { groupId: group.id }); setShowChatContextMenuFor(null); if(activeChatId === group.id) setActiveChat(null); } }} style={{ background: "none", border: "none", color: "var(--danger-color)", padding: "10px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", borderRadius: "4px" }} onMouseOver={e=>e.currentTarget.style.backgroundColor="rgba(239,68,68,0.1)"} onMouseOut={e=>e.currentTarget.style.backgroundColor="transparent"}><LogOut size={16}/> Leave Group</button>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {[...new Set(Object.keys(chats).filter(k => friends.includes(k) && !hiddenChats.includes(k)))].filter(f => !searchQuery || f.toLowerCase().includes(searchQuery.toLowerCase())).map(fName => {
                const userObj = users.find(u => u.username === fName);
                if (!userObj) return null;
                return (
                <div key={fName} onMouseLeave={() => setShowChatContextMenuFor(null)} style={{ position: "relative" }}>
                  <div onClick={() => handleSelectChat(userObj)} onContextMenu={(e) => { e.preventDefault(); setShowChatContextMenuFor(fName); }} style={{ display: "flex", alignItems: "center", padding: "12px", borderRadius: "var(--radius-md)", backgroundColor: activeChatId === fName ? "var(--bg-color-tertiary)" : "transparent", cursor: "pointer", transition: "background 0.2s" }} onMouseOver={e => { if (activeChatId !== fName) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)"; }} onMouseOut={e => { if (activeChatId !== fName) e.currentTarget.style.backgroundColor = "transparent"; }}>
                    <div style={{ width: "48px", height: "48px", borderRadius: "50%", backgroundColor: activeChatId === fName ? "rgba(255,255,255,0.2)" : "var(--bg-color-tertiary)", marginRight: "16px", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                      {userObj.avatar ? <img src={userObj.avatar} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Users size={20} color="var(--primary-color)" />}
                      {presence[fName]?.online && <div style={{ position: "absolute", bottom: 0, right: 0, width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "var(--success-color)", border: "2px solid var(--bg-color)" }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: "16px", fontWeight: "500", color: "white" }}>{fName}</h3>
                      <p style={{ fontSize: "13px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}><Shield size={10} /> Friend</p>
                    </div>
                    {unreadCounts[fName] > 0 && <div style={{ backgroundColor: "var(--primary-color)", color: "white", fontSize: "12px", fontWeight: "bold", width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", marginLeft: "8px" }}>{unreadCounts[fName]}</div>}
                  </div>
                  {showChatContextMenuFor === fName && (
                    <div className="glass-panel" style={{ position: "absolute", top: "50%", right: "12px", transform: "translateY(-50%)", display: "flex", flexDirection: "column", padding: "8px", borderRadius: "var(--radius-md)", zIndex: 50, minWidth: "160px", boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }}>
                      <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete chat with ${fName}?`)) { socket?.emit("clear_chat", { chatId: fName, isGroup: false }); hideChatLocally(fName); setShowChatContextMenuFor(null); if(activeChatId === fName) setActiveChat(null); } }} style={{ background: "none", border: "none", color: "white", padding: "10px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", borderRadius: "4px" }} onMouseOver={e=>e.currentTarget.style.backgroundColor="rgba(255,255,255,0.1)"} onMouseOut={e=>e.currentTarget.style.backgroundColor="transparent"}><Trash2 size={16}/> Delete Chat</button>
                      <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`Remove ${fName} from friends?`)) { socket?.emit("remove_friend", { target: fName }); setShowChatContextMenuFor(null); if(activeChatId === fName) setActiveChat(null); } }} style={{ background: "none", border: "none", color: "var(--danger-color)", padding: "10px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", borderRadius: "4px" }} onMouseOver={e=>e.currentTarget.style.backgroundColor="rgba(239,68,68,0.1)"} onMouseOut={e=>e.currentTarget.style.backgroundColor="transparent"}><UserMinus size={16}/> Unfriend</button>
                    </div>
                  )}
                </div>
              )})}
            </>
          )}

          {/* TAB: FRIENDS */}
          {activeTab === "friends" && (
             <div style={{ display: "flex", flexDirection: "column" }}>
               <h3 style={{ fontSize: "12px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "1px", color: "var(--primary-color)", marginBottom: "8px" }}>My Friends</h3>
               {friends.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: "14px", padding: "8px" }}>You have no friends yet.</p>}
               {friends.filter(f => !searchQuery || f.toLowerCase().includes(searchQuery.toLowerCase())).map(friend => {
                 const fUser = users.find(u => u.username === friend);
                 if (!fUser) return null;
                 return (
                 <div key={friend} style={{ display: "flex", alignItems: "center", padding: "12px", borderRadius: "var(--radius-md)", backgroundColor: "var(--bg-color)", border: "1px solid var(--border-color)", marginBottom: "8px", cursor: "pointer", transition: "border-color 0.2s" }} onMouseOver={e=>e.currentTarget.style.borderColor="var(--primary-color)"} onMouseOut={e=>e.currentTarget.style.borderColor="var(--border-color)"} onClick={() => { setActiveTab("chats"); handleSelectChat(fUser); }}>
                   <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "var(--primary-color)", marginRight: "12px", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                     {fUser.avatar ? <img src={fUser.avatar} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Users size={16} color="white" />}
                     {presence[friend]?.online && <div style={{ position: "absolute", bottom: 0, right: 0, width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "var(--success-color)", border: "2px solid var(--bg-color)" }} />}
                   </div>
                   <span style={{ color: "white", flex: 1, fontSize: "15px", fontWeight: "500" }}>{friend}</span>
                   <button onClick={(e) => { e.stopPropagation(); setActiveTab("chats"); handleSelectChat(fUser); }} style={{ padding: "6px 12px", borderRadius: "var(--radius-full)", backgroundColor: "rgba(59, 130, 246, 0.1)", color: "var(--primary-color)", border: "1px solid rgba(59, 130, 246, 0.3)", cursor: "pointer", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}><MessageSquare size={14}/> Message</button>
                 </div>
                 );
               })}
               <div style={{ height: "1px", backgroundColor: "var(--border-color)", margin: "16px 0" }}></div>
               <h3 style={{ fontSize: "12px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "1px", color: "var(--text-muted)", marginBottom: "8px" }}>Add New Friends</h3>
               {otherUsers.filter(u => !friends.includes(u.username) && (!searchQuery || u.username.toLowerCase().includes(searchQuery.toLowerCase()))).map(u => {
                  const isSent = sentRequests.includes(u.username);
                  return (
                  <div key={u.username} style={{ display: "flex", alignItems: "center", padding: "12px", borderRadius: "var(--radius-md)", backgroundColor: "var(--bg-color)", border: "1px solid var(--border-color)", marginBottom: "8px" }}>
                    <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "var(--bg-color-secondary)", marginRight: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Users size={16} color="var(--primary-color)" />
                    </div>
                    <span style={{ color: "white", flex: 1, fontSize: "15px" }}>{u.username}</span>
                    <button 
                       onClick={() => { if(socket && !isSent) socket.emit("add_friend", { target: u.username }); }} 
                       style={{ padding: "6px 12px", borderRadius: "var(--radius-full)", backgroundColor: isSent ? "var(--bg-color-secondary)" : "var(--primary-color)", color: isSent ? "var(--text-muted)" : "white", border: isSent ? "1px solid var(--border-color)" : "none", cursor: isSent ? "default" : "pointer", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}
                       disabled={isSent}
                    >
                       {isSent ? <><Check size={14}/> Requested</> : <><UserPlus size={14}/> Add</>}
                    </button>
                  </div>
               )})}
             </div>
          )}

          {/* TAB: NOTIFICATIONS */}
          {activeTab === "notifications" && (
             <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
               {pendingInvites.length === 0 && friendRequests.length === 0 ? (
                 <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", marginTop: "40px" }}>
                    <Shield size={40} color="var(--border-color)" />
                    <p style={{ color: "var(--text-muted)", fontSize: "14px", textAlign: "center" }}>No new notifications.<br/>You're all caught up!</p>
                 </div>
               ) : (
                 <>
                   {pendingInvites.length > 0 && (
                     <div style={{ animation: "slideIn 0.3s ease" }}>
                       <h3 style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", color: "var(--primary-color)", padding: "0 12px", marginBottom: "12px", fontWeight: "700" }}>Group Invites</h3>
                       {pendingInvites.map(invite => (
                         <div key={invite.groupId} className="glass-panel" style={{ padding: "16px", marginBottom: "8px", border: "1px solid rgba(59, 130, 246, 0.3)" }}>
                           <div style={{ color: "white", fontSize: "15px", marginBottom: "12px", fontWeight: "500", display: "flex", alignItems: "center", gap: "8px" }}>
                             <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "rgba(59, 130, 246, 0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                               {invite.isChannel ? <Megaphone size={14} color="var(--primary-color)"/> : <UsersRound size={14} color="var(--primary-color)"/>}
                             </div>
                             {invite.name}
                           </div>
                           <div style={{ display: "flex", gap: "8px" }}>
                             <button onClick={() => { if(socket) socket.emit("accept_group_invite", { groupId: invite.groupId }); setPendingInvites(prev => prev.filter(i => i.groupId !== invite.groupId)); }} className="button-primary" style={{ flex: 1, padding: "8px", fontSize: "13px" }}>Join</button>
                             <button onClick={() => { if(socket) socket.emit("reject_group_invite", { groupId: invite.groupId }); setPendingInvites(prev => prev.filter(i => i.groupId !== invite.groupId)); }} style={{ flex: 1, padding: "8px", backgroundColor: "rgba(239, 68, 68, 0.1)", color: "var(--danger-color)", border: "none", borderRadius: "var(--radius-md)", cursor: "pointer", fontWeight: "500" }}>Ignore</button>
                           </div>
                         </div>
                       ))}
                     </div>
                   )}
                   {friendRequests.length > 0 && (
                     <div style={{ animation: "slideIn 0.4s ease" }}>
                       <h3 style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", color: "var(--primary-color)", padding: "0 12px", marginBottom: "12px", fontWeight: "700" }}>Friend Requests</h3>
                       {friendRequests.map(reqName => (
                          <div key={reqName} className="glass-panel" style={{ padding: "16px", marginBottom: "8px" }}>
                            <div style={{ display: "flex", alignItems: "center", marginBottom: "12px" }}>
                               <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "var(--bg-color-secondary)", marginRight: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                 <UserCheck size={14} color="var(--primary-color)" />
                               </div>
                               <span style={{ color: "white", flex: 1, fontSize: "15px", fontWeight: "500" }}>{reqName}</span>
                            </div>
                            <div style={{ display: "flex", gap: "8px" }}>
                               <button onClick={() => { if(socket) socket.emit("accept_friend", { target: reqName }); }} className="button-primary" style={{ flex: 1, padding: "8px", fontSize: "13px" }}>Accept</button>
                               <button onClick={() => { if(socket) socket.emit("reject_friend", { target: reqName }); }} style={{ flex: 1, padding: "8px", backgroundColor: "rgba(239, 68, 68, 0.1)", color: "var(--danger-color)", border: "none", borderRadius: "var(--radius-md)", cursor: "pointer", fontWeight: "500" }}>Delete</button>
                            </div>
                          </div>
                       ))}
                     </div>
                   )}
                 </>
               )}
             </div>
          )}
        </div>
        
        {/* Quick Action Bar */}
        {activeTab === "chats" && (
           <div style={{ padding: "16px", borderTop: "1px solid var(--border-color)", display: "flex", gap: "12px", backgroundColor: "var(--bg-color-secondary)" }}>
             <button onClick={() => { setCreatingChannel(false); setShowCreateGroup(true); }} style={{ flex: 1, padding: "10px", borderRadius: "var(--radius-md)", backgroundColor: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.3)", color: "var(--primary-color)", cursor: "pointer", fontWeight: "600", display: "flex", justifyContent: "center", gap: "8px" }}><UsersRound size={18}/> New Group</button>
           </div>
        )}
      </aside>

      {/* MAIN VIEW */}
      <main className="main-chat-area" style={{ display: (isMobileView && !activeChat && !showSettings) ? "none" : "flex", backgroundImage: wallpaper !== "none" ? `url('${wallpaper}')` : "none", backgroundColor: wallpaper !== "none" ? "rgba(15, 23, 42, 0.95)" : "var(--bg-color)", backgroundBlendMode: "overlay" }}>
        
        {showSettings ? (
          <div style={{ flex: 1, backgroundColor: "var(--bg-color)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
            <header style={{ height: "70px", padding: "0 24px", display: "flex", alignItems: "center", backgroundColor: "rgba(15, 23, 42, 0.95)", borderBottom: "1px solid var(--border-color)" }}>
              {isMobileView && <button onClick={() => setShowSettings(false)} style={{ background: "none", border: "none", color: "white", cursor: "pointer", marginRight: "16px" }}><ArrowLeft size={24} /></button>}
              <h2 style={{ fontSize: "20px", fontWeight: "600", color: "white" }}>Settings</h2>
            </header>
            <div style={{ padding: "32px", maxWidth: "600px", margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: "24px" }}>
              
              <div className="glass-panel" style={{ padding: "24px", display: "flex", alignItems: "center", gap: "24px", position: "relative" }}>
                 <div onClick={() => avatarInputRef.current?.click()} style={{ width: "80px", height: "80px", borderRadius: "50%", backgroundColor: "var(--primary-color)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", cursor: "pointer", position: "relative" }} onMouseOver={e=>(e.currentTarget.lastElementChild as HTMLElement).style.opacity="1"} onMouseOut={e=>(e.currentTarget.lastElementChild as HTMLElement).style.opacity="0"}>
                    {users.find(u => u.username === myUsername.current)?.avatar ? <img src={users.find(u => u.username === myUsername.current)?.avatar} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Shield size={40} color="white" />}
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.2s" }}><Camera size={24} color="white" /></div>
                 </div>
                 <input type="file" accept="image/*" ref={avatarInputRef} style={{ display: "none" }} onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                       const reader = new FileReader();
                       reader.onload = (e) => {
                          const result = e.target?.result as string;
                          socket?.emit("update_profile", { avatar: result });
                       };
                       reader.readAsDataURL(file);
                    }
                 }} />
                 <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: "24px", color: "white", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>{myUsername.current}</h2>
                    {isEditingBio ? (
                       <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                          <input type="text" autoFocus value={profileBio} onChange={e => setProfileBio(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { socket?.emit("update_profile", { bio: profileBio }); setIsEditingBio(false); } }} placeholder="Add a bio..." style={{ flex: 1, padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-color-secondary)", color: "white", fontSize: "14px" }} />
                          <button onClick={() => { socket?.emit("update_profile", { bio: profileBio }); setIsEditingBio(false); }} className="button-primary" style={{ padding: "8px", borderRadius: "50%" }}><Check size={16} /></button>
                       </div>
                    ) : (
                       <p style={{ color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                          {users.find(u => u.username === myUsername.current)?.bio || "Hey there! I am using OmniChat."}
                          <button onClick={() => { setProfileBio(users.find(u => u.username === myUsername.current)?.bio || ""); setIsEditingBio(true); }} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px" }}><Edit2 size={14} /></button>
                       </p>
                    )}
                 </div>
              </div>

              <div className="glass-panel" style={{ padding: "24px" }}>
                 <h3 style={{ color: "white", fontSize: "16px", marginBottom: "16px" }}>Chat Wallpaper</h3>
                 <div style={{ display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "12px" }}>
                    {WALLPAPERS.map((wp, i) => (
                       <div key={i} onClick={() => { setWallpaper(wp); localStorage.setItem("omnichat_bg", wp); }} style={{ minWidth: "100px", height: "140px", borderRadius: "var(--radius-md)", cursor: "pointer", border: wallpaper === wp ? "2px solid var(--primary-color)" : "2px solid transparent", backgroundColor: "var(--bg-color-tertiary)", backgroundImage: wp !== "none" ? `url('${wp}')` : "none", backgroundSize: "cover", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {wp === "none" && <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>Solid Color</span>}
                       </div>
                    ))}
                 </div>
              </div>
                 
              <div className="glass-panel" style={{ padding: "24px" }}>
                 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showUpdatePin ? "16px" : "0" }}>
                   <div>
                     <h3 style={{ color: "white", fontSize: "16px" }}>Security PIN</h3>
                     <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>Change your E2EE decryption PIN</p>
                   </div>
                   {!showUpdatePin && <button onClick={() => setShowUpdatePin(true)} className="button-primary" style={{ padding: "8px 16px" }}>Update</button>}
                 </div>
                 {showUpdatePin && (
                    <form onSubmit={handleUpdatePin} style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--border-color)", animation: "slideIn 0.3s ease" }}>
                       <div><label style={{ fontSize: "12px", color: "var(--text-muted)" }}>Current 5-Digit PIN</label><input type="password" maxLength={5} value={oldPin} onChange={e => setOldPin(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-color-secondary)", color: "white", marginTop: "4px" }} required /></div>
                       <div><label style={{ fontSize: "12px", color: "var(--text-muted)" }}>New 5-Digit PIN</label><input type="password" maxLength={5} value={newPin} onChange={e => setNewPin(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-color-secondary)", color: "white", marginTop: "4px" }} required /></div>
                       {pinUpdateStatus && <p style={{ color: pinUpdateStatus.includes("Error") ? "var(--danger-color)" : "var(--success-color)", fontSize: "13px" }}>{pinUpdateStatus}</p>}
                       <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                          <button type="button" onClick={() => { setShowUpdatePin(false); setPinUpdateStatus(""); setOldPin(""); setNewPin(""); }} style={{ flex: 1, padding: "10px", background: "transparent", border: "1px solid var(--border-color)", color: "white", borderRadius: "var(--radius-md)", cursor: "pointer" }}>Cancel</button>
                          <button type="submit" className="button-primary button-success" style={{ flex: 1, padding: "10px" }}>Save New PIN</button>
                       </div>
                    </form>
                 )}
              </div>
                 
              <button onClick={handleLogout} style={{ padding: "16px", backgroundColor: "rgba(239, 68, 68, 0.1)", color: "var(--danger-color)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "var(--radius-md)", cursor: "pointer", fontWeight: "600", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", transition: "all 0.2s" }} onMouseOver={e => e.currentTarget.style.backgroundColor = "var(--danger-color)"} onMouseOut={e => e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.1)"}>
                 <LogOut /> Logout Account
              </button>
            </div>
          </div>
        ) : activeChat ? (
          <>
            <header style={{ height: "70px", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(15, 23, 42, 0.95)", borderBottom: "1px solid var(--border-color)", zIndex: 10 }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                {isMobileView && <button onClick={() => handleSelectChat(null)} style={{ background: "none", border: "none", color: "white", cursor: "pointer", marginRight: "16px" }}><ArrowLeft size={24} /></button>}
                <div onClick={() => setShowDetails(!showDetails)} style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "isGroup" in activeChat ? "var(--primary-color)" : "var(--bg-color-tertiary)", marginRight: "16px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                     {"isGroup" in activeChat ? (activeChat.isChannel ? <Megaphone size={20} color="white" /> : <UsersRound size={20} color="white" />) : (users.find(u => u.username === activeChat.username)?.avatar ? <img src={users.find(u => u.username === activeChat.username)?.avatar} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Users size={20} color="var(--primary-color)" />)}
                  </div>
                  <div>
                    <h2 style={{ fontSize: "16px", fontWeight: "600", color: "white" }}>{"isGroup" in activeChat ? activeChat.name : activeChat.username}</h2>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
                       {"isGroup" in activeChat ? (activeChat.isChannel ? "Broadcast" : "Encrypted Group") : (
                          presence[activeChat.username]?.online ? <><span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "var(--success-color)" }} /> Online</> : `Last seen at ${presence[activeChat.username]?.lastSeen ? new Date(presence[activeChat.username].lastSeen).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Offline'}`
                       )}
                    </p>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "20px", color: "var(--text-muted)", alignItems: "center" }}>
                 <button onClick={() => startCall(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><Phone size={22} /></button>
                 <button onClick={() => startCall(true)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><Video size={24} /></button>
                 <Info size={24} style={{ cursor: "pointer", marginLeft: "8px" }} onClick={() => setShowDetails(!showDetails)} />
              </div>
            </header>

            <div style={{ flex: 1, padding: isMobileView ? "16px" : "32px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px", position: "relative", backgroundColor: !("isGroup" in activeChat) && vanishModes[activeChat.username] ? "rgba(0,0,0,0.75)" : undefined, backdropFilter: !("isGroup" in activeChat) && vanishModes[activeChat.username] ? "blur(12px)" : undefined, transition: "background-color 0.3s, backdrop-filter 0.3s" }}>
              {!("isGroup" in activeChat) && vanishModes[activeChat.username] && (
                 <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px", animation: "slideIn 0.3s ease" }}>
                    <div style={{ padding: "8px 16px", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: "20px", display: "flex", alignItems: "center", gap: "8px", color: "white", fontSize: "13px", fontWeight: "600", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)" }}>
                       🤫 Vanish Mode Active
                    </div>
                 </div>
              )}
              {activeMessages.length === 0 ? (
                 <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                  <div style={{ backgroundColor: "rgba(30, 41, 59, 0.8)", padding: "12px 24px", borderRadius: "16px", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px", border: "1px solid rgba(59, 130, 246, 0.3)" }}>
                     <Shield size={16} color="var(--primary-color)" /> Messages and calls are end-to-end encrypted. No one outside of this chat can read or listen to them.
                   </div>
                 </div>
              ) : (
                activeMessages.filter(msg => {
                   if (msg.isDeleted && msg.isVanishMode) return false;
                   return true;
                }).map((msg) => {
                  if (msg.isSystem) {
                    return (
                      <div key={msg.id} style={{ display: "flex", justifyContent: "center", margin: "16px 0", width: "100%" }}>
                        <span style={{ backgroundColor: "rgba(255,255,255,0.1)", padding: "4px 12px", borderRadius: "12px", fontSize: "12px", color: "var(--text-muted)", fontWeight: "500" }}>{msg.text}</span>
                      </div>
                    );
                  }
                  
                  return (
                  <div key={msg.id} style={{ alignSelf: msg.sender === "me" ? "flex-end" : "flex-start", maxWidth: isMobileView ? "85%" : "65%", display: "flex", flexDirection: "column", zIndex: 1 }}
                       onMouseEnter={() => setHoveredMsgId(msg.id)} onMouseLeave={() => { setHoveredMsgId(null); }}>
                    {msg.sender !== "me" && msg.sender !== "them" && (
                      <span style={{ fontSize: "12px", color: "var(--primary-color)", marginBottom: "4px", marginLeft: "4px", fontWeight: "600" }}>
                        {"isGroup" in activeChat && activeChat.isChannel ? `${activeChat.name} Admin` : msg.sender}
                      </span>
                    )}
                    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "8px", flexDirection: msg.sender === "me" ? "row-reverse" : "row" }}>
                      
                      <div style={{
                        padding: "8px", borderRadius: "var(--radius-md)",
                        backgroundColor: msg.sender === "me" ? "var(--primary-color)" : "var(--bg-color-tertiary)",
                        color: "white", boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                        borderTopRightRadius: msg.sender === "me" ? "0px" : "var(--radius-md)",
                        borderTopLeftRadius: msg.sender !== "me" ? "0px" : "var(--radius-md)",
                        position: "relative", minWidth: "100px",
                        opacity: msg.isDeleted ? 0.7 : 1, fontStyle: msg.isDeleted ? "italic" : "normal"
                      }}>
                        {msg.isDeleted ? (
                          <p style={{ display: "flex", alignItems: "center", gap: "6px", color: "rgba(255,255,255,0.7)", fontSize: "14px", padding: "4px 8px" }}><Trash2 size={14} /> This message was deleted</p>
                        ) : (
                          <>
                            {msg.replyTo && activeMessages.find(m => m.id === msg.replyTo) && (
                              <div style={{ backgroundColor: "rgba(0,0,0,0.2)", borderLeft: "4px solid white", padding: "6px 8px", borderRadius: "4px", marginBottom: "8px", fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
                                <span style={{ fontWeight: "bold", display: "block", marginBottom: "2px", color: "white" }}>{activeMessages.find(m => m.id === msg.replyTo)?.sender === "me" ? "You" : activeMessages.find(m => m.id === msg.replyTo)?.sender}</span>
                                {activeMessages.find(m => m.id === msg.replyTo)?.isDeleted ? "This message was deleted" : (activeMessages.find(m => m.id === msg.replyTo)?.text || "Photo")}
                              </div>
                            )}
                            {msg.image && <img src={msg.image} alt="Media" style={{ width: "100%", maxHeight: "300px", objectFit: "cover", borderRadius: "8px", marginBottom: msg.text || msg.file ? "8px" : "0" }} />}
                            {msg.audio && <VoiceMessagePlayer src={msg.audio} />}
                            {msg.file && (
                              <a href={msg.file.data} download={msg.file.name} style={{ display: "flex", alignItems: "center", gap: "12px", backgroundColor: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "12px", textDecoration: "none", color: "white", marginBottom: msg.text ? "8px" : "0", border: "1px solid rgba(255,255,255,0.1)" }}>
                                <div style={{ backgroundColor: "var(--primary-color)", padding: "8px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <FileText size={20} />
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", flex: 1 }}>
                                  <span style={{ fontSize: "14px", fontWeight: "bold", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{msg.file.name}</span>
                                  <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>{(msg.file.size / 1024 / 1024).toFixed(2)} MB • Document</span>
                                </div>
                                <Download size={18} color="rgba(255,255,255,0.7)" />
                              </a>
                            )}
                            {msg.text && <p style={{ lineHeight: "1.4", padding: "4px 8px", fontSize: "15px" }}>{msg.text}</p>}
                          </>
                        )}
                        
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px", marginTop: "4px" }}>
                          {msg.isVanishMode && <Ghost size={10} color="rgba(255,255,255,0.5)" />}
                          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)" }}>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {msg.isEdited && <span style={{ fontSize: "10px", fontStyle: "italic", color: "rgba(255,255,255,0.5)", marginLeft: "4px" }}>(edited)</span>}
                          {msg.sender === "me" && (
                            <CheckCheck size={14} color={msg.read ? "#60a5fa" : "rgba(255,255,255,0.5)"} />
                          )}
                        </div>
                        
                        {/* WhatsApp-Style Reaction Bubble */}
                        {msg.reaction && <div title={msg.reactionBy ? `Reacted by ${msg.reactionBy}` : ""} style={{ position: "absolute", bottom: "-12px", right: msg.sender === "me" ? "4px" : "auto", left: msg.sender === "me" ? "auto" : "4px", backgroundColor: "rgba(30, 41, 59, 0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "2px 6px", fontSize: "14px", boxShadow: "0 2px 8px rgba(0,0,0,0.4)", zIndex: 5, backdropFilter: "blur(4px)", cursor: "default" }}>{msg.reaction}</div>}
                      </div>

                      {/* WhatsApp-Style Hover Context Menu Chevron */}
                      {hoveredMsgId === msg.id && (
                        <div style={{ position: "relative" }}>
                          <button onClick={() => setShowContextMenuFor(showContextMenuFor === msg.id ? null : msg.id)} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-muted)" }}><ChevronDown size={14} /></button>
                          
                          {showContextMenuFor === msg.id && (
                            <div style={{ position: "absolute", bottom: "100%", right: msg.sender === "me" ? "0" : "auto", left: msg.sender === "me" ? "auto" : "0", display: "flex", flexDirection: "column", padding: "6px", borderRadius: "16px", zIndex: 50, minWidth: "180px", marginBottom: "8px", backgroundColor: "rgba(15, 23, 42, 0.85)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 10px 30px rgba(0,0,0,0.5)", transformOrigin: msg.sender === "me" ? "bottom right" : "bottom left", animation: "slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)" }}>
                              <div style={{ display: "flex", gap: "10px", padding: "4px 8px 12px 8px", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: "4px", justifyContent: "space-between" }}>
                                {EMOJIS.map(emoji => <button key={emoji} onClick={() => handleReact(msg.id, emoji)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", transition: "transform 0.2s" }} onMouseOver={e=>e.currentTarget.style.transform="scale(1.3)"} onMouseOut={e=>e.currentTarget.style.transform="scale(1)"}>{emoji}</button>)}
                              </div>
                              <button onClick={() => handleCopyMessage(msg.text)} style={{ background: "none", border: "none", color: "white", padding: "10px 12px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", fontSize: "14px", borderRadius: "8px", fontWeight: "500", transition: "background 0.2s" }} onMouseOver={e=>e.currentTarget.style.backgroundColor="rgba(255,255,255,0.1)"} onMouseOut={e=>e.currentTarget.style.backgroundColor="transparent"}><Copy size={16} color="#a1a1aa"/> Copy</button>
                              <button onClick={() => { setReplyingTo(msg.id); setShowContextMenuFor(null); }} style={{ background: "none", border: "none", color: "white", padding: "10px 12px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", fontSize: "14px", borderRadius: "8px", fontWeight: "500", transition: "background 0.2s" }} onMouseOver={e=>e.currentTarget.style.backgroundColor="rgba(255,255,255,0.1)"} onMouseOut={e=>e.currentTarget.style.backgroundColor="transparent"}><CornerUpLeft size={16} color="#a1a1aa"/> Reply</button>
                              {msg.sender === "me" && <button onClick={() => { setEditingMsgId(msg.id); setInput(msg.text); setShowContextMenuFor(null); }} style={{ background: "none", border: "none", color: "white", padding: "10px 12px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", fontSize: "14px", borderRadius: "8px", fontWeight: "500", transition: "background 0.2s" }} onMouseOver={e=>e.currentTarget.style.backgroundColor="rgba(255,255,255,0.1)"} onMouseOut={e=>e.currentTarget.style.backgroundColor="transparent"}><Edit2 size={16} color="#a1a1aa"/> Edit</button>}
                              <button onClick={() => handleDeleteMessageForMe(msg.id)} style={{ background: "none", border: "none", color: "#ef4444", padding: "10px 12px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", fontSize: "14px", borderRadius: "8px", fontWeight: "500", transition: "background 0.2s", marginTop: "2px" }} onMouseOver={e=>e.currentTarget.style.backgroundColor="rgba(239, 68, 68, 0.15)"} onMouseOut={e=>e.currentTarget.style.backgroundColor="transparent"}><Trash2 size={16}/> Delete for Me</button>
                              {msg.sender === "me" && <button onClick={() => handleDeleteMessageForEveryone(msg.id)} style={{ background: "none", border: "none", color: "#ef4444", padding: "10px 12px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", fontSize: "14px", borderRadius: "8px", fontWeight: "500", transition: "background 0.2s" }} onMouseOver={e=>e.currentTarget.style.backgroundColor="rgba(239, 68, 68, 0.15)"} onMouseOut={e=>e.currentTarget.style.backgroundColor="transparent"}><Trash2 size={16}/> Delete for Everyone</button>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
              {typingUsers["isGroup" in activeChat ? activeChat.id : activeChat.username]?.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", backgroundColor: "var(--bg-color-tertiary)", borderRadius: "var(--radius-full)", width: "fit-content", color: "var(--text-muted)", fontSize: "13px", alignSelf: "flex-start" }}>
                  <span className="typing-dot" style={{ animationDelay: "0ms", width: 6, height: 6, backgroundColor: "var(--primary-color)", borderRadius: "50%", display: "inline-block" }}></span>
                  <span className="typing-dot" style={{ animationDelay: "150ms", width: 6, height: 6, backgroundColor: "var(--primary-color)", borderRadius: "50%", display: "inline-block" }}></span>
                  <span className="typing-dot" style={{ animationDelay: "300ms", width: 6, height: 6, backgroundColor: "var(--primary-color)", borderRadius: "50%", display: "inline-block" }}></span>
                  {"isGroup" in activeChat ? `${typingUsers[activeChat.id].join(", ")} typing...` : "typing..."}
                </div>
              )}
            </div>

             <footer style={{ padding: "16px 24px", backgroundColor: "rgba(15, 23, 42, 0.95)", zIndex: 10 }}>
                {!("isGroup" in activeChat) && (
                   <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
                      <button onClick={() => {
                         const nextMode = !vanishModes[activeChat.username];
                         socket?.emit("toggle_vanish_mode", { to: activeChat.username, vanishMode: nextMode });
                         setVanishModes(prev => ({...prev, [activeChat.username]: nextMode}));
                      }} style={{ background: vanishModes[activeChat.username] ? "rgba(255, 255, 255, 0.15)" : "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px", padding: "6px 16px", color: "white", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", transition: "all 0.2s", fontWeight: "600" }} onMouseOver={e=>e.currentTarget.style.backgroundColor="rgba(255,255,255,0.2)"} onMouseOut={e=>e.currentTarget.style.backgroundColor=vanishModes[activeChat.username] ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)"}>
                         <Ghost size={14} /> {vanishModes[activeChat.username] ? "Turn off vanish mode" : "Turn on vanish mode"}
                      </button>
                   </div>
                )}
                {"isGroup" in activeChat ? (
                  groups.find(g => g.id === activeChat.id)?.isDeleted || groups.find(g => g.id === activeChat.id)?.hasLeft ? (
                    <div style={{ padding: "16px", textAlign: "center", color: "var(--danger-color)", backgroundColor: "rgba(239, 68, 68, 0.1)", borderRadius: "var(--radius-md)" }}>{groups.find(g => g.id === activeChat.id)?.isDeleted ? `This channel/group was deleted.` : `You can't send messages to this group because you're no longer a participant.`}</div>
                 ) : (
                   activeChat.isChannel && activeChat.admin !== myUsername.current ? (
                     <div style={{ padding: "16px", textAlign: "center", color: "var(--text-muted)", backgroundColor: "var(--bg-color-secondary)", borderRadius: "var(--radius-md)" }}>Only admins can post in this channel.</div>
                   ) : (
                     <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                       {replyingTo && activeMessages.find(m => m.id === replyingTo) && (
                         <div style={{ backgroundColor: "var(--bg-color-tertiary)", borderLeft: "4px solid var(--primary-color)", padding: "8px 12px", borderRadius: "var(--radius-md)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                           <div style={{ display: "flex", flexDirection: "column" }}>
                             <span style={{ fontSize: "12px", fontWeight: "bold", color: "var(--primary-color)" }}>{activeMessages.find(m => m.id === replyingTo)?.sender === "me" ? "You" : activeMessages.find(m => m.id === replyingTo)?.sender}</span>
                             <span style={{ fontSize: "14px", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "200px" }}>{activeMessages.find(m => m.id === replyingTo)?.isDeleted ? "Deleted message" : (activeMessages.find(m => m.id === replyingTo)?.text || "Photo")}</span>
                           </div>
                           <button onClick={() => setReplyingTo(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={18} /></button>
                         </div>
                       )}
                       <form onSubmit={handleSend} style={{ display: "flex", alignItems: "center", gap: "12px", backgroundColor: "var(--bg-color-secondary)", borderRadius: "var(--radius-full)", padding: "8px 24px", border: "1px solid rgba(255,255,255,0.1)" }}>
                          <input type="file" accept="image/*,.pdf,.doc,.docx,.txt" ref={fileInputRef} onChange={handleFileUpload} style={{ display: "none" }} />
                          <button type="button" onClick={() => fileInputRef.current?.click()} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", transition: "color 0.2s" }} onMouseOver={e=>e.currentTarget.style.color="white"} onMouseOut={e=>e.currentTarget.style.color="var(--text-muted)"}><Paperclip size={22} /></button>
                          {isRecording ? (
                            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "8px", color: "var(--danger-color)", fontSize: "15px", animation: "pulse 1.5s infinite" }}><Mic size={18} /> Recording Voice Note...</div>
                          ) : (
                            <input type="text" value={input} onChange={handleInputChange} placeholder="Type a message" style={{ flex: 1, background: "transparent", border: "none", color: "white", outline: "none", fontSize: "16px" }} />
                          )}
                          {!input.trim() && !isRecording ? (
                            <button type="button" onClick={startRecording} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", transition: "color 0.2s" }} onMouseOver={e=>e.currentTarget.style.color="var(--primary-color)"} onMouseOut={e=>e.currentTarget.style.color="var(--text-muted)"}><Mic size={22} /></button>
                          ) : isRecording ? (
                            <button type="button" onClick={stopRecording} style={{ background: "none", border: "none", color: "var(--danger-color)", cursor: "pointer" }}><Square size={22} fill="currentColor" /></button>
                          ) : (
                            <button type="submit" style={{ background: "none", border: "none", color: "var(--primary-color)", cursor: "pointer" }}><Send size={22} /></button>
                          )}
                       </form>
                     </div>
                   )
                 )
               ) : (
                 <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                   {replyingTo && activeMessages.find(m => m.id === replyingTo) && (
                     <div style={{ backgroundColor: "var(--bg-color-tertiary)", borderLeft: "4px solid var(--primary-color)", padding: "8px 12px", borderRadius: "var(--radius-md)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                       <div style={{ display: "flex", flexDirection: "column" }}>
                         <span style={{ fontSize: "12px", fontWeight: "bold", color: "var(--primary-color)" }}>{activeMessages.find(m => m.id === replyingTo)?.sender === "me" ? "You" : activeMessages.find(m => m.id === replyingTo)?.sender}</span>
                         <span style={{ fontSize: "14px", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "200px" }}>{activeMessages.find(m => m.id === replyingTo)?.isDeleted ? "Deleted message" : (activeMessages.find(m => m.id === replyingTo)?.text || "Photo")}</span>
                       </div>
                       <button onClick={() => setReplyingTo(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={18} /></button>
                     </div>
                   )}
                   <form onSubmit={handleSend} style={{ display: "flex", alignItems: "center", gap: "12px", backgroundColor: "var(--bg-color-secondary)", borderRadius: "var(--radius-full)", padding: "8px 24px", border: "1px solid rgba(255,255,255,0.1)" }}>
                     <input type="file" accept="image/*,.pdf,.doc,.docx,.txt" ref={fileInputRef} onChange={handleFileUpload} style={{ display: "none" }} />
                     <button type="button" onClick={() => fileInputRef.current?.click()} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", transition: "color 0.2s" }} onMouseOver={e=>e.currentTarget.style.color="white"} onMouseOut={e=>e.currentTarget.style.color="var(--text-muted)"}><Paperclip size={22} /></button>
                     {isRecording ? (
                       <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "8px", color: "var(--danger-color)", fontSize: "15px", animation: "pulse 1.5s infinite" }}><Mic size={18} /> Recording Voice Note...</div>
                     ) : (
                       <input type="text" value={input} onChange={handleInputChange} placeholder="Type a message" style={{ flex: 1, background: "transparent", border: "none", color: "white", outline: "none", fontSize: "16px" }} />
                     )}
                     {!input.trim() && !isRecording ? (
                       <button type="button" onClick={startRecording} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", transition: "color 0.2s" }} onMouseOver={e=>e.currentTarget.style.color="var(--primary-color)"} onMouseOut={e=>e.currentTarget.style.color="var(--text-muted)"}><Mic size={22} /></button>
                     ) : isRecording ? (
                       <button type="button" onClick={stopRecording} style={{ background: "none", border: "none", color: "var(--danger-color)", cursor: "pointer" }}><Square size={22} fill="currentColor" /></button>
                     ) : (
                       <button type="submit" style={{ background: "none", border: "none", color: "var(--primary-color)", cursor: "pointer" }}><Send size={22} /></button>
                     )}
                   </form>
                 </div>
               )}
            </footer>
          </>
        ) : (
           <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
             <Shield size={80} style={{ opacity: 0.1, marginBottom: "24px", color: "var(--primary-color)" }} />
             <h2 style={{ fontSize: "28px", color: "white", fontWeight: "300" }}>OmniChat</h2>
             <p style={{ marginTop: "12px", textAlign: "center", maxWidth: "400px", lineHeight: "1.6" }}>Send and receive messages across devices with seamless real-time syncing.</p>
             <p style={{ marginTop: "32px", display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", backgroundColor: "rgba(30, 41, 59, 0.5)", padding: "8px 16px", borderRadius: "16px" }}><Lock size={14}/> End-to-end encrypted</p>
           </div>
        )}
      </main>

      {/* CREATE GROUP MODAL */}
      {showCreateGroup && (
          <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.8)", backdropFilter: "blur(4px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="glass-panel" style={{ padding: "32px", width: "100%", maxWidth: "450px", animation: "slideIn 0.3s ease" }}>
              <h2 style={{ fontSize: "20px", color: "white", marginBottom: "24px", display: "flex", alignItems: "center", gap: "12px" }}>
                {creatingChannel ? <><Megaphone size={24} color="var(--primary-color)" /> New Channel</> : <><UsersRound size={24} color="var(--primary-color)" /> New Group</>}
              </h2>
              <input type="text" placeholder={creatingChannel ? "Channel Name" : "Group Name"} value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                style={{ width: "100%", padding: "16px", marginBottom: "16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-color-secondary)", color: "white", fontSize: "16px", outline: "none" }} />
              
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "24px" }}>
                {selectedMembers.map(m => (
                   <div key={m} style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "var(--primary-color)", padding: "6px 12px", borderRadius: "16px", fontSize: "14px", color: "white", boxShadow: "0 2px 4px rgba(59,130,246,0.3)" }}>
                     {m} <X size={14} style={{ cursor: "pointer" }} onClick={() => setSelectedMembers(prev => prev.filter(x => x !== m))} />
                   </div>
                ))}
              </div>

              <h3 style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>{creatingChannel ? "Add Subscribers" : "Add Contacts"}</h3>
              <div style={{ maxHeight: "200px", overflowY: "auto", marginBottom: "24px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {[...new Set(friends)].map(f => (
                  <div key={f} onClick={() => setSelectedMembers(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])} style={{ display: "flex", alignItems: "center", padding: "12px", borderRadius: "var(--radius-sm)", backgroundColor: selectedMembers.includes(f) ? "rgba(59, 130, 246, 0.1)" : "var(--bg-color-tertiary)", cursor: "pointer", border: selectedMembers.includes(f) ? "1px solid var(--primary-color)" : "1px solid transparent", transition: "all 0.2s" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "var(--bg-color-secondary)", display: "flex", alignItems: "center", justifyContent: "center", marginRight: "12px" }}>
                      <Users size={16} color="var(--primary-color)" />
                    </div>
                    <span style={{ color: "white", flex: 1, fontSize: "15px" }}>{f}</span>
                    <div style={{ width: "24px", height: "24px", borderRadius: "50%", border: "2px solid var(--primary-color)", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: selectedMembers.includes(f) ? "var(--primary-color)" : "transparent" }}>
                      {selectedMembers.includes(f) && <Check size={14} color="white" />}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "12px" }}>
                <button onClick={() => setShowCreateGroup(false)} style={{ flex: 1, padding: "14px", background: "transparent", border: "1px solid var(--border-color)", color: "white", borderRadius: "var(--radius-md)", cursor: "pointer", fontSize: "16px" }}>Cancel</button>
                <button onClick={handleCreateGroup} className="button-primary" style={{ flex: 1 }}>Create</button>
              </div>
            </div>
          </div>
      )}

      {/* ADD MEMBERS MODAL */}
      {showAddMembers && activeChat && "isGroup" in activeChat && (
          <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.8)", backdropFilter: "blur(4px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="glass-panel" style={{ padding: "32px", width: "100%", maxWidth: "450px", animation: "slideIn 0.3s ease" }}>
              <h2 style={{ fontSize: "20px", color: "white", marginBottom: "24px", display: "flex", alignItems: "center", gap: "12px" }}>
                <UserPlus size={24} color="var(--primary-color)" /> Add Members to {activeChat.name}
              </h2>
              
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "24px" }}>
                {selectedNewMembers.map(m => (
                   <div key={m} style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "var(--primary-color)", padding: "6px 12px", borderRadius: "16px", fontSize: "14px", color: "white", boxShadow: "0 2px 4px rgba(59,130,246,0.3)" }}>
                     {m} <X size={14} style={{ cursor: "pointer" }} onClick={() => setSelectedNewMembers(prev => prev.filter(x => x !== m))} />
                   </div>
                ))}
              </div>

              <h3 style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>Select Contacts</h3>
              <div style={{ maxHeight: "200px", overflowY: "auto", marginBottom: "24px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {friends.filter(f => !groupMembersMap[activeChat.id]?.find(m => m.username === f && m.status !== "left")).map(f => (
                  <div key={f} onClick={() => setSelectedNewMembers(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])} style={{ display: "flex", alignItems: "center", padding: "12px", borderRadius: "var(--radius-sm)", backgroundColor: selectedNewMembers.includes(f) ? "rgba(59, 130, 246, 0.1)" : "var(--bg-color-tertiary)", cursor: "pointer", border: selectedNewMembers.includes(f) ? "1px solid var(--primary-color)" : "1px solid transparent", transition: "all 0.2s" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "var(--bg-color-secondary)", display: "flex", alignItems: "center", justifyContent: "center", marginRight: "12px", overflow: "hidden" }}>
                       {users.find(u => u.username === f)?.avatar ? <img src={users.find(u => u.username === f)?.avatar} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <User size={16} color="var(--primary-color)" />}
                    </div>
                    <span style={{ color: "white", fontSize: "15px", flex: 1 }}>{f}</span>
                    {selectedNewMembers.includes(f) && <Check size={18} color="var(--primary-color)" />}
                  </div>
                ))}
                {friends.filter(f => !groupMembersMap[activeChat.id]?.find(m => m.username === f && m.status !== "left")).length === 0 && (
                  <div style={{ color: "var(--text-muted)", fontSize: "14px", textAlign: "center", padding: "16px 0" }}>All your friends are already in this group.</div>
                )}
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <button onClick={() => { setShowAddMembers(false); setSelectedNewMembers([]); }} style={{ flex: 1, padding: "14px", background: "transparent", border: "1px solid var(--border-color)", color: "white", borderRadius: "var(--radius-md)", cursor: "pointer", fontSize: "16px" }}>Cancel</button>
                <button onClick={handleAddMembers} disabled={selectedNewMembers.length === 0} className={selectedNewMembers.length === 0 ? "" : "button-primary"} style={{ flex: 1, padding: "14px", borderRadius: "var(--radius-md)", fontSize: "16px", border: "none", backgroundColor: selectedNewMembers.length === 0 ? "var(--bg-color-secondary)" : "var(--primary-color)", color: selectedNewMembers.length === 0 ? "var(--text-muted)" : "white", cursor: selectedNewMembers.length === 0 ? "not-allowed" : "pointer", opacity: selectedNewMembers.length === 0 ? 0.5 : 1 }}>Add Members</button>
              </div>
            </div>
          </div>
      )}

      {/* CHAT DETAILS PANEL */}
      {showDetails && activeChat && (
        <aside style={{ width: isMobileView ? "100%" : "360px", position: isMobileView ? "absolute" : "relative", zIndex: isMobileView ? 20 : 1, right: 0, height: "100%", backgroundColor: "var(--bg-color-secondary)", borderLeft: "1px solid var(--border-color)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "24px", borderBottom: "1px solid var(--border-color)", display: "flex", alignItems: "center", gap: "16px" }}>
             <button onClick={() => setShowDetails(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={24} /></button>
             <h2 style={{ fontSize: "18px", fontWeight: "600", color: "white" }}>{"isGroup" in activeChat ? "Group Info" : "Contact Info"}</h2>
          </div>
          
          <div style={{ padding: "40px 24px 20px 24px", display: "flex", flexDirection: "column", alignItems: "center", borderBottom: "1px solid var(--border-color)" }}>
            <div style={{ width: "120px", height: "120px", borderRadius: "50%", backgroundColor: "isGroup" in activeChat ? "var(--primary-color)" : "var(--bg-color-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "20px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.5)", overflow: "hidden" }}>
               {"isGroup" in activeChat ? (activeChat.isChannel ? <Megaphone size={50} color="white" /> : <UsersRound size={50} color="white" />) : (users.find(u => u.username === activeChat.username)?.avatar ? <img src={users.find(u => u.username === activeChat.username)?.avatar} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Users size={50} color="var(--primary-color)" />)}
            </div>
            <h2 style={{ fontSize: "24px", fontWeight: "600", color: "white", marginBottom: "8px" }}>{"isGroup" in activeChat ? activeChat.name : activeChat.username}</h2>
            <p style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-muted)", fontSize: "15px" }}>{("isGroup" in activeChat) ? `${groupMembersMap[activeChat.id]?.length || 0} members` : "Friend"}</p>
          </div>

          <div style={{ display: "flex", borderBottom: "1px solid var(--border-color)" }}>
            <button onClick={() => setDetailsTab("info")} style={{ flex: 1, padding: "16px", background: "none", border: "none", borderBottom: detailsTab === "info" ? "2px solid var(--primary-color)" : "2px solid transparent", color: detailsTab === "info" ? "var(--primary-color)" : "var(--text-muted)", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" }}>Info</button>
            <button onClick={() => setDetailsTab("media")} style={{ flex: 1, padding: "16px", background: "none", border: "none", borderBottom: detailsTab === "media" ? "2px solid var(--primary-color)" : "2px solid transparent", color: detailsTab === "media" ? "var(--primary-color)" : "var(--text-muted)", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" }}>Media</button>
          </div>

          {detailsTab === "info" ? (
             "isGroup" in activeChat ? (
            <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <p style={{ color: "var(--primary-color)", fontSize: "14px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "1px" }}>{groupMembersMap[activeChat.id]?.length || 0} {activeChat.isChannel ? 'Subscribers' : 'Members'}</p>
                {"isGroup" in activeChat && activeChat.admin === myUsername.current && !activeChat.isDeleted && (
                  <button onClick={() => setShowAddMembers(true)} style={{ background: "none", border: "none", color: "var(--primary-color)", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: "600" }} onMouseOver={e=>e.currentTarget.style.opacity="0.8"} onMouseOut={e=>e.currentTarget.style.opacity="1"}><UserPlus size={16} /> Add</button>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {groupMembersMap[activeChat.id]?.map((member, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", backgroundColor: "var(--bg-color-tertiary)", borderRadius: "var(--radius-md)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "var(--bg-color-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}><Users size={18} color="var(--primary-color)" /></div>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ color: "white", fontSize: "16px", fontWeight: "500" }}>{member.username === myUsername.current ? "You" : member.username}</span>
                        <span style={{ color: member.status === "accepted" ? "var(--success-color)" : "var(--text-muted)", fontSize: "12px", marginTop: "2px" }}>{member.status === "accepted" ? "Joined" : "Invited"}</span>
                      </div>
                    </div>
                    {activeChat.admin === member.username && <span style={{ fontSize: "11px", padding: "4px 8px", backgroundColor: "rgba(59, 130, 246, 0.2)", color: "var(--primary-color)", borderRadius: "var(--radius-full)", fontWeight: "600" }}>Admin</span>}
                  </div>
                ))}
              </div>
              
              {!activeChat.isDeleted && !activeChat.hasLeft && (
                <div style={{ marginTop: "auto", paddingTop: "32px", display: "flex", justifyContent: "center" }}>
                  {activeChat.admin === myUsername.current ? (
                     <button onClick={() => { if (socket) { socket.emit("delete_group", { groupId: activeChat.id }); setGroups(prev => prev.map(g => g.id === activeChat.id ? { ...g, isDeleted: true } : g)); setShowDetails(false); setActiveChat(null); } }} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", gap: "8px", padding: "16px", backgroundColor: "rgba(239, 68, 68, 0.1)", color: "var(--danger-color)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "var(--radius-md)", cursor: "pointer", fontWeight: "600", fontSize: "16px", transition: "background 0.2s" }} onMouseOver={e=>e.currentTarget.style.backgroundColor="var(--danger-color)"} onMouseOut={e=>e.currentTarget.style.backgroundColor="rgba(239, 68, 68, 0.1)"}><Trash2 size={20} /> Delete {activeChat.isChannel ? 'Channel' : 'Group'}</button>
                  ) : (
                     <button onClick={() => { if (socket) { socket.emit("leave_group", { groupId: activeChat.id }); setShowDetails(false); setActiveChat(null); } }} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", gap: "8px", padding: "16px", backgroundColor: "rgba(239, 68, 68, 0.1)", color: "var(--danger-color)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "var(--radius-md)", cursor: "pointer", fontWeight: "600", fontSize: "16px", transition: "background 0.2s" }} onMouseOver={e=>e.currentTarget.style.backgroundColor="var(--danger-color)"} onMouseOut={e=>e.currentTarget.style.backgroundColor="rgba(239, 68, 68, 0.1)"}><LogOut size={20} /> Leave {activeChat.isChannel ? 'Channel' : 'Group'}</button>
                  )}
                </div>
              )}
            </div>
          ) : (
             <div style={{ padding: "32px", color: "var(--text-muted)", fontSize: "15px", lineHeight: "1.6", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
               <Shield size={40} color="var(--primary-color)" style={{ opacity: 0.5 }} />
               <p>This is a secure 1-on-1 End-to-End Encrypted conversation.</p>
               <button onClick={() => { if (socket && !("isGroup" in activeChat)) { socket.emit("remove_friend", { target: activeChat.username }); setShowDetails(false); setActiveChat(null); } }} style={{ marginTop: "32px", padding: "12px", width: "100%", borderRadius: "var(--radius-md)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "var(--danger-color)", backgroundColor: "rgba(239, 68, 68, 0.1)", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", fontWeight: "600" }}><UserX size={18}/> Remove Friend</button>
             </div>
             )
          ) : (
             <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "8px", alignContent: "flex-start" }}>
                {activeMessages.filter(m => m.image || m.file || m.audio).length === 0 && <p style={{ color: "var(--text-muted)", fontSize: "14px", gridColumn: "1 / -1", textAlign: "center", marginTop: "24px" }}>No media shared yet.</p>}
                {activeMessages.filter(m => m.image || m.file || m.audio).reverse().map((m, i) => (
                   <div key={i} style={{ width: "100%", aspectRatio: "1/1", borderRadius: "8px", backgroundColor: "var(--bg-color-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", border: "1px solid var(--border-color)" }}>
                     {m.image && <img src={m.image} alt="Media" style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }} onClick={() => window.open(m.image, "_blank")} />}
                     {m.file && <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", padding: "8px", color: "var(--text-muted)", cursor: "pointer", width: "100%", height: "100%", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)" }} onClick={() => { const a = document.createElement("a"); a.href = m.file?.data || ""; a.download = m.file?.name || ""; a.click(); }}><FileText size={24} /><span style={{ fontSize: "10px", textAlign: "center", wordBreak: "break-all", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{m.file.name}</span></div>}
                     {m.audio && <div style={{ color: "var(--primary-color)", cursor: "pointer", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)" }} onClick={() => { const a = document.createElement("a"); a.href = m.audio || ""; a.download = "VoiceNote.webm"; a.click(); }}><Mic size={24} /></div>}
                   </div>
                ))}
             </div>
          )}
        </aside>
      )}
    </div>
  );
}

const iconButtonStyle = (active: boolean) => ({ background: "none", border: "none", color: active ? "var(--primary-color)" : "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "12px", borderRadius: "12px", backgroundColor: active ? "rgba(59, 130, 246, 0.1)" : "transparent", transition: "all 0.2s" });
