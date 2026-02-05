# Testing Guide (Procura Ops Command)

This guide is a practical checklist to verify the app is using real APIs and the Dashboard features work end-to-end.

## Prereqs
- Backend running: http://localhost:8001
- Frontend running: http://localhost:3000
- Signed in (Supabase Auth)

## 1) Service Health
Backend health:
```powershell
Invoke-RestMethod -Uri http://localhost:8001/health
```

Backend API docs:
- http://localhost:8001/docs

## 2) Connector Sanity (No DB Writes)
This checks your configured keys can reach external APIs (GovCon, NewsAPI, USAspending).
```powershell
cd C:\Users\Rethick\procura-ops-command
backend\venv\Scripts\python.exe backend\test_connectors.py
```

## 3) Dashboard End-to-End
Open:
- http://localhost:3000/#/dashboard

Checklist:
- [ ] Opportunities list loads (table renders with rows)
- [ ] Clicking a row opens the right-side detail panel
- [ ] Row "Open" button opens a source link (SAM.gov if available, otherwise SAM search fallback)
- [ ] Filters work: status/source/category/notice type, NAICS prefix, PSC prefix, min/max value, due < 7d
- [ ] Sorting works: due / fit / posted

Actions (requires role = admin or contract_officer):
- [ ] Sync works and is rate-limited (button cooldown, backend returns 429 if spammed)
  - UI button calls `POST /api/opportunities/sync`
- [ ] Qualify (AI) works for an opportunity
  - UI calls `POST /api/opportunities/{id}/qualify`
- [ ] Disqualify works for an opportunity
  - UI calls `PATCH /api/opportunities/{id}/disqualify`
- [ ] Create Workspace creates a submission and navigates to `/workspace/:submissionId`
  - UI calls `POST /api/submissions`

Bulk actions:
- [ ] Select multiple rows with checkboxes
- [ ] Bulk Qualify (AI) updates multiple opportunities (concurrency-limited)
- [ ] Bulk Disqualify updates multiple opportunities

## 4) Submissions Workflow
Open:
- http://localhost:3000/#/submissions

Checklist:
- [ ] Submissions list loads
- [ ] Open a submission workspace at `/workspace/:id`
- [ ] Checklist toggle works
- [ ] Finalize/submit action returns a response (may be stubbed depending on backend automation)

## Troubleshooting
If Dashboard opens but shows no data:
- Run Sync once (role must allow inserts)
- Confirm `VITE_API_URL` points to `http://localhost:8001/api`

If "Open" links show SAM search instead of the direct SAM notice:
- The connector did not provide a `sam_url` field for that record (fallback is expected).

If actions return 403:
- Your Supabase `profiles.role` is not `admin` or `contract_officer`.

