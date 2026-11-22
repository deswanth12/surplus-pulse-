"""SurplusPulse API Authentication & Authorization.
Re-exports dependencies from app.auth for backward compatibility.
"""
from __future__ import annotations

from app.auth import (
    extract_token,
    get_expected_api_key,
    is_production,
    is_request_authenticated,
    require_api_key,
    require_auth,
)

__all__ = [
    "extract_token",
    "get_expected_api_key",
    "is_production",
    "is_request_authenticated",
    "require_api_key",
    "require_auth",
]
