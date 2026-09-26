import axios from "axios";
import FormData from "form-data";
import { config } from "../config.js";

const python = axios.create({
  baseURL: config.pythonApiUrl,
  timeout: 60_000,
});

export const pythonClient = {
  async getFramework() {
    const { data } = await python.get("/competency/framework");
    return data;
  },

  async createUser(name, roleId) {
    const { data } = await python.post("/users", { name, role_id: roleId });
    return data; // { user_id, name, role_id, joined_at }
  },

  async getProfile(pythonUserId) {
    const { data } = await python.get(`/competency/profile/${pythonUserId}`);
    return data;
  },

  async getRoadmap(pythonUserId, maxItems) {
    const { data } = await python.get(`/competency/roadmap/${pythonUserId}`, {
      params: maxItems ? { max_items: maxItems } : undefined,
    });
    return data;
  },

  async getHeatmap() {
    const { data } = await python.get("/competency/heatmap");
    return data;
  },

  async generateQuiz(body) {
    const { data } = await python.post("/quiz/generate", body);
    return data;
  },

  async submitQuiz(body) {
    const { data } = await python.post("/quiz/submit", body);
    return data;
  },

  async askQuestion(body) {
    const { data } = await python.post("/quiz/ask", body);
    return data;
  },

  async ingestDocument({ buffer, filename, mimetype, sourceType, domainId }) {
    const form = new FormData();
    form.append("file", buffer, { filename, contentType: mimetype });
    form.append("source_type", sourceType);
    if (domainId) form.append("domain_id", domainId);

    const { data } = await python.post("/ingest/document", form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    return data;
  },

  async ingestTranscript({ title, transcriptText, domainId }) {
    const params = new URLSearchParams();
    params.append("title", title);
    params.append("transcript_text", transcriptText);
    if (domainId) params.append("domain_id", domainId);

    const { data } = await python.post("/ingest/transcript", params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return data;
  },
};
