# Next Steps to Launch

## Status: Pre-Launch (as of 2026-03-30)

## Signed: devluca999 / P2 CTO

**Launch ready** for Procura means: production can serve real users without silent failures on core jobs (discovery, submissions, auth), secrets and RLS are verified on live infra, CI reflects real security and smoke coverage, and operators can detect misconfiguration quickly. **Current state:** the codebase is strong architecturally and security-minded, but several operational and testing gaps (conditional Celery, split deploy topology, excluded UI and resilience tests, migration churn, OpenManus coupling) must be closed before treating the product as truly launch-ready. The sections below prioritise concrete work.

---

## Priority 0 — Blockers (must fix before any real users)

- **Celery / discovery visibility:** Celery activation is silent when Redis is localhost — add an explicit startup log warning or health check assertion so operators know if scheduled discovery is disabled. This is a silent operational failure in staging and production.
- **E2E bypass in production:** Confirm `VITE_E2E_TEST_MODE=1` guard on the E2E bypass is **not** set in production Vercel config. If it is, any unauthenticated user could access the app with mock admin credentials. Verify Vercel env vars.
- **LLM model default:** `LLM_MODEL` hardcoded to `claude-3-5-sonnet-20241022` — update the default in `backend/config.py` to a current, supported model alias. Stale version strings fail silently when Anthropic deprecates a model endpoint.
- **OpenManus SPOF:** OpenManus is a single point of failure for submissions — before launch, document and implement a **manual submission fallback path**. If OpenManus is unavailable, submissions must not silently fail; they should queue or surface a clear operator error.
- **RLS on production:** Verify RLS is active and correct on all tables in the **production** Supabase project — do not rely solely on migration files. Run an RLS audit query against the live production schema to confirm policies are applied.

---

## Priority 1 — Launch Critical (fix within first sprint)

- **Migration consolidation:** Consolidate migrations 04–11 into clean, sequential files. Files such as `05_fix_signup_comprehensive` through `11_verify_final_fix` are diagnostic patches that make fresh environment setup unreliable. Create a single clean `04_auth_and_signup.sql` (or equivalent) that represents the correct final state, and archive the diagnostic files. Do this before onboarding new team members or new staging environments.
- **`data-testid` on Dashboard:** Add `data-testid` attributes to `pages/Dashboard.tsx` (and related pages) to match what `tests/ui/dashboard.test.tsx` and `tests/ui/filtering.test.tsx` expect, including: `opportunity-card`, `filter-status`, `filter-source`, `filter-min-fit-score`, `sort-select`, `search-input`, `pagination-next`, `error-banner`, `retry-button`, `loading-spinner`, `empty-state`. The tests exist; they cannot attach to current markup.
- **Enable `tests/ui/` in CI:** Once `data-testid` values are in place, enable `tests/ui/` in `vitest.config.ts` (or Playwright config, depending on how those specs are executed). These are API-mocked tests that do not need real credentials — run them as smoke tests on every push.
- **Backend hosting tier:** Confirm production deployment topology: is the backend on Render free tier or paid? Free tier cold starts and spin-down degrade UX. Decide before launch: paid Render, Railway, Fly.io, or another container host.
- **Staging parity:** Set up a staging environment that mirrors production: separate Supabase project, separate Redis, Vercel preview (or equivalent) with production-equivalent env vars — not only CI Supabase tenants.

---

## Priority 2 — Launch Quality (fix before public announcement)

- **Functional auth tests:** Wire up `tests/functional/auth.test.ts` — complete the `authPipeline` mock in `tests/mocks/auth.mock.ts` so the ~434-line auth pipeline suite (RBAC, MFA bypass, session timeout, CSRF, rate limiting) runs in CI. This behaviour should be green before launch.
- **Edge / external failure tests:** Wire up `tests/edge/external-failure.test.ts` — complete the `externalFailureTesting` mock. The circuit breaker, retry logic, and Supabase downtime tests (~533 lines) encode important resilience guarantees; connect the suite and get it passing (subset in CI acceptable if documented, but file should not stay orphaned).
- **Architecture doc:** Update `docs/architecture/overview.md` to reflect the full router list (12 routers, including `company_profile`, `market_intel`, `correspondence`, `follow_ups`, `documents`, etc., if missing today).
- **Monitoring:** Decide on monitoring strategy. Sentry is wired — verify DSNs are set in Vercel (frontend) and backend production env. Add uptime monitoring (Better Stack, UptimeRobot, or similar) on at least `/health`.
- **Release log:** Add `CHANGELOG.md` (or equivalent) at repo root for a versioned record of what changed between deployments.

---

## Priority 3 — Post-Launch (fix after first users)

- **Proposal sections model:** Migrate `proposal_sections` JSONB on `submissions` to a dedicated `proposal_sections` table (one row per section: `section_name`, `content`, `status`, `generated_at`, `submission_id` FK). JSONB blocks per-section query, search, and versioning as the product grows.
- **Vite layout:** Resolve non-standard layout — move `App.tsx`, `index.tsx`, `index.css`, `components/`, `pages/`, `lib/` into `src/`; update `vite.config.ts` entry and `tsconfig.json` paths. Cosmetic for runtime, important for onboarding.
- **Playwright matrix:** Add Firefox and `mobile-chrome` to CI Playwright runs (currently Chromium-only in CI; Firefox and Pixel 5 local-only).
- **UAT contractor workflow:** Build `tests/uat/contractor-workflow.test.tsx` into a runnable, connected test — highest-value user-journey coverage once creds and stability allow.
- **Celery beat configuration:** Consider extracting Celery beat schedule from commented blocks in `main.py` into a dedicated `celery_config.py` with explicit task registration so schedules are visible and not silently disabled.

---

## Testing Readiness Plan

1. **Step 1:** Add `data-testid` to Dashboard and related pages (estimate: 1–2 hours). Unlocks the largest chunk of excluded UI tests.
2. **Step 2:** Enable `tests/ui/` in Playwright (or Vitest) config; verify `dashboard.test.tsx` and `filtering.test.tsx` pass with API mocking. Add them to the CI E2E job — no real credentials required.
3. **Step 3:** Complete `tests/mocks/auth.mock.ts` — implement `authPipeline.canAccessRoute()`, `canPerformSensitiveOperation()`, `checkSessionTimeout()`, `validateCSRFToken()`, `attemptLogin()`, and rate-limit helpers. Then enable `tests/functional/auth.test.ts` in Vitest.
4. **Step 4:** Complete `tests/mocks/external-failure.mock.ts` — implement `externalFailureTesting` with working circuit breaker, retry, and fallback mocks. Enable edge tests per project policy.
5. **Step 5:** Enforce coverage thresholds meaningfully — once functional and edge tests run, the 80% threshold in `vitest.config.ts` becomes a real gate; until then, consider lowering it to match measured coverage to avoid false confidence.
6. **Step 6:** Add `tests/uat/` as a separate CI job on merge to `main` only (not every PR) — slower, credential-heavy journey tests.

---

## Deployment Readiness Checklist

### Infrastructure decisions (confirm before launch)

- [ ] Backend hosting provider confirmed and **paid** tier selected (or equivalent SLA).
- [ ] Production Redis provider confirmed (Upstash or similar — serverless avoids some cold-start patterns).
- [ ] Production Supabase project separated from staging/dev projects.
- [ ] Custom domain on Vercel with SSL.
- [ ] Vercel env vars audited — **`VITE_E2E_TEST_MODE` must not be set** in production.

### Secrets (verify all set in production)

- [ ] `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `VAULT_ENCRYPTION_KEY` (Fernet — fresh for production)
- [ ] `AUDIT_SIGNING_KEY` (HMAC — fresh for production)
- [ ] `ANTHROPIC_API_KEY`
- [ ] `SAM_GOV_API_KEY` + `GOVCON_API_KEY` (or equivalents in use)
- [ ] `SENTRY_DSN` (backend) + `VITE_SENTRY_DSN` (frontend)
- [ ] `REDIS_URL` pointing to production Redis (`redis://` or `rediss://`, non-localhost, so Celery activates)

### Pre-launch verification

- [ ] `GET /health` on production — `database: connected` and `redis: connected` (or explicit degraded state documented).
- [ ] Manually trigger one discovery sync from Admin; confirm `discovery_runs` shows a completed run.
- [ ] Create one test opportunity; run AI qualification; confirm scores populate.
- [ ] Create one test submission through the full approval chain.
- [ ] Verify audit log entries are written and signed.
- [ ] Confirm MFA enrollment on a test account.
- [ ] Run `supabase db push` (or equivalent migration apply) against production schema; confirm all migrations apply cleanly.

---

## Definition of Launch Ready

The following binary checklist defines launch-ready status. **All** items must be checked:

- [ ] All **Priority 0** blockers resolved.
- [ ] All **Priority 1** launch-critical items resolved.
- [ ] CI pipeline green on `main` (backend tests, frontend tests, E2E, build).
- [ ] `tests/ui/` Playwright smoke tests enabled and passing in CI.
- [ ] Production `/health` fully healthy (database + Redis connected, per product definition).
- [ ] Production discovery sync confirmed (at least one successful run).
- [ ] Production submission flow confirmed end-to-end (at least one test submission).
- [ ] Sentry receiving events from frontend and backend.
- [ ] All production secrets set and validated — no default or placeholder values.
- [ ] `VITE_E2E_TEST_MODE` confirmed **absent** from production Vercel environment.
- [ ] Staging environment confirmed separate from production Supabase project.
- [ ] At least one non-developer (contractor or internal tester) completed onboarding.
- [ ] Migration history consolidated (files 04–11 cleaned up) before new team members rely on fresh clones.

When every checkbox above is ticked, Procura is **launch ready**.
