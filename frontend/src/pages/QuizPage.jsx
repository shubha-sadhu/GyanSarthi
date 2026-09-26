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
  const [difficulty, setDifficulty] = useState(3);
  const [numQuestions, setNumQuestions] = useState(5);

  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient.get("/competency/profile").then(({ data }) => {
      const list = data.domain_scores.map((d) => ({ domain_id: d.domain_id, name: d.domain_name }));
      setDomains(list);
      if (list.length) setDomainId(list[0].domain_id);
    });
  }, []);

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

  const feedbackByQuestion = {};
  if (result) {
    for (const f of result.feedback) feedbackByQuestion[f.question_id] = f;
  }

  const allAnswered = quiz && quiz.questions.every((q) => answers[q.question_id]);

  return (
    <div>
      <div className="page-intro">
        <h1>Take an assessment</h1>
        <p>Questions are generated fresh from ingested training material, grounded strictly in that content.</p>
      </div>

      {error && <div className="form-error">{error}</div>}

      {!quiz && (
        <form className="panel" onSubmit={handleGenerate}>
          <div className="field">
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

          <button className="btn btn--primary" type="submit" disabled={generating || !domainId}>
            {generating ? "Generating…" : "Generate assessment"}
          </button>
        </form>
      )}

      {quiz && (
        <div className="panel">
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
            <button
              className="btn btn--secondary"
              onClick={() => {
                setQuiz(null);
                setResult(null);
                setAnswers({});
              }}
            >
              Take another assessment
            </button>
          )}
        </div>
      )}
    </div>
  );
}
