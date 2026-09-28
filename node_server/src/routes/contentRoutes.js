import { Router } from "express";
import { pythonClient } from "../services/pythonClient.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// Any signed-in user can browse what's been ingested — this is what lets
// the quiz page offer chapter-wise testing, not just whole-domain.
// Ingesting new content is still admin-only (see ingestRoutes.js).
router.get("/documents", async (req, res) => {
  try {
    const docs = await pythonClient.listDocuments(req.query.domain_id);
    res.json(docs);
  } catch (err) {
    console.error("Failed to list documents:", err.message);
    res.status(502).json({ error: "Could not reach the learning backend." });
  }
});

router.get("/chapters", async (req, res) => {
  try {
    const chapters = await pythonClient.listChapters(req.query.domain_id);
    res.json(chapters);
  } catch (err) {
    console.error("Failed to list chapters:", err.message);
    res.status(502).json({ error: "Could not reach the learning backend." });
  }
});

export default router;
