## Test Suite Overview

This repository has **three main layers of automated tests**:

- **Backend tests (Python / pytest)** for the FastAPI backend and Supabase integration.
- **Frontend unit/integration tests (Vitest)** for React components and client-side logic.
- **End-to-end UI tests (Playwright)** that drive the browser against the running app.

All paths and commands below assume you are in the **repo root**.

---

## Backend tests (pytest)

- **Location**: `backend/tests/` (plus the `backend/test_connectors.py` script-style checks).
- **Framework**: `pytest` with shared fixtures in `backend/tests/conftest.py`.
- **Environment**:
  - `conftest.py` sets required env vars (e.g. Supabase URL/keys, encryption/audit keys) so tests run **without real credentials**.
  - A `TestClient` fixture (`test_app`) boots the FastAPI app and overrides dependencies:
    - Auth dependencies (`get_current_user`, `require_officer`, `require_admin`) are replaced with a mock admin user.
    - The Supabase dependency (`get_request_supabase`) is replaced with `MockSupabaseClient`, which mimics the chained query pattern (`supabase.table(...).select(...).eq(...).execute()`).
- **What is covered** (examples):
  - `test_health.py`: health and readiness endpoints.
  - `test_connectors_router.py`: API routes for discovery connectors.
  - `test_security.py`: authorization and access control behavior.
  - `test_opportunities.py`: opportunity listing/filtering and validation logic.
  - `test_models.py`: core domain models and validation rules.

### Running backend tests

- **Run all backend tests**:

```bash
python -m pytest
```

This will discover and run all tests under `backend/tests/`.  
You can also target individual files or tests in the usual pytest way, for example:

```bash
python -m pytest backend/tests/test_opportunities.py -k "min_fit_score"
```

### Discovery connector smoke checks (`backend/test_connectors.py`)

`backend/test_connectors.py` is **not a typical unit test file**; it is a **script-style smoke test** for the external discovery sources (USAspending, NewsAPI, SAM.gov, GovCon API):

- Each function (`test_usaspending`, `test_newsapi`, `test_sam_gov`, `test_govcon`) is an `async def` that:
  - Makes a real HTTP request via `httpx.AsyncClient`.
  - Prints a short summary (record counts, status) to stdout.
  - Returns parsed data for further inspection.
- A `main()` coroutine calls all four and prints a summary block.

To run this script on its own (for manual connector verification):

```bash
python backend/test_connectors.py
```

> Note: When invoked via `pytest` these async functions require an async plugin (e.g. `pytest-asyncio`); running the script directly with `python` is the intended path for quick smoke checks against real services.

---

## Frontend unit/integration tests (Vitest)

- **Location**: `tests/**/*.test.{ts,tsx}`
  - `tests/components.test.tsx` and `tests/ui/*.test.tsx` focus on React components and UI flows.
  - `tests/functional/*.test.ts` and `tests/api.test.ts` exercise functional behavior of the client-side logic.
  - `tests/edge/*.test.ts` and `tests/regression/*.test.ts` cover edge cases and regression scenarios.
  - `tests/uat/*.test.tsx` contains higher-level user acceptance style tests.
- **Framework & config**:
  - Config: `vitest.config.ts`.
  - Environment: `jsdom` with `globals` enabled.
  - Test setup: `tests/setup.ts` (common mocks and DOM setup).
  - Coverage:
    - Provider: V8.
    - Reporters: `text`, `json`, `html`.
    - Global coverage thresholds: 80% for branches, functions, lines, and statements.
  - Module resolution aliases:
    - `@` → repo root.
    - `@tests` → `tests`.
    - `@mocks` → `tests/mocks`.
- **Mocks/test data**:
  - `tests/mocks/` contains reusable mocks for auth, ingestion, scrapers, Supabase, tier enforcement, and external failures, plus a sample CSV and golden datasets.

### Running frontend tests

The `package.json` scripts define the main commands:

- **Single run (CI-style)**:

```bash
npm test
```

This executes:

```bash
vitest run
```

- **Watch mode (during development)**:

```bash
npm run test:watch
```

This runs `vitest` in interactive watch mode.

- **Run a specific test file**:

```bash
npm test -- tests/ui/dashboard.test.tsx
```

Vitest will respect the `include` pattern from `vitest.config.ts` and use the shared `tests/setup.ts`.

---

## End-to-end UI tests (Playwright)

- **Location**: `tests/ui/*.test.tsx`.
- **Framework & runner**: `@playwright/test` with configuration in `playwright.config.ts`.
- **Key config details**:
  - `testDir: 'tests/ui'` – only UI tests in that folder are picked up.
  - `fullyParallel: true` + `workers` tuned for local vs CI.
  - `reporter`:
    - Local: `['html', 'list']` (rich local reports).
    - CI: `['github']`.
  - `timeout: 30_000` ms per test by default.
  - `use` options:
    - `baseURL`: `E2E_BASE_URL` or `http://localhost:3000`.
    - `trace: 'on-first-retry'`, `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`.
    - A `route` handler that:
      - Intercepts `'/api/'` requests and fulfills them with a deterministic mock response.
      - Falls back to `route.continue()` for everything else.
  - **Projects**:
    - Desktop Chrome (`chromium`).
    - Desktop Firefox (`firefox`).
    - Mobile Chrome (`mobile-chrome`, using the `Pixel 5` preset).
  - **Dev server integration** (local only):
    - `webServer` starts `npm run dev` on `http://localhost:3000`, with `reuseExistingServer: true`.

### Running E2E tests

From the repo root:

- **Run the full E2E suite**:

```bash
npm run test:e2e
```

- **Run Playwright in UI mode (for debugging)**:

```bash
npm run test:e2e:ui
```

- **Run headed E2E tests**:

```bash
npm run test:e2e:headed
```

You can also use standard Playwright CLI filters, for example:

```bash
npx playwright test tests/ui/filtering.test.tsx -g "applies fit score filter"
```

---

## Combined frontend + E2E test run

For a quick **front-of-house sanity check** (React + browser flows), use the aggregate script defined in `package.json`:

```bash
npm run test:all
```

This will:

1. Run all Vitest tests (`vitest run`).
2. If they pass, run all Playwright tests (`playwright test`).

---

## Adding new tests

- **Backend (pytest)**:
  - Place new files under `backend/tests/` with a `test_*.py` naming convention.
  - Use the shared fixtures from `conftest.py`:
    - Inject `test_app` when you need a FastAPI `TestClient`.
    - Use `mock_supabase` and `MockSupabaseClient` when you need to control database responses.
  - Keep tests deterministic by avoiding real external API calls; prefer mocks and the Supabase test client.

- **Frontend (Vitest)**:
  - Place new tests alongside existing ones under `tests/**` and follow the `*.test.ts` / `*.test.tsx` naming.
  - Reuse helpers from `tests/setup.ts` and `tests/mocks/*`.
  - Target React components with `@testing-library/react` and user workflows with `@testing-library/user-event`.

- **E2E (Playwright)**:
  - Add new specs to `tests/ui/` and follow the existing patterns for:
    - Navigating via `page.goto(baseURL + '/some-route')`.
    - Interacting with UI elements using locators.
    - Asserting on text/ARIA roles rather than brittle selectors when possible.
  - Keep external dependencies mocked via the `route` hook in `playwright.config.ts` to ensure deterministic runs.

This document should give you a **single place to understand how tests are structured, how to run them, and where to add new coverage** across the backend, frontend, and end-to-end layers.

