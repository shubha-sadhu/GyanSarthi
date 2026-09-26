import { verifyToken } from "../utils/jwt.js";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing or malformed Authorization header." });
  }

  try {
    const payload = verifyToken(token);
    req.user = payload; // { sub, name, roleId, pythonUserId }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}
