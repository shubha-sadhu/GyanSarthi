import { Router } from "express";
import { pythonClient } from "../services/pythonClient.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.post("/generate", async (req, res) => {
  try {
    const quiz = await pythonClient.generateQuiz(req.body);
    res.json(quiz);
  } catch (err) {
    console.error("Quiz generation failed:", err.message);
    const status = err.response?.status || 502;
    res.status(status).json({
      error: err.response?.data?.detail || "Could not generate a quiz. Has any content been ingested for this domain?",
    });
  }
});

router.post("/submit", async (req, res) => {
  try {
    // Never trust a client-supplied user_id — always score against the
    // authenticated caller's own linked Python profile.
    const body = { ...req.body, user_id: req.user.pythonUserId };
    const result = await pythonClient.submitQuiz(body);
    res.json(result);
  } catch (err) {
    console.error("Quiz submission failed:", err.message);
    res.status(502).json({ error: "Could not submit the quiz." });
  }
});

router.post("/ask", async (req, res) => {
  try {
    const answer = await pythonClient.askQuestion(req.body);
    res.json(answer);
  } catch (err) {
    console.error("Q&A failed:", err.message);
    res.status(502).json({ error: "Could not reach the learning backend." });
  }
});

export default router;
