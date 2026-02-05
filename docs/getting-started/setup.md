# Developer Setup (Windows-first)

This is the canonical step-by-step to run the full stack locally.

Also see:
- Running services + stopping cleanly: `docs/development/services-reference.md`
- Data population: `docs/development/data-population.md`
- Testing: `docs/development/testing.md`

## Prereqs
- Git
- Python 3.11+ (venv)
- Node.js 18+ (npm)
- Docker Desktop (optional; needed only for Redis/Celery)

## 1) Repo
```powershell
cd C:\Users\Rethick
git clone <repository-url>
cd procura-ops-command
```

## 2) Backend (FastAPI)
Create venv + install deps:
```powershell
cd C:\Users\Rethick\procura-ops-command
python -m venv backend\venv
backend\venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

Configure backend env:
```powershell
Copy-Item backend\.env.example backend\.env
```

Edit `backend/.env` and set at least:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `GOVCON_API_KEY` (for opportunity discovery)
- `NEWS_API_KEY` (for news feed proxy)
- `GOOGLE_API_KEY` (Gemini, for qualification)

Run backend:
```powershell
cd C:\Users\Rethick\procura-ops-command
backend\venv\Scripts\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8001 --reload
```

## 3) Frontend (React + Vite)
Install deps:
```powershell
cd C:\Users\Rethick\procura-ops-command
npm install
```

Configure frontend env:
```powershell
Copy-Item .env.example .env.local
```

Edit `.env.local` and set:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL=http://localhost:8001/api`

Run frontend:
```powershell
cd C:\Users\Rethick\procura-ops-command
npm run dev
```

Open:
- UI: http://localhost:3000/#/dashboard
- API docs: http://localhost:8001/docs

## 4) Redis + Celery (Optional)
If you need scheduled/background jobs:

Start Redis:
```powershell
docker start procura-redis
```

If the container does not exist:
```powershell
docker run -d -p 6379:6379 --name procura-redis redis:alpine
```

Run Celery worker (Windows):
```powershell
cd C:\Users\Rethick\procura-ops-command
backend\venv\Scripts\celery.exe -A backend.tasks.celery_app worker --loglevel=info --pool=solo
```

Note: Celery "seed connectors" requires a valid `SUPABASE_SERVICE_ROLE_KEY` because it runs without a user JWT.

