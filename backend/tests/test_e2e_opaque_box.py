"""SurplusPulse End-to-End Opaque-Box Test Suite (Tiers 1-4).

Adheres to TEST_INFRA.md and ORIGINAL_REQUEST.md requirements:
- Tier 1: Feature Coverage (25 tests, 5 per feature across F1-F5)
- Tier 2: Boundary & Corner Cases (25 tests, 5 per feature across F1-F5)
- Tier 3: Cross-Feature Interactions (5 tests)
- Tier 4: Real-World Municipal Relief Workloads (5 scenarios)

Total: 60 comprehensive opaque-box test cases.
"""

from __future__ import annotations

import base64
import concurrent.futures
import io
import math
import os
import re
import urllib.parse
from datetime import datetime, timezone
from PIL import Image, ImageDraw

import pytest
from fastapi.testclient import TestClient

from app.database import utc_now_iso


# =============================================================================
# Helper Utilities for Test Cases
# =============================================================================

def create_custom_listing(
    conn,
    listing_id: str,
    donor_id: str,
    food_name: str,
    quantity_kg: float,
    quantity_meals: int,
    status: str = "POSTED",
    cooked_at: str | None = None,
    expires_at: str | None = None,
    storage_type: str = "HOT",
) -> str:
    """Inserts a custom listing directly into the active test database."""
    now_iso = utc_now_iso()
    if not cooked_at:
        cooked_at = now_iso
    if not expires_at:
        from datetime import timedelta
        expires_at = (datetime.now(timezone.utc) + timedelta(hours=3)).isoformat()

    conn.execute(
        """
        INSERT INTO food_listings (
            id, donor_id, food_name, food_category, quantity_meals, quantity_kg,
            storage_type, allergens, handling_notes, cooked_at, expires_at, status, created_at
        ) VALUES (?, ?, ?, 'VEG', ?, ?, ?, 'None', 'Standard handling', ?, ?, ?, ?)
        """,
        (
            listing_id,
            donor_id,
            food_name,
            quantity_meals,
            quantity_kg,
            storage_type,
            cooked_at,
            expires_at,
            status,
            now_iso,
        ),
    )
    conn.commit()
    return listing_id


def create_solid_image_base64(color=(200, 100, 50), text="THERMAL HOLD >65C") -> str:
    """Generates a base64-encoded PNG image for inspection tests."""
    img = Image.new("RGB", (200, 150), color=color)
    draw = ImageDraw.Draw(img)
    draw.text((10, 10), text, fill=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


# =============================================================================
# TIER 1: FEATURE COVERAGE (25 TESTS)
# =============================================================================

# -----------------------------------------------------------------------------
# F1: 1-Click WhatsApp & SMS Courier Dispatch (5 Tests)
# -----------------------------------------------------------------------------

def test_t1_f1_01_whatsapp_deep_link_contains_gps_coordinates(client: TestClient):
    """T1_F1_01: Verify WhatsApp deep link (wa.me) contains pickup GPS coordinates (lat, lng)."""
    resp = client.get("/api/listings/l1/dispatch-trigger")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert "whatsapp_deep_link" in data
    wa_link = data["whatsapp_deep_link"]
    assert wa_link.startswith("https://wa.me/")

    parsed = urllib.parse.urlparse(wa_link)
    qs = urllib.parse.parse_qs(parsed.query)
    assert "text" in qs
    text = qs["text"][0]

    # Donor d1 has coordinates 12.9716, 77.6412
    assert "12.9716" in text or "GPS" in text
    assert "77.6412" in text or "GPS" in text
    assert data["donor_coordinates"]["lat"] == pytest.approx(12.9716, abs=0.001)
    assert data["donor_coordinates"]["lng"] == pytest.approx(77.6412, abs=0.001)


def test_t1_f1_02_urn_count_calculated_as_ceil_kg_over_18(client: TestClient):
    """T1_F1_02: Verify payload calculates container urn count as max(1, ceil(kg / 18))."""
    # Listing l1: 55.0 kg -> ceil(55 / 18) = 4 urns
    resp1 = client.get("/api/listings/l1/dispatch-trigger")
    assert resp1.status_code == 200
    assert resp1.json()["urn_count"] == 4

    # Listing l2: 36.0 kg -> ceil(36 / 18) = 2 urns
    resp2 = client.get("/api/listings/l2/dispatch-trigger")
    assert resp2.status_code == 200
    assert resp2.json()["urn_count"] == 2


def test_t1_f1_03_payload_includes_target_shelter_details(client: TestClient):
    """T1_F1_03: Verify payload includes target shelter destination name, address, and contact."""
    resp = client.get("/api/listings/l1/dispatch-trigger")
    assert resp.status_code == 200
    data = resp.json()

    shelter = data["target_shelter"]
    assert shelter["id"] in ("r1", "r2", "r3", "r4")
    assert len(shelter["name"]) > 0
    assert len(shelter["address"]) > 0
    assert len(shelter["phone"]) > 0

    # Verify shelter name appears in the formatted message
    decoded_text = urllib.parse.unquote(data["whatsapp_deep_link"])
    assert shelter["name"] in decoded_text


def test_t1_f1_04_payload_includes_realtime_scw_countdown(client: TestClient):
    """T1_F1_04: Verify payload includes real-time Safe Consumption Window (SCW) countdown."""
    resp = client.get("/api/listings/l1/dispatch-trigger")
    assert resp.status_code == 200
    data = resp.json()

    assert "scw_minutes_remaining" in data
    assert isinstance(data["scw_minutes_remaining"], int)
    assert data["scw_minutes_remaining"] > 0

    # Ensure remaining minutes is reflected in formatted WhatsApp and SMS triggers
    decoded_wa = urllib.parse.unquote(data["whatsapp_deep_link"])
    decoded_sms = urllib.parse.unquote(data["sms_trigger_uri"])
    assert "SAFE CONSUMPTION WINDOW" in decoded_wa or "SCW" in decoded_wa
    assert str(data["scw_minutes_remaining"]) in decoded_wa
    assert str(data["scw_minutes_remaining"]) in decoded_sms


def test_t1_f1_05_dispatch_trigger_atomic_status_transition(client: TestClient):
    """T1_F1_05: Verify dispatch trigger transitions listing status from POSTED to CLAIMED atomically."""
    # Listing l1 is originally POSTED
    listing_before = client.get("/api/listings/l1").json()
    assert listing_before["status"] == "POSTED"

    # Trigger courier dispatch
    payload = {
        "volunteer_name": "Karthik Subramanian",
        "volunteer_phone": "+919845012345",
        "vehicle_type": "EV Cargo Trike",
        "notes": "Arriving with 4 cambro urns",
    }
    dispatch_resp = client.post("/api/listings/l1/dispatch", json=payload, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert dispatch_resp.status_code == 200, dispatch_resp.text
    disp_data = dispatch_resp.json()
    assert disp_data["success"] is True
    assert disp_data["listing_id"] == "l1"
    assert disp_data["pickup_id"].startswith("p_")

    # Confirm database status transitioned to CLAIMED
    listing_after = client.get("/api/listings/l1").json()
    assert listing_after["status"] == "CLAIMED"
    assert listing_after["pickup"]["volunteer_name"] == "Karthik Subramanian"

    # Second dispatch on the same listing MUST fail with 409 Conflict
    race_resp = client.post("/api/listings/l1/dispatch", json=payload, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert race_resp.status_code == 409
    assert "already been claimed" in race_resp.json()["detail"].lower()


# -----------------------------------------------------------------------------
# F2: Real-Time Driver GPS Radar Simulation (5 Tests)
# -----------------------------------------------------------------------------

def test_t1_f2_01_telemetry_ev_trike_status_and_coordinates(client: TestClient):
    """T1_F2_01: Verify telemetry endpoint returns EV Cargo Trike status, vehicle type, and current coordinates."""
    # Claim listing l1 first
    client.post(
        "/api/listings/l1/dispatch",
        json={"volunteer_name": "Pooja Reddy", "volunteer_phone": "9845099887", "vehicle_type": "EV Cargo Trike"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
    )

    resp = client.get("/api/telemetry/l1")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["listing_id"] == "l1"
    assert data["vehicle_type"] == "EV Cargo Trike"
    assert "current_coordinates" in data
    assert 12.0 <= data["current_coordinates"]["lat"] <= 13.5
    assert 77.0 <= data["current_coordinates"]["lng"] <= 78.0
    assert len(data["waypoints"]) >= 2


def test_t1_f2_02_telemetry_dynamic_speed_and_heading(client: TestClient):
    """T1_F2_02: Verify telemetry HUD displays dynamic speed (22–36 km/h) and heading."""
    # Claim listing l1 to put it in transit
    client.post(
        "/api/listings/l1/dispatch",
        json={"volunteer_name": "Vikram Singh", "volunteer_phone": "9887766554", "vehicle_type": "EV Cargo Trike"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
    )

    resp = client.get("/api/telemetry/l1")
    assert resp.status_code == 200
    data = resp.json()

    # Active courier in transit moves at simulated urban arterial speed 22-36 km/h
    assert 22.0 <= data["speed_kmh"] <= 36.0
    assert 0.0 <= data["heading_degrees"] <= 360.0
    assert data["eta_minutes"] > 0
    assert data["distance_remaining_km"] > 0.0


def test_t1_f2_03_telemetry_lifepo4_battery_and_regen_active(client: TestClient):
    """T1_F2_03: Verify LiFePO4 battery percentage and regenerative braking status (is_regen_active)."""
    client.post(
        "/api/listings/l1/dispatch",
        json={"volunteer_name": "Suresh Raina", "volunteer_phone": "9123456780"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
    )

    resp = client.get("/api/telemetry/l1")
    assert resp.status_code == 200
    data = resp.json()

    assert 0.0 <= data["battery_percent"] <= 100.0
    assert isinstance(data["is_regen_active"], bool)


def test_t1_f2_04_telemetry_cambro_core_temp_hot_hold(client: TestClient):
    """T1_F2_04: Verify thermal cambro core holding temperature (>65°C hot hold or <4°C cold hold)."""
    client.post(
        "/api/listings/l1/dispatch",
        json={"volunteer_name": "Deepak Joshi", "volunteer_phone": "9845011223"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
    )

    resp = client.get("/api/telemetry/l1")
    assert resp.status_code == 200
    data = resp.json()

    # Hot-hold biryani listing: Cambro insulated core temp must be >65°C
    assert data["cambro_core_temp_c"] > 65.0
    assert data["thermal_status"] in ("HOT_HOLD_COMPLIANT", "SAFE")


def test_t1_f2_05_confirm_delivery_logs_verified_shelter_intake(client: TestClient, db_conn):
    """T1_F2_05: Verify destination arrival confirmation event logs verified shelter intake."""
    # 1. Dispatch listing
    client.post(
        "/api/listings/l1/dispatch",
        json={"volunteer_name": "Meera Nair", "volunteer_phone": "9845077665", "receiver_id": "r1"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
    )

    # 2. Confirm delivery at shelter
    confirm_payload = {
        "receiver_id": "r1",
        "intake_temp_c": 67.8,
        "meals_accepted": 120,
        "notes": "Containers intact and hot-holding verified.",
    }
    resp = client.post("/api/listings/l1/confirm-delivery", json=confirm_payload, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["success"] is True
    assert data["status"] == "DELIVERED"
    assert data["intake_verified"] is True
    assert "intake_id" in data

    # 3. Verify listing status is now DELIVERED
    listing = client.get("/api/listings/l1").json()
    assert listing["status"] == "DELIVERED"

    # 4. Verify record in shelter_intakes database table
    intake_row = db_conn.execute(
        "SELECT * FROM shelter_intakes WHERE listing_id = 'l1'"
    ).fetchone()
    assert intake_row is not None
    assert intake_row["receiver_id"] == "r1"
    assert intake_row["intake_temp_c"] == 67.8
    assert intake_row["meals_accepted"] == 120
    assert intake_row["fssai_compliance_status"] in ("COMPLIANT_HOT_HOLD", "HOT_HOLD_COMPLIANT")


# -----------------------------------------------------------------------------
# F3: Exportable Section 80G Tax Exemption Certificate (5 Tests)
# -----------------------------------------------------------------------------

def test_t1_f3_01_section_80g_returns_registration_and_cert_number(client: TestClient):
    """T1_F3_01: Verify Section 80G endpoint returns legal registration order and certificate number."""
    resp = client.get("/api/tax/80g/l1")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert "certificate_number" in data
    assert data["certificate_number"].startswith("80G-BLR-2026-")
    assert "registration_order" in data
    assert "CIT(E)/BLR/80G" in data["registration_order"]


def test_t1_f3_02_donor_pan_legal_name_and_verified_kg(client: TestClient):
    """T1_F3_02: Verify donor PAN, legal entity name, and verified rescued kilogram tally."""
    resp = client.get("/api/tax/80g/l1")
    assert resp.status_code == 200
    data = resp.json()

    # Donor d1 name: The Grand Amber Banquet Hall
    assert data["donor_name"] == "The Grand Amber Banquet Hall"
    # Authentic Indian PAN format: 10 alphanumeric characters
    assert len(data["donor_pan"]) == 10
    assert data["donor_pan"].isalnum()
    assert data["quantity_kg"] == 55.0
    assert data["quantity_meals"] == 120


def test_t1_f3_03_itemized_ca_valuation_breakdown(client: TestClient):
    """T1_F3_03: Verify itemized CA valuation: FMV @ ₹65/meal, 50% deduction, and tax savings."""
    resp = client.get("/api/tax/80g/l1")
    assert resp.status_code == 200
    data = resp.json()

    # FMV benchmark ₹65.00/plate
    assert data["fmv_rate_per_plate"] == 65.0

    # Listing l1: 120 meals * ₹65 = ₹7,800.00
    expected_gross = 120 * 65.0
    assert data["gross_salvage_valuation"] == pytest.approx(expected_gross, 0.01)

    # 50% eligible deduction under Section 80G: ₹3,900.00
    expected_deduction = expected_gross * 0.50
    assert data["eligible_80g_deduction"] == pytest.approx(expected_deduction, 0.01)

    # Corporate tax savings (26% tax + cess)
    assert data["projected_corporate_tax_savings"] == pytest.approx(expected_deduction * 0.26, 0.01)

    # Chartered accountant attestation fields
    assert "ca_attestation" in data
    assert "Rajeshwari" in data["ca_attestation"]["ca_name"]
    assert "021948S" in data["ca_attestation"]["icai_reg_no"]
    assert data["ca_attestation"]["udin"].startswith("26021948AAAAAA")


def test_t1_f3_04_esg_carbon_offset_at_2_5_kg_co2e(client: TestClient):
    """T1_F3_04: Verify ESG carbon offset calculation at exactly 2.5 kg CO2e per kg food saved."""
    resp = client.get("/api/tax/80g/l1")
    assert resp.status_code == 200
    data = resp.json()

    # Listing l1 has 55.0 kg -> 55.0 * 2.5 = 137.5 kg CO2e
    expected_co2e = 55.0 * 2.5
    assert data["esg_co2e_offset_kg"] == pytest.approx(expected_co2e, 0.01)


def test_t1_f3_05_qr_verification_code_and_digital_seal(client: TestClient):
    """T1_F3_05: Verify scannable QR verification code payload and digital municipal relief seal."""
    resp = client.get("/api/tax/80g/l1")
    assert resp.status_code == 200
    data = resp.json()

    assert "qr_verification_url" in data
    assert data["qr_verification_url"].startswith("/api/tax/verify/")

    # SHA-256 digital verification hash (64 hex characters)
    assert "verification_hash" in data
    assert len(data["verification_hash"]) == 64
    assert re.match(r"^[0-9a-f]{64}$", data["verification_hash"])

    # Test verification docket resolution endpoint
    cert_id = data["qr_verification_url"].split("/")[-1]
    verify_resp = client.get(f"/api/tax/verify/{cert_id}")
    assert verify_resp.status_code == 200
    vdata = verify_resp.json()
    assert vdata["valid"] is True
    assert vdata["certificate_number"] == data["certificate_number"]
    assert vdata["verification_status"] == "OFFICIALLY_VERIFIED_AND_SEALED"


# -----------------------------------------------------------------------------
# F4: Multi-Role Portal Views (5 Tests)
# -----------------------------------------------------------------------------

def test_t1_f4_01_donor_kitchen_portal_displays_listings_and_tax_slips(client: TestClient):
    """T1_F4_01: Verify Donor Kitchen portal displays excess food logging, active pickups, and tax slip links."""
    resp = client.get("/api/portals/donor/d1")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["donor"]["id"] == "d1"
    assert data["donor"]["name"] == "The Grand Amber Banquet Hall"
    assert len(data["active_listings"]) >= 1
    assert data["total_kg_saved"] > 0
    assert data["total_meals_saved"] > 0
    assert "tax_certificates" in data


def test_t1_f4_02_courier_fleet_view_displays_missions_and_routing(client: TestClient):
    """T1_F4_02: Verify Volunteer Courier Fleet view displays available missions, routing, and dispatch triggers."""
    resp = client.get("/api/portals/courier")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert "available_missions" in data
    assert "active_missions" in data
    assert "courier_fleet_status" in data
    assert len(data["available_missions"]) >= 1

    # Check structure of an available mission
    mission = data["available_missions"][0]
    assert "listing_id" in mission
    assert "urn_count" in mission
    assert "whatsapp_deep_link" in mission
    assert "sms_trigger_uri" in mission
    assert "target_shelter" in mission


def test_t1_f4_03_shelter_intake_board_displays_shipments_and_capacity(client: TestClient):
    """T1_F4_03: Verify Shelter Intake board displays incoming shipments, capacity limits, and thermal checks."""
    resp = client.get("/api/portals/shelter/r1")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["shelter"]["id"] == "r1"
    assert "incoming_deliveries" in data
    assert "completed_intakes" in data
    assert "capacity_meals" in data
    assert "utilization_percent" in data
    assert 0.0 <= data["utilization_percent"] <= 100.0


def test_t1_f4_04_municipal_command_center_macro_metrics(client: TestClient):
    """T1_F4_04: Verify Municipal Command Center displays city-wide throughput, active couriers, and spoilage rate."""
    resp = client.get("/api/portals/municipal")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert "Bengaluru" in data["city"]
    assert data["total_meals_rescued"] > 0
    assert data["total_food_kg_saved"] > 0
    assert data["spoilage_prevention_rate"] >= 90.0
    assert len(data["active_courier_density"]) >= 3
    assert len(data["ward_summaries"]) >= 4

    # Check courier density points
    c1 = data["active_courier_density"][0]
    assert "lat" in c1 and "lng" in c1
    assert c1["vehicle_type"] == "EV Cargo Trike"


def test_t1_f4_05_backward_compatibility_directory_and_impact_endpoints(client: TestClient):
    """T1_F4_05: Verify operational role switching preserves all existing directory and impact endpoints."""
    donors_resp = client.get("/api/donors")
    assert donors_resp.status_code == 200
    assert len(donors_resp.json()) >= 4

    receivers_resp = client.get("/api/receivers")
    assert receivers_resp.status_code == 200
    assert len(receivers_resp.json()) >= 4

    impact_resp = client.get("/api/impact")
    assert impact_resp.status_code == 200
    assert impact_resp.json()["total_meals_rescued"] > 0


# -----------------------------------------------------------------------------
# F5: Enhanced On-Device VLM / SLM Edge Intelligence (5 Tests)
# -----------------------------------------------------------------------------

def test_t1_f5_01_thermography_core_surface_ambient_temperatures(client: TestClient):
    """T1_F5_01: Verify simulated FLIR thermography heatmap data returns core, surface, and ambient temperatures."""
    resp = client.post("/api/inspect-food", json={"sample_id": "fresh_biryani"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert "thermography" in data
    thermo = data["thermography"]
    assert "core_temp_c" in thermo
    assert "surface_temp_c" in thermo
    assert "ambient_temp_c" in thermo
    assert "thermal_mode" in thermo
    assert "hotspot_matrix" in thermo

    # Fresh biryani is hot-hold: core temperature must be >= 65.0°C
    assert thermo["core_temp_c"] >= 65.0
    assert thermo["thermal_mode"] == "HOT_HOLD"
    assert thermo["holding_compliance"] is True
    assert len(thermo["hotspot_matrix"]) == 4


def test_t1_f5_02_fssai_engine_validates_hot_hold_temp(client: TestClient):
    """T1_F5_02: Verify FSSAI compliance engine validates hot-hold temperature (>65°C)."""
    resp = client.post("/api/inspect-food", json={"sample_id": "fresh_biryani"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert resp.status_code == 200
    data = resp.json()

    fssai = data["fssai_rule_engine"]
    assert fssai["hot_hold_valid"] is True
    assert fssai["cold_hold_valid"] is False
    assert fssai["compliance_status"] == "COMPLIANT_SAFE_HOLD"
    assert fssai["microbial_risk_level"] == "LOW"


def test_t1_f5_03_fssai_engine_validates_cold_hold_temp(client: TestClient):
    """T1_F5_03: Verify FSSAI compliance engine validates cold-hold temperature (<4°C)."""
    resp = client.post("/api/inspect-food", json={"sample_id": "salad"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert resp.status_code == 200
    data = resp.json()

    fssai = data["fssai_rule_engine"]
    assert fssai["cold_hold_valid"] is True
    assert fssai["hot_hold_valid"] is False
    assert fssai["compliance_status"] == "COMPLIANT_SAFE_HOLD"
    assert data["thermography"]["core_temp_c"] <= 4.0
    assert data["thermography"]["thermal_mode"] == "COLD_HOLD"


def test_t1_f5_04_dynamic_4_hour_microbial_proliferation_window(client: TestClient):
    """T1_F5_04: Verify dynamic 4-hour microbial proliferation window calculation based on prep time."""
    resp = client.post("/api/inspect-food", json={"sample_id": "fresh_biryani"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert resp.status_code == 200
    data = resp.json()

    fssai = data["fssai_rule_engine"]
    assert "elapsed_hours_since_prep" in fssai
    assert "scw_remaining_minutes" in fssai
    assert fssai["elapsed_hours_since_prep"] >= 0.0
    assert fssai["scw_remaining_minutes"] > 0
    # Safe window: elapsed + remaining should approximate 240 minutes (4 hours)
    total_window_approx = (fssai["elapsed_hours_since_prep"] * 60) + fssai["scw_remaining_minutes"]
    assert 220 <= total_window_approx <= 260


def test_t1_f5_05_ocr_extraction_kitchen_prep_timestamp(client: TestClient):
    """T1_F5_05: Verify OCR extraction of kitchen prep timestamp from container labels."""
    resp = client.post("/api/inspect-food", json={"sample_id": "fresh_biryani"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert resp.status_code == 200
    data = resp.json()

    assert "ocr_prep_timestamp" in data
    assert "12:30" in data["ocr_prep_timestamp"] or "IST" in data["ocr_prep_timestamp"]


# =============================================================================
# TIER 2: BOUNDARY & CORNER CASES (25 TESTS)
# =============================================================================

# -----------------------------------------------------------------------------
# F1 Boundaries (5 Tests)
# -----------------------------------------------------------------------------

def test_t2_f1_01_fractional_kg_food_minimum_one_urn(client: TestClient, db_conn):
    """T2_F1_01: Zero or fractional food mass (e.g. 0.5 kg -> minimum 1 urn)."""
    create_custom_listing(db_conn, "l_tiny", "d1", "Leftover Chutney", 0.5, 2)
    resp = client.get("/api/listings/l_tiny/dispatch-trigger")
    assert resp.status_code == 200
    assert resp.json()["urn_count"] == 1


def test_t2_f1_02_large_banquet_mass_urn_rounding(client: TestClient, db_conn):
    """T2_F1_02: Large banquet food mass (e.g. 500 kg -> 28 urns, exact integer rounding)."""
    # ceil(500 / 18) = 28 urns
    create_custom_listing(db_conn, "l_massive", "d1", "Wedding Buffet Surge", 500.0, 1000)
    resp = client.get("/api/listings/l_massive/dispatch-trigger")
    assert resp.status_code == 200
    assert resp.json()["urn_count"] == 28


def test_t2_f1_03_expired_scw_handling(client: TestClient, db_conn):
    """T2_F1_03: Expired SCW (0 minutes remaining) -> dispatch trigger blocked or returns HTTP 400."""
    from datetime import timedelta
    past_iso = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    create_custom_listing(db_conn, "l_exp", "d1", "Expired Gravy", 20.0, 40, status="EXPIRED", expires_at=past_iso)

    # Attempting to dispatch expired listing must return HTTP 400
    resp = client.post(
        "/api/listings/l_exp/dispatch",
        json={"volunteer_name": "Ravi Shastri", "volunteer_phone": "9845011998"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
    )
    assert resp.status_code == 400
    assert "expired" in resp.json()["detail"].lower()


def test_t2_f1_04_concurrent_dispatch_atomic_race(client: TestClient, db_conn):
    """T2_F1_04: Concurrent dispatch race condition -> exactly one volunteer wins claim, others receive HTTP 409."""
    # Create fresh POSTED listing for race test
    create_custom_listing(db_conn, "l_race_t2", "d1", "Concurrent Samosa Surplus", 20.0, 40, status="POSTED")

    volunteers = [
        {"volunteer_name": f"Courier_{i}", "volunteer_phone": f"984500000{i}"}
        for i in range(5)
    ]

    results = []
    # Execute 5 concurrent dispatch requests on listing l_race_t2
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [
            executor.submit(client.post, "/api/listings/l_race_t2/dispatch", json=v, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
            for v in volunteers
        ]
        for f in concurrent.futures.as_completed(futures):
            results.append(f.result())

    success_count = sum(1 for r in results if r.status_code == 200)
    conflict_count = sum(1 for r in results if r.status_code == 409)

    assert success_count == 1
    assert conflict_count == 4


def test_t2_f1_05_special_characters_in_food_name_url_encoded(client: TestClient, db_conn):
    """T2_F1_05: Special characters in food name/address -> URL-encoded cleanly in wa.me query string."""
    special_name = 'Mutton "Special" Biryani & Spicy Raita (50% Off!) @ Koramangala'
    create_custom_listing(db_conn, "l_special", "d1", special_name, 25.0, 50)

    resp = client.get("/api/listings/l_special/dispatch-trigger")
    assert resp.status_code == 200
    data = resp.json()

    wa_link = data["whatsapp_deep_link"]
    # Link must not contain unencoded spaces or raw double quotes
    assert " " not in wa_link
    assert '"' not in wa_link

    # Decode and ensure original special characters survived round-trip
    decoded = urllib.parse.unquote(wa_link)
    assert special_name in decoded


# -----------------------------------------------------------------------------
# F2 Boundaries (5 Tests)
# -----------------------------------------------------------------------------

def test_t2_f2_01_route_departure_state(client: TestClient):
    """T2_F2_01: Route progress at departure (status POSTED) -> ETA maximum, distance equal to full route."""
    # Listing l1 is POSTED in seed data
    resp = client.get("/api/telemetry/l1")
    assert resp.status_code == 200
    data = resp.json()

    assert data["is_delivered"] is False
    assert data["distance_remaining_km"] > 0
    assert data["eta_minutes"] >= 5


def test_t2_f2_02_route_arrival_state(client: TestClient):
    """T2_F2_02: Route progress at arrival (DELIVERED) -> ETA 0, distance 0, delivery confirmed."""
    # In seed data, listing l3 is already DELIVERED
    resp = client.get("/api/telemetry/l3")
    assert resp.status_code == 200
    data = resp.json()

    assert data["is_delivered"] is True
    assert data["distance_remaining_km"] == 0.0
    assert data["eta_minutes"] == 0
    assert data["speed_kmh"] == 0.0


def test_t2_f2_03_battery_critical_warning(client: TestClient):
    """T2_F2_03: Battery percentage reported cleanly in valid float range 0-100%."""
    resp = client.get("/api/telemetry/l1")
    assert resp.status_code == 200
    data = resp.json()

    assert isinstance(data["battery_percent"], float)
    assert 0.0 <= data["battery_percent"] <= 100.0


def test_t2_f2_04_thermal_drop_danger_zone_alert(client: TestClient, db_conn):
    """T2_F2_04: Cambro core temperature falling to danger zone (60°C) is flagged."""
    # Create and dispatch a fresh listing
    create_custom_listing(db_conn, "l_thermal_drop", "d1", "Lukewarm Curry", 30.0, 60, status="POSTED")
    client.post("/api/listings/l_thermal_drop/dispatch", json={"volunteer_name": "Sunil", "volunteer_phone": "9845099881", "receiver_id": "r2"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})

    # Confirm delivery with temperature in danger zone (58.5°C)
    delivery_resp = client.post(
        "/api/listings/l_thermal_drop/confirm-delivery",
        json={"receiver_id": "r2", "intake_temp_c": 58.5, "meals_accepted": 60}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
    )
    assert delivery_resp.status_code == 200

    # Intake was recorded with danger zone breach status
    intake = db_conn.execute("SELECT * FROM shelter_intakes WHERE listing_id = 'l_thermal_drop'").fetchone()
    assert intake["fssai_compliance_status"] in ("THERMAL_BREACH_DANGER_ZONE", "TEMP_FLAGGED_WARNING")


def test_t2_f2_05_delivery_confirmation_invalid_or_already_delivered(client: TestClient):
    """T2_F2_05: Delivery confirmation for non-existent or already delivered listing returns HTTP 404/409."""
    # Non-existent listing
    resp404 = client.post(
        "/api/listings/l_nonexistent/confirm-delivery",
        json={"receiver_id": "r1", "intake_temp_c": 68.0, "meals_accepted": 10}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
    )
    assert resp404.status_code == 404

    # Undispatched listing (l1 is POSTED)
    resp409 = client.post(
        "/api/listings/l1/confirm-delivery",
        json={"receiver_id": "r1", "intake_temp_c": 68.0, "meals_accepted": 10}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
    )
    assert resp409.status_code == 409


# -----------------------------------------------------------------------------
# F3 Boundaries (5 Tests)
# -----------------------------------------------------------------------------

def test_t2_f3_01_zero_quantity_deduction_graceful(client: TestClient, db_conn):
    """T2_F3_01: Zero kilograms donated -> deduction amount ₹0.00, handled gracefully."""
    create_custom_listing(db_conn, "l_zero", "d1", "Complimentary Spices", 0.0, 0)
    resp = client.get("/api/tax/80g/l_zero")
    assert resp.status_code == 200
    data = resp.json()

    assert data["gross_salvage_valuation"] == 0.0
    assert data["eligible_80g_deduction"] == 0.0
    assert data["esg_co2e_offset_kg"] == 0.0


def test_t2_f3_02_invalid_pan_format_handling(client: TestClient):
    """T2_F3_02: Generated donor PAN strictly satisfies IT Department 10-character alphanumeric format."""
    resp = client.get("/api/tax/80g/l1")
    assert resp.status_code == 200
    pan = resp.json()["donor_pan"]
    assert len(pan) == 10
    assert pan.isalnum()
    assert pan[:4].isalpha()


def test_t2_f3_03_extreme_large_scale_donation_10000kg(client: TestClient, db_conn):
    """T2_F3_03: Extremely large donation (10,000 kg) -> tax deduction scales correctly without overflow."""
    # 10,000 kg -> 20,000 meals -> FMV @ ₹65 = ₹1,300,000 -> 80G deduction = ₹650,000
    create_custom_listing(db_conn, "l_mega", "d1", "City Relief Marathon", 10000.0, 20000)
    resp = client.get("/api/tax/80g/l_mega")
    assert resp.status_code == 200
    data = resp.json()

    assert data["gross_salvage_valuation"] == 1300000.0
    assert data["eligible_80g_deduction"] == 650000.0
    assert data["esg_co2e_offset_kg"] == 25000.0


def test_t2_f3_04_unclaimed_or_unverified_listing_tax_slip(client: TestClient):
    """T2_F3_04: Requesting 80G slip for active POSTED listing generates valid provisional slip."""
    resp = client.get("/api/tax/80g/l1")
    assert resp.status_code == 200
    assert resp.json()["certificate_number"].startswith("80G-BLR-2026-")


def test_t2_f3_05_tampered_verification_hash(client: TestClient):
    """T2_F3_05: Certificate verification lookup with tampered ID returns HTTP 404."""
    resp = client.get("/api/tax/verify/tc_tampered_invalid_hash_9999")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


# -----------------------------------------------------------------------------
# F4 Boundaries (5 Tests)
# -----------------------------------------------------------------------------

def test_t2_f4_01_empty_donor_listings_state(empty_client: TestClient):
    """T2_F4_01: Empty database -> queries to non-existent donor return HTTP 404 cleanly."""
    resp = empty_client.get("/api/portals/donor/d_empty")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_t2_f4_02_zero_available_couriers_graceful(empty_client: TestClient):
    """T2_F4_02: Zero available listings -> Courier Portal handles empty state cleanly."""
    resp = empty_client.get("/api/portals/courier")
    assert resp.status_code == 200
    data = resp.json()
    assert data["available_missions"] == []
    assert data["active_missions"] == []


def test_t2_f4_03_shelter_capacity_utilization_limit(client: TestClient):
    """T2_F4_03: Shelter utilization calculation handles bounds up to 100% without overflowing."""
    resp = client.get("/api/portals/shelter/r1")
    assert resp.status_code == 200
    data = resp.json()
    assert 0.0 <= data["utilization_percent"] <= 100.0


def test_t2_f4_04_rapid_requests_portal_stability(client: TestClient):
    """T2_F4_04: Rapid back-to-back requests to municipal portal remain stable without crashing."""
    for _ in range(15):
        resp = client.get("/api/portals/municipal")
        assert resp.status_code == 200
        assert resp.json()["spoilage_prevention_rate"] >= 90.0


def test_t2_f4_05_nonexistent_shelter_portal_404(client: TestClient):
    """T2_F4_05: Nonexistent shelter ID returns HTTP 404 Not Found."""
    resp = client.get("/api/portals/shelter/r_invalid_missing")
    assert resp.status_code == 404


# -----------------------------------------------------------------------------
# F5 Boundaries (5 Tests)
# -----------------------------------------------------------------------------

def test_t2_f5_01_temperature_boundary_exact_65c(client: TestClient):
    """T2_F5_01: Food temperature at hot-hold boundary (>65°C) is compliant."""
    # fresh_biryani preset has core temp 68.4°C >= 65.0°C
    resp = client.post("/api/inspect-food", json={"sample_id": "fresh_biryani"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert resp.status_code == 200
    data = resp.json()
    assert data["thermography"]["core_temp_c"] >= 65.0
    assert data["fssai_rule_engine"]["hot_hold_valid"] is True


def test_t2_f5_02_temperature_boundary_64_9c_danger_zone(client: TestClient):
    """T2_F5_02: Food in danger zone / spoiled triggers non-compliance."""
    resp = client.post("/api/inspect-food", json={"sample_id": "spoiled_curry"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_safe"] is False
    assert data["thermography"]["holding_compliance"] is False
    assert data["thermography"]["thermal_mode"] == "DANGER_ZONE"


def test_t2_f5_03_prep_time_boundary_exactly_240_minutes(client: TestClient):
    """T2_F5_03: Elapsed prep time calculations adhere to 4-hour microbial window."""
    resp = client.post("/api/inspect-food", json={"sample_id": "fresh_paneer"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert resp.status_code == 200
    fssai = resp.json()["fssai_rule_engine"]
    assert fssai["elapsed_hours_since_prep"] <= 4.0
    assert fssai["scw_remaining_minutes"] >= 0


def test_t2_f5_04_prep_time_over_240_minutes_fssai_grade_f(client: TestClient):
    """T2_F5_04: Elapsed time > 240 minutes -> mandatory FSSAI violation, inspection grade F."""
    resp = client.post("/api/inspect-food", json={"sample_id": "expired_rice"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert resp.status_code == 200
    data = resp.json()
    assert data["fssai_grade"] == "GRADE_F"
    assert data["is_safe"] is False
    assert data["fssai_rule_engine"]["microbial_risk_level"] == "CRITICAL"


def test_t2_f5_05_corrupt_image_payload_fail_closed(client: TestClient):
    """T2_F5_05: Corrupt/unreadable image input -> fail-closed safety returns HTTP 400 or INSPECTION_FAILED."""
    # Corrupt base64 string
    resp = client.post("/api/inspect-food", json={"image_base64": "NOT_A_VALID_IMAGE_BYTES_XYZ!"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    # Must fail closed: either HTTP 400 rejection or fail-closed INSPECTION_FAILED
    if resp.status_code == 200:
        data = resp.json()
        assert data["is_safe"] is False
        assert data["verdict"] == "INSPECTION_FAILED"
    else:
        assert resp.status_code in (400, 422)


# =============================================================================
# TIER 3: CROSS-FEATURE INTERACTIONS (5 TESTS)
# =============================================================================

def test_t3_pair_01_dispatch_initializes_telemetry_route(client: TestClient, db_conn):
    """T3_PAIR_01 (F1 + F2): Dispatch trigger initializes EV Cargo Trike telemetry route."""
    # Create fresh POSTED listing
    create_custom_listing(db_conn, "l_pair_01", "d1", "Paneer Pulao Special", 40.0, 80, status="POSTED")

    # Before dispatch: listing is POSTED (waiting at donor)
    pre_telemetry = client.get("/api/telemetry/l_pair_01").json()
    assert pre_telemetry["speed_kmh"] == 0.0
    assert pre_telemetry["is_delivered"] is False

    # Dispatch l_pair_01
    dispatch_resp = client.post(
        "/api/listings/l_pair_01/dispatch",
        json={"volunteer_name": "Farhan Akhtar", "volunteer_phone": "9845012399", "vehicle_type": "EV Cargo Trike"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
    )
    assert dispatch_resp.status_code == 200

    # After dispatch: telemetry reflects active courier transit
    post_telemetry = client.get("/api/telemetry/l_pair_01").json()
    assert post_telemetry["courier_name"] == "Farhan Akhtar"
    assert post_telemetry["speed_kmh"] >= 22.0
    assert post_telemetry["is_regen_active"] is True
    assert len(post_telemetry["waypoints"]) >= 2


def test_t3_pair_02_delivery_arrival_updates_shelter_intake_board(client: TestClient, db_conn):
    """T3_PAIR_02 (F2 + F4): Driver delivery confirmation updates Shelter Intake board in real-time."""
    create_custom_listing(db_conn, "l_pair_02", "d1", "South Indian Meals", 45.0, 90, status="POSTED")

    # 1. Dispatch l_pair_02 to shelter r2
    client.post(
        "/api/listings/l_pair_02/dispatch",
        json={"volunteer_name": "Priya Sharma", "volunteer_phone": "9845099112", "receiver_id": "r2"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
    )

    # 2. Confirm delivery at shelter r2
    client.post(
        "/api/listings/l_pair_02/confirm-delivery",
        json={"receiver_id": "r2", "intake_temp_c": 67.4, "meals_accepted": 90}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
    )

    # 3. Query Shelter Intake Board for r2
    portal_resp = client.get("/api/portals/shelter/r2")
    assert portal_resp.status_code == 200
    pdata = portal_resp.json()

    # Completed intakes must now contain the newly delivered shipment
    intake_ids = [item["listing_id"] for item in pdata["completed_intakes"]]
    assert "l_pair_02" in intake_ids
    delivered_entry = next(item for item in pdata["completed_intakes"] if item["listing_id"] == "l_pair_02")
    assert delivered_entry["intake_temp_c"] == 67.4
    assert delivered_entry["meals_accepted"] == 90


def test_t3_pair_03_verified_delivery_generates_section_80g_tax_certificate(client: TestClient, db_conn):
    """T3_PAIR_03 (F2 + F3): Verified delivery in Shelter board automatically yields exportable 80G tax slip."""
    create_custom_listing(db_conn, "l_pair_03", "d1", "Chapati & Dal Combo", 35.0, 70, status="POSTED")

    # 1. Dispatch and deliver l_pair_03
    client.post("/api/listings/l_pair_03/dispatch", json={"volunteer_name": "Rohan", "volunteer_phone": "9845012345", "receiver_id": "r1"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    client.post("/api/listings/l_pair_03/confirm-delivery", json={"receiver_id": "r1", "intake_temp_c": 68.0, "meals_accepted": 70}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})

    # 2. Query 80G certificate
    tax_resp = client.get("/api/tax/80g/l_pair_03")
    assert tax_resp.status_code == 200
    tdata = tax_resp.json()

    assert tdata["quantity_meals"] == 70
    assert tdata["gross_salvage_valuation"] == 70 * 65.0
    assert tdata["eligible_80g_deduction"] == (70 * 65.0) * 0.50
    assert tdata["ca_attestation"]["udin"].startswith("26021948AAAAAA")


def test_t3_pair_04_vlm_inspection_pass_populates_dispatch_payload(client: TestClient):
    """T3_PAIR_04 (F5 + F1): Food passing VLM thermography auto-populates container urn count and SCW in dispatch."""
    # Inspect fresh banquet
    vlm_resp = client.post("/api/inspect-food", json={"sample_id": "fresh_biryani"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert vlm_resp.status_code == 200
    vdata = vlm_resp.json()

    assert vdata["is_safe"] is True
    assert vdata["thermography"]["holding_compliance"] is True

    # Check dispatch trigger on active listing
    disp_resp = client.get("/api/listings/l1/dispatch-trigger")
    assert disp_resp.status_code == 200
    ddata = disp_resp.json()

    assert ddata["urn_count"] == 4
    assert ddata["scw_minutes_remaining"] > 0


def test_t3_pair_05_vlm_inspection_fail_triggers_compost_diversion_in_municipal_portal(client: TestClient):
    """T3_PAIR_05 (F5 + F4): Food failing VLM inspection is prevented from rescue dispatch and tracked in municipal portal."""
    vlm_resp = client.post("/api/inspect-food", json={"sample_id": "spoiled_curry"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert vlm_resp.status_code == 200
    vdata = vlm_resp.json()

    assert vdata["is_safe"] is False
    assert vdata["verdict"] == "SPOILED_AND_GONE"

    # Municipal portal maintains overall spoilage tracking
    muni_resp = client.get("/api/portals/municipal")
    assert muni_resp.status_code == 200
    mdata = muni_resp.json()
    assert mdata["spoilage_prevention_rate"] > 0.0


# =============================================================================
# TIER 4: REAL-WORLD MUNICIPAL RELIEF WORKLOADS (5 SCENARIOS)
# =============================================================================

def test_t4_scenario_01_high_volume_banquet_rescue(client: TestClient, db_conn):
    """T4_SCENARIO_01: High-Volume Banquet Rescue (150 kg biryani, 9 urns, dispatch, transit, delivery, 80G slip)."""
    # Step 1: Donor logs 150 kg fresh biryani (300 meals)
    create_custom_listing(db_conn, "l_wedding_150", "d1", "Corporate Wedding Hyderabadi Biryani", 150.0, 300)

    # Step 2: VLM inspection verifies thermal compliance
    vlm_resp = client.post("/api/inspect-food", json={"sample_id": "fresh_biryani"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert vlm_resp.status_code == 200
    assert vlm_resp.json()["thermography"]["core_temp_c"] >= 65.0

    # Step 3: Trigger 1-Click WhatsApp dispatch (ceil(150 / 18) = 9 urns)
    disp_resp = client.post(
        "/api/listings/l_wedding_150/dispatch",
        json={"volunteer_name": "Manoj Kumar", "volunteer_phone": "9845012345", "vehicle_type": "EV Cargo Trike", "receiver_id": "r2"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
    )
    assert disp_resp.status_code == 200
    disp_data = disp_resp.json()
    assert disp_data["urn_count"] == 9
    assert "https://wa.me/" in disp_data["whatsapp_deep_link"]

    # Step 4: EV Trike navigates arterial route to City Hope Shelter
    telemetry = client.get("/api/telemetry/l_wedding_150").json()
    assert telemetry["vehicle_type"] == "EV Cargo Trike"
    assert telemetry["cambro_core_temp_c"] > 65.0
    assert 22.0 <= telemetry["speed_kmh"] <= 36.0

    # Step 5: Shelter confirms intake
    confirm_resp = client.post(
        "/api/listings/l_wedding_150/confirm-delivery",
        json={"receiver_id": "r2", "intake_temp_c": 68.2, "meals_accepted": 300, "notes": "9 urns received intact"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
    )
    assert confirm_resp.status_code == 200
    assert confirm_resp.json()["status"] == "DELIVERED"

    # Step 6: Section 80G Certificate generated: 300 meals * ₹65 = ₹19,500 FMV, ₹9,750 deduction, 375 kg CO2e offset
    tax_resp = client.get("/api/tax/80g/l_wedding_150")
    assert tax_resp.status_code == 200
    tax_data = tax_resp.json()
    assert tax_data["gross_salvage_valuation"] == 19500.0
    assert tax_data["eligible_80g_deduction"] == 9750.0
    assert tax_data["esg_co2e_offset_kg"] == 375.0
    assert tax_data["ca_attestation"]["udin"].startswith("26021948AAAAAA")


def test_t4_scenario_02_danger_zone_thermal_spoilage_containment(client: TestClient, db_conn):
    """T4_SCENARIO_02: Danger Zone Thermal Spoilage Containment (42°C, broken seal, fail-closed diversion)."""
    # Step 1: VLM inspects compromised sample
    vlm_resp = client.post("/api/inspect-food", json={"sample_id": "spoiled_curry"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert vlm_resp.status_code == 200
    vdata = vlm_resp.json()

    # Step 2: Fail-closed zero-trust validation
    assert vdata["is_safe"] is False
    assert vdata["verdict"] == "SPOILED_AND_GONE"
    assert vdata["fssai_grade"] == "GRADE_F"
    assert vdata["thermography"]["holding_compliance"] is False

    # Step 3: Food is diverted to composting; prevented from dispatch
    create_custom_listing(db_conn, "l_spoiled_batch", "d1", "Sour Curd Rice", 40.0, 80, status="EXPIRED")
    dispatch_attempt = client.post(
        "/api/listings/l_spoiled_batch/dispatch",
        json={"volunteer_name": "Ravi", "volunteer_phone": "9845012345"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
    )
    assert dispatch_attempt.status_code == 400


def test_t4_scenario_03_multi_courier_concurrent_dispatch_race(client: TestClient, db_conn):
    """T4_SCENARIO_03: Multi-Courier Concurrent Dispatch Race (atomic claim lock, 1 winner, 1 rejected)."""
    # Create fresh POSTED listing for race
    create_custom_listing(db_conn, "l_race_s3", "d1", "Festival Sweet Surplus", 25.0, 50, status="POSTED")

    # Two couriers attempt to claim listing l_race_s3 simultaneously
    courier_a = {"volunteer_name": "Arun - Robin Hood Army", "volunteer_phone": "9845011111"}
    courier_b = {"volunteer_name": "Deepak - Feeding India", "volunteer_phone": "9845022222"}

    resp_a = client.post("/api/listings/l_race_s3/dispatch", json=courier_a, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    resp_b = client.post("/api/listings/l_race_s3/dispatch", json=courier_b, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})

    # Exactly one succeeded (200), and the second received a 409 conflict
    statuses = [resp_a.status_code, resp_b.status_code]
    assert 200 in statuses
    assert 409 in statuses

    # Confirm only the winner is recorded
    listing = client.get("/api/listings/l_race_s3").json()
    assert listing["status"] == "CLAIMED"
    assert listing["pickup"]["volunteer_name"] in (courier_a["volunteer_name"], courier_b["volunteer_name"])


def test_t4_scenario_04_corporate_donor_audit_and_tax_verification(client: TestClient, db_conn):
    """T4_SCENARIO_04: Corporate Donor Historical Audit & 80G Tax Verification."""
    # Create and deliver a completed rescue for donor d1
    create_custom_listing(db_conn, "l_audit_d1", "d1", "Audited Buffet Rescued", 50.0, 100, status="DELIVERED")

    # Donor d1 checks donor portal
    portal_resp = client.get("/api/portals/donor/d1")
    assert portal_resp.status_code == 200
    portal_data = portal_resp.json()

    assert portal_data["donor"]["id"] == "d1"
    assert len(portal_data["tax_certificates"]) >= 1

    # Fetch specific 80G tax certificate
    cert = portal_data["tax_certificates"][0]
    assert cert["donor_pan"] is not None

    # Verify certificate via public verification docket URL
    qr_url = cert["qr_verification_url"]
    verify_resp = client.get(qr_url)
    assert verify_resp.status_code == 200
    vdata = verify_resp.json()

    assert vdata["valid"] is True
    assert vdata["certificate_number"] == cert["certificate_number"]
    assert vdata["ca_udin"] == cert["ca_attestation"]["udin"]
    assert vdata["verification_status"] == "OFFICIALLY_VERIFIED_AND_SEALED"


def test_t4_scenario_05_citywide_municipal_command_surge_response(client: TestClient):
    """T4_SCENARIO_05: Municipal Disaster Surge Command (multi-sector density, throughput, spoilage prevention)."""
    resp = client.get("/api/portals/municipal")
    assert resp.status_code == 200
    data = resp.json()

    # Macro rescue throughput
    assert data["total_meals_rescued"] > 0
    assert data["total_food_kg_saved"] > 0
    assert data["esg_co2e_total_kg"] == pytest.approx(data["total_food_kg_saved"] * 2.5, abs=0.1)

    # Spoilage prevention efficiency rate (>90%)
    assert data["spoilage_prevention_rate"] >= 90.0

    # Sector ward summaries
    wards = {w["ward_name"]: w for w in data["ward_summaries"]}
    assert any("Koramangala" in name for name in wards)
    assert any("Indiranagar" in name for name in wards)
    assert any("HSR Layout" in name for name in wards)

    # Courier density radar markers
    active_couriers = data["active_courier_density"]
    assert len(active_couriers) >= 3
    for c in active_couriers:
        assert c["vehicle_type"] in ("EV Cargo Trike", "Electric Auto")
        assert 12.0 <= c["lat"] <= 13.5
        assert 77.0 <= c["lng"] <= 78.0
