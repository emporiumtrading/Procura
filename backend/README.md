# Procura Backend

Production-grade FastAPI backend for the Government Contract Opportunity Automation Platform.

## Quick Start

```bash
# Setup
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt

# Configure
cp .env.example .env
# Edit .env with your credentials

# Run
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8001
```

**API Documentation**: http://localhost:8001/docs

---

## Documentation

For detailed backend development information, see:

- **[Backend Development Guide](../docs/development/backend.md)** - Complete setup and development guide
- **[Architecture Overview](../docs/architecture/overview.md)** - Technical architecture
- **[Getting Started](../docs/getting-started/README.md)** - Full project setup

---

## Tech Stack

- **Framework**: FastAPI 0.110+
- **Runtime**: Python 3.11+
- **Database**: Supabase PostgreSQL
- **Task Queue**: Celery + Redis
- **AI**: Anthropic Claude, Google Gemini
- **Security**: Fernet encryption, HMAC signing

---

## Key Features

- ✅ Automated contract discovery from multiple government sources
- ✅ AI-powered opportunity qualification
- ✅ Encrypted credential vault
- ✅ Background task scheduling with Celery
- ✅ Comprehensive audit logging
- ✅ Role-based access control

---

## Project Structure

```
backend/
├── routers/       # API endpoints
├── scrapers/      # Discovery connectors
├── ai/            # LLM integration
├── automation/    # Browser automation
├── security/      # Vault & audit
└── tasks/         # Celery tasks
```

---

**Need help?** Check the [documentation](../docs/) or run the server and visit http://localhost:8001/docs
