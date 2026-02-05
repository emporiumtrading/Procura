# Data Population (Real Feeds)

This project supports two "real data" paths:

1) **Manual sync (recommended for local dev):** click Sync in the UI (or call the sync API) to fetch live opportunities and upsert them into Supabase.
2) **Scheduled sync (production-style):** run Celery worker/beat for periodic discovery (requires a working Supabase `service_role` key).

---

## 1) Manual Opportunity Sync (Local Dev)

### Prereqs
- Backend + frontend are running (see `docs/getting-started/setup.md`)
- In `backend/.env`, these must be set:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `GOVCON_API_KEY` (required for GovCon discovery)
  - (Optional) `SAM_GOV_API_KEY` if you want SAM.gov too
- Your Supabase `profiles.role` must be **admin** or **contract_officer** (RLS blocks inserts otherwise).

### Run it
1) Open the UI: `http://localhost:3000`
2) Sign in (Supabase Auth)
3) Go to **Dashboard** (`/#/dashboard`)
4) Click **Sync**

What happens:
- Backend calls GovCon (and SAM.gov if configured)
- Normalizes results into the `opportunities` schema
- Batch upserts into the Supabase `opportunities` table by `external_ref`

### Verify
- UI should show a populated opportunity list
- Supabase Table Editor should show rows in `opportunities`

---

## 2) Market News Feed (NewsAPI)

The backend exposes a proxy endpoint so the frontend never needs `NEWS_API_KEY`.

1) Ensure `NEWS_API_KEY` is set in `backend/.env`
2) Call:
   - `GET http://localhost:8001/api/feeds/news`
   - Optional params: `q`, `days`, `page_size`

Example:
```
GET /api/feeds/news?q=government%20contracts&days=7&page_size=20
```

---

## 3) Scheduled Discovery (Celery + Redis)

This path is closer to production, but it requires a valid Supabase `service_role` key because Celery runs without a user JWT.

### Prereqs
- `SUPABASE_SERVICE_ROLE_KEY` must be valid in `backend/.env`
- Redis running (`docker start procura-redis`)

### Seed connector credentials (once)
This creates/updates rows in the Supabase `connectors` table (encrypted).

```powershell
backend\venv\Scripts\python.exe backend/scripts/seed_connectors.py
```

### Run Celery
Worker:
```powershell
backend\venv\Scripts\celery.exe -A backend.tasks.celery_app worker --loglevel=info --pool=solo
```

Scheduler (optional):
```powershell
backend\venv\Scripts\celery.exe -A backend.tasks.celery_app beat --loglevel=info
```

---

## Connector Smoke Test

To verify external APIs are reachable with your keys:

```powershell
backend\venv\Scripts\python.exe backend/test_connectors.py
```
