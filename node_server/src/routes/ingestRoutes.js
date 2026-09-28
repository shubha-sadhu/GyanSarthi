import { Router } from "express";
import multer from "multer";
import path from "path";
import { pythonClient } from "../services/pythonClient.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const router = Router();
// Only admins add training content — everyone else just consumes it.
router.use(requireAuth, requireAdmin);

function inferSourceType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".pdf") return "pdf";
  if (ext === ".pptx") return "pptx";
  return null;
}

router.post("/document", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }
  const sourceType = req.body.source_type || inferSourceType(req.file.originalname);
  if (!sourceType) {
    return res.status(400).json({ error: "Could not determine file type. Upload a .pdf or .pptx." });
  }

  try {
    const doc = await pythonClient.ingestDocument({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      sourceType,
      domainId: req.body.domain_id || undefined,
      chapterId: req.body.chapter_id || undefined,
    });
    res.status(201).json(doc);
  } catch (err) {
    console.error("Document ingestion failed:", err.message);
    const status = err.response?.status || 502;
    res.status(status).json({ error: err.response?.data?.detail || "Ingestion failed." });
  }
});

router.post("/book", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }
  const sourceType = req.body.source_type || inferSourceType(req.file.originalname);
  if (!sourceType) {
    return res.status(400).json({ error: "Could not determine file type. Upload a .pdf or .pptx." });
  }
  if (!req.body.domain_id) {
    return res.status(400).json({ error: "domain_id is required for a whole-book upload." });
  }

  try {
    const docs = await pythonClient.ingestBook({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      sourceType,
      domainId: req.body.domain_id,
      title: req.body.title || undefined,
    });
    res.status(201).json(docs);
  } catch (err) {
    console.error("Book ingestion failed:", err.message);
    const status = err.response?.status || 502;
    res.status(status).json({ error: err.response?.data?.detail || "Book ingestion failed." });
  }
});

router.post("/transcript", async (req, res) => {
  const { title, transcript_text: transcriptText, domain_id: domainId, chapter_id: chapterId } = req.body || {};
  if (!title || !transcriptText) {
    return res.status(400).json({ error: "title and transcript_text are required." });
  }

  try {
    const doc = await pythonClient.ingestTranscript({ title, transcriptText, domainId, chapterId });
    res.status(201).json(doc);
  } catch (err) {
    console.error("Transcript ingestion failed:", err.message);
    res.status(502).json({ error: "Ingestion failed." });
  }
});

export default router;
