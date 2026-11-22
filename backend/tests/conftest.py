"""SurplusPulse Pytest Configuration and Test Fixtures.
Provides isolated temporary SQLite database instances and TestClient fixtures
so tests never pollute or lock surpluspulse.db.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
import sqlite3
import pytest
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import database
from app.main import app


@pytest.fixture(autouse=True)
def test_db(tmp_path, monkeypatch):
    """Creates a temporary SQLite database per test function, seeds it with standard data,
    and points app.database.DB_PATH to it."""
    db_file = tmp_path / "test_surpluspulse.db"
    orig_path = database.DB_PATH
    monkeypatch.setattr(database, "DB_PATH", db_file)
    monkeypatch.setenv("SURPLUSPULSE_API_KEY", "test-fixture-api-key")
    
    database.init_db()
    database.seed_data(force=True)
    
    yield db_file
    
    # Restore original path
    monkeypatch.setattr(database, "DB_PATH", orig_path)


@pytest.fixture
def client(test_db):
    """FastAPI TestClient operating against the isolated, seeded temporary SQLite database
    with default authentic test API key headers."""
    with TestClient(app) as test_client:
        test_client.headers.update({"X-API-Key": "test-fixture-api-key"})
        yield test_client


@pytest.fixture
def unauth_client(test_db):
    """FastAPI TestClient with NO default authentication headers for testing unauthenticated rejection."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def empty_client(client):
    """FastAPI TestClient with all tables completely emptied for testing empty-state edge cases."""
    conn = database.get_connection()
    try:
        conn.execute("DELETE FROM pickups")
        conn.execute("DELETE FROM food_listings")
        conn.execute("DELETE FROM receivers")
        conn.execute("DELETE FROM donors")
        conn.commit()
    finally:
        conn.close()
    return client


@pytest.fixture
def db_conn(test_db):
    """Direct SQLite connection to the active test database for verification queries."""
    conn = database.get_connection()
    try:
        yield conn
    finally:
        conn.close()
