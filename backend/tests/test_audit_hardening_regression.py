"""Comprehensive regression test suite covering all 10 security, integrity,
robustness, and dynamic live data fixes.
"""
from __future__ import annotations

import concurrent.futures
from datetime import datetime, timezone
import hashlib
import os
import pytest
from fastapi.testclient import TestClient

from app.database import utc_now_iso
from app.main import app


# =============================================================================
# Fix 1: Unauthenticated rejection (401/403) on dispatch triggers
# =============================================================================
def test_fix1_dispatch_trigger_requires_auth_unauth_rejected(unauth_client: TestClient):
    """GET /api/listings/{id}/dispatch-trigger and GET /api/dispatch/{id}/trigger
    must reject unauthenticated requests with HTTP 401."""
    # 1. /api/listings/{id}/dispatch-trigger
    res1 = unauth_client.get("/api/listings/l1/dispatch-trigger")
    assert res1.status_code == 401
    detail = res1.json().get("detail", "").lower()
    assert "authentication required" in detail or "api-key" in detail or "api key" in detail or "unauthorized" in detail

    # 2. /api/dispatch/{id}/trigger
    res2 = unauth_client.get("/api/dispatch/l1/trigger")
    assert res2.status_code == 401


def test_fix1_dispatch_trigger_invalid_key_rejected(client: TestClient):
    """Dispatch trigger requests with invalid API key return HTTP 401."""
    res = client.get("/api/listings/l1/dispatch-trigger", headers={"X-API-Key": "invalid-garbage-key"})
    assert res.status_code == 401


def test_fix1_dispatch_trigger_valid_auth_succeeds(client: TestClient):
    """Dispatch trigger requests with authentic API key return HTTP 200."""
    res = client.get("/api/listings/l1/dispatch-trigger")
    assert res.status_code == 200
    assert res.json()["listing_id"] == "l1"


# =============================================================================
# Fix 2: Tax certificate verification against stored hash
# =============================================================================
def test_fix2_tax_verify_valid_certificate(client: TestClient):
    """Untampered, authentic certificate verifies as valid=True."""
    cert = client.get("/api/tax/80g/l3").json()
    cert_num = cert["certificate_number"]

    v_res = client.get(f"/api/tax/verify/{cert_num}")
    assert v_res.status_code == 200
    assert v_res.json()["valid"] is True
    assert v_res.json()["certificate_number"] == cert_num
    assert v_res.json()["verification_status"] == "OFFICIALLY_VERIFIED_AND_SEALED"


def test_fix2_tax_verify_tampered_hash_returns_invalid(client: TestClient, db_conn):
    """If stored verification_hash in DB does not match recomputed hash, valid=False."""
    cert = client.get("/api/tax/80g/l3").json()
    cert_num = cert["certificate_number"]

    # Tamper with the stored hash in the database
    db_conn.execute(
        "UPDATE tax_certificates SET verification_hash = 'tampered_sha256_hash_value_1234567890' WHERE certificate_number = ?",
        (cert_num,),
    )
    db_conn.commit()

    v_res = client.get(f"/api/tax/verify/{cert_num}")
    assert v_res.status_code == 200
    assert v_res.json()["valid"] is False
    assert "TAMPERED" in v_res.json()["verification_status"] or "FAILED" in v_res.json()["verification_status"] or "MISMATCH" in v_res.json()["verification_status"]


def test_fix2_tax_verify_nonexistent_returns_404(client: TestClient):
    """Non-existent certificate ID returns HTTP 404 (preserving baseline behavior)."""
    v_res = client.get("/api/tax/verify/fake_nonexistent_cert_9999")
    assert v_res.status_code == 404


# =============================================================================
# Fix 3: Updating meal count recalculates verification_hash
# =============================================================================
def test_fix3_updating_meal_count_recalculates_verification_hash(client: TestClient, db_conn):
    """When verified shelter intake updates meal count, verification_hash must be updated."""
    # 1. Fetch initial certificate for l2
    initial_cert = client.get("/api/tax/80g/l2").json()
    initial_hash = initial_cert["verification_hash"]
    initial_meals = initial_cert["quantity_meals"]

    # 2. Insert verified intake with updated meal count (120 meals)
    now_iso = utc_now_iso()
    db_conn.execute(
        """
        INSERT INTO shelter_intakes (id, listing_id, receiver_id, volunteer_name, arrived_at, intake_temp_c, meals_accepted, fssai_compliance_status, created_at)
        VALUES ('in_test_recalc', 'l2', 'r3', 'Volunteer Test', ?, 68.0, 120, 'HOT_HOLD_COMPLIANT', ?)
        """,
        (now_iso, now_iso),
    )
    db_conn.commit()

    # 3. Fetch certificate again -> triggers update from intake
    updated_cert = client.get("/api/tax/80g/l2").json()
    assert updated_cert["quantity_meals"] == 120
    assert updated_cert["gross_salvage_valuation"] == 120 * 65.0
    assert updated_cert["verification_hash"] != initial_hash

    # Verify that the new verification_hash correctly verifies via verify endpoint
    v_res = client.get(f"/api/tax/verify/{updated_cert['certificate_number']}")
    assert v_res.status_code == 200
    assert v_res.json()["valid"] is True
    assert v_res.json()["verification_status"] == "OFFICIALLY_VERIFIED_AND_SEALED"


# =============================================================================
# Fix 4: Concurrent certificate creation produces unique numbers without 500
# =============================================================================
def test_fix4_concurrent_certificate_creation_unique_numbers(client: TestClient, db_conn):
    """Simultaneous requests generating certificates for multiple listings do not trigger
    500 UNIQUE constraint collisions."""
    # Insert 8 dummy listings
    now_iso = utc_now_iso()
    listing_ids = [f"l_conc_{i}" for i in range(8)]
    for lid in listing_ids:
        db_conn.execute(
            """
            INSERT INTO food_listings (id, donor_id, food_name, food_category, quantity_meals, quantity_kg, storage_type, cooked_at, expires_at, status, created_at)
            VALUES (?, 'd1', 'Test Biryani', 'VEG', 50, 20.0, 'HOT', ?, ?, 'POSTED', ?)
            """,
            (lid, now_iso, now_iso, now_iso),
        )
    db_conn.commit()

    def fetch_cert(lid: str):
        c = TestClient(app)
        c.headers.update({"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
        return c.get(f"/api/tax/80g/{lid}")

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(fetch_cert, lid) for lid in listing_ids]
        responses = [f.result() for f in futures]

    assert all(r.status_code == 200 for r in responses)
    cert_numbers = [r.json()["certificate_number"] for r in responses]
    assert len(set(cert_numbers)) == len(cert_numbers), "Certificate numbers must be strictly unique"


# =============================================================================
# Fix 5: Concurrent delivery confirmations do not insert duplicate shelter_intakes
# =============================================================================
def test_fix5_concurrent_delivery_confirmations_race_safe(client: TestClient, db_conn):
    """Concurrent delivery confirmations on listing l2 allow exactly 1 success (200),
    reject concurrent attempts with 409 Conflict, and produce exactly 1 shelter_intakes row."""
    # Ensure l2 is in CLAIMED status
    db_conn.execute("UPDATE food_listings SET status = 'CLAIMED' WHERE id = 'l2'")
    db_conn.execute("DELETE FROM shelter_intakes WHERE listing_id = 'l2'")
    db_conn.commit()

    payload = {
        "receiver_id": "r3",
        "intake_temp_c": 68.5,
        "meals_accepted": 80,
        "notes": "Gate verification.",
    }

    def attempt_confirm(worker_id: int):
        c = TestClient(app)
        c.headers.update({"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
        return c.post("/api/listings/l2/confirm-delivery", json=payload)

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(attempt_confirm, i) for i in range(5)]
        responses = [f.result() for f in futures]

    successes = [r for r in responses if r.status_code == 200]
    conflicts = [r for r in responses if r.status_code == 409]

    assert len(successes) == 1, f"Expected exactly 1 success, got {len(successes)}"
    assert len(conflicts) == 4, f"Expected 4 conflicts, got {len(conflicts)}"

    # Direct database verification
    intakes_count = db_conn.execute("SELECT COUNT(*) FROM shelter_intakes WHERE listing_id = 'l2'").fetchone()[0]
    assert intakes_count == 1, "shelter_intakes must contain exactly 1 row for listing l2"


# =============================================================================
# Fix 6: Empty receiver list in telemetry does not raise ValueError
# =============================================================================
def test_fix6_empty_receiver_list_telemetry_graceful(empty_client: TestClient, db_conn):
    """When receivers table is empty, GET /api/telemetry/{id} does not crash with ValueError on min()."""
    # Insert a donor and listing with no pickup
    now_iso = utc_now_iso()
    db_conn.execute("INSERT INTO donors (id, name, donor_type, contact_name, contact_phone, address, city, lat, lng, created_at) VALUES ('d_test', 'Test Kitchen', 'RESTAURANT', 'Chef', '9845012345', 'Indiranagar', 'BLR', 12.97, 77.64, ?)", (now_iso,))
    db_conn.execute("INSERT INTO food_listings (id, donor_id, food_name, food_category, quantity_meals, quantity_kg, storage_type, cooked_at, expires_at, status, created_at) VALUES ('l_empty_rec', 'd_test', 'Biryani', 'VEG', 40, 15.0, 'HOT', ?, ?, 'POSTED', ?)", (now_iso, now_iso, now_iso))
    db_conn.commit()

    res = empty_client.get("/api/telemetry/l_empty_rec")
    # Must NOT return 500 Internal Server Error (ValueError: min() arg is an empty sequence)
    assert res.status_code in (200, 400, 404)
    if res.status_code == 200:
        assert res.json()["listing_id"] == "l_empty_rec"


# =============================================================================
# Fix 7: arrived_at validation and parsing before persisting
# =============================================================================
def test_fix7_confirm_delivery_malformed_arrived_at_rejected(client: TestClient):
    """Passing a malformed timestamp string in arrived_at must be rejected with HTTP 422."""
    payload = {
        "receiver_id": "r3",
        "intake_temp_c": 68.0,
        "meals_accepted": 80,
        "arrived_at": "invalid-garbage-date-format",
    }
    res = client.post("/api/listings/l2/confirm-delivery", json=payload)
    assert res.status_code == 422


def test_fix7_confirm_delivery_empty_string_arrived_at_rejected(client: TestClient):
    """Empty string arrived_at must be rejected with HTTP 422 Unprocessable Entity."""
    for empty_val in ["", "   "]:
        payload = {
            "receiver_id": "r3",
            "intake_temp_c": 68.0,
            "meals_accepted": 80,
            "arrived_at": empty_val,
        }
        res = client.post("/api/listings/l2/confirm-delivery", json=payload)
        assert res.status_code == 422


def test_fix7_confirm_delivery_future_arrived_at_rejected(client: TestClient):
    """Future timestamp in arrived_at must be rejected with HTTP 422 Unprocessable Entity."""
    payload = {
        "receiver_id": "r3",
        "intake_temp_c": 68.0,
        "meals_accepted": 80,
        "arrived_at": "2099-01-01T00:00:00Z",
    }
    res = client.post("/api/listings/l2/confirm-delivery", json=payload)
    assert res.status_code == 422


def test_fix7_confirm_delivery_valid_arrived_at_accepted(client: TestClient, db_conn):
    """Passing a valid ISO 8601 timestamp in arrived_at succeeds and persists cleanly."""
    valid_ts = "2026-11-22T14:30:00+00:00"
    payload = {
        "receiver_id": "r3",
        "intake_temp_c": 68.0,
        "meals_accepted": 80,
        "arrived_at": valid_ts,
    }
    res = client.post("/api/listings/l2/confirm-delivery", json=payload)
    assert res.status_code == 200
    assert res.json()["delivered_at"] == valid_ts

    row = db_conn.execute("SELECT delivered_at FROM pickups WHERE listing_id = 'l2'").fetchone()
    assert row["delivered_at"] == valid_ts


# =============================================================================
# Fix 8: Missing donor data handled safely without TypeError in dispatch
# =============================================================================
def test_fix8_dispatch_orphaned_donor_returns_404_not_500(client: TestClient, db_conn):
    """Listing pointing to a non-existent donor ID returns HTTP 404/400 cleanly without TypeError."""
    now_iso = utc_now_iso()
    db_conn.execute("PRAGMA foreign_keys = OFF;")
    db_conn.execute(
        """
        INSERT INTO food_listings (id, donor_id, food_name, food_category, quantity_meals, quantity_kg, storage_type, cooked_at, expires_at, status, created_at)
        VALUES ('l_orphan', 'd_nonexistent_99', 'Ghost Food', 'VEG', 30, 10.0, 'HOT', ?, ?, 'POSTED', ?)
        """,
        (now_iso, now_iso, now_iso),
    )
    db_conn.execute("PRAGMA foreign_keys = ON;")
    db_conn.commit()

    # 1. Dispatch POST
    res_post = client.post(
        "/api/listings/l_orphan/dispatch",
        json={"volunteer_name": "Rohan", "volunteer_phone": "+91 98450 11223", "vehicle_type": "EV"},
    )
    assert res_post.status_code in (400, 404, 422)
    assert res_post.status_code != 500

    # 2. Dispatch Trigger GET
    res_get = client.get("/api/listings/l_orphan/dispatch-trigger")
    assert res_get.status_code in (400, 404, 422)
    assert res_get.status_code != 500


# =============================================================================
# Fix 9: Donor portal GET requests do not perform DB writes/commits
# =============================================================================
def test_fix9_donor_portal_get_is_read_only(client: TestClient, db_conn):
    """GET /api/portals/donor/{id} must NOT insert new rows or commit database transactions."""
    # Count rows before GET
    initial_certs = db_conn.execute("SELECT COUNT(*) FROM tax_certificates").fetchone()[0]

    # Perform GET request on donor portal
    res = client.get("/api/portals/donor/d1")
    assert res.status_code == 200

    # Count rows after GET
    final_certs = db_conn.execute("SELECT COUNT(*) FROM tax_certificates").fetchone()[0]
    assert final_certs == initial_certs, "GET /api/portals/donor/{id} must be strictly read-only and not insert tax certificates"


def test_fix9_courier_portal_empty_receivers_graceful(empty_client: TestClient):
    """GET /api/portals/courier does not crash with IndexError or ValueError when receivers table is empty."""
    res = empty_client.get("/api/portals/courier")
    assert res.status_code == 200
    assert res.json()["available_missions"] == []
    assert res.json()["active_missions"] == []


# =============================================================================
# Fix 10: Dynamic live values in dispatch, telemetry, portals
# =============================================================================
def test_fix10_telemetry_live_dynamic_values(client: TestClient):
    """Telemetry metrics (speed, battery, cambro_temp, heading) reflect dynamic calculations."""
    res = client.get("/api/telemetry/l2")
    assert res.status_code == 200
    data = res.json()
    assert 22.0 <= data["speed_kmh"] <= 36.0
    assert 50.0 <= data["battery_percent"] <= 100.0
    assert data["cambro_core_temp_c"] >= 65.0
    assert 0.0 <= data["heading_degrees"] <= 360.0


def test_fix10_portals_courier_uses_actual_volunteer_phone(client: TestClient, db_conn):
    """Courier portal WhatsApp link uses actual volunteer contact from pickup record, not static constant."""
    db_conn.execute("UPDATE pickups SET volunteer_phone = '+91 98765 43210' WHERE listing_id = 'l2'")
    db_conn.commit()

    res = client.get("/api/portals/courier")
    assert res.status_code == 200
    active = res.json()["active_missions"]
    l2_mission = next(m for m in active if m["listing_id"] == "l2")
    assert "9876543210" in l2_mission["whatsapp_deep_link"]


def test_fix10_municipal_portal_dynamic_spoilage_rate(client: TestClient):
    """Municipal portal calculates actual spoilage prevention rate dynamically."""
    res = client.get("/api/portals/municipal")
    assert res.status_code == 200
    assert 0.0 <= res.json()["spoilage_prevention_rate"] <= 100.0
