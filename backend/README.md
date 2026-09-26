# Gyan Sarthi — Backend (Phase 1)

Scope of this phase, matching the three modules requested: **RAG pipeline**,
**vector embeddings**, and the **competency engine**. Everything else from
the SIH proposal (frontend, auth, full iGOT integration) is deliberately
out of scope for now.

## Architecture

```
Upload (PDF / PPTX / video transcript)
        │
        ▼
 ingestion/document_parser.py   → extracts text per page/slide
 ingestion/chunker.py           → splits into overlapping chunks
 ingestion/domain_tagger.py     → LLM classifies each chunk into a
                                   competency domain
        │
        ▼
 rag/vector_store.py            → embeds + upserts into Pinecone
                                   (integrated inference — Pinecone hosts
                                   the embedding model, so we never touch
                                   raw vectors ourselves)
        │
        ▼
 rag/rag_engine.py              → retrieval-augmented:
                                     • generate_quiz()  — MCQs grounded
                                       only in retrieved chunks
                                     • answer_question() — cited Q&A
        │
        ▼
 competency/engine.py           → turns quiz attempts into a live,
                                   re-scored competency profile per user,
                                   compares against role targets, and
                                   ranks a roadmap of what to learn next
                                   (pulling relevant chunks back from the
                                   vector store for each gap)
```

`app/storage.py` is a JSON-file store standing in for MongoDB Atlas (named
in the proposal). Every method maps 1:1 to a Mongo operation — swapping in
`pymongo` later only touches that one file.

## Setup

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in GEMINI_API_KEY and PINECONE_API_KEY
```

You need:
- A **Gemini API key** (free, [aistudio.google.com/apikey](https://aistudio.google.com/apikey), no credit card) — powers quiz generation, RAG Q&A, and domain tagging. Default model is `gemini-2.5-flash`, which has free input/output tokens on the free tier; change `GEMINI_MODEL` in `.env` if you want a different one.
- A **Pinecone API key** (pinecone.io, free tier is enough) — vector storage with integrated embeddings, no separate embedding provider needed.

## Run the API

```bash
uvicorn app.main:app --reload
```

Open **http://127.0.0.1:8000/docs** for interactive Swagger UI covering every endpoint below.

## Seed demo data (no API keys required for this part)

Populates 4 fake users across the 3 sample roles with a realistic quiz-attempt
history, so the **competency engine** (profile / gaps / roadmap / heatmap) is
demoable immediately, independent of live LLM/vector calls:

```bash
python -m scripts.seed_demo_data
```

Then try, e.g.:
```
GET /competency/profile/<user_id>
GET /competency/roadmap/<user_id>
GET /competency/heatmap
```

## End-to-end flow with real content (needs API keys)

```bash
# 1. Ingest a PDF into a domain (auto-tagged if domain_id omitted)
curl -X POST http://127.0.0.1:8000/ingest/document \
  -F "file=@survey_manual.pdf" -F "source_type=pdf"

# 2. Generate a quiz grounded in what was just ingested
curl -X POST http://127.0.0.1:8000/quiz/generate \
  -H "Content-Type: application/json" \
  -d '{"domain_id": "survey_methodology", "difficulty": 3, "num_questions": 5}'

# 3. Create a user, submit answers
curl -X POST http://127.0.0.1:8000/users \
  -H "Content-Type: application/json" -d '{"name": "Test User", "role_id": "field_investigator"}'

curl -X POST http://127.0.0.1:8000/quiz/submit \
  -H "Content-Type: application/json" \
  -d '{"quiz_id": "...", "user_id": "...", "answers": [{"question_id": "...", "selected_option_id": "a"}]}'

# 4. Re-pull the competency profile — it has already updated
curl http://127.0.0.1:8000/competency/profile/<user_id>
```

## Sample competency framework

`app/data/sample_framework.json` — 8 Statistics-specific domains (survey
methodology, statistical analysis, CAPI/CATI tools, data governance,
national accounts, etc.) and 3 MoSPI/NSSO roles (Field Investigator,
Statistical Officer, Deputy Director) each with target proficiency levels
per domain. Replace with the real DoPT Framework of Roles, Activities &
Competencies when available.

## Scoring model (competency engine)

Each quiz attempt produces an **evidence score** = `score_fraction ×
(difficulty_level × 20)` — correctness on harder material counts for more.
Domain scores are an **exponential moving average** over attempts in
chronological order (α = 0.4), so the profile shifts with recent
performance without discarding history — this is what makes it re-score
in real time rather than being a one-time snapshot. Tune `BASELINE_SCORE`
and `EMA_ALPHA` in `app/competency/engine.py`.

## Not yet built (next phases, per the full proposal)

- Frontend / dashboards
- iGOT Karmayogi SSO + course catalogue integration
- Real ASR step for video → transcript (transcript ingestion endpoint is
  ready to receive it)
- Predictive future-skill-needs modeling beyond the simple trend signal
- MongoDB Atlas swap-in (storage layer is already shaped for it)
