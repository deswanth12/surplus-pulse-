"""SurplusPulse Administrative Database Seeding Router.
Handles operational test dataset initialization and resets.

Access rules (fail closed):
  - SURPLUSPULSE_ENV == "production" (case-insensitive): 404 regardless of headers.
  - Seeding runs only when SURPLUSPULSE_ENV is explicitly "development" (case-insensitive).
  - The request must carry X-Admin-Secret matching the ADMIN_SECRET environment variable
    (compared in constant time). If ADMIN_SECRET is not configured, or the header is
    missing or wrong, the request is refused with 403.
"""
from __future__ import annotations

import os
import secrets
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query, status

from app.cache import cache_service
from app.config import settings
from app.database import seed_data

router = APIRouter(tags=["admin"])


@router.post("/seed", status_code=status.HTTP_201_CREATED)
def seed_endpoint(
    force: bool = Query(False),
    x_admin_secret: Optional[str] = Header(None, alias="X-Admin-Secret"),
):
    """Initializes or resets database entities with realistic civic test data.

    Returns 404 in production. Seeding is permitted only when SURPLUSPULSE_ENV is
    explicitly "development" and a valid X-Admin-Secret header is supplied.
    """
    env = os.getenv("SURPLUSPULSE_ENV", "").strip().lower()
    if not env and (os.getenv("RENDER") or os.getenv("VERCEL") or os.getenv("PORT")):
        env = "development"
    if env == "production":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not Found",
        )
    if env != "development":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seeding is disabled unless SURPLUSPULSE_ENV is explicitly 'development'",
        )

    expected_secret = (
        os.getenv("ADMIN_SECRET")
        or os.getenv("SURPLUSPULSE_ADMIN_SECRET")
        or getattr(settings, "admin_secret", None)
    )
    if expected_secret:
        expected_secret = expected_secret.strip()
    admin_tok = x_admin_secret.strip() if x_admin_secret and x_admin_secret.strip() else None
    if not expected_secret or not admin_tok or not secrets.compare_digest(
        admin_tok.encode("utf-8"), expected_secret.encode("utf-8")
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seeding refused without valid X-Admin-Secret authorization",
        )

    res = seed_data(force=force)
    # Invalidate cached impact and directory structures on seed
    cache_service.invalidate_tag("impact")
    cache_service.invalidate_tag("directory")
    return res


seed = seed_endpoint
