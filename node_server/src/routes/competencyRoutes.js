import { Router } from "express";
import { pythonClient } from "../services/pythonClient.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";

const router = Router();
router.use(requireAuth);

router.get("/profile", async (req, res) => {
  try {
    const profile = await pythonClient.getProfile(req.user.pythonUserId);
    res.json(profile);
  } catch (err) {
    console.error("Failed to fetch profile:", err.message);
    res.status(502).json({ error: "Could not reach the learning backend." });
  }
});

router.get("/roadmap", async (req, res) => {
  try {
    const roadmap = await pythonClient.getRoadmap(req.user.pythonUserId, req.query.max_items);
    res.json(roadmap);
  } catch (err) {
    console.error("Failed to fetch roadmap:", err.message);
    res.status(502).json({ error: "Could not reach the learning backend." });
  }
});

// Org-wide averages are an admin/leadership view, not something every
// individual learner needs to see about their peers.
router.get("/heatmap", requireAdmin, async (req, res) => {
  try {
    const heatmap = await pythonClient.getHeatmap();
    res.json(heatmap);
  } catch (err) {
    console.error("Failed to fetch heatmap:", err.message);
    res.status(502).json({ error: "Could not reach the learning backend." });
  }
});

export default router;
