import { Router } from "express";
import { pythonClient } from "../services/pythonClient.js";

const router = Router();

// Public (no auth) — the registration page needs the role list before a
// person has an account, and the framework itself has no sensitive data.
router.get("/", async (req, res) => {
  try {
    const framework = await pythonClient.getFramework();
    res.json(framework);
  } catch (err) {
    console.error("Failed to fetch framework:", err.message);
    res.status(502).json({ error: "Could not reach the learning backend." });
  }
});

export default router;
