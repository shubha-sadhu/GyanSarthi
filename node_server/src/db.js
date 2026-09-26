import mongoose from "mongoose";
import { config } from "./config.js";

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // app-level id (crypto.randomUUID), kept distinct from Mongo's _id
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  roleId: { type: String, required: true },
  pythonUserId: { type: String, required: true }, // links to the competency profile in the Python backend
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const UserModel = mongoose.model("User", userSchema);

let connected = false;

export async function connectDB() {
  if (connected) return;
  await mongoose.connect(config.mongoUri);
  connected = true;
  console.log(`Connected to MongoDB at ${config.mongoUri}`);
}

function toPlain(doc) {
  if (!doc) return null;
  const obj = doc.toObject();
  delete obj._id;
  delete obj.__v;
  return obj;
}

export const userStore = {
  async findByEmail(email) {
    const doc = await UserModel.findOne({ email: email.toLowerCase() });
    return toPlain(doc);
  },

  async findById(id) {
    const doc = await UserModel.findOne({ id });
    return toPlain(doc);
  },

  async create(user) {
    try {
      const doc = await UserModel.create(user);
      return toPlain(doc);
    } catch (err) {
      // Mongo's unique-index violation on email
      if (err.code === 11000) {
        throw new Error("EMAIL_TAKEN");
      }
      throw err;
    }
  },

  async all() {
    const docs = await UserModel.find();
    return docs.map(toPlain);
  },
};
