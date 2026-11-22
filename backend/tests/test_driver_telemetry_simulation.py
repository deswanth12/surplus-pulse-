"""Tests for SurplusPulse Driver GPS Telemetry and Delivery Confirmation.
Validates EV Cargo Trike telemetry along Bengaluru arterial corridors,
hot-hold thermal stability (>65°C), LiFePO4 battery regen, and verified shelter intake logging.
"""
from __future__ import annotations
import os

from fastapi.testclient import TestClient


def test_telemetry_claimed_listing(client: TestClient):
    """GET /api/telemetry/{id} for a CLAIMED rescue returns active EV Cargo Trike telemetry

    including speed (22-36 km/h), regenerative braking, cambro temperature (>65°C), and waypoints.
    """
    resp = client.get("/api/telemetry/l2")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["listing_id"] == "l2"
    assert data["courier_name"] == "Vikram Adiga"
    assert "EV Cargo Trike" in data["vehicle_type"] or "Cargo" in data["vehicle_type"]
    assert "Arterial" in data["route_name"] or "Transit" in data["route_name"]

    # Current coordinates must be valid
    coords = data["current_coordinates"]
    assert 12.0 < coords["lat"] < 13.5
    assert 77.0 < coords["lng"] < 78.0

    # EV Cargo Trike speed must be between 22.0 and 36.0 km/h
    assert 22.0 <= data["speed_kmh"] <= 36.0
    assert 0.0 <= data["heading_degrees"] <= 360.0
    assert 50.0 <= data["battery_percent"] <= 100.0
    assert isinstance(data["is_regen_active"], bool)

    # Thermal hot-holding compliance check (>65°C)
    assert data["cambro_core_temp_c"] >= 65.0
    assert data["thermal_status"] == "HOT_HOLD_COMPLIANT"

    # ETA and distance
    assert data["eta_minutes"] > 0
    assert data["distance_remaining_km"] > 0.0
    assert data["is_delivered"] is False

    # Waypoints along arterial corridor
    waypoints = data["waypoints"]
    assert len(waypoints) >= 4
    for wp in waypoints:
        assert "lat" in wp and "lng" in wp and "label" in wp


def test_telemetry_delivered_listing(client: TestClient):
    """GET /api/telemetry/{id} for a DELIVERED rescue returns stationary destination state."""
    resp = client.get("/api/telemetry/l3")
    assert resp.status_code == 200
    data = resp.json()

    assert data["listing_id"] == "l3"
    assert data["is_delivered"] is True
    assert data["speed_kmh"] == 0.0
    assert data["distance_remaining_km"] == 0.0
    assert data["eta_minutes"] == 0


def test_telemetry_nonexistent_listing_404(client: TestClient):
    """GET /api/telemetry/{id} returns 404 for unknown listing."""
    resp = client.get("/api/telemetry/unknown_abc")
    assert resp.status_code == 404


def test_confirm_delivery_success(client: TestClient, db_conn):
    """POST /api/listings/{id}/confirm-delivery transitions status to DELIVERED

    and logs a verified shelter intake record with FSSAI compliance verification.
    """
    payload = {
        "receiver_id": "r3",
        "intake_temp_c": 68.2,
        "meals_accepted": 80,
        "notes": "Delivered to Whitefield Community Kitchen, verified at gate.",
    }
    resp = client.post("/api/listings/l2/confirm-delivery", json=payload, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["success"] is True
    assert data["listing_id"] == "l2"
    assert data["status"] == "DELIVERED"
    assert data["intake_verified"] is True
    assert data["intake_id"].startswith("in_")
    assert data["delivered_at"] is not None

    # Verify listing status in DB
    listing = db_conn.execute("SELECT status FROM food_listings WHERE id = 'l2'").fetchone()
    assert listing["status"] == "DELIVERED"

    # Verify shelter_intakes row inserted
    intake = db_conn.execute("SELECT * FROM shelter_intakes WHERE listing_id = 'l2'").fetchone()
    assert intake is not None
    assert intake["receiver_id"] == "r3"
    assert intake["intake_temp_c"] == 68.2
    assert intake["meals_accepted"] == 80
    assert intake["fssai_compliance_status"] == "HOT_HOLD_COMPLIANT"


def test_confirm_delivery_cold_hold_status(client: TestClient, db_conn):
    """POST confirm-delivery with cold intake <= 4°C records COMPLIANT_COLD_HOLD."""
    # First claim l1 so it can be delivered
    client.post("/api/listings/l1/dispatch", json={
        "volunteer_name": "Test Courier",
        "volunteer_phone": "9845012345",
    }, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    resp = client.post("/api/listings/l1/confirm-delivery", json={
        "receiver_id": "r1",
        "intake_temp_c": 3.8,
        "meals_accepted": 120,
    }, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert resp.status_code == 200
    intake = db_conn.execute("SELECT fssai_compliance_status FROM shelter_intakes WHERE listing_id = 'l1'").fetchone()
    assert intake["fssai_compliance_status"] == "COLD_HOLD_COMPLIANT"


def test_confirm_delivery_unclaimed_conflict(client: TestClient):
    """Attempting to confirm delivery for a POSTED (unclaimed) listing returns 409 Conflict."""
    resp = client.post("/api/listings/l1/confirm-delivery", json={
        "receiver_id": "r1",
        "meals_accepted": 50,
    }, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert resp.status_code == 409
    assert "must be claimed" in resp.json()["detail"]


def test_confirm_delivery_already_delivered_conflict(client: TestClient):
    """Attempting to confirm delivery for an already DELIVERED listing returns 409 Conflict."""
    resp = client.post("/api/listings/l3/confirm-delivery", json={
        "receiver_id": "r2",
        "meals_accepted": 60,
    }, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert resp.status_code == 409
    assert "already marked DELIVERED" in resp.json()["detail"]
