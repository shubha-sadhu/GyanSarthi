# Gyan Sarthi — Full Stack
SIH 2026 project of Team GyanSarthi, IIEST Shibpur

Three services, run together:

```
frontend (React, :5173)  →  node_server (Express auth + gateway, :4000)  →  backend (Python FastAPI, :8000)
                                                                                   ↓
                                                                    Gemini (LLM) + Pinecone (vectors)
                                    ↑
                              node_server also talks to MongoDB (login accounts)
```

- **`backend/`** — RAG pipeline, vector embeddings (Pinecone), and the competency engine.
- **`node_server/`** — Authentication (JWT + bcrypt, accounts stored in MongoDB) and an API gateway. The frontend never talks to the Python backend directly.
- **`frontend/`** — The React app.

Two kinds of accounts: **regular learners** and **admins**. Only admins can upload training content or see the organisation-wide heat-map — everyone else just takes assessments and tracks their own progress.

## 1. Install prerequisites

You need three things installed: **Python 3.10+**, **Node.js 18+**, and **MongoDB** (either installed locally, or a free MongoDB Atlas account — no local install needed for that option).

You also need two free API keys before content upload / quiz generation will work (the rest of the app — login, dashboard — works without them):
- **Gemini**: [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — sign in with Google, create a key, no credit card.
- **Pinecone**: [pinecone.io](https://pinecone.io) — sign up, free tier, copy the key from your dashboard.

## 2. Start the Python backend

Open a terminal:
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```
Open `backend/.env` and paste in your `GEMINI_API_KEY` and `PINECONE_API_KEY`.

```bash
uvicorn app.main:app --reload
```
Leave this running. It's now serving on **http://127.0.0.1:8000**.

## 3. Start MongoDB (if running it locally)

If you're using a local MongoDB install, make sure it's running (commonly `mongod` in its own terminal, or as a background service — depends on how you installed it). If you're using MongoDB Atlas instead, skip this — you'll just paste your Atlas connection string into `node_server/.env` in the next step.

## 4. Start the Node server

Open a second terminal:
```bash
cd node_server
npm install
cp .env.example .env
```
Open `node_server/.env` and check:
- `MONGODB_URI` — the default `mongodb://127.0.0.1:27017/gyan_sarthi` works if MongoDB is running locally. If using Atlas, replace it with your Atlas connection string.
- `ADMIN_SIGNUP_CODE` — set this to any private phrase, e.g. `letmein-admin-2026`. You'll use it once to create your own admin account.

```bash
npm run dev
```
Leave this running. It's now serving on **http://localhost:4000**. If it can't connect to MongoDB, it will print an error and exit — check `MONGODB_URI` if that happens.

## 5. Start the frontend

Open a third terminal:
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```
It's now serving on **http://localhost:5173**.

## 6. Create your accounts

Go to **http://localhost:5173** in your browser.

- **To create your admin account:** click "Create an account", fill in your details, pick a role, and in the "Admin code (optional)" field, enter the `ADMIN_SIGNUP_CODE` you set in step 4. You'll see "Add training content" and "Organisation heat-map" in your sidebar.
- **To create a regular learner account:** register again with a different email and leave the admin code blank.

## 7. Try it out

As **admin**: go to "Add training content" and upload a PDF/PPTX, or use the bundled demo notes instead —
```bash
cd backend
python -m scripts.seed_jee_content
```
This ingests short original Physics/Chemistry/Mathematics notes (written for this demo, not copied from any real exam) into the domains used by the **Testing** role.

As **any user** (register with role "Testing" to try this): go to "Take an assessment", pick Physics, Chemistry, or Mathematics, and generate a quiz — it's grounded in whatever was just ingested. Submit your answers, then check "My competency" — your score updates immediately.

## Seeing the competency engine without any of the above

The Python backend's scoring/roadmap logic can be demoed on its own, with fake pre-loaded history, no keys or Mongo needed:
```bash
cd backend
python -m scripts.seed_demo_data
```
Then browse `http://127.0.0.1:8000/docs` directly — this data lives only in the Python backend, not linked to any Node login, so it won't show up if you log into the actual frontend.

## Ports

| Service | Port | Purpose |
|---|---|---|
| Frontend (Vite) | 5173 | What you open in a browser |
| Node server | 4000 | Auth + gateway |
| Python backend | 8000 | RAG, vector store, competency engine |
| MongoDB | 27017 (default) | Login accounts |

