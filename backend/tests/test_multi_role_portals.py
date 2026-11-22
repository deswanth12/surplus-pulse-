"""Tests for SurplusPulse Multi-Role Operational Dashboards.
Validates:
1. Donor Kitchen Portal
2. Volunteer Courier Fleet View
3. Shelter Intake Board
4. Municipal Command Center
"""
from __future__ import annotations

from fastapi.testclient import TestClient


def test_donor_portal(client: TestClient):
    """GET /api/portals/donor/{id} returns donor profile, active listings,

    completed rescues, and tax certificates.
    """
    resp = client.get("/api/portals/donor/d1")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["donor"]["id"] == "d1"
    assert data["donor"]["name"] == "The Grand Amber Banquet Hall"
    assert data["donor"]["city"] == "Bengaluru"

    # d1 has active listing l1 (POSTED)
    active = data["active_listings"]
    assert len(active) >= 1
    assert any(item["id"] == "l1" for item in active)

    assert data["total_kg_saved"] >= 55.0
    assert data["total_meals_saved"] >= 120


def test_donor_portal_404(client: TestClient):
    """GET /api/portals/donor/{id} returns 404 for unknown donor."""
    resp = client.get("/api/portals/donor/d_missing_99")
    assert resp.status_code == 404


def test_courier_portal(client: TestClient):
    """GET /api/portals/courier returns available missions, active assignments,

    and fleet metrics with WhatsApp deep-links.
    """
    resp = client.get("/api/portals/courier")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    # Available missions should have l1 (POSTED)
    available = data["available_missions"]
    assert len(available) >= 1
    mission = next(m for m in available if m["listing_id"] == "l1")
    assert mission["status"] == "POSTED"
    assert mission["urn_count"] == 4
    assert mission["scw_minutes_remaining"] > 0
    assert mission["whatsapp_deep_link"].startswith("https://wa.me/")
    assert mission["donor_coordinates"]["lat"] == 12.9716

    # Active missions should have l2 (CLAIMED)
    active = data["active_missions"]
    assert len(active) >= 1
    assert any(m["listing_id"] == "l2" for m in active)

    # Fleet metrics
    fleet = data["courier_fleet_status"]
    assert fleet["active_couriers"] >= 8
    assert "EV Cargo Trikes" in fleet["fleet_type"]
    assert fleet["missions_completed_today"] >= 2


def test_shelter_portal(client: TestClient):
    """GET /api/portals/shelter/{id} returns incoming deliveries, completed intakes,

    and capacity utilization metrics.
    """
    # r3 has incoming listing l2
    resp = client.get("/api/portals/shelter/r3")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["shelter"]["id"] == "r3"
    assert data["shelter"]["name"] == "Whitefield Community Kitchen"
    assert data["capacity_meals"] == 200

    # Incoming deliveries for r3
    incoming = data["incoming_deliveries"]
    assert any(item["id"] == "l2" for item in incoming)

    # Utilization percent
    assert 0.0 <= data["utilization_percent"] <= 100.0


def test_shelter_portal_404(client: TestClient):
    """GET /api/portals/shelter/{id} returns 404 for unknown receiver."""
    resp = client.get("/api/portals/shelter/r_missing_99")
    assert resp.status_code == 404


def test_municipal_portal(client: TestClient):
    """GET /api/portals/municipal returns city-wide rescue throughput,

    active courier density, and ward breakdown.
    """
    resp = client.get("/api/portals/municipal")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert "Bengaluru" in data["city"]
    assert data["total_meals_rescued"] >= 400
    assert data["total_food_kg_saved"] >= 180.0
    assert data["active_rescues_count"] >= 2
    assert 90.0 <= data["spoilage_prevention_rate"] <= 100.0
    assert data["esg_co2e_total_kg"] >= 400.0

    # Active courier density vectors
    density = data["active_courier_density"]
    assert len(density) >= 4
    for pt in density:
        assert pt["courier_id"] is not None
        assert 12.0 < pt["lat"] < 13.5
        assert 77.0 < pt["lng"] < 78.0

    # Ward summaries
    wards = data["ward_summaries"]
    assert len(wards) >= 5
    ward_names = [w["ward_name"] for w in wards]
    assert any("Koramangala" in name for name in ward_names)
    assert any("Indiranagar" in name for name in ward_names)
    assert any("HSR Layout" in name for name in ward_names)
    assert any("Whitefield" in name for name in ward_names)
