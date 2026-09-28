import { useEffect, useState } from "react";
import { apiClient, extractErrorMessage } from "../api/client.js";

export default function ContentPage() {
  const [domains, setDomains] = useState([]);

  // Whole-book upload (auto-split into chapters)
  const [bookFile, setBookFile] = useState(null);
  const [bookDomainId, setBookDomainId] = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [bookResult, setBookResult] = useState(null);
  const [uploadingBook, setUploadingBook] = useState(false);

  // Single document upload (optionally attached to an existing chapter)
  const [file, setFile] = useState(null);
  const [domainId, setDomainId] = useState("");
  const [chapters, setChapters] = useState([]);
  const [chapterId, setChapterId] = useState("");
  const [docResult, setDocResult] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Transcript upload
  const [transcriptTitle, setTranscriptTitle] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  const [transcriptResult, setTranscriptResult] = useState(null);
  const [submittingTranscript, setSubmittingTranscript] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    apiClient.get("/framework").then(({ data }) => {
      setDomains(data.domains || []);
      if (data.domains?.length) setBookDomainId(data.domains[0].domain_id);
    });
  }, []);

  // Load chapters for the single-document form whenever its domain changes
  useEffect(() => {
    setChapterId("");
    if (!domainId) {
      setChapters([]);
      return;
    }
    apiClient
      .get("/content/chapters", { params: { domain_id: domainId } })
      .then(({ data }) => setChapters(data))
      .catch(() => setChapters([]));
  }, [domainId]);

  async function handleBookUpload(e) {
    e.preventDefault();
    if (!bookFile || !bookDomainId) return;
    setError("");
    setBookResult(null);
    setUploadingBook(true);
    try {
      const form = new FormData();
      form.append("file", bookFile);
      form.append("domain_id", bookDomainId);
      if (bookTitle) form.append("title", bookTitle);
      const { data } = await apiClient.post("/ingest/book", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setBookResult(data);
    } catch (err) {
      setError(extractErrorMessage(err, "Book upload failed."));
    } finally {
      setUploadingBook(false);
    }
  }

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
      if (chapterId) form.append("chapter_id", chapterId);
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
        chapter_id: chapterId || undefined,
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
          Upload a whole textbook to auto-split it into chapters, add one document to an existing chapter, or paste a
          video transcript.
        </p>
      </div>

      {error && <div className="form-error">{error}</div>}

      <form className="panel" onSubmit={handleBookUpload}>
        <h2>Upload a whole book</h2>
        <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", marginTop: -8, marginBottom: 18 }}>
          Automatically split into chapters by detecting headings like "Chapter 3" — each chapter becomes
          separately testable.
        </p>

        <div className="field">
          <label className="field__label" htmlFor="bookFile">
            PDF or PPTX file
          </label>
          <input id="bookFile" type="file" accept=".pdf,.pptx" onChange={(e) => setBookFile(e.target.files?.[0] || null)} />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="bookDomain">
            Competency domain
          </label>
          <select id="bookDomain" className="field__select" value={bookDomainId} onChange={(e) => setBookDomainId(e.target.value)}>
            {domains.map((d) => (
              <option key={d.domain_id} value={d.domain_id}>
                {d.name}
              </option>
            ))}
          </select>
          <div className="field__hint">Required — a whole book is assumed to belong to one subject.</div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="bookTitle">
            Book title (optional)
          </label>
          <input id="bookTitle" className="field__input" value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} placeholder={bookFile?.name || ""} />
        </div>

        <button className="btn btn--primary" type="submit" disabled={!bookFile || !bookDomainId || uploadingBook}>
          {uploadingBook ? "Splitting and ingesting…" : "Upload and split into chapters"}
        </button>

        {bookResult && (
          <div className={bookResult.some((d) => d.embedding_status === "failed") ? "form-error" : "form-success"} style={{ marginTop: 16 }}>
            Split into {bookResult.length} piece{bookResult.length === 1 ? "" : "s"}:
            <ul style={{ margin: "8px 0 0 0", paddingLeft: 20 }}>
              {bookResult.map((d) => (
                <li key={d.document_id}>
                  {d.embedding_status === "complete" && "✓ "}
                  {d.embedding_status === "failed" && "✗ "}
                  {d.title} — {d.num_chunks} chunks
                  {d.embedding_status === "failed" && ` — vectorizing failed: ${d.embedding_error}`}
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>

      <form className="panel" onSubmit={handleUpload}>
        <h2>Add one document</h2>
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

        <div className="field">
          <label className="field__label" htmlFor="chapter">
            Add to an existing chapter (optional)
          </label>
          <select id="chapter" className="field__select" value={chapterId} onChange={(e) => setChapterId(e.target.value)} disabled={!domainId || chapters.length === 0}>
            <option value="">Domain-wide only, not part of a chapter</option>
            {chapters.map((c) => (
              <option key={c.chapter_id} value={c.chapter_id}>
                {c.title} ({c.num_documents} document{c.num_documents === 1 ? "" : "s"} so far)
              </option>
            ))}
          </select>
          <div className="field__hint">
            {domainId
              ? chapters.length === 0
                ? "No chapters exist yet in this domain — upload a whole book above to create some."
                : "Picking a chapter overrides the domain above with that chapter's own domain."
              : "Pick a domain first to see its chapters."}
          </div>
        </div>

        <button className="btn btn--primary" type="submit" disabled={!file || uploading}>
          {uploading ? "Uploading…" : "Ingest document"}
        </button>

        {docResult && docResult.embedding_status === "complete" && (
          <div className="form-success" style={{ marginTop: 16 }}>
            "{docResult.title}" ingested and vectorized — {docResult.num_chunks} chunks tagged to{" "}
            {domains.find((d) => d.domain_id === docResult.domain_id)?.name || docResult.domain_id}. Ready for
            assessments now.
          </div>
        )}

        {docResult && docResult.embedding_status === "failed" && (
          <div className="form-error" style={{ marginTop: 16 }}>
            "{docResult.title}" was parsed into {docResult.num_chunks} chunks, but vectorizing into the vector
            store failed: {docResult.embedding_error}. This content is not searchable yet — check your Pinecone
            setup and try uploading again.
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

        {transcriptResult && transcriptResult.embedding_status === "complete" && (
          <div className="form-success" style={{ marginTop: 16 }}>
            "{transcriptResult.title}" ingested and vectorized — {transcriptResult.num_chunks} chunks tagged to{" "}
            {domains.find((d) => d.domain_id === transcriptResult.domain_id)?.name || transcriptResult.domain_id}.
            Ready for assessments now.
          </div>
        )}

        {transcriptResult && transcriptResult.embedding_status === "failed" && (
          <div className="form-error" style={{ marginTop: 16 }}>
            "{transcriptResult.title}" was parsed into {transcriptResult.num_chunks} chunks, but vectorizing failed:{" "}
            {transcriptResult.embedding_error}. This content is not searchable yet.
          </div>
        )}
      </form>
    </div>
  );
}
