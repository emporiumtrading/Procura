# Procura Ops Command - Technical Overview

## Project Summary
**Procura Ops Command** is a government contract capture and proposal automation platform. It leverages AI to discover, qualify, and submit proposals for government contracts (SAM.gov, etc.).

## Architecture & Tech Stack

### Frontend
- **Framework**: React 19 + TypeScript (Vite)
- **Styling**: TailwindCSS
- **State Management**: React Context (`UseAuth`, etc.)
- **Routing**: `react-router-dom`
- **Authentication**: Supabase Auth
- **Structure**:
    - **Entry**: `index.tsx`, `App.tsx` (Root level)
    - **Components**: `components/` (Root level)
    - **Pages**: `pages/` (Root level)
    - **Utilities**: `src/lib/`, `src/context/` (Note: `src` is used sparingly)

### Backend
- **Framework**: FastAPI (Python 3.11+)
- **Database**: Supabase PostgreSQL
- **Async Tasks**: Celery + Redis
- **AI Integration**: Anthropic Claude / Google Gemini
- **Structure**:
    - **Entry**: `backend/main.py`
    - **Modules**: `routers/`, `scrapers/`, `ai/`, `security/`, `tasks/`

## Current Status (Recent Refactoring)
The codebase has recently undergone significant cleanup and stabilization (as per `IMPLEMENTATION_SUMMARY.md`):

1.  **Mock Data Removal**: `AdminDashboard` and other pages now fetch real data from the backend.
2.  **Navigation Cleanup**: Unused pages (`CredentialsAdmin`, `RunHistory`) were removed.
3.  **UI/UX Improvements**:
    -   Permanent side panel for details on desktop.
    -   Improved mobile drawer.
    -   Loading states and empty states added throughout.
4.  **Connectivity**:
    -   Frontend points to `http://localhost:8001/api`.
    -   Backend runs on port 8001.
    -   Retry logic and timeouts added to API client.

## Key Directories

| Directory | Description |
| :--- | :--- |
| `backend/` | FastAPI application source code |
| `components/` | Reusable React components (Sidebar, etc.) |
| `pages/` | Top-level page components (Dashboard, AdminDashboard, etc.) |
| `src/` | Helper libraries (`lib`) and context providers (`context`) |
| `supabase/` | Database migrations and configuration |
| `docs/` | Comprehensive project documentation |

## Getting Started
- **Backend API Docs**: `http://localhost:8001/docs`
- **Frontend**: `http://localhost:5173`
- **Health Check**: `http://localhost:8001/health`
