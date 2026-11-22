"""SurplusPulse Authentication Dependency.
Provides authentic API key and Bearer token verification for mutating routes.
Strictly fails closed across all environments:
  - if no API key is configured, every protected request is rejected (HTTP 401);
  - a request with no, malformed, or incorrect credential is rejected (HTTP 401).
Accepted credentials: X-API-Key: <key> or Authorization: Bearer <key>.
"""
from __future__ import annotations

import logging
import os
import secrets
from typing import Optional

from fastapi import Header, HTTPException, Request, status

from app.config import settings

logger = logging.getLogger(__name__)

_WWW_AUTHENTICATE = {"WWW-Authenticate": "Bearer"}


def is_production() -> bool:
    """Returns True if the current environment is production."""
    env = (
        os.getenv("SURPLUSPULSE_ENV")
        or os.getenv("ENVIRONMENT")
        or "development"
    ).strip().lower()
    return env in ("production", "prod")


def get_expected_api_key() -> Optional[str]:
    """Retrieves the configured API key from environment or settings.
    Never returns hardcoded fallback secrets.
    """
    key = (
        os.getenv("SURPLUSPULSE_API_KEY")
        or os.getenv("APP_API_KEY")
        or os.getenv("API_KEY")
        or getattr(settings, "api_key", None)
    )
    if key and key.strip():
        return key.strip()
    return None


def extract_token(
    x_api_key: Optional[str] = None,
    authorization: Optional[str] = None,
) -> Optional[str]:
    """Extracts a credential from X-API-Key or an 'Authorization: Bearer <token>' header.
    Returns None when the credential is missing or malformed. A bare token without the
    Bearer scheme, a non-Bearer scheme, or 'Bearer' with no token is not accepted.
    """
    if x_api_key and x_api_key.strip():
        return x_api_key.strip()
    if authorization and authorization.strip():
        parts = authorization.strip().split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            return parts[1]
    return None


def is_request_authenticated(request: Request) -> bool:
    """Helper to check if an incoming Request contains valid auth credentials."""
    token = extract_token(
        x_api_key=request.headers.get("X-API-Key"),
        authorization=request.headers.get("Authorization"),
    )
    if not token:
        return False
    expected = get_expected_api_key()
    if not expected:
        return False
    return secrets.compare_digest(token.encode("utf-8"), expected.encode("utf-8"))


async def require_auth(
    request: Request,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> dict:
    """FastAPI dependency for mutating and protected routes.

    Authentic fail-closed policy across all environments (production and development):
    - Missing or unconfigured API key in settings/env -> HTTP 401 Unauthorized
    - Missing credentials (no X-API-Key or Authorization header) -> HTTP 401 Unauthorized
    - Malformed credentials (empty token, missing Bearer prefix, etc.) -> HTTP 401 Unauthorized
    - Invalid credentials (mismatched key/token) -> HTTP 401 Unauthorized
    - Valid credentials matching configured key -> HTTP 200 (authenticated)
    """
    expected = get_expected_api_key()
    if not expected:
        logger.error("Rejected request: API key is not configured (fail closed).")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required; API key not configured",
            headers=_WWW_AUTHENTICATE,
        )

    raw_api_header = x_api_key if x_api_key is not None else request.headers.get("X-API-Key")
    raw_auth_header = authorization if authorization is not None else request.headers.get("Authorization")
    has_auth_header = (raw_api_header is not None) or (raw_auth_header is not None)

    token = extract_token(
        x_api_key=raw_api_header,
        authorization=raw_auth_header,
    )

    if not has_auth_header or not token:
        logger.info("Rejected request: missing or malformed credentials.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required: supply X-API-Key or Authorization: Bearer <token>",
            headers=_WWW_AUTHENTICATE,
        )

    if not secrets.compare_digest(token.encode("utf-8"), expected.encode("utf-8")):
        logger.info("Rejected request: invalid credentials.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key or Bearer token",
            headers=_WWW_AUTHENTICATE,
        )

    return {"authenticated": True, "method": "token"}


# Alias for backward compatibility
require_api_key = require_auth
