# Staging Environment

Staging is a production-like environment for testing before release.

## Configuration

Set `ENVIRONMENT=staging` in your backend and use a separate Supabase project (or schema) for staging data.

### Backend (.env)

```env
ENVIRONMENT=staging
DEBUG=false
LOG_LEVEL=INFO

# Use a separate Supabase project for staging
SUPABASE_URL=https://your-staging-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<staging-service-role-key>
SUPABASE_ANON_KEY=<staging-anon-key>

# Staging CORS - add your staging frontend URL
PROCURA_ALLOWED_ORIGINS=https://staging.yourdomain.com,https://your-app-staging.vercel.app
```

### Frontend (.env.staging)

```env
VITE_SUPABASE_URL=https://your-staging-project.supabase.co
VITE_SUPABASE_ANON_KEY=<staging-anon-key>
VITE_API_URL=https://api-staging.yourdomain.com/api
```

### Vercel Staging

1. Create a separate Vercel project or use Preview deployments.
2. For a dedicated staging URL: add a branch `staging` and deploy it, or use a custom domain.
3. Set environment variables in Vercel → Settings → Environment Variables (scope to Preview or Staging).

### Deployment Flow

```bash
# Deploy to staging (e.g. from staging branch)
git checkout staging
git merge main
git push origin staging

# Vercel auto-deploys previews; configure staging domain if needed
```

## Differences from Production

| Setting          | Staging      | Production   |
| ---------------- | ------------ | ------------ |
| ENVIRONMENT      | staging      | production   |
| DEBUG            | false        | false        |
| Required secrets | Same as prod | Same as prod |
| API docs (/docs) | Disabled     | Disabled     |

## Verification

After deploying to staging:

1. Run smoke tests: login, dashboard load, API health.
2. Verify no production data is used.
3. Test migrations on staging DB before production.
