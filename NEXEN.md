# NEXEN.md — Project Rules

Official project rules for the SurplusPulse repository, built and maintained within the Codebenders IDE with Nexen AI Assistant support.

## 1. Project Overview

- **Purpose:** SurplusPulse is a food-surplus rescue platform that connects donors, recipients, and volunteers, and tracks food-safety inspection, donation records, and related reporting.
- **Backend:** FastAPI application (`app.main:app`), located in `backend/`. All API routes are mounted under `/api` (portal routes under `/api/portals`, tax routes under `/api/tax`).
- **Frontend:** React 18 with TypeScript (`frontend/tsconfig.json`), built with Vite, styled with Tailwind CSS 3.4. The Vite dev server proxies `/api` to `127.0.0.1:8000`.
- **Database:** SQLite, file `backend/surpluspulse.db` by default (overridable with `SURPLUSPULSE_DB_PATH`). The connection sets `PRAGMA journal_mode = WAL` (`backend/app/database.py`). Keep WAL mode on any new connection path.
- **Configuration:** Pydantic settings in `backend/app/config.py`.
- **Feature names:** "Mirage" is the name of the food-inspection feature (`backend/app/mirage_inspector.py`). Do not rename it. Keep existing routes, tests, and dependencies (including `cactus-compute`) intact unless a task explicitly changes them.

## 2. Coding Standards & Conventions

### Python (backend)
- Target Python 3.11+ syntax with full type hints on public functions and methods.
- Use Pydantic v2 models for request and response bodies. Use `model_config = ConfigDict(...)` or `SettingsConfigDict(...)`, not the v1 `class Config:` form. Use `field_validator` and `model_validator`, not the v1 `validator` decorator.
- Any package imported at runtime (for example `pydantic_settings`) must be listed in `backend/requirements.txt`.
- Keep route handlers thin. Put business logic in modules under `backend/app/`.

### Error handling
- Raise `HTTPException` with an explicit status code for client errors (400, 404, 422) and state what was wrong, without leaking stack traces or internal paths.
- Never return a positive safety or certification result when a check failed or was unavailable. Fail closed: return an explicit "unverified" or error state.
- Catch the narrowest exception type that applies. Do not use bare `except:`. Log exceptions with context before re-raising or converting them.
- Database writes that span multiple statements must be wrapped in a transaction and rolled back on failure.

### Frontend (TypeScript / React)
- Keep all HTTP calls in the central API helper. Use relative `/api/...` paths; do not hardcode `localhost` or ports.
- Do not hardcode API keys or secrets in source. Configuration comes from environment variables.
- Use Tailwind utility classes for styling; avoid ad-hoc inline styles unless a value is computed at runtime.

### Tests and test-driven expectations
- Write or update a test before or alongside any behaviour change, and include a regression test for every bug fix.
- Tests live in `backend/tests/` and use pytest. Use the existing fixtures in `backend/tests/conftest.py`.
- A change is not complete until the relevant tests pass. Report the exact command run and its result.
- Do not delete or weaken an existing test to make a change pass. If a test is wrong, explain why in the change.

### General
- Make the minimal change that satisfies the request. Do not rename identifiers, restructure modules, or remove logic unless asked.
- Do not add generated-by headers, vendor markers, or conversational leftovers to source files.

## 3. Run & Test Commands

Run tests from the repository root:

    python -m pytest backend/tests -v

Start the backend API (from the `backend/` directory):

    cd backend
    python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

Start the frontend dev server (from the `frontend/` directory, after `npm install` if `node_modules` is missing):

    cd frontend
    npm run dev

Start the backend before the frontend, so the Vite `/api` proxy at `127.0.0.1:8000` has a target. Build the frontend with `npm run build`.

## 4. Tooling Environment

Tooling Environment: Codebenders IDE & Nexen AI Assistant

This repository is built and maintained within the Codebenders IDE with Nexen AI Assistant support. Keep this line in the project's configuration and documentation.
