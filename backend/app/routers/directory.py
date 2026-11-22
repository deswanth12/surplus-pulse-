"""SurplusPulse Organization Directory Router.
Provides donor banquet and receiver shelter registries with 300s TTL in-memory caching.
"""
from __future__ import annotations

import sqlite3
from fastapi import APIRouter, Depends

from app import database
from app.cache import cache_service
from app.config import settings
from app.dependencies import get_db
from app.schemas import DonorOut, ReceiverOut

router = APIRouter(tags=["directory"])


@router.get("/donors", response_model=list[DonorOut])
@router.get("/directory/donors", response_model=list[DonorOut])
def get_donors(conn: sqlite3.Connection = Depends(get_db)):
    """Retrieves master donor directory ordered by name, cached with 300s TTL."""
    cache_key = f"{database.DB_PATH}:donors"
    cached = cache_service.get(cache_key)
    if cached is not None:
        return [DonorOut(**d) for d in cached]

    rows = conn.execute("SELECT * FROM donors ORDER BY name ASC").fetchall()
    donors = [DonorOut(**dict(r)) for r in rows]

    cache_service.set(
        cache_key,
        [d.model_dump() for d in donors],
        ttl_seconds=settings.cache_directory_ttl_seconds,
        tags=["directory"],
    )
    return donors


@router.get("/receivers", response_model=list[ReceiverOut])
@router.get("/directory/receivers", response_model=list[ReceiverOut])
def get_receivers(conn: sqlite3.Connection = Depends(get_db)):
    """Retrieves master receiver shelters and NGOs ordered by name, cached with 300s TTL."""
    cache_key = f"{database.DB_PATH}:receivers"
    cached = cache_service.get(cache_key)
    if cached is not None:
        return [ReceiverOut(**r) for r in cached]

    rows = conn.execute("SELECT * FROM receivers ORDER BY name ASC").fetchall()
    receivers = [ReceiverOut(**dict(r)) for r in rows]

    cache_service.set(
        cache_key,
        [r.model_dump() for r in receivers],
        ttl_seconds=settings.cache_directory_ttl_seconds,
        tags=["directory"],
    )
    return receivers
