import { useEffect, useState } from "react";
import { apiClient, extractErrorMessage } from "../api/client.js";

const DIFFICULTIES = [
  { value: 1, label: "1 — Recall" },
  { value: 2, label: "2 — Basic understanding" },
  { value: 3, label: "3 — Applied understanding" },
  { value: 4, label: "4 — Analysis" },
  { value: 5, label: "5 — Expert / edge cases" },
];

export default function QuizPage() {
  const [domains, setDomains] = useState([]);
  const [domainId, setDomainId] = useState("");

  const [chapters, setChapters] = useState([]);
  const [loadingChapters, setLoadingChapters] = useState(false);

  // scope: null (still choosing) | { chapterId: string|null, label: string }
  const [scope, setScope] = useState(null);
  const [difficulty, setDifficulty] = useState(3);
  const [numQuestions, setNumQuestions] = useState(5);

  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Load the domains this user's role tracks, once.
  useEffect(() => {
    apiClient.get("/competency/profile").then(({ data }) => {
      const list = data.domain_scores.map((d) => ({ domain_id: d.domain_id, name: d.domain_name }));
      setDomains(list);
      if (list.length) setDomainId(list[0].domain_id);
    });
  }, []);

  // Whenever the domain changes, reload its chapters and reset scope.
  useEffect(() => {
    if (!domainId) return;
    setScope(null);
    setChapters([]);
    setLoadingChapters(true);
    apiClient
      .get("/content/chapters", { params: { domain_id: domainId } })
      .then(({ data }) => setChapters(data))
      .catch(() => setChapters([]))
      .finally(() => setLoadingChapters(false));
  }, [domainId]);

  function chooseFullDomain() {
    setError("");
    setScope({ chapterId: null, label: "Full domain assessment" });
  }

  function chooseChapter(chapter) {
    setError("");
    setScope({ chapterId: chapter.chapter_id, label: chapter.title });
  }

  async function handleGenerate(e) {
    e.preventDefault();
    setError("");
    setResult(null);
    setAnswers({});
    setGenerating(true);
    try {
      const { data } = await apiClient.post("/quiz/generate", {
        domain_id: domainId,
        difficulty: Number(difficulty),
        num_questions: Number(numQuestions),
        chapter_id: scope?.chapterId || undefined,
      });
      setQuiz(data);
    } catch (err) {
      setQuiz(null);
      setError(extractErrorMessage(err, "Could not generate a quiz for this domain."));
    } finally {
      setGenerating(false);
    }
  }

  function selectAnswer(questionId, optionId) {
    if (result) return; // locked after submission
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        quiz_id: quiz.quiz_id,
        answers: Object.entries(answers).map(([question_id, selected_option_id]) => ({
          question_id,
          selected_option_id,
        })),
      };
      const { data } = await apiClient.post("/quiz/submit", payload);
      setResult(data);
    } catch (err) {
      setError(extractErrorMessage(err, "Could not submit your answers."));
    } finally {
      setSubmitting(false);
    }
  }

  function resetToScopeChoice() {
    setQuiz(null);
    setResult(null);
    setAnswers({});
    setScope(null);
  }

  const feedbackByQuestion = {};
  if (result) {
    for (const f of result.feedback) feedbackByQuestion[f.question_id] = f;
  }

  const allAnswered = quiz && quiz.questions.every((q) => answers[q.question_id]);
  const domainName = domains.find((d) => d.domain_id === domainId)?.name || "";

  return (
    <div>
      <div className="page-intro">
        <h1>Take an assessment</h1>
        <p>Questions are generated fresh from ingested training material, grounded strictly in that content.</p>
      </div>

      {error && <div className="form-error">{error}</div>}

      {!quiz && (
        <>
          <div className="panel">
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field__label" htmlFor="domain">
                Competency domain
              </label>
              <select id="domain" className="field__select" value={domainId} onChange={(e) => setDomainId(e.target.value)}>
                {domains.map((d) => (
                  <option key={d.domain_id} value={d.domain_id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!scope && (
            <div className="panel">
              <h2>{domainName} — choose what to test</h2>

              <div className="choice-card" onClick={chooseFullDomain}>
                <div className="choice-card__title">Full domain assessment</div>
                <div className="choice-card__meta">Draws from everything ingested in {domainName}.</div>
              </div>

              {loadingChapters && <p className="loading-text">Loading chapters…</p>}

              {!loadingChapters && chapters.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <div className="roadmap-item__materials-label">Or test one chapter:</div>
                  {chapters.map((chapter) => (
                    <div className="choice-card" key={chapter.chapter_id} onClick={() => chooseChapter(chapter)}>
                      <div className="choice-card__title">{chapter.title}</div>
                      <div className="choice-card__meta">
                        {chapter.num_documents} document{chapter.num_documents === 1 ? "" : "s"} ·{" "}
                        {chapter.num_chunks} chunk{chapter.num_chunks === 1 ? "" : "s"}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!loadingChapters && chapters.length === 0 && (
                <p className="empty-text" style={{ marginTop: 12 }}>
                  No chapters created yet for this domain — an admin can upload a whole book via "Add training
                  content" to auto-split it into chapters. You can still take the full domain assessment above if
                  any content already exists.
                </p>
              )}
            </div>
          )}

          {scope && (
            <form className="panel" onSubmit={handleGenerate}>
              <button type="button" className="btn btn--secondary" onClick={() => setScope(null)} style={{ marginBottom: 16 }}>
                Change selection
              </button>

              <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", marginTop: 0, marginBottom: 18 }}>
                Testing: <strong style={{ color: "var(--ink)" }}>{scope.label}</strong>
              </p>

              <div className="field">
                <label className="field__label" htmlFor="difficulty">
                  Difficulty
                </label>
                <select id="difficulty" className="field__select" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  {DIFFICULTIES.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="field__label" htmlFor="numQuestions">
                  Number of questions
                </label>
                <input
                  id="numQuestions"
                  type="number"
                  min={1}
                  max={10}
                  className="field__input"
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(e.target.value)}
                />
              </div>

              <button className="btn btn--primary" type="submit" disabled={generating}>
                {generating ? "Generating…" : "Generate assessment"}
              </button>
            </form>
          )}
        </>
      )}

      {quiz && (
        <div className="panel">
          <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", marginTop: 0 }}>
            Testing: <strong style={{ color: "var(--ink)" }}>{scope?.label}</strong>
          </p>

          {quiz.questions.map((q, idx) => {
            const feedback = feedbackByQuestion[q.question_id];
            return (
              <div className="quiz-question" key={q.question_id}>
                <div className="quiz-question__prompt">
                  {idx + 1}. {q.prompt}
                </div>
                {q.options.map((opt) => {
                  const selected = answers[q.question_id] === opt.option_id;
                  let cls = "quiz-option";
                  if (selected) cls += " quiz-option--selected";
                  if (feedback) {
                    if (opt.option_id === feedback.correct_option_id) cls = "quiz-option quiz-option--correct";
                    else if (selected) cls = "quiz-option quiz-option--incorrect";
                  }
                  return (
                    <div key={opt.option_id} className={cls} onClick={() => selectAnswer(q.question_id, opt.option_id)}>
                      <span>{opt.text}</span>
                    </div>
                  );
                })}
                {feedback && <div className="quiz-feedback">{feedback.explanation}</div>}
              </div>
            );
          })}

          {!result && (
            <button className="btn btn--stamp" onClick={handleSubmit} disabled={!allAnswered || submitting} style={{ marginTop: 16 }}>
              {submitting ? "Submitting…" : "Submit answers"}
            </button>
          )}

          {result && (
            <div className="form-success" style={{ marginTop: 16 }}>
              You scored {result.attempt.num_correct} / {result.attempt.num_questions} — your competency profile has
              already been updated.
            </div>
          )}

          {result && (
            <button className="btn btn--secondary" onClick={resetToScopeChoice}>
              Take another assessment
            </button>
          )}
        </div>
      )}
    </div>
  );
}
