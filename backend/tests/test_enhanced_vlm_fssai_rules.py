"""Tests for SurplusPulse Enhanced On-Device VLM / SLM Food Safety Triage.
Validates:
1. Simulated thermography telemetry (core temp, thermal mode, 4x4 hotspot matrix)
2. FSSAI 4-hour microbial proliferation rule engine (hot-hold >65°C, cold-hold <4°C, danger zone)
3. Packaging integrity and OCR kitchen prep timestamp extraction
4. Fail-closed zero-trust safety policy
"""
from __future__ import annotations

from fastapi.testclient import TestClient
from app.mirage_inspector import inspect_food_image, inspect_food_payload


def test_vlm_thermography_fresh_biryani_hot_hold(client: TestClient):
    """Inspect fresh_biryani preset returns >65°C hot-hold compliance,

    low microbial risk, and extracted OCR prep timestamp.
    """
    resp = client.post("/api/inspect-food", json={"sample_id": "fresh_biryani"})
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["is_safe"] is True
    assert data["quality_score"] >= 90
    assert data["verdict"] == "FRESH_AND_GOOD"

    # Thermography telemetry
    thermo = data["thermography"]
    assert thermo["core_temp_c"] >= 65.0, f"Expected core temp >= 65°C, got {thermo['core_temp_c']}"
    assert thermo["thermal_mode"] == "HOT_HOLD"
    assert thermo["holding_compliance"] is True
    matrix = thermo["hotspot_matrix"]
    assert len(matrix) == 4 and len(matrix[0]) == 4
    for row in matrix:
        for val in row:
            assert val >= 65.0

    # FSSAI Rule Engine
    fssai = data["fssai_rule_engine"]
    assert fssai["compliance_status"] == "COMPLIANT_SAFE_HOLD"
    assert fssai["hot_hold_valid"] is True
    assert fssai["cold_hold_valid"] is False
    assert fssai["elapsed_hours_since_prep"] <= 1.0
    assert fssai["scw_remaining_minutes"] >= 180
    assert fssai["microbial_risk_level"] == "LOW"

    # OCR prep timestamp
    assert data["ocr_prep_timestamp"] == "12:30 IST"


def test_vlm_thermography_chilled_salad_cold_hold(client: TestClient):
    """Inspect salad preset returns <4°C cold-hold compliance and low microbial risk."""
    resp = client.post("/api/inspect-food", json={"sample_id": "salad"})
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["is_safe"] is True
    assert data["verdict"] == "FRESH_AND_GOOD"

    thermo = data["thermography"]
    assert thermo["core_temp_c"] <= 4.0, f"Expected core temp <= 4°C, got {thermo['core_temp_c']}"
    assert thermo["thermal_mode"] == "COLD_HOLD"
    assert thermo["holding_compliance"] is True

    fssai = data["fssai_rule_engine"]
    assert fssai["compliance_status"] == "COMPLIANT_SAFE_HOLD"
    assert fssai["hot_hold_valid"] is False
    assert fssai["cold_hold_valid"] is True
    assert fssai["microbial_risk_level"] == "LOW"

    assert data["ocr_prep_timestamp"] == "13:15 IST"


def test_vlm_thermography_spoiled_curry_danger_zone(client: TestClient):
    """Inspect spoiled_curry preset flags danger zone temperature (31°C)

    and critical microbial proliferation hazard.
    """
    resp = client.post("/api/inspect-food", json={"sample_id": "spoiled_curry"})
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["is_safe"] is False
    assert data["verdict"] == "SPOILED_AND_GONE"

    thermo = data["thermography"]
    assert 4.0 < thermo["core_temp_c"] < 65.0  # In danger zone
    assert thermo["thermal_mode"] == "DANGER_ZONE"
    assert thermo["holding_compliance"] is False

    fssai = data["fssai_rule_engine"]
    assert fssai["compliance_status"] == "CRITICAL_SPOILAGE_HAZARD"
    assert fssai["hot_hold_valid"] is False
    assert fssai["cold_hold_valid"] is False
    assert fssai["scw_remaining_minutes"] == 0
    assert fssai["microbial_risk_level"] == "CRITICAL"


def test_vlm_thermography_expired_rice_danger_zone(client: TestClient):
    """Inspect expired_rice preset flags cold hazard danger zone (22°C)

    and expired safe consumption window.
    """
    resp = client.post("/api/inspect-food", json={"sample_id": "expired_rice"})
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["is_safe"] is False
    assert data["verdict"] == "SPOILED_AND_GONE"

    thermo = data["thermography"]
    assert thermo["thermal_mode"] == "DANGER_ZONE"
    assert thermo["holding_compliance"] is False

    fssai = data["fssai_rule_engine"]
    assert fssai["compliance_status"] == "DANGER_ZONE_EXPIRED"
    assert fssai["scw_remaining_minutes"] == 0
    assert fssai["microbial_risk_level"] == "CRITICAL"


def test_inspect_food_image_alias_direct():
    """Direct module call to inspect_food_image alias works identical to inspect_food_payload."""
    result = inspect_food_image(sample_id="fresh_paneer")
    assert result["is_safe"] is True
    assert result["thermography"]["core_temp_c"] >= 65.0
    assert result["fssai_rule_engine"]["microbial_risk_level"] == "LOW"
    assert result["ocr_prep_timestamp"] == "13:00 IST"


def test_vlm_fail_closed_on_corrupt_data():
    """Passing corrupt byte sequences fails closed with CRITICAL risk and 0 quality score."""
    corrupt_bytes = b"NOT_A_VALID_IMAGE_HEADER_CORRUPTED_STREAM"
    result = inspect_food_payload(image_bytes=corrupt_bytes)
    assert result["is_safe"] is False
    assert result["quality_score"] == 0
    assert result["thermography"]["holding_compliance"] is False
    assert result["fssai_rule_engine"]["microbial_risk_level"] == "CRITICAL"
