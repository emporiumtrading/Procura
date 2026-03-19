# Deployment Guide

Reference for deploying Procura to production. See [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) for the step-by-step checklist.

## Environment Variables

### Backend (required in production)

| Variable                    | Description                         | Example                                                                                               |
| --------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `ENVIRONMENT`               | `production` for prod               | `production`                                                                                          |
| `SUPABASE_URL`              | Supabase project URL                | `https://xxx.supabase.co`                                                                             |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (required in prod) | (from Supabase dashboard)                                                                             |
| `SUPABASE_ANON_KEY`         | Anon/public key                     | (from Supabase dashboard)                                                                             |
| `VAULT_ENCRYPTION_KEY`      | 32-byte base64 Fernet key           | Generate: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `AUDIT_SIGNING_KEY`         | HMAC secret for audit logs          | Generate: `python -c "import secrets; print(secrets.token_hex(32))"`                                  |
| `PROCURA_ALLOWED_ORIGINS`   | Comma-separated CORS origins        | `https://your-app.vercel.app`                                                                         |
| `DEBUG`                     | Set to `false` in production        | `false`                                                                                               |

### Backend (optional)

| Variable                                  | Description                                                |
| ----------------------------------------- | ---------------------------------------------------------- |
| `REDIS_URL`                               | Redis for rate limiting and Celery (optional on free tier) |
| `SENTRY_DSN`                              | Error reporting                                            |
| `GOVCON_API_KEY`, `SAM_GOV_API_KEY`, etc. | Discovery source API keys                                  |

### Frontend (Vercel)

| Variable                 | Description                                            |
| ------------------------ | ------------------------------------------------------ |
| `VITE_SUPABASE_URL`      | Same as backend SUPABASE_URL                           |
| `VITE_SUPABASE_ANON_KEY` | Same as backend SUPABASE_ANON_KEY                      |
| `VITE_API_URL`           | Backend API URL, e.g. `https://api.yourdomain.com/api` |
| `VITE_SENTRY_DSN`        | Optional error reporting                               |

## Migrations

1. Apply migrations in order from `supabase/migrations/` via Supabase SQL Editor.
2. Critical migration: `12_production_auth_fix.sql` (profiles foreign key).
3. Verify: `SELECT tc.constraint_name, con.condeferrable FROM information_schema.table_constraints tc JOIN pg_constraint con ON con.conname = tc.constraint_name WHERE tc.table_name = 'profiles' AND tc.constraint_name = 'profiles_id_fkey';` — expect DEFERRABLE.

## Rollback

### Frontend (Vercel)

- Dashboard → Deployments → Previous deployment → "Promote to Production"
- Or: `git revert HEAD && git push origin main`

### Database

```sql
-- Revert profiles FK to non-deferrable (emergency only)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
```

### Backend

Redeploy previous version; ensure env vars match.

## Staging

See [docs/staging.md](docs/staging.md) for staging environment setup.

## OpenAPI Export

```bash
npm run openapi:export
```

Produces `openapi.json` for external consumers or API documentation.
