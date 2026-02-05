<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Procura Ops Command 🚀

**Government Contract Capture & Proposal Automation Platform**

Automate the discovery, qualification, and submission of government contract opportunities using AI-powered workflows and intelligent automation.

---

## ✨ Key Features

- 🔍 **Automated Discovery** - Scrape opportunities from SAM.gov, USAspending, and other government sources
- 🤖 **AI Qualification** - Smart scoring using Claude and Gemini to rank opportunities
- 📝 **Submission Automation** - Automated form filling and document submission
- 🔒 **Secure Vault** - Encrypted credential storage with rotation support
- 📊 **Audit Trail** - Cryptographically signed logs for compliance
- 👥 **Admin Dashboard** - Zero-code platform administration

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd procura-ops-command

# Backend setup
cd backend
python -m venv venv
venv\Scripts\activate  # Windows: venv\Scripts\activate | Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

# Frontend setup
cd ..
npm install
cp .env.example .env.local

# Start services
# Terminal 1: Backend
uvicorn backend.main:app --host 0.0.0.0 --port 8001 --reload

# Terminal 2: Frontend
npm run dev

# Terminal 3: Redis
docker run -d -p 6379:6379 --name procura-redis redis:alpine
```

**Access the app:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8001
- API Docs: http://localhost:8001/docs
- Health Check: http://localhost:8001/health

---

## 📚 Documentation

> **👋 New to the project?** Start with [QUICKSTART.md](QUICKSTART.md) for immediate setup

### Implementation Guides
- **[Quick Start](QUICKSTART.md)** - Get up and running in 5 minutes
- **[Implementation Summary](IMPLEMENTATION_SUMMARY.md)** - Recent changes and improvements
- **[Testing Checklist](TESTING_CHECKLIST.md)** - Verify all features work correctly

### Core Documentation
- **[Getting Started](docs/getting-started/README.md)** - Setup and quick start
- **[Setup Guide](docs/getting-started/setup.md)** - Complete environment configuration
- **[Architecture](docs/architecture/overview.md)** - Technical architecture and design

### Development
- **[Backend Guide](docs/development/backend.md)** - Backend development and API
- **[Testing Guide](docs/development/testing.md)** - Testing procedures
- **[Services Reference](docs/development/services-reference.md)** - Running services

### Planning
- **[Project Plan](docs/planning/project-plan.md)** - Complete project roadmap
- **[Admin Dashboard](docs/planning/admin-dashboard.md)** - Admin feature specifications

---

## 🛠️ Tech Stack

**Frontend:**
- React 19 + TypeScript
- Vite + TailwindCSS
- Supabase Auth

**Backend:**
- FastAPI (Python 3.11+)
- Supabase PostgreSQL
- Celery + Redis
- Anthropic Claude / Google Gemini

**Infrastructure:**
- Docker
- Vercel (Frontend)
- Railway/Render (Backend)

---

## 📋 Prerequisites

- **Git** - Version control
- **Python 3.11+** - Backend runtime
- **Node.js 18+** - Frontend development
- **Docker** - For Redis (task queue)
- **Supabase Account** - Database and authentication

---

## 🏗️ Project Structure

```
procura-ops-command/
├── docs/                  # 📚 Documentation
│   ├── getting-started/   # Setup guides
│   ├── development/       # Development guides
│   ├── planning/          # Project planning
│   └── architecture/      # Technical architecture
├── backend/               # 🐍 FastAPI application
│   ├── routers/           # API endpoints
│   ├── scrapers/          # Discovery connectors
│   ├── ai/                # LLM integration
│   ├── security/          # Vault & audit
│   └── tasks/             # Background jobs
├── src/                   # ⚛️ React application
├── components/            # UI components
├── pages/                 # Route pages
├── supabase/              # Database migrations
└── README.md              # This file
```

---

## 🔒 Security

- **Authentication**: Supabase JWT with MFA support
- **Encryption**: Fernet (AES-128) for credentials
- **Audit Logs**: HMAC-SHA256 signed trails
- **RLS**: Row-level security policies
- **HTTPS**: All API communication encrypted

---

## 🧪 Testing

```bash
# Backend tests
cd backend
pytest

# Test connectors
python test_connectors.py

# API health check
curl http://localhost:8001/health
```

See the [Testing Guide](docs/development/testing.md) for comprehensive testing procedures.

---

## 🤝 Contributing

1. Read the [Getting Started Guide](docs/getting-started/README.md)
2. Review the [Architecture](docs/architecture/overview.md)
3. Check the [Project Plan](docs/planning/project-plan.md)
4. Follow the [Development Guide](docs/development/backend.md)

---

## 📄 License

Proprietary - All Rights Reserved

---

## 🆘 Support

- **Documentation**: Check the `/docs` directory
- **API Docs**: http://localhost:8001/docs (when running)
- **Issues**: Report in the project repository

---

<div align="center">

**Built with ❤️ for government contractors**

[Documentation](docs/) • [Architecture](docs/architecture/overview.md) • [Contributing](docs/getting-started/README.md)

</div>
