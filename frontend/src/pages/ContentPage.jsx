import { useEffect, useState } from "react";
import { apiClient, extractErrorMessage } from "../api/client.js";

export default function ContentPage() {
  const [domains, setDomains] = useState([]);
  const [file, setFile] = useState(null);
  const [domainId, setDomainId] = useState("");
  const [transcriptTitle, setTranscriptTitle] = useState("");
  const [transcriptText, setTranscriptText] = useState("");

  const [docResult, setDocResult] = useState(null);
  const [transcriptResult, setTranscriptResult] = useState(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submittingTranscript, setSubmittingTranscript] = useState(false);

  useEffect(() => {
    apiClient.get("/framework").then(({ data }) => setDomains(data.domains || []));
  }, []);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setError("");
    setDocResult(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      if (domainId) form.append("domain_id", domainId);
      const { data } = await apiClient.post("/ingest/document", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setDocResult(data);
    } catch (err) {
      setError(extractErrorMessage(err, "Upload failed."));
    } finally {
      setUploading(false);
    }
  }

  async function handleTranscriptSubmit(e) {
    e.preventDefault();
    setError("");
    setTranscriptResult(null);
    setSubmittingTranscript(true);
    try {
      const { data } = await apiClient.post("/ingest/transcript", {
        title: transcriptTitle,
        transcript_text: transcriptText,
        domain_id: domainId || undefined,
      });
      setTranscriptResult(data);
      setTranscriptText("");
    } catch (err) {
      setError(extractErrorMessage(err, "Could not ingest the transcript."));
    } finally {
      setSubmittingTranscript(false);
    }
  }

  return (
    <div>
      <div className="page-intro">
        <h1>Add training content</h1>
        <p>
          Upload a PDF or PPTX, or paste a video transcript. It's parsed, chunked, tagged to a competency domain, and
          made available for assessments — leave the domain on "Auto-detect" to let the system classify it.
        </p>
      </div>

      {error && <div className="form-error">{error}</div>}

      <form className="panel" onSubmit={handleUpload}>
        <h2>Upload a document</h2>
        <div className="field">
          <label className="field__label" htmlFor="file">
            PDF or PPTX file
          </label>
          <input id="file" type="file" accept=".pdf,.pptx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="domain">
            Competency domain
          </label>
          <select id="domain" className="field__select" value={domainId} onChange={(e) => setDomainId(e.target.value)}>
            <option value="">Auto-detect</option>
            {domains.map((d) => (
              <option key={d.domain_id} value={d.domain_id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <button className="btn btn--primary" type="submit" disabled={!file || uploading}>
          {uploading ? "Uploading…" : "Ingest document"}
        </button>

        {docResult && (
          <div className="form-success" style={{ marginTop: 16 }}>
            "{docResult.title}" ingested — {docResult.num_chunks} chunks tagged to{" "}
            {domains.find((d) => d.domain_id === docResult.domain_id)?.name || docResult.domain_id}.
          </div>
        )}
      </form>

      <form className="panel" onSubmit={handleTranscriptSubmit}>
        <h2>Paste a video transcript</h2>
        <div className="field">
          <label className="field__label" htmlFor="transcriptTitle">
            Title
          </label>
          <input
            id="transcriptTitle"
            className="field__input"
            value={transcriptTitle}
            onChange={(e) => setTranscriptTitle(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="transcriptText">
            Transcript text
          </label>
          <textarea
            id="transcriptText"
            className="field__textarea"
            value={transcriptText}
            onChange={(e) => setTranscriptText(e.target.value)}
            required
          />
        </div>

        <button className="btn btn--primary" type="submit" disabled={submittingTranscript || !transcriptText}>
          {submittingTranscript ? "Ingesting…" : "Ingest transcript"}
        </button>

        {transcriptResult && (
          <div className="form-success" style={{ marginTop: 16 }}>
            "{transcriptResult.title}" ingested — {transcriptResult.num_chunks} chunks tagged to{" "}
            {domains.find((d) => d.domain_id === transcriptResult.domain_id)?.name || transcriptResult.domain_id}.
          </div>
        )}
      </form>
    </div>
  );
}
