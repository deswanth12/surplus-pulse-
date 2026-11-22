"""Tier 3 Cross-Feature Combinations & State Lifecycle Test Suite.
Verifies the complete end-to-end municipal food rescue operational lifecycle:
VLM Inspection -> Form 68-A Creation -> Proximity Matching -> Courier Claim ->
Collection -> Delivery -> Impact Accounting Reconciliation -> Double-Claim/Regression Guards.
Requirement: >=15 assertions.
"""

from __future__ import annotations

import os

import pytest


def test_full_municipal_rescue_lifecycle(client):
    """TC3.1: Full end-to-end municipal food rescue operational flow across all subsystems."""
    # Step 1: Optical food inspection using on-device Mirage VLM synthetic generator
    inspect_res = client.post("/api/inspect-food", json={"sample_id": "biryani"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert inspect_res.status_code == 200
    inspect_data = inspect_res.json()
    assert inspect_data["success"] is True

    auto_fill = inspect_data["auto_fill_form_data"]
    assert "food_name" in auto_fill
    assert auto_fill["food_category"] in ("VEG", "NON_VEG")
    assert auto_fill["storage_type"] in ("HOT", "AMBIENT", "REFRIGERATED")
    assert auto_fill["hours_valid"] > 0

    # Capture initial impact baseline
    baseline_impact = client.get("/api/impact").json()
    init_meals = baseline_impact["total_meals_rescued"]
    init_kg = baseline_impact["total_food_kg_saved"]

    # Step 2: Transmit Form 68-A Salvage Declaration for Donor d1 (The Grand Amber)
    form_68a_payload = {
        "donor_id": "d1",
        "food_name": auto_fill["food_name"],
        "food_category": auto_fill["food_category"],
        "quantity_meals": 100,
        "quantity_kg": 45.0,
        "storage_type": auto_fill["storage_type"],
        "allergens": auto_fill.get("allergens", "None"),
        "handling_notes": auto_fill.get("handling_notes", "VLM Verified Hygienic"),
        "hours_valid": auto_fill["hours_valid"],
    }
    create_res = client.post("/api/listings", json=form_68a_payload, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert create_res.status_code == 201
    listing = create_res.json()
    listing_id = listing["id"]
    assert listing_id.startswith("l_")
    assert listing["status"] == "POSTED"
    assert listing["quantity_meals"] == 100
    assert listing["pickup"] is None

    # Step 3: Run Proximity Smart Matching to identify closest accredited receiver
    match_res = client.get(f"/api/matches/{listing_id}")
    assert match_res.status_code == 200
    match_payload = match_res.json()
    assert len(match_payload["matches"]) >= 1
    top_receiver = match_payload["matches"][0]
    receiver_id = top_receiver["receiver_id"]
    assert top_receiver["urgency_score"] > 0.0
    assert top_receiver["match_fit"] in ("EXCELLENT", "GOOD", "ACCEPTABLE")

    # Step 4: Dispatch Courier Volunteer to Claim Listing
    claim_payload = {
        "receiver_id": receiver_id,
        "volunteer_name": "Kavitha Sundaram",
        "volunteer_phone": "+91 98450 77665",
        "vehicle_type": "Three-Wheeler Auto Cargo",
        "notes": "Emergency courier route dispatched from Indiranagar.",
    }
    claim_res = client.post(f"/api/listings/{listing_id}/claim", json=claim_payload, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert claim_res.status_code == 200
    claimed_listing = claim_res.json()
    assert claimed_listing["status"] == "CLAIMED"
    assert claimed_listing["pickup"] is not None
    assert claimed_listing["pickup"]["volunteer_name"] == "Kavitha Sundaram"
    assert claimed_listing["pickup"]["claimed_at"] is not None
    assert claimed_listing["pickup"]["collected_at"] is None

    # Step 5: Advance Status to COLLECTED (Volunteer arrives at donor)
    collect_payload = {"status": "COLLECTED", "notes": "Thermal containers verified at 68C, loaded into cargo auto."}
    collect_res = client.post(f"/api/listings/{listing_id}/status", json=collect_payload, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert collect_res.status_code == 200
    collected_listing = collect_res.json()
    assert collected_listing["status"] == "COLLECTED"
    assert collected_listing["pickup"]["collected_at"] is not None
    assert collected_listing["pickup"]["delivered_at"] is None

    # Step 6: Advance Status to DELIVERED (Volunteer delivers to receiver shelter)
    deliver_payload = {"status": "DELIVERED", "notes": "Rations delivered safely to kitchen beneficiaries."}
    deliver_res = client.post(f"/api/listings/{listing_id}/status", json=deliver_payload, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert deliver_res.status_code == 200
    delivered_listing = deliver_res.json()
    assert delivered_listing["status"] == "DELIVERED"
    assert delivered_listing["pickup"]["delivered_at"] is not None

    # Step 7: Verify ESG & Impact Accounting Aggregation
    updated_impact = client.get("/api/impact").json()
    assert updated_impact["total_meals_rescued"] == init_meals + 100
    assert round(updated_impact["total_food_kg_saved"], 1) == round(init_kg + 45.0, 1)

    # CO2 avoided: 45.0 kg * 2.5 = 112.5 kg CO2e
    expected_co2_delta = round(45.0 * 2.5, 1)
    assert round(updated_impact["total_co2_kg_offset"] - baseline_impact["total_co2_kg_offset"], 1) == expected_co2_delta

    # Water saved: 45.0 kg * 800.0 = 36,000.0 L
    expected_water_delta = round(45.0 * 800.0, 1)
    assert round(updated_impact["total_water_liters_saved"] - baseline_impact["total_water_liters_saved"], 1) == expected_water_delta

    # Step 8: Assert Re-claim Rejection (Guards against duplicate volunteer assignment)
    reclaim_res = client.post(f"/api/listings/{listing_id}/claim", json=claim_payload, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert reclaim_res.status_code == 400
    assert "Cannot claim listing in DELIVERED status" in reclaim_res.json()["detail"]

    # Step 9: Assert Backward Regression Rejection
    regress_res = client.post(f"/api/listings/{listing_id}/status", json={"status": "COLLECTED"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert regress_res.status_code == 400
    assert "Cannot collect listing in status DELIVERED" in regress_res.json()["detail"]


def test_status_filter_consistency_during_lifecycle(client):
    """TC3.2: Query filter consistency across sequential state transitions without stale records."""
    # 1. Create fresh listing
    new_res = client.post(
        "/api/listings",
        headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
        json={
            "donor_id": "d2",
            "food_name": "Curd Rice & Pickle Packets",
            "food_category": "VEG",
            "quantity_meals": 50,
            "quantity_kg": 22.0,
            "storage_type": "AMBIENT",
            "hours_valid": 2.5,
        },
    )
    assert new_res.status_code == 201
    lid = new_res.json()["id"]

    # State: POSTED
    posted_ids = [l["id"] for l in client.get("/api/listings?status=POSTED").json()]
    claimed_ids = [l["id"] for l in client.get("/api/listings?status=CLAIMED").json()]
    assert lid in posted_ids
    assert lid not in claimed_ids

    # Transition: CLAIMED
    client.post(
        f"/api/listings/{lid}/claim",
        json={"receiver_id": "r2", "volunteer_name": "Arjun Das", "volunteer_phone": "+91 99881 22334"},
        headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
    )
    posted_ids = [l["id"] for l in client.get("/api/listings?status=POSTED").json()]
    claimed_ids = [l["id"] for l in client.get("/api/listings?status=CLAIMED").json()]
    collected_ids = [l["id"] for l in client.get("/api/listings?status=COLLECTED").json()]
    assert lid not in posted_ids
    assert lid in claimed_ids
    assert lid not in collected_ids

    # Transition: COLLECTED
    client.post(f"/api/listings/{lid}/status", json={"status": "COLLECTED"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    claimed_ids = [l["id"] for l in client.get("/api/listings?status=CLAIMED").json()]
    collected_ids = [l["id"] for l in client.get("/api/listings?status=COLLECTED").json()]
    delivered_ids = [l["id"] for l in client.get("/api/listings?status=DELIVERED").json()]
    assert lid not in claimed_ids
    assert lid in collected_ids
    assert lid not in delivered_ids

    # Transition: DELIVERED
    client.post(f"/api/listings/{lid}/status", json={"status": "DELIVERED"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    collected_ids = [l["id"] for l in client.get("/api/listings?status=COLLECTED").json()]
    delivered_ids = [l["id"] for l in client.get("/api/listings?status=DELIVERED").json()]
    assert lid not in collected_ids
    assert lid in delivered_ids
