# Procura Ops - Quick Start Guide

## Prerequisites
- Node.js (v18+)
- Python (3.10+)
- Supabase account
- API keys for SAM.gov, GovCon, etc.

---

## Setup (First Time)

### 1. Frontend Setup

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Edit .env.local with your credentials:
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_ANON_KEY
# - VITE_API_URL (should be http://localhost:8001/api)
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment (Windows)
python -m venv venv
venv\Scripts\activate

# Create virtual environment (Mac/Linux)
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create environment file
cp .env.example .env

# Edit .env with your credentials:
# - SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY
# - GOVCON_API_KEY
# - ANTHROPIC_API_KEY or GOOGLE_API_KEY (for AI)
# - PORT=8001
```

---

## Running the Application

### Terminal 1: Start Backend

```bash
cd backend
source venv/Scripts/activate  # Windows: venv\Scripts\activate

# Run the server on port 8001
python -m uvicorn backend.main:app --reload --port 8001

# You should see:
# INFO:     Uvicorn running on http://0.0.0.0:8001
# INFO:     Application startup complete
```

**Verify Backend**:
- Visit http://localhost:8001 (should show API info)
- Visit http://localhost:8001/health (should show health status)
- Visit http://localhost:8001/docs (Swagger UI)

### Terminal 2: Start Frontend

```bash
# From project root
npm run dev

# You should see:
# VITE ready in XXXms
# Local: http://localhost:5173
```

**Verify Frontend**:
- Visit http://localhost:5173
- Should see Procura login page

---

## First Login

1. Navigate to http://localhost:5173
2. Sign in with your Supabase credentials
3. You should land on the Dashboard

---

## Testing the Workflow

### 1. Dashboard (Browse Opportunities)

**Desktop View**:
- ✓ Left side: Opportunity list
- ✓ Right side: Permanent detail panel
- ✓ First opportunity auto-selected
- ✓ Empty state if no opportunities

**Mobile View**:
- ✓ Full-width list
- ✓ Tap opportunity → modal drawer opens
- ✓ Tap backdrop or X → modal closes

**Actions**:
```bash
1. Click "Sync Opportunities"
   → Fetches from SAM.gov, GovCon
   → List populates with opportunities

2. Click an opportunity row
   → Right panel shows details
   → Metadata, scores, description

3. Click "AI Qualify"
   → Sends to LLM for scoring
   → Shows fit, effort, urgency scores
   → Updates AI summary

4. Click "Start Proposal"
   → Creates submission
   → Navigates to workspace
```

### 2. Submissions (Manage Proposals)

```bash
1. Click "Submissions" in sidebar
2. See list of active submissions
3. Click one to open workspace
4. Edit, collaborate, finalize
```

### 3. Admin Dashboard (System Settings)

```bash
1. Click "Admin" in sidebar
2. Overview tab:
   - System metrics (real data)
   - Status indicators
3. Users tab:
   - User list from Supabase
4. Discovery tab:
   - Data sources configuration
5. AI Config tab:
   - LLM settings
```

### 4. Audit Logs (Compliance Trail)

```bash
1. Click "Audit Logs" in sidebar
2. View submission history
3. Verify cryptographic signatures
4. Export logs
```

---

## Common Issues & Solutions

### Backend won't start
```bash
# Check port 8001 is not in use
netstat -ano | findstr :8001  # Windows
lsof -i :8001                 # Mac/Linux

# If occupied, kill the process or change PORT in .env
```

### Frontend can't connect to backend
```bash
# Verify backend is running on port 8001
curl http://localhost:8001/health

# Check .env.local has correct API URL:
VITE_API_URL=http://localhost:8001/api

# Restart frontend after changing .env
```

### No opportunities showing
```bash
# Check API keys in backend/.env
GOVCON_API_KEY=your-real-key
SAM_GOV_API_KEY=your-real-key

# Click "Sync Opportunities" button
# Check browser console for errors (F12)
# Check backend logs for API errors
```

### AI Qualify not working
```bash
# Check LLM provider is configured
PROCURA_LLM_PROVIDER=anthropic  # or google
ANTHROPIC_API_KEY=sk-ant-...   # or GOOGLE_API_KEY

# Verify model is set
LLM_MODEL=claude-3-5-sonnet-20241022

# Check backend logs for LLM errors
```

### Database connection failed
```bash
# Verify Supabase credentials
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Check Supabase is online
curl https://your-project.supabase.co

# Verify tables exist (profiles, opportunities, submissions)
```

---

## Health Check

**Backend Health**:
```bash
curl http://localhost:8001/health
```

Expected response:
```json
{
  "status": "healthy",
  "checks": {
    "database": "connected",
    "redis": "not configured (optional)"
  },
  "environment": "development"
}
```

**Frontend Health**:
- Open browser console (F12)
- No error messages
- Network tab shows successful API calls

---

## Features Overview

### ✅ Working Features
- ✓ Opportunity discovery (SAM.gov, GovCon)
- ✓ AI qualification (fit, effort, urgency scoring)
- ✓ Submission workflow (create, edit, finalize)
- ✓ Audit logging (cryptographic trail)
- ✓ User management (Supabase auth)
- ✓ Admin dashboard (metrics, settings)
- ✓ Responsive design (desktop, mobile)

### ⚠️ Not Implemented (Yet)
- ❌ Browser automation (OpenManus)
- ❌ Background jobs (Celery)
- ❌ Feature flags system
- ❌ Workflow autonomy
- ❌ Email notifications

---

## Development Tips

### Hot Reload
Both frontend and backend support hot reload:
- Frontend: Changes auto-refresh browser
- Backend: Changes auto-restart server (with --reload)

### Debugging
**Frontend**:
```bash
# Browser DevTools (F12)
# React DevTools extension
# Console tab for errors
# Network tab for API calls
```

**Backend**:
```bash
# Check terminal logs
# Add print() or logger.info() statements
# Visit /docs for API testing
```

### Testing API Endpoints
```bash
# Use Swagger UI
http://localhost:8001/docs

# Or use curl
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:8001/api/opportunities
```

---

## Production Deployment

### Environment Variables
**Frontend (.env.production)**:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=https://api.yourapp.com/api
```

**Backend (.env)**:
```env
ENVIRONMENT=production
DEBUG=false
PORT=8001
# ... all other production credentials
```

### Build Commands
```bash
# Frontend
npm run build
# Output: dist/

# Backend
# Use gunicorn or similar WSGI server
gunicorn backend.main:app --workers 4 --bind 0.0.0.0:8001
```

---

## Getting Help

1. Check `IMPLEMENTATION_SUMMARY.md` for architecture details
2. Review plan document for feature specifications
3. Check backend logs for error details
4. Use browser console for frontend issues

---

## Next Steps

After successful setup:
1. ✓ Explore the Dashboard
2. ✓ Sync some opportunities
3. ✓ Test AI qualification
4. ✓ Create a test submission
5. ✓ Review Admin dashboard
6. ✓ Check audit logs
7. ✓ Customize system settings

**Status**: ✅ Ready for development and testing!
