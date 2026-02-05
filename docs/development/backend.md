# Backend Development Guide

## Overview

The Procura backend is a production-grade FastAPI application that handles:
- Contract opportunity discovery and storage
- AI-powered qualification using LLMs
- Submission workflow management
- Audit logging and compliance

---

## Quick Start

### Prerequisites

- Python 3.11+
- Redis (for Celery task queue)
- Supabase account (for database and auth)

### Setup

1. **Create virtual environment:**
   ```bash
   cd backend
   python -m venv venv
   ```

2. **Install dependencies:**
   ```bash
   venv\Scripts\python.exe -m pip install -r requirements.txt
   ```

3. **Configure environment:**
   ```bash
   copy .env.example .env
   # Edit .env with your actual values
   ```

4. **Generate security keys:**
   ```bash
   # Vault encryption key
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

   # Audit signing key
   python -c "import secrets; print(secrets.token_hex(32))"
   ```

5. **Start the server:**
   ```bash
   venv\Scripts\python.exe -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8001
   ```

6. **Access API docs:**
   - Swagger UI: http://localhost:8001/docs
   - ReDoc: http://localhost:8001/redoc

---

## Project Structure

```
backend/
├── main.py              # FastAPI app entry point
├── config.py            # Environment configuration
├── database.py          # Supabase client
├── dependencies.py      # Auth middleware
├── models.py            # Pydantic schemas
├── routers/             # API endpoints
│   ├── opportunities.py
│   ├── submissions.py
│   ├── connectors.py
│   ├── audit.py
│   └── admin.py
├── scrapers/            # Data source connectors
│   ├── base.py
│   ├── govcon_api.py
│   ├── sam_gov.py
│   └── usaspending.py
├── ai/                  # LLM integration
│   ├── llm_client.py
│   └── qualification.py
├── automation/          # OpenManus integration
│   ├── openmanus_client.py
│   └── submission_engine.py
├── security/            # Encryption & signing
│   ├── vault.py
│   └── audit.py
└── tasks/               # Celery tasks
    ├── celery_app.py
    └── discovery.py
```

---

## API Endpoints

### Opportunities (`/api/opportunities`)
- `GET /` - List with filters
- `GET /{id}` - Get single
- `POST /sync` - Trigger discovery
- `PATCH /{id}/disqualify` - Disqualify
- `POST /{id}/qualify` - AI qualification

### Submissions (`/api/submissions`)
- `GET /` - List user's submissions
- `POST /` - Create workspace
- `PATCH /{id}` - Update
- `POST /{id}/approve` - Approve step
- `POST /{id}/finalize` - Execute submission

### Connectors (`/api/connectors`)
- `GET /` - List all (admin)
- `POST /` - Create
- `POST /{id}/rotate` - Rotate credentials
- `DELETE /{id}` - Revoke

### Admin (`/api/admin`)
- `GET /users` - List users
- `GET /health` - System health
- `PATCH /autonomy` - Toggle autonomy mode

---

## Running Celery Workers

For scheduled discovery tasks:

1. **Start Redis:**
   ```bash
   docker run -d -p 6379:6379 redis:alpine
   ```

2. **Start Celery worker:**
   ```bash
   venv\Scripts\celery.exe -A backend.tasks.celery_app worker --loglevel=info --pool=solo
   ```

   Note: `--pool=solo` is required for Windows

3. **Start Celery beat (scheduler):**
   ```bash
   venv\Scripts\celery.exe -A backend.tasks.celery_app beat --loglevel=info
   ```

---

## Testing

### Run all tests
```bash
venv\Scripts\py.test.exe
```

### Test specific connector
```bash
venv\Scripts\python.exe test_connectors.py
```

### Test API endpoint
```bash
curl http://localhost:8001/health
```

---

## Environment Variables

Required variables in `.env`:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key
SUPABASE_ANON_KEY=your-anon-key

# Redis (for Celery)
REDIS_URL=redis://localhost:6379/0

# Discovery APIs
GOVCON_API_KEY=your-key
SAM_GOV_API_KEY=your-key
NEWS_API_KEY=your-key

# LLM Providers
GOOGLE_API_KEY=your-key
ANTHROPIC_API_KEY=your-key
PROCURA_LLM_PROVIDER=anthropic

# Security
VAULT_ENCRYPTION_KEY=your-fernet-key
AUDIT_SIGNING_KEY=your-hmac-key

# OpenManus
OPENMANUS_API_URL=http://localhost:8080
```

---

## Security

- **Authentication**: Supabase JWT tokens
- **Authorization**: Role-based (admin, contract_officer, viewer)
- **Credentials**: Fernet encryption (AES-128)
- **Audit Logs**: HMAC-SHA256 signed for integrity
- **RLS**: Row-level security in Supabase

---

## Common Development Tasks

### Adding a new API endpoint
1. Create route function in appropriate router file
2. Add Pydantic models in `models.py`
3. Implement business logic
4. Add authentication/authorization decorators
5. Test with Swagger UI

### Adding a new data source
1. Create new connector in `scrapers/`
2. Inherit from `BaseConnector`
3. Implement `fetch_opportunities()` and `normalize()`
4. Add to Celery schedule in `main.py`
5. Test with `test_connectors.py`

### Debugging Celery tasks
1. Check Redis connection: `redis-cli ping`
2. View Celery logs for errors
3. Test task directly: `python -c "from backend.tasks.discovery import run_discovery_task; run_discovery_task()"`

---

For more information, see the [Architecture Overview](../architecture/overview.md).
