"""SurplusPulse FastAPI Application.
Hyperlocal Food Rescue, Smart Proximity Matching, and ESG Impact Engine.
Modularized architecture using APIRouters and dependency injection.
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import database
from app.config import settings
from app.database import init_db, seed_data
from app.routers import directory, dispatch, impact, inspection, listings, matches, portals, seed, tax, telemetry
from app.routers.seed import seed_endpoint


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Auto-seed initial test data only when SURPLUSPULSE_ENV is explicitly "development"
    if os.getenv("SURPLUSPULSE_ENV", "").strip().lower() == "development":
        seed_data(force=False)
    yield


app = FastAPI(
    title=settings.app_title,
    version=settings.app_version,
    lifespan=lifespan,
)

# CORS Configuration
cors_origins = list(settings.cors_origins)
frontend_binding = os.getenv("FRONTEND_URL")
if frontend_binding and frontend_binding not in cors_origins:
    cors_origins.append(frontend_binding)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Modular Routers under /api
app.include_router(listings.router, prefix="/api")
app.include_router(dispatch.router, prefix="/api")
app.include_router(telemetry.router, prefix="/api")
app.include_router(tax.router, prefix="/api")
app.include_router(portals.router, prefix="/api")
app.include_router(matches.router, prefix="/api")
app.include_router(impact.router, prefix="/api")
app.include_router(directory.router, prefix="/api")
app.include_router(inspection.router, prefix="/api")
app.include_router(seed.router, prefix="/api")

# Backward Compatibility Re-Exports for Test Fixtures and Monkeypatching
seed = seed_endpoint
DB_PATH = database.DB_PATH
get_connection = database.get_connection

# Unified Production Static SPA Mount
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend_dist")
