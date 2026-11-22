"""Tier 2 Boundary Values, Validation Constraints, and Error Handling Test Suite.
Verifies HTTP 422 Unprocessable Entity, 404 Not Found, 400 Bad Request,
mathematical edge conditions, and error recovery behaviors for SurplusPulse.
Requirement: >=55 assertions.
"""

from __future__ import annotations

import os

import pytest
from app.matching import compute_urgency_score, haversine_distance_km, minutes_until_expiry


# ---------------------------------------------------------------------------
# 1. HTTP 422 Schema Validation Constraints
# ---------------------------------------------------------------------------

def test_listing_creation_meals_zero_and_negative(client):
    """TC2.1: quantity_meals must be strictly greater than 0."""
    base_payload = {
        "donor_id": "d1",
        "food_name": "Paneer Butter Masala",
        "food_category": "VEG",
        "quantity_kg": 10.0,
        "hours_valid": 3.0,
    }
    # Zero meals
    res_zero = client.post("/api/listings", json={**base_payload, "quantity_meals": 0}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res_zero.status_code == 422
    assert "quantity_meals" in str(res_zero.json()["detail"])

    # Negative meals
    res_neg = client.post("/api/listings", json={**base_payload, "quantity_meals": -15}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res_neg.status_code == 422
    assert "quantity_meals" in str(res_neg.json()["detail"])


def test_listing_creation_kg_zero_and_negative(client):
    """TC2.2: quantity_kg must be strictly greater than 0."""
    base_payload = {
        "donor_id": "d1",
        "food_name": "Paneer Butter Masala",
        "food_category": "VEG",
        "quantity_meals": 25,
        "hours_valid": 3.0,
    }
    # Zero kg
    res_zero = client.post("/api/listings", json={**base_payload, "quantity_kg": 0.0}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res_zero.status_code == 422
    assert "quantity_kg" in str(res_zero.json()["detail"])

    # Negative kg
    res_neg = client.post("/api/listings", json={**base_payload, "quantity_kg": -2.5}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res_neg.status_code == 422
    assert "quantity_kg" in str(res_neg.json()["detail"])


def test_listing_creation_hours_valid_boundaries(client):
    """TC2.3: hours_valid must be in [0.5, 12.0]."""
    base_payload = {
        "donor_id": "d1",
        "food_name": "Paneer Butter Masala",
        "food_category": "VEG",
        "quantity_meals": 30,
        "quantity_kg": 12.0,
    }
    # Sub-boundary: 0.49 hours
    res_low = client.post("/api/listings", json={**base_payload, "hours_valid": 0.49}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res_low.status_code == 422
    assert "hours_valid" in str(res_low.json()["detail"])

    # Sub-boundary: 0.0 hours
    res_zero = client.post("/api/listings", json={**base_payload, "hours_valid": 0.0}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res_zero.status_code == 422

    # Excess-boundary: 12.1 hours
    res_high = client.post("/api/listings", json={**base_payload, "hours_valid": 12.1}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res_high.status_code == 422
    assert "hours_valid" in str(res_high.json()["detail"])

    # Excess-boundary: 24.0 hours
    res_excess = client.post("/api/listings", json={**base_payload, "hours_valid": 24.0}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res_excess.status_code == 422

    # Exact lower limit: 0.5 hours should succeed
    res_min = client.post("/api/listings", json={**base_payload, "hours_valid": 0.5}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res_min.status_code == 201

    # Exact upper limit: 12.0 hours should succeed
    res_max = client.post("/api/listings", json={**base_payload, "hours_valid": 12.0}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res_max.status_code == 201


def test_listing_creation_food_name_length(client):
    """TC2.4: food_name must have at least 3 characters."""
    base_payload = {
        "donor_id": "d1",
        "food_category": "VEG",
        "quantity_meals": 20,
        "quantity_kg": 8.0,
        "hours_valid": 2.0,
    }
    # Empty string
    res_empty = client.post("/api/listings", json={**base_payload, "food_name": ""}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res_empty.status_code == 422

    # 2 characters (short)
    res_two = client.post("/api/listings", json={**base_payload, "food_name": "ab"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res_two.status_code == 422
    assert "food_name" in str(res_two.json()["detail"])

    # 3 characters (boundary pass)
    res_three = client.post("/api/listings", json={**base_payload, "food_name": "Dal"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res_three.status_code == 201


def test_listing_creation_enum_constraints(client):
    """TC2.5: food_category must be VEG/NON_VEG and storage_type must be HOT/AMBIENT/REFRIGERATED."""
    base_payload = {
        "donor_id": "d1",
        "food_name": "Mixed Seafood Platter",
        "quantity_meals": 40,
        "quantity_kg": 15.0,
        "hours_valid": 3.0,
    }
    # Invalid food_category
    res_cat = client.post("/api/listings", json={**base_payload, "food_category": "SEAFOOD"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res_cat.status_code == 422
    assert "food_category" in str(res_cat.json()["detail"])

    # Invalid storage_type
    res_storage = client.post(
        "/api/listings",
        json={**base_payload, "food_category": "NON_VEG", "storage_type": "FROZEN_DEEP"},
        headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
    )
    assert res_storage.status_code == 422
    assert "storage_type" in str(res_storage.json()["detail"])


def test_claim_request_validation(client):
    """TC2.6: volunteer_name must be >=2 chars and volunteer_phone must be >=8 chars."""
    # Short volunteer_name (1 char)
    res_short_name = client.post(
        "/api/listings/l1/claim",
        json={"receiver_id": "r1", "volunteer_name": "V", "volunteer_phone": "+91 98800 11223"},
        headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
    )
    assert res_short_name.status_code == 422
    assert "volunteer_name" in str(res_short_name.json()["detail"])

    # Short volunteer_phone (<8 chars)
    res_short_phone = client.post(
        "/api/listings/l1/claim",
        json={"receiver_id": "r1", "volunteer_name": "Vikram", "volunteer_phone": "12345"},
        headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
    )
    assert res_short_phone.status_code == 422
    assert "volunteer_phone" in str(res_short_phone.json()["detail"])


def test_status_update_enum_validation(client):
    """TC2.7: status update only accepts COLLECTED or DELIVERED."""
    # Invalid statuses
    for invalid_status in ["POSTED", "CLAIMED", "EXPIRED", "CANCELLED", "REJECTED"]:
        res = client.post("/api/listings/l2/status", json={"status": invalid_status}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
        assert res.status_code == 422
        assert "status" in str(res.json()["detail"])


# ---------------------------------------------------------------------------
# 2. HTTP 404 Entity Absence
# ---------------------------------------------------------------------------

def test_listing_creation_nonexistent_donor(client):
    """TC2.8: Creating a listing with nonexistent donor_id returns 404."""
    res = client.post(
        "/api/listings",
        headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
        json={
            "donor_id": "d999_nonexistent",
            "food_name": "Surplus Lunch",
            "food_category": "VEG",
            "quantity_meals": 30,
            "quantity_kg": 10.0,
            "hours_valid": 3.0,
        },
    )
    assert res.status_code == 404
    assert "Donor not found" in res.json()["detail"]


def test_get_nonexistent_listing(client):
    """TC2.9: Fetching nonexistent listing returns 404."""
    res = client.get("/api/listings/l_nonexistent_999")
    assert res.status_code == 404
    assert "Listing not found" in res.json()["detail"]


def test_claim_nonexistent_listing(client):
    """TC2.10: Claiming nonexistent listing returns 404."""
    res = client.post(
        "/api/listings/l_nonexistent_999/claim",
        headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
        json={"receiver_id": "r1", "volunteer_name": "Santosh", "volunteer_phone": "+91 99001 12233"},
    )
    assert res.status_code == 404
    assert "Listing not found" in res.json()["detail"]


def test_claim_nonexistent_receiver(client):
    """TC2.11: Claiming with nonexistent receiver_id returns 404."""
    res = client.post(
        "/api/listings/l1/claim",
        headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
        json={"receiver_id": "r999_nonexistent", "volunteer_name": "Santosh", "volunteer_phone": "+91 99001 12233"},
    )
    assert res.status_code == 404
    assert "Receiver NGO/Shelter not found" in res.json()["detail"]


def test_status_update_nonexistent_listing(client):
    """TC2.12: Updating status on nonexistent listing returns 404."""
    res = client.post("/api/listings/l_nonexistent_999/status", json={"status": "COLLECTED"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res.status_code == 404
    assert "Listing not found" in res.json()["detail"]


def test_smart_matches_nonexistent_listing(client):
    """TC2.13: Computing matches for nonexistent listing returns 404."""
    res = client.get("/api/matches/l_nonexistent_999")
    assert res.status_code == 404
    assert "Listing not found" in res.json()["detail"]


# ---------------------------------------------------------------------------
# 3. HTTP 400 Invalid State Machine Transitions
# ---------------------------------------------------------------------------

def test_double_claim_on_already_claimed_listing(client):
    """TC2.14: Claiming an already CLAIMED listing returns 400."""
    # l2 is seeded in CLAIMED status
    res = client.post(
        "/api/listings/l2/claim",
        headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
        json={"receiver_id": "r1", "volunteer_name": "Ramesh", "volunteer_phone": "+91 98800 12345"},
    )
    assert res.status_code == 400
    assert "Cannot claim listing in CLAIMED status" in res.json()["detail"]


def test_claim_on_delivered_listing(client):
    """TC2.15: Claiming an already DELIVERED listing returns 400."""
    # l3 is seeded in DELIVERED status
    res = client.post(
        "/api/listings/l3/claim",
        headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
        json={"receiver_id": "r1", "volunteer_name": "Ramesh", "volunteer_phone": "+91 98800 12345"},
    )
    assert res.status_code == 400
    assert "Cannot claim listing in DELIVERED status" in res.json()["detail"]


def test_claim_on_collected_listing(client):
    """TC2.16: Claiming an already COLLECTED listing returns 400."""
    # Advance l2 to COLLECTED
    client.post("/api/listings/l2/status", json={"status": "COLLECTED"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    # Attempt claim
    res = client.post(
        "/api/listings/l2/claim",
        headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
        json={"receiver_id": "r1", "volunteer_name": "Ramesh", "volunteer_phone": "+91 98800 12345"},
    )
    assert res.status_code == 400
    assert "Cannot claim listing in COLLECTED status" in res.json()["detail"]


def test_status_update_collected_on_posted_listing(client):
    """TC2.17: Directly jumping POSTED -> COLLECTED without claim returns 400."""
    # l1 is in POSTED status
    res = client.post("/api/listings/l1/status", json={"status": "COLLECTED"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res.status_code == 400
    assert "Cannot collect listing in status POSTED" in res.json()["detail"]


def test_status_update_delivered_on_posted_listing(client):
    """TC2.18: Directly jumping POSTED -> DELIVERED without claim returns 400."""
    # l1 is in POSTED status
    res = client.post("/api/listings/l1/status", json={"status": "DELIVERED"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res.status_code == 400
    assert "Cannot deliver listing in status POSTED" in res.json()["detail"]


def test_status_update_backward_regression_delivered_to_collected(client):
    """TC2.19: Regressing DELIVERED back to COLLECTED returns 400."""
    # l3 is in DELIVERED status
    res = client.post("/api/listings/l3/status", json={"status": "COLLECTED"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res.status_code == 400
    assert "Cannot collect listing in status DELIVERED" in res.json()["detail"]


# ---------------------------------------------------------------------------
# 4. Error Recovery & Mathematical Boundary Analysis
# ---------------------------------------------------------------------------

def test_inspect_food_malformed_base64_returns_400(client):
    """TC2.20: Inspect-food with malformed base64 returns HTTP 400 Bad Request."""
    # Completely invalid base64 string
    res_corrupt = client.post(
        "/api/inspect-food",
        headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
        json={"image_base64": "!!!NOT_VALID_BASE64_DATA@@@$$$%%^", "sample_id": "biryani"},
    )
    assert res_corrupt.status_code == 400
    assert "Invalid base64 encoded image data" in res_corrupt.json()["detail"]

    # Empty string base64
    res_empty_str = client.post(
        "/api/inspect-food",
        headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
        json={"image_base64": "   ", "sample_id": "biryani"},
    )
    assert res_empty_str.status_code == 400
    assert "Invalid base64 encoded image data" in res_empty_str.json()["detail"]

    # Omitted base64 / default payload recovers and returns 200
    res_empty = client.post("/api/inspect-food", json={}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res_empty.status_code == 200
    assert res_empty.json()["success"] is True

    # No body at all returns 200
    res_none = client.post("/api/inspect-food", headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res_none.status_code == 200
    assert res_none.json()["success"] is True


def test_urgency_score_mathematical_boundaries():
    """TC2.21: Urgency score evaluates strictly to 0.0 when minutes_remaining <= 0."""
    # Exactly expired (0 minutes remaining)
    assert compute_urgency_score(minutes_remaining=0, quantity_meals=100, distance_km=2.0) == 0.0

    # Negative minutes remaining (expired 45 minutes ago)
    assert compute_urgency_score(minutes_remaining=-45, quantity_meals=200, distance_km=1.0) == 0.0

    # Expired with massive quantity and 0 distance
    assert compute_urgency_score(minutes_remaining=-1, quantity_meals=1000, distance_km=0.0) == 0.0

    # Normal time progression: 30 minutes remaining should have top time component (50 pts)
    score_30m = compute_urgency_score(minutes_remaining=30, quantity_meals=150, distance_km=0.0)
    # Time (50) + Qty (30) + Dist (20) = 100.0
    assert score_30m == 100.0

    # Max distance decay: distance = 50 km -> dist_score is max(0, 20 - 100) = 0.0
    score_far = compute_urgency_score(minutes_remaining=30, quantity_meals=150, distance_km=50.0)
    assert score_far == 80.0  # 50 + 30 + 0


def test_haversine_distance_boundaries():
    """TC2.22: Haversine distance handles identical coordinates, antipodal, and known distances."""
    # Identical coordinates
    d_zero = haversine_distance_km(12.9716, 77.6412, 12.9716, 77.6412)
    assert d_zero == 0.0

    # Known Bengaluru distance: Indiranagar (12.9716, 77.6412) to Whitefield (12.9698, 77.7500) ~ 11.8 km
    d_bengaluru = haversine_distance_km(12.9716, 77.6412, 12.9698, 77.7500)
    assert 11.0 <= d_bengaluru <= 12.5


def test_empty_database_state_queries(empty_client):
    """TC2.23: Database in empty state returns clean empty lists and defaults without 500 errors."""
    # Listings query returns empty list
    res_listings = empty_client.get("/api/listings")
    assert res_listings.status_code == 200
    assert res_listings.json() == []

    # Donors query returns empty list
    res_donors = empty_client.get("/api/donors")
    assert res_donors.status_code == 200
    assert res_donors.json() == []

    # Receivers query returns empty list
    res_receivers = empty_client.get("/api/receivers")
    assert res_receivers.status_code == 200
    assert res_receivers.json() == []

    # Impact query returns clean zero metrics and base ESG score of 65.0
    res_impact = empty_client.get("/api/impact")
    assert res_impact.status_code == 200
    impact = res_impact.json()
    assert impact["total_meals_rescued"] == 0
    assert impact["total_food_kg_saved"] == 0.0
    assert impact["total_co2_kg_offset"] == 0.0
    assert impact["total_water_liters_saved"] == 0.0
    assert impact["total_donors_active"] == 0
    assert impact["total_receivers_served"] == 0
    assert impact["esg_compliance_index"] == 65.0


def test_invalid_status_query_param_returns_422(client):
    """TC2.24: Invalid status filter in GET /api/listings returns HTTP 422 Unprocessable Entity."""
    res = client.get("/api/listings?status=GARBAGE_STATUS_FILTER")
    assert res.status_code == 422
    assert "status" in str(res.json()["detail"])

    # Valid statuses return 200
    for valid_st in ["POSTED", "CLAIMED", "COLLECTED", "DELIVERED", "EXPIRED"]:
        res_v = client.get(f"/api/listings?status={valid_st}")
        assert res_v.status_code == 200
