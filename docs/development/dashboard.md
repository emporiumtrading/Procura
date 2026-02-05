# Dashboard Guide (Ops Command)

## What the Dashboard is for
The Dashboard is the "opportunity inbox":
- pull new opportunities into Supabase (Sync)
- review and filter opportunities
- open the source system (SAM.gov) directly
- qualify/disqualify opportunities with AI
- create a submission workspace

## Key Interactions
### Open the details panel
- Click any row to open the right-side panel.
- Close with the (X) button or press `Esc`.

### Open the source system (operate directly)
You have two ways:
- Table row: the `Open` icon opens the best available link
- Detail panel: `Open Source`

Link priority:
1) `raw_data.sam_url` (direct SAM notice)
2) `raw_data.description_url` (source details page)
3) first item in `raw_data.resource_links_array`
4) fallback to a SAM.gov search URL for the solicitation reference

### Sync opportunities (real data)
Click `Sync` to upsert live opportunities into Supabase.
- Backend endpoint: `POST /api/opportunities/sync`
- Uses GovCon when `GOVCON_API_KEY` is configured in `backend/.env`
- Uses SAM.gov when `SAM_GOV_API_KEY` is configured in `backend/.env`
- Sync is rate-limited (cooldown UI + backend 429)

### Qualify / Disqualify
- Qualify (AI): updates fit/effort/urgency scores and AI summary
- Disqualify: sets status + optional reason

Bulk actions:
- Select multiple rows using checkboxes
- Bulk Qualify (AI) and Bulk Disqualify are concurrency-limited to reduce rate-limit risk

## Data-quality behavior
Some sources omit `response_deadline`. When missing:
- backend assumes a due date (posted_date + 30 days)
- UI shows an "assumed" badge and displays the assumed date

