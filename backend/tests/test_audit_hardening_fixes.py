"""Verification tests for the 8 security, safety, and race condition hardening fixes."""

from __future__ import annotations

import base64
import io
import os
import pytest
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from app.auth import get_expected_api_key, require_auth
from app.config import settings
from app.main import app
from app.mirage_inspector import inspect_food_payload
import app.mirage_inspector as mi


# -----------------------------------------------------------------------------
# 1. Preset ID & Upload Image Priority
# -----------------------------------------------------------------------------

def test_preset_id_does_not_override_uploaded_image(client):
    """Uploading real image bytes MUST dynamically inspect the image rather than
    short-circuiting to static preset verdict (e.g. fresh_biryani -> 98%)."""
    # Create an image that triggers visual degradation / spoilage
    img = Image.new("RGB", (100, 100), color=(15, 15, 15))  # dark necrotic rot
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64_str = f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}"

    # Pass sample_id='fresh_biryani' alongside the dark spoiled image bytes
    res = client.post(
        "/api/inspect-food",
        json={
            "sample_id": "fresh_biryani",
            "image_base64": b64_str,
        },
        headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
    )
    assert res.status_code == 200
    data = res.json()
    # It must NOT return the hardcoded 98% fresh biryani verdict!
    assert data["quality_score"] != 98
    assert data["verdict"] != "FRESH_AND_GOOD"
    assert data["is_safe"] is False
    assert data["food_inspection"]["is_safe"] is False


# -----------------------------------------------------------------------------
# 2. Fail-Closed Zero-Trust Safety Default
# -----------------------------------------------------------------------------

def test_vlm_exception_fails_closed():
    """If the VLM raises an unhandled exception, inspector must fail closed:
    is_safe = False, quality_score = 0.0, verdict = 'INSPECTION_FAILED',
    fssai_status = 'REJECTED - UNVERIFIABLE SAMPLE'."""
    class CrashingMirage:
        def describe(self, b):
            raise RuntimeError("VLM Model CUDA Memory Error or Segmentation Fault")

    orig_inst = mi._MIRAGE_INSTANCE
    orig_avail = mi._MIRAGE_AVAILABLE
    try:
        mi._MIRAGE_AVAILABLE = True
        mi._MIRAGE_INSTANCE = CrashingMirage()

        img = Image.new("RGB", (64, 64), color=(200, 200, 200))
        buf = io.BytesIO()
        img.save(buf, format="PNG")

        res = inspect_food_payload(buf.getvalue(), "custom")
        assert res["is_safe"] is False
        assert res["quality_score"] == 0
        assert res["verdict"] == "INSPECTION_FAILED"
        assert res["food_inspection"]["fssai_status"] == "REJECTED - UNVERIFIABLE SAMPLE"
        assert res["auto_fill_form_data"]["hours_valid"] == 0.0
    finally:
        mi._MIRAGE_INSTANCE = orig_inst
        mi._MIRAGE_AVAILABLE = orig_avail


def test_vlm_error_dict_fails_closed():
    """If VLM returns an error dict, inspector must fail closed."""
    class ErrorMirage:
        def describe(self, b):
            return {"error": "Vision tensor shape mismatch"}

    orig_inst = mi._MIRAGE_INSTANCE
    orig_avail = mi._MIRAGE_AVAILABLE
    try:
        mi._MIRAGE_AVAILABLE = True
        mi._MIRAGE_INSTANCE = ErrorMirage()

        img = Image.new("RGB", (64, 64), color=(200, 200, 200))
        buf = io.BytesIO()
        img.save(buf, format="PNG")

        res = inspect_food_payload(buf.getvalue(), "custom")
        assert res["is_safe"] is False
        assert res["quality_score"] == 0
        assert res["verdict"] == "INSPECTION_FAILED"
        assert res["food_inspection"]["fssai_status"] == "REJECTED - UNVERIFIABLE SAMPLE"
        assert res["auto_fill_form_data"]["hours_valid"] == 0.0
    finally:
        mi._MIRAGE_INSTANCE = orig_inst
        mi._MIRAGE_AVAILABLE = orig_avail


def test_corrupt_image_payload_fails_closed():
    """Directly passing corrupt/unreadable bytes to inspect_food_payload fails closed."""
    corrupt_bytes = b"garbage_bytes_not_an_image_1234567890"
    res = inspect_food_payload(corrupt_bytes, "custom")
    assert res["is_safe"] is False
    assert res["quality_score"] == 0
    assert res["verdict"] == "INSPECTION_FAILED"
    assert res["food_inspection"]["fssai_status"] == "REJECTED - UNVERIFIABLE SAMPLE"


# -----------------------------------------------------------------------------
# 3. Validity Window for Rejected Food
# -----------------------------------------------------------------------------

def test_rejected_food_validity_window_is_zero():
    """Spoiled food must have hours_valid = 0.0, never max(0.5, ...)."""
    spoiled_res = inspect_food_payload(sample_id="spoiled_curry")
    assert spoiled_res["is_safe"] is False
    assert spoiled_res["auto_fill_form_data"]["hours_valid"] == 0.0

    expired_res = inspect_food_payload(sample_id="expired_rice")
    assert expired_res["is_safe"] is False
    assert expired_res["auto_fill_form_data"]["hours_valid"] == 0.0


def test_listing_creation_rejects_unsafe_food(client):
    """Creating listing with hours_valid <= 0 or spoiled handling notes returns HTTP 422."""
    base_payload = {
        "donor_id": "d1",
        "food_name": "Spoiled Vegetable Curry",
        "food_category": "VEG",
        "quantity_meals": 30,
        "quantity_kg": 10.0,
    }

    # 1. hours_valid = 0.0
    res_zero = client.post("/api/listings", json={
        **base_payload,
        "hours_valid": 0.0,
    }, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res_zero.status_code == 422
    assert "Unsafe food cannot be listed for distribution" in str(res_zero.json()["detail"])

    # 2. Spoiled handling notes with valid hours_valid
    res_spoiled_notes = client.post("/api/listings", json={
        **base_payload,
        "hours_valid": 3.0,
        "handling_notes": "Mirage VLM Certified Quality (18%). Status: REJECTED - FOOD IS SPOILED / GONE.",
    }, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res_spoiled_notes.status_code == 422
    assert "Unsafe food cannot be listed for distribution" in str(res_spoiled_notes.json()["detail"])

    # 3. Low quality score in handling notes
    res_low_score = client.post("/api/listings", json={
        **base_payload,
        "hours_valid": 3.0,
        "handling_notes": "Mirage VLM Certified Quality (45%). Thermal Hold: AMBIENT.",
    }, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res_low_score.status_code == 422
    assert "Unsafe food cannot be listed for distribution" in str(res_low_score.json()["detail"])


# -----------------------------------------------------------------------------
# 4. Keyword Matching Regex with Word Boundaries
# -----------------------------------------------------------------------------

def test_keyword_matching_does_not_flag_coffee_or_official():
    """Corpus containing 'COFFEE' or 'OFFICIAL' must NOT be flagged as spoilage."""
    class CoffeeMirage:
        def describe(self, b):
            return {
                "text": [{"string": "OFFICIAL BANQUET COFFEE HOLDER"}],
                "objects": [{"name": "urn", "description": {"shape": "round"}}],
                "reasoning": "Official catering coffee urn in heated container.",
                "scene": {"type": "banquet"},
            }

    orig_inst = mi._MIRAGE_INSTANCE
    orig_avail = mi._MIRAGE_AVAILABLE
    try:
        mi._MIRAGE_AVAILABLE = True
        mi._MIRAGE_INSTANCE = CoffeeMirage()

        img = Image.new("RGB", (64, 64), color=(180, 100, 50))
        buf = io.BytesIO()
        img.save(buf, format="PNG")

        res = inspect_food_payload(buf.getvalue(), "custom")
        assert res["is_safe"] is True
        assert res["verdict"] == "FRESH_AND_GOOD"
        assert res["quality_score"] >= 90
    finally:
        mi._MIRAGE_INSTANCE = orig_inst
        mi._MIRAGE_AVAILABLE = orig_avail


def test_keyword_matching_flags_actual_spoilage_words():
    """Corpus containing actual standalone 'OFF', 'BAD', 'SOUR' must be flagged."""
    for word in ["OFF", "BAD", "SOUR", "SPOILED", "MOLD", "DECOMPOSED"]:
        class BadMirage:
            def describe(self, b):
                return {
                    "text": [{"string": f"SAMPLE HAS {word} PROFILE"}],
                    "objects": [],
                    "reasoning": f"Sample detected with {word} characteristics.",
                    "scene": {},
                }

        orig_inst = mi._MIRAGE_INSTANCE
        orig_avail = mi._MIRAGE_AVAILABLE
        try:
            mi._MIRAGE_AVAILABLE = True
            mi._MIRAGE_INSTANCE = BadMirage()

            img = Image.new("RGB", (64, 64), color=(180, 100, 50))
            buf = io.BytesIO()
            img.save(buf, format="PNG")

            res = inspect_food_payload(buf.getvalue(), "custom")
            assert res["is_safe"] is False
            assert res["verdict"] == "SPOILED_AND_GONE"
        finally:
            mi._MIRAGE_INSTANCE = orig_inst
            mi._MIRAGE_AVAILABLE = orig_avail


# -----------------------------------------------------------------------------
# 5. Pickup Status Atomic Conditional Update
# -----------------------------------------------------------------------------

def test_pickup_status_atomic_conditional_updates(client):
    """update_pickup_status uses atomic SQL WHERE status checks and raises 409 Conflict on race."""
    # l2 is seeded in CLAIMED status
    # 1. Successful CLAIMED -> COLLECTED
    res_col = client.post("/api/listings/l2/status", json={"status": "COLLECTED"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res_col.status_code == 200
    assert res_col.json()["status"] == "COLLECTED"

    # 2. Second attempt to COLLECTED must fail with 409 Conflict
    res_col_repeat = client.post("/api/listings/l2/status", json={"status": "COLLECTED"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res_col_repeat.status_code == 409

    # 3. Successful COLLECTED -> DELIVERED
    res_del = client.post("/api/listings/l2/status", json={"status": "DELIVERED"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res_del.status_code == 200
    assert res_del.json()["status"] == "DELIVERED"

    # 4. Repeating DELIVERED fails with 409 Conflict because status is already DELIVERED
    res_del_repeat = client.post("/api/listings/l2/status", json={"status": "DELIVERED"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res_del_repeat.status_code == 409


# -----------------------------------------------------------------------------
# 6. Seed Route Environment Guard
# -----------------------------------------------------------------------------

def test_seed_route_in_production_requires_admin_secret(client, monkeypatch):
    """In production mode, /api/seed is disabled (404) regardless of X-Admin-Secret (S2)."""
    monkeypatch.setenv("SURPLUSPULSE_ENV", "production")
    monkeypatch.setenv("ADMIN_SECRET", "super-secret-admin-pass")

    # Call without X-Admin-Secret -> 404 Not Found (route disabled in production)
    res_denied = client.post("/api/seed?force=true")
    assert res_denied.status_code == 404

    # Call with invalid X-Admin-Secret -> 404 Not Found
    res_wrong = client.post("/api/seed?force=true", headers={"X-Admin-Secret": "wrong-secret"})
    assert res_wrong.status_code == 404

    # Call with valid X-Admin-Secret AND valid API key -> still 404: production never seeds
    api_key = get_expected_api_key()
    res_ok = client.post(
        "/api/seed?force=true",
        headers={
            "X-Admin-Secret": "super-secret-admin-pass",
            "X-API-Key": api_key,
        },
    )
    assert res_ok.status_code == 404


def test_seed_route_in_development_allows_standard_seeding(client, monkeypatch):
    """In explicit development mode, /api/seed works when X-Admin-Secret matches ADMIN_SECRET (S2)."""
    monkeypatch.setenv("SURPLUSPULSE_ENV", "development")
    monkeypatch.setenv("ADMIN_SECRET", "test-admin-secret-fixture")
    res = client.post(
        "/api/seed?force=true",
        headers={
            "X-Admin-Secret": "test-admin-secret-fixture",
            "X-API-Key": os.environ["SURPLUSPULSE_API_KEY"],
        },
    )
    assert res.status_code == 201


# -----------------------------------------------------------------------------
# 8. Auth Layer Support
# -----------------------------------------------------------------------------

def test_mutating_routes_require_auth_in_production(client, monkeypatch):
    """In production mode, mutating routes require API key / Bearer token."""
    monkeypatch.setenv("SURPLUSPULSE_ENV", "production")
    api_key = get_expected_api_key()

    listing_payload = {
        "donor_id": "d1",
        "food_name": "Fresh Test Khichdi",
        "food_category": "VEG",
        "quantity_meals": 20,
        "quantity_kg": 8.0,
        "hours_valid": 3.0,
    }

    # 1. Unauthenticated in production -> 401 Unauthorized
    res_no_auth = TestClient(app).post("/api/listings", json=listing_payload)
    assert res_no_auth.status_code == 401

    # 2. Authenticated via X-API-Key in production -> 201 Created
    res_api_key = client.post(
        "/api/listings",
        json=listing_payload,
        headers={"X-API-Key": api_key},
    )
    assert res_api_key.status_code == 201

    # 3. Authenticated via Bearer token in production -> 201 Created
    res_bearer = client.post(
        "/api/listings",
        json={**listing_payload, "food_name": "Fresh Test Pongal"},
        headers={"Authorization": f"Bearer {api_key}"},
    )
    assert res_bearer.status_code == 201


def test_mutating_routes_reject_unauthenticated_in_dev(client, monkeypatch):
    """Development mode has no auth bypass: writes without a key are rejected with 401,
    and writes with the configured key succeed."""
    monkeypatch.setenv("SURPLUSPULSE_ENV", "development")
    listing_payload = {
        "donor_id": "d1",
        "food_name": "Dev Mode Dosa",
        "food_category": "VEG",
        "quantity_meals": 25,
        "quantity_kg": 10.0,
        "hours_valid": 3.0,
    }

    # No credentials in development -> 401 Unauthorized
    res_no_auth = TestClient(app).post("/api/listings", json=listing_payload)
    assert res_no_auth.status_code == 401

    # Configured API key -> 201 Created
    res_api_key = client.post(
        "/api/listings",
        json=listing_payload,
        headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
    )
    assert res_api_key.status_code == 201


def test_keyword_matching_does_not_flag_valid_expiry_time():
    """Labels with 'EXPIRES AT 18:00' or 'EXPIRY: 4 HOURS' must NOT be rejected as spoiled."""
    class ValidExpiryMirage:
        def describe(self, b):
            return {
                "text": [{"string": "HOT LUNCH PACKED 13:00 | EXPIRES AT 18:00"}],
                "objects": [{"name": "container", "description": {"shape": "rectangular"}}],
                "reasoning": "Hot cooked meal in sealed container. Expires at 18:00.",
                "scene": {"type": "banquet"},
            }

    orig_inst = mi._MIRAGE_INSTANCE
    orig_avail = mi._MIRAGE_AVAILABLE
    try:
        mi._MIRAGE_AVAILABLE = True
        mi._MIRAGE_INSTANCE = ValidExpiryMirage()

        img = Image.new("RGB", (64, 64), color=(200, 150, 50))
        buf = io.BytesIO()
        img.save(buf, format="PNG")

        res = inspect_food_payload(buf.getvalue(), "custom")
        assert res["is_safe"] is True
        assert res["verdict"] == "FRESH_AND_GOOD"
        assert res["quality_score"] >= 90
    finally:
        mi._MIRAGE_INSTANCE = orig_inst
        mi._MIRAGE_AVAILABLE = orig_avail


def test_unhandled_exception_in_inspector_fails_closed(monkeypatch):
    """Zero-trust fail-closed safety must catch unexpected internal errors."""
    def crash(*args, **kwargs):
        raise TypeError("Unexpected serialization or PIL internal failure")

    monkeypatch.setattr("app.mirage_inspector._inspect_food_payload_inner", crash)
    res = inspect_food_payload(b"some_fake_bytes_12345", "custom")
    assert res["is_safe"] is False
    assert res["quality_score"] == 0
    assert res["verdict"] == "INSPECTION_FAILED"
    assert res["food_inspection"]["fssai_status"] == "REJECTED - UNVERIFIABLE SAMPLE"
    assert res["auto_fill_form_data"]["hours_valid"] == 0.0
