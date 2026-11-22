"""Tests for SurplusPulse secret fail-closed behavior in production.
Ensures no hard-coded fallback secrets grant access in production.
"""

from fastapi.testclient import TestClient
import pytest


def test_production_without_api_key_fails_closed(client, monkeypatch):
    """When SURPLUSPULSE_API_KEY is not configured in production, mutating requests fail closed."""
    monkeypatch.setenv("SURPLUSPULSE_ENV", "production")
    monkeypatch.delenv("SURPLUSPULSE_API_KEY", raising=False)
    monkeypatch.delenv("APP_API_KEY", raising=False)
    monkeypatch.delenv("API_KEY", raising=False)

    payload = {
        "donor_id": "d1",
        "food_name": "Fail Closed Test Meal",
        "food_category": "VEG",
        "quantity_meals": 10,
        "quantity_kg": 5.0,
        "hours_valid": 4.0,
    }

    # Request without header fails closed
    res = client.post("/api/listings", json=payload)
    assert res.status_code == 401
    assert "not configured" in res.json()["detail"].lower() or "required" in res.json()["detail"].lower()

    # Request with arbitrary mock test key is rejected
    res_mock_key = client.post(
        "/api/listings",
        json=payload,
        headers={"X-API-Key": "mock-test-api-key-9988"},
    )
    assert res_mock_key.status_code == 401


def test_production_without_admin_secret_fails_closed(client, monkeypatch):
    """When ADMIN_SECRET is not configured in production, /api/seed fails closed (S2: route disabled)."""
    monkeypatch.setenv("SURPLUSPULSE_ENV", "production")
    monkeypatch.delenv("ADMIN_SECRET", raising=False)
    monkeypatch.delenv("SURPLUSPULSE_ADMIN_SECRET", raising=False)

    # Without header -> 404 (production disables the seed route)
    res = client.post("/api/seed?force=true")
    assert res.status_code == 404

    # Supplying arbitrary mock admin secret -> 404
    res_mock = client.post(
        "/api/seed?force=true",
        headers={"X-Admin-Secret": "mock-test-admin-secret-7766"},
    )
    assert res_mock.status_code == 404


def test_old_hardcoded_secrets_strictly_rejected_negative_control(client, monkeypatch):
    """Explicit negative control: in production mode with NO environment secret configured,
    verify that an incoming request attempting to use the old key X-API-Key: surpluspulse-secret-key-2026
    or X-Admin-Secret: production-admin-secret is strictly rejected with HTTP 401 / 404,
    proving the old strings hold zero special privilege."""
    monkeypatch.setenv("SURPLUSPULSE_ENV", "production")
    monkeypatch.delenv("SURPLUSPULSE_API_KEY", raising=False)
    monkeypatch.delenv("APP_API_KEY", raising=False)
    monkeypatch.delenv("API_KEY", raising=False)
    monkeypatch.delenv("ADMIN_SECRET", raising=False)
    monkeypatch.delenv("SURPLUSPULSE_ADMIN_SECRET", raising=False)

    payload = {
        "donor_id": "d1",
        "food_name": "Negative Control Old Secret Meal",
        "food_category": "VEG",
        "quantity_meals": 10,
        "quantity_kg": 5.0,
        "hours_valid": 4.0,
    }

    # Verify old API key string is strictly rejected with 401
    res_old_api_key = client.post(
        "/api/listings",
        json=payload,
        headers={"X-API-Key": "surpluspulse-secret-key-2026"},
    )
    assert res_old_api_key.status_code == 401

    res_lp_api_key = client.post(
        "/api/listings",
        json=payload,
        headers={"X-API-Key": "ledgerpulse-secret-key-2026"},
    )
    assert res_lp_api_key.status_code == 401

    # Verify old Bearer token string is also strictly rejected with 401
    res_old_bearer = client.post(
        "/api/listings",
        json=payload,
        headers={"Authorization": "Bearer surpluspulse-secret-key-2026"},
    )
    assert res_old_bearer.status_code == 401

    res_lp_bearer = client.post(
        "/api/listings",
        json=payload,
        headers={"Authorization": "Bearer ledgerpulse-secret-key-2026"},
    )
    assert res_lp_bearer.status_code == 401

    # Verify old admin secret string is strictly rejected (production seed route is 404)
    res_old_admin = client.post(
        "/api/seed?force=true",
        headers={"X-Admin-Secret": "production-admin-secret"},
    )
    assert res_old_admin.status_code == 404

    # Also verify when a real key is configured in production, old secrets still fail
    monkeypatch.setenv("SURPLUSPULSE_API_KEY", "real-prod-api-key-9988")
    monkeypatch.setenv("ADMIN_SECRET", "real-admin-secret-7766")

    res_old_with_real_env = client.post(
        "/api/listings",
        json=payload,
        headers={"X-API-Key": "surpluspulse-secret-key-2026"},
    )
    assert res_old_with_real_env.status_code == 401

    res_lp_with_real_env = client.post(
        "/api/listings",
        json=payload,
        headers={"X-API-Key": "ledgerpulse-secret-key-2026"},
    )
    assert res_lp_with_real_env.status_code == 401

    res_old_admin_with_real_env = client.post(
        "/api/seed?force=true",
        headers={"X-Admin-Secret": "production-admin-secret"},
    )
    assert res_old_admin_with_real_env.status_code == 404


def test_production_with_configured_keys_succeeds(client, monkeypatch):
    """When secrets are explicitly configured in production, valid credentials succeed."""
    monkeypatch.setenv("SURPLUSPULSE_ENV", "production")
    monkeypatch.setenv("SURPLUSPULSE_API_KEY", "real-prod-api-key-xyz")
    monkeypatch.setenv("ADMIN_SECRET", "real-admin-secret-xyz")

    payload = {
        "donor_id": "d1",
        "food_name": "Valid Auth Meal",
        "food_category": "VEG",
        "quantity_meals": 15,
        "quantity_kg": 6.0,
        "hours_valid": 3.0,
    }

    # Mutating request with valid key -> 201
    res = client.post(
        "/api/listings",
        json=payload,
        headers={"X-API-Key": "real-prod-api-key-xyz"},
    )
    assert res.status_code == 201

    # Mutating request with invalid key -> 401
    res_invalid = client.post(
        "/api/listings",
        json=payload,
        headers={"X-API-Key": "wrong-key"},
    )
    assert res_invalid.status_code == 401

    # Seed with valid admin secret -> 404 (S2: production disables seeding even with a valid secret)
    res_seed = client.post(
        "/api/seed?force=true",
        headers={"X-Admin-Secret": "real-admin-secret-xyz"},
    )
    assert res_seed.status_code == 404


def test_production_environment_var_fail_closed(client, monkeypatch):
    """When ENVIRONMENT=production (instead of SURPLUSPULSE_ENV), fail-closed is equally enforced."""
    monkeypatch.delenv("SURPLUSPULSE_ENV", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv("SURPLUSPULSE_API_KEY", raising=False)
    monkeypatch.delenv("APP_API_KEY", raising=False)
    monkeypatch.delenv("API_KEY", raising=False)
    monkeypatch.delenv("ADMIN_SECRET", raising=False)
    monkeypatch.delenv("SURPLUSPULSE_ADMIN_SECRET", raising=False)

    payload = {
        "donor_id": "d1",
        "food_name": "Prod Env Test Meal",
        "food_category": "VEG",
        "quantity_meals": 5,
        "quantity_kg": 2.5,
        "hours_valid": 2.0,
    }

    # Mutating route fails closed
    assert client.post("/api/listings", json=payload).status_code == 401

    # Whitespace token fails closed
    assert client.post("/api/listings", json=payload, headers={"X-API-Key": "   "}).status_code == 401

    # Seed fails closed
    assert client.post("/api/seed?force=true").status_code == 403

    # Seed with whitespace admin secret fails closed
    assert client.post("/api/seed?force=true", headers={"X-Admin-Secret": "   "}).status_code == 403
