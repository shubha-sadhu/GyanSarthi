import express from "express";
import cors from "cors";
import morgan from "morgan";
import { config } from "./config.js";
import { connectDB } from "./db.js";
import authRoutes from "./routes/authRoutes.js";
import frameworkRoutes from "./routes/frameworkRoutes.js";
import competencyRoutes from "./routes/competencyRoutes.js";
import quizRoutes from "./routes/quizRoutes.js";
import ingestRoutes from "./routes/ingestRoutes.js";

const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.json({ service: "gyan-sarthi-node-server", status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/framework", frameworkRoutes);
app.use("/api/competency", competencyRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/ingest", ingestRoutes);

// Fallback error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Unexpected server error." });
});

connectDB()
  .then(() => {
    app.listen(config.port, () => {
      console.log(`Gyan Sarthi Node server listening on http://localhost:${config.port}`);
      console.log(`Proxying AI/competency calls to Python backend at ${config.pythonApiUrl}`);
    });
  })
  .catch((err) => {
    console.error("Could not connect to MongoDB:", err.message);
    console.error(`Check MONGODB_URI in .env (currently: ${config.mongoUri})`);
    process.exit(1);
  });
