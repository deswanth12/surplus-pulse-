"""Regression tests for S1 (authentication fails closed) and S2 (seed endpoint protection).

All credentials below are placeholders injected via monkeypatch. No real secret is used,
and no secret value is printed. The autouse test_db fixture in conftest.py gives every test
an isolated temporary SQLite database; surpluspulse.db is never touched.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app import database
from app.main import app

API_KEY = "placeholder-api-key-for-tests"
WRONG_KEY = "placeholder-wrong-key-for-tests"
ADMIN_SECRET = "placeholder-admin-secret-for-tests"
WRONG_ADMIN_SECRET = "placeholder-wrong-admin-secret-for-tests"

AUTH_ENV_VARS = (
    "SURPLUSPULSE_ENV",
    "ENVIRONMENT",
    "SURPLUSPULSE_API_KEY",
    "APP_API_KEY",
    "API_KEY",
    "ADMIN_SECRET",
    "SURPLUSPULSE_ADMIN_SECRET",
)


@pytest.fixture(autouse=True)
def _clean_auth_env(monkeypatch):
    """Start every test with no auth-related environment variables set."""
    for name in AUTH_ENV_VARS:
        monkeypatch.delenv(name, raising=False)


@pytest.fixture
def http():
    """TestClient without the context manager, so lifespan does not run unless a test asks."""
    return TestClient(app)


@pytest.fixture
def configured_key(monkeypatch):
    """Configure the expected API key for the current test."""
    monkeypatch.setenv("SURPLUSPULSE_API_KEY", API_KEY)
    return API_KEY


@pytest.fixture
def donor_id(db_conn):
    """A donor ID that exists in the isolated test database."""
    row = db_conn.execute("SELECT id FROM donors LIMIT 1").fetchone()
    assert row is not None
    return row[0]


def listing_body(donor_id: str) -> dict:
    """Minimal valid FoodListingCreate payload (see app/schemas.py)."""
    return {
        "donor_id": donor_id,
        "food_name": "Test Rice Meals",
        "food_category": "VEG",
        "quantity_meals": 10,
        "quantity_kg": 5.0,
        "storage_type": "HOT",
        "allergens": "None",
        "hours_valid": 3.0,
    }


def _count_rows(table: str) -> int:
    conn = database.get_connection()
    try:
        return conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# S1: authentication in development mode
# ---------------------------------------------------------------------------

def test_dev_no_key_configured_rejects_every_header(http, donor_id, monkeypatch):
    """With no API key configured, any header is rejected (no dev bypass)."""
    monkeypatch.delenv("SURPLUSPULSE_API_KEY", raising=False)
    for headers in (
        {},
        {"X-API-Key": WRONG_KEY},
        {"Authorization": f"Bearer {WRONG_KEY}"},
    ):
        r = http.post("/api/listings", json=listing_body(donor_id), headers=headers)
        assert r.status_code == 401, headers


def test_dev_correct_x_api_key_creates_listing(http, donor_id, configured_key):
    r = http.post(
        "/api/listings",
        json=listing_body(donor_id),
        headers={"X-API-Key": configured_key},
    )
    assert r.status_code == 201


def test_dev_correct_bearer_token_creates_listing(http, donor_id, configured_key):
    r = http.post(
        "/api/listings",
        json=listing_body(donor_id),
        headers={"Authorization": f"Bearer {configured_key}"},
    )
    assert r.status_code == 201


def test_dev_wrong_key_is_rejected(http, donor_id, configured_key):
    r = http.post(
        "/api/listings",
        json=listing_body(donor_id),
        headers={"X-API-Key": WRONG_KEY},
    )
    assert r.status_code == 401


@pytest.mark.parametrize(
    "headers",
    [
        {"X-API-Key": ""},
        {"X-API-Key": "   "},
        {"Authorization": ""},
        {"Authorization": "Bearer"},
        {"Authorization": "Basic x"},
        {"Authorization": API_KEY},  # bare token without the Bearer scheme
    ],
)
def test_malformed_credentials_are_rejected(http, donor_id, configured_key, headers):
    r = http.post("/api/listings", json=listing_body(donor_id), headers=headers)
    assert r.status_code == 401, headers


# ---------------------------------------------------------------------------
# S1: authentication in production mode
# ---------------------------------------------------------------------------

def test_production_no_key_configured_rejects_request(http, donor_id, monkeypatch):
    monkeypatch.setenv("SURPLUSPULSE_ENV", "production")
    monkeypatch.delenv("SURPLUSPULSE_API_KEY", raising=False)
    r = http.post(
        "/api/listings",
        json=listing_body(donor_id),
        headers={"X-API-Key": API_KEY},
    )
    assert r.status_code == 401


def test_production_wrong_key_is_rejected(http, donor_id, configured_key, monkeypatch):
    monkeypatch.setenv("SURPLUSPULSE_ENV", "production")
    r = http.post(
        "/api/listings",
        json=listing_body(donor_id),
        headers={"X-API-Key": WRONG_KEY},
    )
    assert r.status_code == 401


def test_production_correct_key_creates_listing(http, donor_id, configured_key, monkeypatch):
    monkeypatch.setenv("SURPLUSPULSE_ENV", "production")
    r = http.post(
        "/api/listings",
        json=listing_body(donor_id),
        headers={"Authorization": f"Bearer {configured_key}"},
    )
    assert r.status_code == 201


# ---------------------------------------------------------------------------
# S1: protected write routes reject unauthenticated callers
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "path",
    [
        "/api/listings",
        "/api/inspect-food",
        "/api/listings/nonexistent-listing-id/dispatch",
    ],
)
def test_protected_routes_reject_unauthenticated_callers(http, configured_key, path):
    """401 must come from auth, before any 404 for the dummy listing ID."""
    r = http.post(path, json={})
    assert r.status_code == 401


# ---------------------------------------------------------------------------
# S2: seed endpoint
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("env_value", ["production", "Production", "PRODUCTION"])
def test_seed_production_returns_404_with_or_without_secret(http, monkeypatch, env_value):
    monkeypatch.setenv("SURPLUSPULSE_ENV", env_value)
    monkeypatch.setenv("ADMIN_SECRET", ADMIN_SECRET)
    assert http.post("/api/seed").status_code == 404
    assert (
        http.post("/api/seed", headers={"X-Admin-Secret": ADMIN_SECRET}).status_code == 404
    )


def test_seed_unset_env_is_forbidden(http, monkeypatch):
    monkeypatch.setenv("ADMIN_SECRET", ADMIN_SECRET)
    r = http.post("/api/seed", headers={"X-Admin-Secret": ADMIN_SECRET})
    assert r.status_code == 403


def test_seed_unrecognised_env_value_is_forbidden(http, monkeypatch):
    monkeypatch.setenv("SURPLUSPULSE_ENV", "staging")
    monkeypatch.setenv("ADMIN_SECRET", ADMIN_SECRET)
    r = http.post("/api/seed", headers={"X-Admin-Secret": ADMIN_SECRET})
    assert r.status_code == 403


def test_seed_development_without_admin_secret_configured_is_forbidden(http, monkeypatch):
    monkeypatch.setenv("SURPLUSPULSE_ENV", "development")
    r = http.post("/api/seed", headers={"X-Admin-Secret": ADMIN_SECRET})
    assert r.status_code == 403


def test_seed_development_wrong_secret_is_forbidden(http, monkeypatch):
    monkeypatch.setenv("SURPLUSPULSE_ENV", "development")
    monkeypatch.setenv("ADMIN_SECRET", ADMIN_SECRET)
    r = http.post("/api/seed", headers={"X-Admin-Secret": WRONG_ADMIN_SECRET})
    assert r.status_code == 403


def test_seed_development_missing_secret_header_is_forbidden(http, monkeypatch):
    monkeypatch.setenv("SURPLUSPULSE_ENV", "development")
    monkeypatch.setenv("ADMIN_SECRET", ADMIN_SECRET)
    r = http.post("/api/seed")
    assert r.status_code == 403


def test_seed_development_correct_secret_succeeds(http, monkeypatch):
    monkeypatch.setenv("SURPLUSPULSE_ENV", "development")
    monkeypatch.setenv("ADMIN_SECRET", ADMIN_SECRET)
    r = http.post("/api/seed", headers={"X-Admin-Secret": ADMIN_SECRET})
    assert 200 <= r.status_code < 300


# ---------------------------------------------------------------------------
# S2: startup auto-seed is limited to explicit development
# ---------------------------------------------------------------------------

@pytest.fixture
def fresh_db(tmp_path, monkeypatch):
    """Point the app at an empty database so startup seeding is observable."""
    path = tmp_path / "startup_check.db"
    monkeypatch.setattr(database, "DB_PATH", path)
    return path


def test_startup_does_not_seed_in_production(fresh_db, monkeypatch):
    monkeypatch.setenv("SURPLUSPULSE_ENV", "production")
    with TestClient(app):
        pass
    assert _count_rows("food_listings") == 0
    assert _count_rows("donors") == 0


def test_startup_does_not_seed_when_env_unset(fresh_db):
    with TestClient(app):
        pass
    assert _count_rows("food_listings") == 0
    assert _count_rows("donors") == 0


def test_startup_seeds_when_explicitly_development(fresh_db, monkeypatch):
    """Positive control: explicit development still auto-seeds an empty database."""
    monkeypatch.setenv("SURPLUSPULSE_ENV", "development")
    with TestClient(app):
        pass
    assert _count_rows("donors") > 0
