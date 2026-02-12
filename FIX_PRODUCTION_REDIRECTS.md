# Fix Production Email Redirect URLs

## Problem

When users click the email confirmation link after signup, they're redirected to `localhost` instead of your production domain.

**Root Cause:** Supabase project settings still have `localhost` as an allowed redirect URL and it's being prioritized.

---

## Solution (5 minutes)

### Step 1: Update Supabase Redirect URLs

1. **Go to Supabase Dashboard:**
   ```
   https://supabase.com/dashboard
   ```

2. **Navigate to your project**

3. **Go to Authentication Settings:**
   ```
   Left sidebar → Authentication → URL Configuration
   ```

4. **Update Site URL:**
   - Find: **"Site URL"**
   - Change to: `https://your-production-domain.vercel.app`
   - Or your custom domain: `https://procura.yourdomain.com`

5. **Update Redirect URLs:**
   - Find: **"Redirect URLs"**
   - Remove or comment out: `http://localhost:3000/*`
   - Add your production URLs:
     ```
     https://your-production-domain.vercel.app/**
     https://your-production-domain.vercel.app/#/dashboard
     https://your-production-domain.vercel.app/#/reset-password
     ```

   **Note:** Include `/**` to allow all paths under your domain

6. **Click "Save"**

---

### Step 2: (Optional) Support Both Local Dev and Production

If you want email links to work in both development and production:

**Redirect URLs should include:**
```
http://localhost:3000/**
http://localhost:3000/#/dashboard
http://localhost:3000/#/reset-password
https://your-production-domain.vercel.app/**
https://your-production-domain.vercel.app/#/dashboard
https://your-production-domain.vercel.app/#/reset-password
```

**Note:** Supabase will redirect to the domain that matches where the signup/reset was initiated.

---

### Step 3: Verify the Fix

1. **Sign up a new user** in production

2. **Check your email**

3. **Click the confirmation link**

4. **Verify:**
   - ✅ Should redirect to: `https://your-production-domain.vercel.app/#/dashboard`
   - ❌ Should NOT redirect to: `http://localhost:3000`

---

## Additional Configuration (Recommended)

### Email Template Customization

While in Supabase Dashboard:

1. **Go to:** Authentication → Email Templates

2. **For "Confirm signup" template:**
   - Find: `{{ .ConfirmationURL }}`
   - Verify it's using the correct redirect URL

3. **For "Reset password" template:**
   - Find: `{{ .ConfirmationURL }}`
   - Verify it's using the correct redirect URL

---

## Common Issues

### Issue: Still redirecting to localhost

**Check:**
1. Clear browser cache
2. Sign up with a NEW email (not one used before)
3. Verify Supabase settings were saved
4. Check email template isn't hardcoded to localhost

---

### Issue: Getting CORS errors

**Fix in Supabase:**
1. Dashboard → Settings → API
2. Add your production domain to CORS allowed origins

---

### Issue: Email not arriving

**Check:**
1. Spam folder
2. Supabase Dashboard → Logs → check for email sending errors
3. Email rate limits (Supabase free tier has limits)

---

## Testing Checklist

After configuring Supabase:

- [ ] Sign up with new email in production
- [ ] Receive confirmation email
- [ ] Click link redirects to production domain (not localhost)
- [ ] Password reset email redirects to production domain
- [ ] Both development (localhost) and production work (if dual config)

---

## Environment-Specific Configuration (Alternative Approach)

If you want different behavior in dev vs prod, you can use environment variables:

### Add to `.env.local` (development):
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_URL=http://localhost:3000
```

### Add to Vercel Environment Variables (production):
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_URL=https://your-production-domain.vercel.app
```

### Then update code to use env var:

**lib/AuthContext.tsx:**
```typescript
const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;

const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
            },
            emailRedirectTo: `${appUrl}/#/dashboard`,
        },
    });
    return { error };
};
```

**But this is optional** - fixing Supabase redirect URLs is simpler and recommended.

---

## Quick Fix Summary

**Just do this:**

1. Supabase Dashboard → Authentication → URL Configuration
2. Site URL: `https://your-production-domain.vercel.app`
3. Redirect URLs: Add `https://your-production-domain.vercel.app/**`
4. Save
5. Test signup in production

**Done!** ✅

---

## What Your Production URL Is

Check your Vercel dashboard:
```
https://vercel.com/dashboard → Your Project → Domains
```

You'll see something like:
- `procura-xyz123.vercel.app` (auto-generated)
- Or your custom domain if configured

Use that URL in Supabase settings.

---

**After fixing:** Test signup again and the email link will redirect to your production domain instead of localhost!
