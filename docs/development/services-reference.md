# 🚀 Procura Services - Running Status

**Last Updated**: 2026-01-28 23:48

---

## ✅ All Services Running

### 1. **Backend API** - FastAPI

- **URL**: http://localhost:8001
- **API Docs**: http://localhost:8001/docs
- **Health**: http://localhost:8001/health
- **Status**: ✅ Running
- **Command**: `backend\venv\Scripts\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8001 --reload`

### 2. **Frontend UI** - React + Vite

- **URL**: http://localhost:3000
- **Status**: ✅ Running
- **Command**: `npm run dev`

### 3. **Redis** - Task Queue

- **URL**: redis://localhost:6379
- **Container**: procura-redis
- **Status**: ✅ Running
- **Command**: `docker run -d -p 6379:6379 --name procura-redis redis:alpine`

### 4. **Database** - Supabase PostgreSQL

- **URL**: https://zspsrdicgjihdoilciyk.supabase.co
- **Status**: ✅ Connected
- **Dashboard**: https://supabase.com/dashboard/project/zspsrdicgjihdoilciyk

---

## 🔑 Configured API Keys

| Service          | Status      | Notes                                              |
| ---------------- | ----------- | -------------------------------------------------- |
| Supabase         | ✅ Complete | URL, Anon Key, Service Role Key                    |
| GovCon API       | ✅ Complete | Configured in backend env (do not paste keys here) |
| News API         | ✅ Complete | Configured in backend env (do not paste keys here) |
| USAspending      | ✅ Public   | No key required                                    |
| SAM.gov          | ⚠️ Pending  | Register at sam.gov                                |
| Anthropic Claude | ⚠️ Pending  | Get from console.anthropic.com                     |
| OpenAI           | ⚠️ Optional | Fallback provider                                  |

---

## 📡 Quick Access URLs

### Development

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8001
- **API Documentation**: http://localhost:8001/docs
- **API Health Check**: http://localhost:8001/health

### Production (Supabase)

- **Database Dashboard**: https://supabase.com/dashboard/project/zspsrdicgjihdoilciyk
- **Table Editor**: https://supabase.com/dashboard/project/zspsrdicgjihdoilciyk/editor
- **SQL Editor**: https://supabase.com/dashboard/project/zspsrdicgjihdoilciyk/sql
- **Authentication**: https://supabase.com/dashboard/project/zspsrdicgjihdoilciyk/auth/users

---

## 🛠️ Common Commands

### Start Services

```bash
# Backend
cd backend
venv\Scripts\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8001 --reload

# Frontend
npm run dev

# Redis (if not running)
docker start procura-redis
# OR if container doesn't exist:
docker run -d -p 6379:6379 --name procura-redis redis:alpine
```

### Stop Services

```bash
# Backend - Ctrl+C in terminal

# Frontend - Ctrl+C in terminal

# Redis
docker stop procura-redis
```

### Fix Port Conflicts (Windows)

If you accidentally left services running, clear the ports before starting again.

```powershell
# Find the process using a port
netstat -ano | findstr :8001
netstat -ano | findstr :3000

# Kill by PID (replace <pid>)
taskkill /PID <pid> /F
```

Alternative PowerShell-native:

```powershell
Get-NetTCPConnection -LocalPort 8001 | Select-Object -First 1 -ExpandProperty OwningProcess
Stop-Process -Id <pid> -Force
```

### Check Status

```bash
# Backend health
Invoke-RestMethod -Uri http://localhost:8001/health

# Frontend
Invoke-RestMethod -Uri http://localhost:3000

# Redis
docker ps --filter "name=procura-redis"
```

### View Logs

```bash
# Backend - in terminal where uvicorn is running

# Frontend - in terminal where npm dev is running

# Redis
docker logs procura-redis
```

---

## 🔄 Celery Workers (Optional - For Scheduled Tasks)

To enable scheduled discovery tasks:

```bash
# Terminal 1 - Celery Worker
cd backend
venv\Scripts\celery.exe -A backend.tasks.celery_app worker --loglevel=info --pool=solo

# Terminal 2 - Celery Beat (Scheduler)
cd backend
venv\Scripts\celery.exe -A backend.tasks.celery_app beat --loglevel=info
```

**Note**: Celery requires Redis to be running.

---

## 📊 Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    USER BROWSER                              │
│                  http://localhost:3000                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  REACT FRONTEND (Vite)                       │
│                    Port 3000                                 │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/REST
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  FASTAPI BACKEND                             │
│                    Port 8001                                 │
│  /api/opportunities | /api/submissions | /api/connectors    │
└───────┬──────────────────────┬──────────────────────────────┘
        │                      │
        ▼                      ▼
┌───────────────┐      ┌───────────────┐
│   SUPABASE    │      │  REDIS        │
│  PostgreSQL   │      │  Port 6379    │
│   + Auth      │      │  (Celery)     │
└───────────────┘      └───────────────┘
```

---

## 🎯 Next Steps

1. **Test Frontend**: Open http://localhost:3000 in your browser
2. **Test Backend**: Open http://localhost:8001/docs for API documentation
3. **Get API Keys**:
   - SAM.gov: https://sam.gov/content/entity-information
   - Anthropic: https://console.anthropic.com
4. **Start Celery** (optional): For scheduled discovery tasks
5. **Begin Integration**: Connect frontend pages to backend APIs

---

## 🐛 Troubleshooting

### Backend won't start

- Check if port 8001 is available
- Verify `.env` file exists in `backend/` directory
- Ensure virtual environment is activated

### Frontend won't start

- Run `npm install` if dependencies are missing
- Check if port 3000 is available
- Verify `.env.local` file exists

### Redis connection failed

- Check if Docker is running
- Verify Redis container: `docker ps --filter "name=procura-redis"`
- Restart container: `docker restart procura-redis`

### Database connection failed

- Verify Supabase URL and keys in `.env`
- Check Supabase project status in dashboard
- Ensure migrations have been run

---

**Status**: All core services operational ✅
