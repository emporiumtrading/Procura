# Codebase Organization

This repo is intentionally simple: Vite + React for the UI and FastAPI for the backend.

## Frontend layout
- `pages/`: route-level screens (Dashboard, Submissions, Admin, etc.)
- `components/`: shared UI components (Sidebar, Modal, etc.)
- `lib/`: client-side helpers
  - `lib/api.ts`: backend API client (adds user JWT)
  - `lib/AuthContext.tsx`: Supabase auth wiring + API token injection
  - `lib/dashboard.ts`: opportunity parsing, link extraction, formatting helpers

## Backend layout
- `backend/main.py`: FastAPI app + routers
- `backend/routers/`: API endpoints (`/api/opportunities`, `/api/submissions`, etc.)
- `backend/scrapers/`: discovery connectors (GovCon, SAM.gov, etc.)
- `backend/ai/`: LLM client + qualification pipeline
- `supabase/migrations/`: DB schema + RLS policies

## Conventions
- Keep route pages thin: move parsing/formatting to `lib/` so UI stays readable.
- Never paste API keys into docs; docs should say "set in backend/.env".
- Prefer "source of truth" URLs:
  - Store source-provided URLs in `opportunities.raw_data` (e.g., `sam_url`, `description_url`)
  - UI should display provenance clearly (where the record came from + direct link)

