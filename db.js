require("dotenv").config();
const mongoose = require("mongoose");
let MongoMemoryServer;

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;

  let uri = process.env.MONGODB_URI;

  if (!uri) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("MONGODB_URI must be set in production");
    }
    console.log("No MONGODB_URI found. Starting MongoDB Memory Server for development...");
    try {
      MongoMemoryServer = require("mongodb-memory-server").MongoMemoryServer;
    } catch (e) {
      console.error("mongodb-memory-server is not installed. Run `npm i -D mongodb-memory-server`");
      process.exit(1);
    }
    const mongod = await MongoMemoryServer.create();
    uri = mongod.getUri();
  }

  await mongoose.connect(uri);
  console.log(`Connected to MongoDB: ${uri.includes("memory") ? "Memory Server" : "Atlas/Remote"}`);
}

const userSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true, index: true },
  username: { type: String, required: true, unique: true, index: true },
  pinHash: String,
  publicKey: String,
  encryptedPrivateKey: String,
  iv: String,
  avatar: { type: String, default: null },
  bio: { type: String, default: "" },
  friends: { type: [String], default: [] },
  friendRequests: { type: [String], default: [] },
  sentRequests: { type: [String], default: [] }
}, { timestamps: true });

const messageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  type: { type: String, required: true, enum: ["1on1", "group"] },
  from: { type: String, required: true },
  to: { type: String, required: true },
  ciphertext: String,
  iv: String,
  text: String, // mostly for system messages
  image: String,
  audio: String,
  file: {
    name: String,
    type: String,
    data: String,
    size: Number
  },
  timestamp: { type: Number, required: true },
  read: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  isEdited: { type: Boolean, default: false },
  reaction: String,
  reactionBy: String,
  isVanishMode: { type: Boolean, default: false },
  isSystem: { type: Boolean, default: false },
  replyTo: {
    id: String,
    text: String,
    sender: String
  },
  deletedFor: { type: [String], default: [] }
}, { timestamps: true });

messageSchema.index({ from: 1, to: 1 });
messageSchema.index({ to: 1 });

const groupMemberSchema = new mongoose.Schema({
  username: String,
  status: String, // "accepted", "invited", "left"
  encryptedGroupKey: String,
  iv: String
}, { _id: false });

const groupSchema = new mongoose.Schema({
  groupId: { type: String, required: true, unique: true, index: true },
  name: String,
  isChannel: { type: Boolean, default: false },
  admin: String,
  isDeleted: { type: Boolean, default: false },
  members: [groupMemberSchema]
}, { timestamps: true });

const vanishModeSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  enabled: { type: Boolean, default: false }
});

const User = mongoose.models.User || mongoose.model("User", userSchema);
const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);
const Group = mongoose.models.Group || mongoose.model("Group", groupSchema);
const VanishMode = mongoose.models.VanishMode || mongoose.model("VanishMode", vanishModeSchema);

module.exports = { connectDB, User, Message, Group, VanishMode };
