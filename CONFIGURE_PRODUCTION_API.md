# Configure Production API URL

## Problem

Your frontend (Vercel) is trying to call `localhost:8001` instead of your production backend on Render.

**Error:** CORS policy blocking requests because frontend tries to call localhost from production.

---

## Solution: Set Environment Variable in Vercel

### Step 1: Add Environment Variable to Vercel

1. **Go to Vercel Dashboard:**
   ```
   https://vercel.com/dashboard
   ```

2. **Select your Procura project**

3. **Go to Settings:**
   ```
   Project Settings → Environment Variables
   ```

4. **Add this variable:**
   ```
   Key: VITE_API_URL
   Value: https://procura-backend-ozd2.onrender.com/api
   ```

   **Important:** Include `/api` at the end!

5. **Select environment:**
   - ✅ Production
   - ✅ Preview
   - ✅ Development (optional)

6. **Click "Save"**

---

### Step 2: Redeploy Frontend

After adding the environment variable:

1. **In Vercel Dashboard:**
   - Go to: Deployments tab
   - Click: "..." menu on latest deployment
   - Select: "Redeploy"

**Or trigger via Git:**
```bash
# Make a small change and push
git commit --allow-empty -m "trigger: redeploy with API URL"
git push personal main
```

---

### Step 3: Verify Backend is Accessible

**Test your backend directly:**

Open in browser:
```
https://procura-backend-ozd2.onrender.com/api/health
```

**Should return:**
```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

**If you get an error:**
- Backend might be sleeping (Render free tier)
- Wait 30-60 seconds for it to wake up
- Try again

---

### Step 4: Check CORS Configuration

Your backend needs to allow requests from your Vercel domain.

**In your Render backend environment variables:**

Variable should exist:
```
PROCURA_ALLOWED_ORIGINS=https://procura-eight.vercel.app,http://localhost:3000
```

**Check in Render Dashboard:**
1. Go to: https://dashboard.render.com
2. Select: Procura-backend
3. Go to: Environment
4. Verify: `PROCURA_ALLOWED_ORIGINS` includes `https://procura-eight.vercel.app`

**If missing, add it:**
```
PROCURA_ALLOWED_ORIGINS=https://procura-eight.vercel.app,http://localhost:3000
```

Then click "Save Changes" (backend will auto-redeploy)

---

## Complete Environment Variables Checklist

### Vercel (Frontend)

| Variable | Value | Required |
|----------|-------|----------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | ✅ Yes |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key | ✅ Yes |
| `VITE_API_URL` | `https://procura-backend-ozd2.onrender.com/api` | ✅ **ADD THIS** |

### Render (Backend)

| Variable | Value | Required |
|----------|-------|----------|
| `SUPABASE_URL` | Your Supabase project URL | ✅ Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key | ✅ Yes |
| `PROCURA_ALLOWED_ORIGINS` | `https://procura-eight.vercel.app,http://localhost:3000` | ✅ **VERIFY THIS** |
| `ENVIRONMENT` | `production` | ✅ Yes |

---

## Testing After Configuration

### Test 1: Check Network Tab

1. Open production site: `https://procura-eight.vercel.app/#/dashboard`
2. Open DevTools → Network tab
3. Look for API calls

**Should see:**
```
https://procura-backend-ozd2.onrender.com/api/opportunities?page=1&limit=100
Status: 200 OK (or 401 if not logged in)
```

**Should NOT see:**
```
http://localhost:8001/api/...  ❌ Wrong!
```

---

### Test 2: Login and Check Dashboard

1. Login to production
2. Go to Dashboard
3. Should load opportunities (or show empty state)
4. No CORS errors in console

---

### Test 3: Console Check

Open DevTools Console:

**Should NOT see:**
```
❌ Access to fetch at 'http://localhost:8001/...' has been blocked by CORS policy
```

**Should see:**
```
✅ Requests to https://procura-backend-ozd2.onrender.com/api/...
```

---

## Troubleshooting

### Issue: Still calling localhost

**Solution:**
1. Verify environment variable is set in Vercel
2. Redeploy the frontend
3. Hard refresh browser: `Ctrl+Shift+R`
4. Check in DevTools → Console: `import.meta.env.VITE_API_URL`

---

### Issue: CORS error from Render backend

**Error:**
```
Access to fetch at 'https://procura-backend-ozd2.onrender.com/api/...'
from origin 'https://procura-eight.vercel.app' has been blocked by CORS policy
```

**Solution:**
1. Check `PROCURA_ALLOWED_ORIGINS` in Render includes your Vercel domain
2. Backend should have this in environment variables:
   ```
   PROCURA_ALLOWED_ORIGINS=https://procura-eight.vercel.app,http://localhost:3000
   ```
3. After changing, backend will auto-redeploy (wait 2-3 minutes)

---

### Issue: Backend returns 404

**Check:**
1. Backend URL is correct: `https://procura-backend-ozd2.onrender.com/api`
2. Backend is running (check Render logs)
3. Free tier backend might be sleeping - wait 30-60s for it to wake up

---

### Issue: Backend is sleeping (Render free tier)

**Symptom:** First request takes 30-60 seconds

**This is normal** for Render free tier. Options:
1. Wait for it to wake up
2. Upgrade to paid tier (keeps backend always running)
3. Use a "keep-alive" ping service

**Temporary fix:** Keep a tab open pinging the backend every 10 minutes

---

## Quick Fix Commands

### Check environment variable is set (in browser console):

```javascript
console.log('API URL:', import.meta.env.VITE_API_URL);
// Should show: https://procura-backend-ozd2.onrender.com/api
```

### Test backend health:

```bash
curl https://procura-backend-ozd2.onrender.com/api/health
```

### Force Vercel redeploy:

```bash
cd procura-ops-command
git commit --allow-empty -m "chore: redeploy with API URL"
git push personal main
```

---

## Summary

**Do these 3 things:**

1. ✅ **Vercel:** Add `VITE_API_URL=https://procura-backend-ozd2.onrender.com/api`
2. ✅ **Render:** Verify `PROCURA_ALLOWED_ORIGINS` includes your Vercel domain
3. ✅ **Redeploy** frontend in Vercel

**Then test:** Dashboard should load data from your Render backend!

---

## Environment Variable Format Reference

**Vercel (.env):**
```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_API_URL=https://procura-backend-ozd2.onrender.com/api
```

**Render (.env):**
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
PROCURA_ALLOWED_ORIGINS=https://procura-eight.vercel.app,http://localhost:3000
ENVIRONMENT=production
DEBUG=False
```

---

**After configuring:** Your dashboard will load data from the production backend! 🎉
