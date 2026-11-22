"""FastAPI Dependencies for SurplusPulse.
Provides database connection lifecycle management and monkeypatch interception.
"""
from __future__ import annotations

import sqlite3
import sys
from typing import Generator


def get_db_connection() -> sqlite3.Connection:
    """Acquires a database connection, delegating to app.main.get_connection
    so that monkeypatched connections in tests are strictly honored.
    """
    main_mod = sys.modules.get("app.main")
    if main_mod is not None and hasattr(main_mod, "get_connection"):
        return main_mod.get_connection()
    from app.database import get_connection
    return get_connection()


def get_db() -> Generator[sqlite3.Connection, None, None]:
    """FastAPI dependency yielding a database connection and ensuring closure upon request completion."""
    conn = get_db_connection()
    try:
        yield conn
    finally:
        conn.close()
