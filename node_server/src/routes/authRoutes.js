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

/**
 * Verifies email/password and returns the matching user record, or throws
 * an Error whose message is a stable code the route handlers translate
 * into the right HTTP response. Shared by both login pipelines below so
 * credential-checking logic exists in exactly one place.
 */
async function authenticateCredentials(email, password) {
  if (!email || !password) {
    throw new Error("MISSING_FIELDS");
  }
  const user = await userStore.findByEmail(email);
  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new Error("INVALID_CREDENTIALS");
  }
  return user;
}

function issueTokenResponse(res, user, status = 200) {
  const token = signToken({
    sub: user.id,
    name: user.name,
    roleId: user.roleId,
    pythonUserId: user.pythonUserId,
    isAdmin: user.isAdmin,
  });
  return res.status(status).json({ token, user: toPublicUser(user) });
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

    return issueTokenResponse(res, user, 201);
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

// Regular sign-in pipeline: any valid account, admin or not, gets a token.
router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  try {
    const user = await authenticateCredentials(email, password);
    return issueTokenResponse(res, user);
  } catch (err) {
    if (err.message === "MISSING_FIELDS") {
      return res.status(400).json({ error: "email and password are required." });
    }
    return res.status(401).json({ error: "Invalid email or password." });
  }
});

// Admin sign-in pipeline: credentials are checked the same way, but a
// token is issued ONLY if the account is an admin. A correct password on
// a non-admin account never gets a token from this endpoint at all — the
// rejection happens here, server-side, not as a client-side afterthought.
router.post("/admin/login", async (req, res) => {
  const { email, password } = req.body || {};
  try {
    const user = await authenticateCredentials(email, password);
    if (!user.isAdmin) {
      return res.status(403).json({ error: "This account doesn't have admin access." });
    }
    return issueTokenResponse(res, user);
  } catch (err) {
    if (err.message === "MISSING_FIELDS") {
      return res.status(400).json({ error: "email and password are required." });
    }
    return res.status(401).json({ error: "Invalid email or password." });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await userStore.findById(req.user.sub);
  if (!user) return res.status(404).json({ error: "User not found." });
  return res.json({ user: toPublicUser(user) });
});

export default router;
