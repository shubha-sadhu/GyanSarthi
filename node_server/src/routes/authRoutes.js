import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { userStore } from "../db.js";
import { pythonClient } from "../services/pythonClient.js";
import { signToken } from "../utils/jwt.js";
import { requireAuth } from "../middleware/auth.js";
import { config } from "../config.js";

const router = Router();

function toPublicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

router.post("/register", async (req, res) => {
  const { name, email, password, roleId, adminCode } = req.body || {};

  if (!name || !email || !password || !roleId) {
    return res.status(400).json({ error: "name, email, password, and roleId are all required." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  if (await userStore.findByEmail(email)) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  // A registrant becomes an admin only if they supplied the matching code
  // from the server's env — this is what gates who can ingest content and
  // view the org-wide heat-map.
  const isAdmin = Boolean(
    config.adminSignupCode && adminCode && adminCode === config.adminSignupCode
  );

  try {
    // Create the matching competency-engine profile in the Python backend
    // first — a Node user without a linked Python user can't have scores.
    const pythonUser = await pythonClient.createUser(name, roleId);

    const passwordHash = await bcrypt.hash(password, 10);
    const user = {
      id: crypto.randomUUID(),
      name,
      email,
      passwordHash,
      roleId,
      pythonUserId: pythonUser.user_id,
      isAdmin,
      createdAt: new Date().toISOString(),
    };
    await userStore.create(user);

    const token = signToken({
      sub: user.id,
      name: user.name,
      roleId: user.roleId,
      pythonUserId: user.pythonUserId,
      isAdmin: user.isAdmin,
    });

    return res.status(201).json({ token, user: toPublicUser(user) });
  } catch (err) {
    if (err.message === "EMAIL_TAKEN") {
      return res.status(409).json({ error: "An account with that email already exists." });
    }
    console.error("Registration failed:", err.message);
    return res.status(502).json({
      error: "Could not reach the learning backend to set up your profile. Is the Python API running?",
    });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required." });
  }

  const user = await userStore.findByEmail(email);
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const token = signToken({
    sub: user.id,
    name: user.name,
    roleId: user.roleId,
    pythonUserId: user.pythonUserId,
    isAdmin: user.isAdmin,
  });

  return res.json({ token, user: toPublicUser(user) });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await userStore.findById(req.user.sub);
  if (!user) return res.status(404).json({ error: "User not found." });
  return res.json({ user: toPublicUser(user) });
});

export default router;
