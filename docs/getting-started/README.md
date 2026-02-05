# Getting Started (Procura Ops Command)

This repo is a local dev stack for discovery, qualification, and submission workflows.

## Quick Links
- Setup: `docs/getting-started/setup.md`
- Running services + stopping cleanly: `docs/development/services-reference.md`
- Data population (real opportunities + news): `docs/development/data-population.md`
- Dashboard usage: `docs/development/dashboard.md`
- Codebase organization: `docs/development/codebase-organization.md`
- Dashboard roadmap: `docs/planning/dashboard.md`
- Testing: `docs/development/testing.md`

## Minimal "Run It" (Windows / PowerShell)
Open 2 terminals (3rd is optional for Redis/Celery).

Terminal 1 (Backend):
```powershell
cd C:\Users\Rethick\procura-ops-command
backend\venv\Scripts\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8001 --reload
```

Terminal 2 (Frontend):
```powershell
cd C:\Users\Rethick\procura-ops-command
npm run dev
```

Open:
- UI: http://localhost:3000/#/dashboard
- API docs: http://localhost:8001/docs

## Populate Real Opportunities
In the UI, go to Dashboard and click `Sync`.
- This calls `POST /api/opportunities/sync`
- GovCon is used when `GOVCON_API_KEY` is set in `backend/.env`
- SAM.gov is used when `SAM_GOV_API_KEY` is set in `backend/.env`

## Stop Cleanly (Avoid Port Conflicts)
Use `Ctrl+C` in the terminals you started.

If you left a process running on a port, see:
`docs/development/services-reference.md#fix-port-conflicts-windows`
