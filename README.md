# Wealth Loop

Kenya-focused personal financial intelligence platform. FastAPI backend on **:4000**, Next.js frontend on **:3000**.

## Stack

| Layer | Tech |
|-------|------|
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2, psycopg 3 |
| Frontend | Next.js 16, React 19, Tailwind CSS 4 |
| Database | PostgreSQL (`wealthloop`) |
| Payments | LOOP gateway (sandbox or live) |

## Prerequisites

- Python 3.11+ (via pyenv recommended)
- Node.js 20+
- PostgreSQL running locally with a `wealthloop` database

```bash
sudo -u postgres psql -c "CREATE DATABASE wealthloop;"
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
```

## Backend Setup

```bash
cd backend

# Pin Python version (if using pyenv)
pyenv local 3.11.9

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate        # macOS/Linux
# .venv\Scripts\activate         # Windows

pip install -r requirements.txt
cp .env.example .env             # edit if needed
```

Default `DATABASE_URL`: `postgresql+psycopg://postgres:postgres@localhost:5432/wealthloop`

Seed demo data (Amina Otieno), then start the API:

```bash
python -m app.seed
npm start
```

Health check → [http://localhost:4000/api/health](http://localhost:4000/api/health)

> **Important:** Always activate the venv before running `npm start`, otherwise the system Python will be used.

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Ensure `frontend/.env.local` contains:

```
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

Open → [http://localhost:3000](http://localhost:3000)

## LOOP Payments

Set these in `backend/.env` for live gateway calls:

```
LOOP_CONSUMER_KEY=your_key
LOOP_CONSUMER_SECRET=your_secret
```

Without them, simulate endpoints return mocked responses. Callbacks land on `/api/loop/callbacks/*` (in-memory, max 50).

## Root Scripts

Run from the repo root:

| Script | Description |
|--------|-------------|
| `npm run dev:frontend` | Next.js on :3000 |
| `npm run dev:backend` | Uvicorn on :4000 |
| `npm run backend:seed` | Clear DB and load demo seed |

---

## Deploy

### 1) Backend → Render

Repo includes [`render.yaml`](render.yaml) (API + Postgres blueprint).

1. Push this repo to GitHub.
2. In [Render](https://dashboard.render.com): **New → Blueprint** → select the repo (or create a **Web Service** manually with Root Directory `backend`).
3. Set these environment variables (Blueprint marks several as *sync: false* so you fill them in the UI):

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | From Render Postgres (auto if using Blueprint) or your own Postgres/Supabase URL |
| `CORS_ORIGIN` | Your Vercel URL, e.g. `https://your-app.vercel.app` (comma-separate extras; keep `http://localhost:3000` for local if needed) |
| `CORS_ORIGIN_REGEX` | `https://.*\.vercel\.app` (preview deploys) |
| `JWT_SECRET` | Long random string (Blueprint can generate) |
| `LOOP_CALLBACK_BASE_URL` | Your Render API URL, e.g. `https://wealth-loop-api.onrender.com` |
| `LOOP_*` / `GEMINI_API_KEY` / `SUPABASE_*` | Optional, same as local `.env` |

4. Start command (already in Blueprint / Procfile):

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

5. Health check path: `/api/health`

6. After the first successful deploy, seed demo data from **Render Shell**:

```bash
cd backend   # if needed
python -m app.seed
```

Notes:

- `DATABASE_URL` from Render (`postgres://…`) is normalized automatically to `postgresql+psycopg://…` with `sslmode=require`.
- Free web services sleep when idle; the first request after sleep can take ~30–60s.

### 2) Frontend → Vercel

1. In [Vercel](https://vercel.com): **Add New Project** → import the GitHub repo.
2. **Root Directory**: `frontend` (required — monorepo).
3. Framework: Next.js (auto). Build/install defaults are fine.
4. Environment variable:

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | `https://YOUR-RENDER-SERVICE.onrender.com/api` |

5. Deploy. Then copy the Vercel URL into Render `CORS_ORIGIN` and **redeploy the API** if you set CORS after the first API deploy.

### 3) Wire them together

```text
Browser → https://your-app.vercel.app
         → NEXT_PUBLIC_API_URL → https://your-api.onrender.com/api
```

Checklist:

- [ ] Render `/api/health` returns `{ "ok": true, ... }`
- [ ] Vercel site loads; sign-in works (no CORS errors in DevTools)
- [ ] Demo seed run once on Render DB (`amina@example.com` / `demo1234`)
- [ ] `LOOP_CALLBACK_BASE_URL` is the public Render HTTPS origin (not localhost)
