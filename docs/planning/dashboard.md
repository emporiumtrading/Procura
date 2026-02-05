# Dashboard Roadmap (Ops Command)

## Goal
Make the main Dashboard fully functional end-to-end (real opportunities, AI qualification, workspace creation), with clear provenance (source + links), strong filtering/classification, and safe API usage (rate-limited, resilient).

## Done
- Real opportunities list wired to backend (`GET /api/opportunities`)
- Manual sync wired to backend with UI cooldown (`POST /api/opportunities/sync`)
- AI qualification wired to backend (`POST /api/opportunities/{id}/qualify`)
- Disqualify wired to backend (`PATCH /api/opportunities/{id}/disqualify`)
- Create Workspace wired to backend submissions (`POST /api/submissions`) and deep-link to `/workspace/:id`
- Provenance:
  - Source badges (govcon/sam)
  - Source quick links (SAM.gov URL, description URL, resource links) pulled from `raw_data`
- Filtering / segmentation:
  - Search (title/agency/ref)
  - Status/source/category (derived)/notice type/NAICS prefix/PSC prefix/company keyword/value min/max
  - Due-soon and sort controls
- Customization:
  - Toggleable table columns persisted to `localStorage`
- Data quality UX:
  - "assumed due date" badge when connector had to infer a due date
- Side panel:
  - Responsive details drawer (desktop docked, mobile slide-over with backdrop)
  - Row highlight + keyboard open (Enter/Space)
- Direct operation links:
  - Table "Open" button opens the best available source URL (SAM.gov > description > resource)
  - Detail drawer "Open Source" button
- Bulk actions:
  - Multi-select rows
  - Bulk Qualify (AI) with concurrency limits
  - Bulk Disqualify with concurrency limits

## Next
1) Bulk actions (polish)
   - Progress indicator (per-item success/failure)
   - Preset disqualify reasons and "undo" for last action

2) Better classification + saved views
   - Rules-based categories stored in Supabase (ex: system_settings)
   - Saved filter presets per user (Supabase table or user metadata)
   - "My company fit" inputs (NAICS list, agency list, keywords) per user profile

3) More contract metadata
   - Expose/standardize notice type, PSC, set-aside, place-of-performance across connectors
   - Normalize link fields (sam_url, description_url, resource_links_array) for all sources

4) Market intel on Dashboard
   - News feed panel via `GET /api/feeds/news` with UI cooldown + query presets
   - Link news keywords to active opportunities (simple match on agency/NAICS/keywords)

5) Ops + reliability
   - Replace in-memory throttles with Redis-backed rate limiting (per user)
   - Add retry/backoff for external APIs (429/5xx)
   - Add audit logs for sync/qualify actions
