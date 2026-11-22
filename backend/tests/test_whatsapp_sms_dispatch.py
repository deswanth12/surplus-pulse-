"""Tests for SurplusPulse 1-Click WhatsApp and SMS Courier Dispatch.
Validates atomic claim locking, mathematical container urn count calculation,
Safe Consumption Window (SCW) countdown, and URL encoding.
"""
from __future__ import annotations

import math
import os
import urllib.parse
from fastapi.testclient import TestClient


def test_dispatch_posted_listing_success(client: TestClient, db_conn):
    """POST /api/listings/{id}/dispatch atomically claims a POSTED listing,

    inserts a pickup assignment, and returns wa.me / sms: URIs.
    """
    payload = {
        "volunteer_name": "Rohan Verma",
        "volunteer_phone": "+91 98450 99881",
        "vehicle_type": "EV Cargo Trike",
        "notes": "Equipped with dual Cambro thermal urns.",
    }
    resp = client.post("/api/listings/l1/dispatch", json=payload, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["success"] is True
    assert data["listing_id"] == "l1"
    assert data["pickup_id"].startswith("p_")

    # Verify Urn count = ceil(55.0 / 18.0) = 4 urns
    assert data["urn_count"] == 4
    assert data["scw_minutes_remaining"] > 0

    # Verify WhatsApp deep-link
    wa_link = data["whatsapp_deep_link"]
    assert wa_link.startswith("https://wa.me/919845099881?text=")
    decoded_wa = urllib.parse.unquote(wa_link)
    assert "SURPLUSPULSE RESCUE MISSION DISPATCH" in decoded_wa
    assert "Royal Hyderabadi Veg Pulao" in decoded_wa
    assert "55.0 kg" in decoded_wa
    assert "4 Cambro Insulated Urn" in decoded_wa
    assert "The Grand Amber Banquet Hall" in decoded_wa
    assert "EV Cargo Trike" in decoded_wa

    # Verify SMS trigger URI
    sms_uri = data["sms_trigger_uri"]
    assert sms_uri.startswith("sms:919845099881?body=")

    # Verify Donor coordinates
    coords = data["donor_coordinates"]
    assert coords["lat"] == 12.9716
    assert coords["lng"] == 77.6412

    # Verify Target shelter assigned
    shelter = data["target_shelter"]
    assert shelter["id"] in ("r1", "r2", "r3", "r4")
    assert shelter["name"] is not None

    # Verify database state updated atomically
    listing_row = db_conn.execute("SELECT status FROM food_listings WHERE id = 'l1'").fetchone()
    assert listing_row["status"] == "CLAIMED"

    pickup_row = db_conn.execute("SELECT * FROM pickups WHERE listing_id = 'l1'").fetchone()
    assert pickup_row is not None
    assert pickup_row["volunteer_name"] == "Rohan Verma"
    assert pickup_row["vehicle_type"] == "EV Cargo Trike"


def test_dispatch_conflict_already_claimed(client: TestClient):
    """Attempting to dispatch a listing that is already CLAIMED (like l2) returns 409 Conflict."""
    payload = {
        "volunteer_name": "Kiran Rao",
        "volunteer_phone": "+91 99001 22334",
        "vehicle_type": "EV Cargo Trike",
    }
    resp = client.post("/api/listings/l2/dispatch", json=payload, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert resp.status_code == 409
    assert "already been claimed" in resp.json()["detail"]


def test_dispatch_atomic_race_condition(client: TestClient):
    """Subsequent dispatch requests to the same listing must fail with 409 Conflict."""
    payload = {
        "volunteer_name": "Volunteer Alpha",
        "volunteer_phone": "9876543210",
        "vehicle_type": "EV Cargo Trike",
    }
    # First dispatch succeeds
    resp1 = client.post("/api/listings/l1/dispatch", json=payload, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert resp1.status_code == 200

    # Second immediate dispatch fails atomically
    resp2 = client.post("/api/listings/l1/dispatch", json={
        "volunteer_name": "Volunteer Beta",
        "volunteer_phone": "9876543211",
        "vehicle_type": "Bike",
    }, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert resp2.status_code == 409


def test_dispatch_nonexistent_listing_404(client: TestClient):
    """Dispatching an unknown listing ID returns 404 Not Found."""
    resp = client.post("/api/listings/unknown_999/dispatch", json={
        "volunteer_name": "Test Runner",
        "volunteer_phone": "9845012345",
    }, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert resp.status_code == 404


def test_dispatch_trigger_get_non_mutating(client: TestClient, db_conn):
    """GET /api/listings/{id}/dispatch-trigger generates WhatsApp and SMS URIs

    without mutating the listing status in the database.
    """
    resp = client.get("/api/listings/l1/dispatch-trigger")
    assert resp.status_code == 200
    data = resp.json()

    assert data["listing_id"] == "l1"
    assert data["urn_count"] == 4
    assert data["scw_minutes_remaining"] > 0
    assert "https://wa.me/" in data["whatsapp_deep_link"]
    assert "sms:" in data["sms_trigger_uri"]

    # Verify status is still POSTED (non-mutating)
    status_row = db_conn.execute("SELECT status FROM food_listings WHERE id = 'l1'").fetchone()
    assert status_row["status"] == "POSTED"


def test_dispatch_trigger_404(client: TestClient):
    """GET /api/listings/{id}/dispatch-trigger returns 404 for missing listing."""
    resp = client.get("/api/listings/nonexistent_xyz/dispatch-trigger")
    assert resp.status_code == 404


def test_dispatch_clock_expired_listing_fails(client: TestClient, db_conn):
    """POST /api/listings/{id}/dispatch on a clock-expired listing (where expires_at is
    in the past, even if status is 'POSTED') must return HTTP 400 Bad Request
    and reject courier dispatch.
    """
    past_iso = "2020-01-01T12:00:00+00:00"
    # Update l1 to have an expires_at timestamp in the past, but keep status as POSTED
    db_conn.execute(
        "UPDATE food_listings SET expires_at = ?, status = 'POSTED' WHERE id = 'l1'",
        (past_iso,),
    )
    db_conn.commit()

    payload = {
        "volunteer_name": "Suresh Raina",
        "volunteer_phone": "+91 98450 11223",
        "vehicle_type": "EV Cargo Trike",
    }
    resp = client.post("/api/listings/l1/dispatch", json=payload, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert resp.status_code == 400, resp.text
    detail = resp.json()["detail"].lower()
    assert "expired" in detail

    # Verify listing was NOT claimed and remains POSTED
    listing_row = db_conn.execute("SELECT status FROM food_listings WHERE id = 'l1'").fetchone()
    assert listing_row["status"] == "POSTED"

    # Verify no pickup record was created
    pickup_row = db_conn.execute("SELECT * FROM pickups WHERE listing_id = 'l1'").fetchone()
    assert pickup_row is None


def test_dispatch_trigger_clock_expired_listing_fails(client: TestClient, db_conn):
    """GET /api/listings/{id}/dispatch-trigger on a clock-expired listing
    must return HTTP 400 Bad Request.
    """
    past_iso = "2020-01-01T12:00:00+00:00"
    db_conn.execute(
        "UPDATE food_listings SET expires_at = ?, status = 'POSTED' WHERE id = 'l1'",
        (past_iso,),
    )
    db_conn.commit()

    resp = client.get("/api/listings/l1/dispatch-trigger")
    assert resp.status_code == 400, resp.text
    detail = resp.json()["detail"].lower()
    assert "expired" in detail

