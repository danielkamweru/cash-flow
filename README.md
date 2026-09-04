# Cash-Flow

A professional personal-finance platform for Kenya. FastAPI backend on **:8000**, Next.js frontend on **:3000**.

> **Cash-Flow** — Understand your money. Control your flow.

## Quick Start

```bash
# 1. Clone
git clone git@github.com:danielkamweru/cash-flow.git
cd cash-flow

# 2. Backend (terminal 1)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m app.seed
npm start

# 3. Frontend (terminal 2)
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with demo credentials: `amina@example.com` / `demo1234`

## Features

- **Financial overview** — Net worth, liquid balance, investments, liabilities
- **Cash flow tracking** — Income vs expenses with monthly trends
- **Surplus engine** — Safe surplus = liquid − obligations − emergency buffer
- **Wealth Health** — Multi-factor financial health score (not a CRB score)
- **Goals & savings** — Track progress toward financial goals
- **Advisor** — Explainable recommendations based on your financial position
- **Automation** — User-approved rules for recurring financial actions
- **Payments** — Safaricom Daraja M-Pesa STK Push integration
- **Business context** — Suppliers, receivables, and invoice management
- **Chama / Community** — Pooled savings group tracking

## Stack

| Layer | Tech |
|-------|------|
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2, psycopg 3 |
| Frontend | Next.js 16, React 19, Tailwind CSS 4 |
| Database | PostgreSQL |
| Payments | Safaricom Daraja M-Pesa (sandbox or live) |

## Prerequisites

- Python 3.11+ (via pyenv recommended)
- Node.js 20+
- PostgreSQL running locally with a `cashflow` database

```bash
sudo -u postgres psql -c "CREATE DATABASE cashflow;"
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
```

## Commands

### Root Scripts

Run from the repo root:

| Script | Description |
|--------|-------------|
| `npm run dev:frontend` | Next.js on :3000 |
| `npm run dev:backend` | Uvicorn on :8000 |
| `npm run backend:seed` | Clear DB and load demo seed |

### Backend Commands

Run from `backend/`:

| Command | Description |
|---------|-------------|
| `source .venv/bin/activate` | Activate virtual environment |
| `pip install -r requirements.txt` | Install Python dependencies |
| `python -m app.seed` | Seed demo data (Amina Otieno) |
| `npm start` | Start API on :8000 |

Health check → [http://localhost:8000/api/health](http://localhost:8000/api/health)

### Frontend Commands

Run from `frontend/`:

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run dev` | Start dev server on :3000 |
| `npm run build` | Production build |
| `npm start` | Run production build |
| `npm run lint` | Run ESLint |

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | 8000 | Server port |
| `DATABASE_URL` | `postgresql+psycopg://postgres:postgres@localhost:5432/cashflow` | PostgreSQL connection |
| `CORS_ORIGIN` | `http://localhost:3000` | Comma-separated allowed origins |
| `JWT_SECRET` | dev secret | JWT signing secret |
| `JWT_EXPIRE_HOURS` | 72 | Token lifetime |
| `DARAJA_CONSUMER_KEY` | | Daraja OAuth2 client ID |
| `DARAJA_CONSUMER_SECRET` | | Daraja OAuth2 client secret |
| `DARAJA_SHORTCODE` | | Daraja business shortcode |
| `DARAJA_PASSKEY` | | Daraja passkey |
| `DARAJA_AUTH_URL` | `https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials` | Daraja auth endpoint |
| `DARAJA_STK_PUSH_URL` | `https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest` | Daraja STK Push endpoint |
| `DARAJA_CALLBACK_URL` | | Public HTTPS callback for M-Pesa results |

### Frontend (`frontend/.env.local`)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL (default `http://localhost:8000/api`) |

## Safaricom Daraja Payments

Set `DARAJA_CONSUMER_KEY`, `DARAJA_CONSUMER_SECRET`, `DARAJA_SHORTCODE`, and `DARAJA_PASSKEY` in `backend/.env` for live sandbox calls. Without them, the payments page shows a configuration prompt.

Get sandbox credentials at [developer.safaricom.co.ke](https://developer.safaricom.co.ke).

## Project Structure

```
cash-flow/
  backend/          # FastAPI application
    app/
      routers/      # API route modules
      daraja/       # Safaricom Daraja M-Pesa client
      automation/   # Rule engine
      business/     # Business coach logic
      advisors/     # Advisory agents
  frontend/         # Next.js application
    src/
      app/          # App Router pages
      components/   # UI components
      lib/          # API client, context, types
  database/         # Schema and seed SQL
  render.yaml       # Render deployment blueprint
```

## Production Build

```bash
cd frontend
npm run build
npm start
```

## Deploy

### Backend → Render

Repo includes [`render.yaml`](render.yaml) (API + Postgres blueprint).

1. Push this repo to GitHub.
2. In [Render](https://dashboard.render.com): **New → Blueprint** → select the repo.
3. Set environment variables (Blueprint marks several as *sync: false*).
4. Start command (already in Blueprint / Procfile): `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Health check path: `/api/health`
6. After first deploy, seed demo data from **Render Shell**: `cd backend && python -m app.seed`

### Frontend → Vercel

1. In [Vercel](https://vercel.com): **Add New Project** → import the GitHub repo.
2. **Root Directory**: `frontend` (required — monorepo).
3. Framework: Next.js (auto).
4. Set `NEXT_PUBLIC_API_URL` to your Render API URL.
5. Deploy.

## Design

Cash-Flow uses a modern Kenyan fintech-inspired green design system. The interface prioritizes clarity, trust, and financial literacy — with clear currency formatting, strong visual hierarchy, and honest data provenance labels.
