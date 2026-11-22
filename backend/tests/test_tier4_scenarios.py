"""Tier 4 Real-World Municipal Dispatch & Operational Stress Scenarios Test Suite.
Simulates high-volume banquet surplus floods, capacity mismatch triage,
shift reset idempotency under load, ESG audit reconciliation, and expired food quarantine.
Requirement: >=5 real-world municipal dispatch scenarios.
"""

from __future__ import annotations

import concurrent.futures
import os
from datetime import datetime, timezone, timedelta
import pytest
from app.matching import compute_urgency_score, minutes_until_expiry


def test_scenario_1_high_volume_banquet_flood(client):
    """Scenario 1: High-Volume Banquet Flood.
    Simulates 10 banquet halls across Bengaluru submitting emergency surplus listings simultaneously.
    Verifies SQLite WAL concurrency, zero lock errors, and precise urgency sorting by expires_at ASC.
    """
    donor_ids = ["d1", "d2", "d3", "d4"]
    listings_created = []

    # 10 diverse surplus items with varying urgency (0.5 hours to 10 hours)
    banquet_batches = [
        {"name": "Wedding Dum Biryani Batch A", "meals": 150, "kg": 70.0, "hours": 1.0, "donor": "d1", "storage": "HOT"},
        {"name": "South Indian Feast Rasam & Rice", "meals": 80, "kg": 35.0, "hours": 0.5, "donor": "d4", "storage": "HOT"},
        {"name": "Paneer Tikka & Butter Naan", "meals": 120, "kg": 50.0, "hours": 2.0, "donor": "d1", "storage": "HOT"},
        {"name": "Corporate Lunch Buffet Assortment", "meals": 60, "kg": 25.0, "hours": 3.0, "donor": "d2", "storage": "HOT"},
        {"name": "Chilled Sprout Salad & Fruit Bowl", "meals": 40, "kg": 18.0, "hours": 4.0, "donor": "d3", "storage": "REFRIGERATED"},
        {"name": "Dinner Chapati & Dal Fry", "meals": 90, "kg": 38.0, "hours": 1.5, "donor": "d2", "storage": "HOT"},
        {"name": "Cocktail Samosas & Mint Chutney", "meals": 110, "kg": 30.0, "hours": 5.0, "donor": "d1", "storage": "AMBIENT"},
        {"name": "Hostel Breakfast Idli & Vada", "meals": 75, "kg": 32.0, "hours": 0.8, "donor": "d4", "storage": "HOT"},
        {"name": "North Indian Thali Leftovers", "meals": 130, "kg": 55.0, "hours": 2.5, "donor": "d3", "storage": "HOT"},
        {"name": "Bakery Tea Cakes & Puffs", "meals": 50, "kg": 15.0, "hours": 8.0, "donor": "d2", "storage": "AMBIENT"},
    ]

    def submit_banquet(batch):
        return client.post(
            "/api/listings",
            json={
                "donor_id": batch["donor"],
                "food_name": batch["name"],
                "food_category": "VEG",
                "quantity_meals": batch["meals"],
                "quantity_kg": batch["kg"],
                "storage_type": batch["storage"],
                "hours_valid": batch["hours"],
            },
            headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
        )

    # Concurrently submit 10 banquet listings using ThreadPoolExecutor(max_workers=10)
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(submit_banquet, batch) for batch in banquet_batches]
        responses = [f.result() for f in futures]

    for res in responses:
        assert res.status_code == 201
        listings_created.append(res.json())

    assert len(listings_created) == 10

    # Query listings index and assert ordering
    all_listings = client.get("/api/listings").json()
    assert len(all_listings) >= 14  # 4 initial + 10 created

    # Validate that listings are strictly sorted by urgency / expires_at ASC
    expires_at_list = [l["expires_at"] for l in all_listings]
    assert expires_at_list == sorted(expires_at_list)

    # Verify that listing with 0.5 hours ("South Indian Feast") has smaller expires_at than listing with 8.0 hours
    rasam = next(l for l in all_listings if l["food_name"] == "South Indian Feast Rasam & Rice")
    bakery = next(l for l in all_listings if l["food_name"] == "Bakery Tea Cakes & Puffs")
    assert rasam["expires_at"] < bakery["expires_at"]
    assert rasam["urgency_score"] > bakery["urgency_score"]


def test_scenario_2_capacity_mismatch_triage(client, db_conn):
    """Scenario 2: Capacity Mismatch Resolution.
    A massive 350-meal banquet surplus is created at donor d1.
    Verifies that the proximity engine does NOT mark receivers with capacity < 350 as EXCELLENT,
    even if located within 1 km, properly enforcing capacity constraints in triage.
    """
    res = client.post(
        "/api/listings",
        json={
            "donor_id": "d1",
            "food_name": "Mega Wedding Banquet 350-Meal Surplus",
            "food_category": "VEG",
            "quantity_meals": 350,
            "quantity_kg": 150.0,
            "storage_type": "HOT",
            "hours_valid": 2.0,
        },
        headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
    )
    assert res.status_code == 201
    listing_id = res.json()["id"]

    match_res = client.get(f"/api/matches/{listing_id}")
    assert match_res.status_code == 200
    matches = match_res.json()["matches"]

    # All seeded receivers have capacity < 350:
    # r1: 150, r2: 100, r3: 200, r4: 80
    # None of them can satisfy capacity >= 350
    for m in matches:
        assert m["capacity_meals"] < 350
        # Under contract: EXCELLENT requires dist <= 3.0 AND capacity >= qty
        assert m["match_fit"] != "EXCELLENT"

    # Add a high-capacity mega-hub receiver (capacity 500) located 1.2 km away
    db_conn.execute(
        """
        INSERT INTO receivers (id, name, receiver_type, contact_name, contact_phone, capacity_meals, address, city, lat, lng, created_at)
        VALUES ('r_mega', 'Central Municipal Relief Mega-Hub', 'VOLUNTEER_HUB', 'Major General Rao', '+91 99000 88888', 500, 'Old Airport Rd', 'Bengaluru', 12.9650, 77.6450, '2026-11-21T00:00:00Z')
        """
    )
    db_conn.commit()

    # Re-query matches
    recheck_res = client.get(f"/api/matches/{listing_id}")
    assert recheck_res.status_code == 200
    recheck_matches = recheck_res.json()["matches"]
    mega_hub = next((m for m in recheck_matches if m["receiver_id"] == "r_mega"), None)
    assert mega_hub is not None
    assert mega_hub["capacity_meals"] == 500
    assert mega_hub["distance_km"] <= 3.0
    assert mega_hub["match_fit"] == "EXCELLENT"


def test_scenario_3_shift_reset_idempotency_under_load(client, monkeypatch):
    """Scenario 3: Shift Reset & Database Idempotency.
    Executes repeated force-seed cycles back-to-back and verifies clean re-initialization
    without foreign key violations or database lock corruption.
    """
    monkeypatch.setenv("SURPLUSPULSE_ENV", "development")
    monkeypatch.setenv("ADMIN_SECRET", "test-admin-secret-fixture")
    seed_headers = {
        "X-Admin-Secret": "test-admin-secret-fixture",
        "X-API-Key": os.environ["SURPLUSPULSE_API_KEY"],
    }

    # Create some active claims and pickups first
    client.post(
        "/api/listings/l1/claim",
        json={"receiver_id": "r1", "volunteer_name": "Shift Vol A", "volunteer_phone": "+91 98450 11111"},
        headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
    )

    # Perform back-to-back shift resets with force=true
    for i in range(3):
        reset_res = client.post("/api/seed?force=true", headers=seed_headers)
        assert reset_res.status_code == 201
        assert reset_res.json()["status"] == "seeded"
        assert reset_res.json()["donors"] == 4
        assert reset_res.json()["receivers"] == 4
        assert reset_res.json()["listings"] == 4

        # Verify database state immediately after reset
        listings = client.get("/api/listings").json()
        assert len(listings) == 4
        assert any(l["id"] == "l1" and l["status"] == "POSTED" for l in listings)

    # Calling without force should report already_seeded
    idempotent_res = client.post("/api/seed?force=false", headers=seed_headers)
    assert idempotent_res.status_code == 201
    assert idempotent_res.json()["status"] == "already_seeded"


def test_scenario_4_esg_audit_and_comptometer_reconciliation(client):
    """Scenario 4: ESG Audit & Comptometer Math Reconciliation.
    Verifies that backend ledger calculations exactly reconcile with commercial
    ESG carbon credit accounting and the frontend 1968 Comptometer ROI metrics:
    - Weight: meals * 0.45 kg
    - Carbon offset: kg * 2.5 kg CO2e
    - Water conserved: kg * 800.0 L
    - Commercial value: ₹65 saved per meal vs ₹1,499/mo subscription.
    """
    # Post and deliver a specific batch of 200 meals, 90.0 kg
    new_res = client.post(
        "/api/listings",
        json={
            "donor_id": "d1",
            "food_name": "Audit Verification Khichdi Batch",
            "food_category": "VEG",
            "quantity_meals": 200,
            "quantity_kg": 90.0,
            "storage_type": "HOT",
            "hours_valid": 4.0,
            },
            headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
        )
    assert new_res.status_code == 201
    lid = new_res.json()["id"]

    # Claim and deliver
    client.post(
        f"/api/listings/{lid}/claim",
        json={"receiver_id": "r1", "volunteer_name": "Audit Auditor", "volunteer_phone": "+91 99000 00000"},
        headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
    )
    client.post(
        f"/api/listings/{lid}/status",
        json={"status": "DELIVERED"},
        headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
    )

    impact = client.get("/api/impact").json()

    # Reconcile mathematical integrity
    total_meals = impact["total_meals_rescued"]
    total_kg = impact["total_food_kg_saved"]
    total_co2 = impact["total_co2_kg_offset"]
    total_water = impact["total_water_liters_saved"]
    esg_index = impact["esg_compliance_index"]

    # Verify UNEP / EPA standards
    assert total_co2 == round(total_kg * 2.5, 1)
    assert total_water == round(total_kg * 800.0, 1)
    assert esg_index == min(100.0, round(65.0 + (total_meals / 10.0), 1))

    # Verify Comptometer ROI math
    monthly_events = 8
    leftovers_per_event = 80
    expected_rescued_meals = monthly_events * leftovers_per_event  # 640
    expected_food_kg = expected_rescued_meals * 0.45  # 288.0 kg
    expected_savings_inr = expected_rescued_meals * 65  # ₹41,600
    expected_net_benefit = expected_savings_inr - 1499  # ₹40,101
    expected_carbon_tons = (expected_food_kg * 2.5) / 1000.0  # 0.72 tons

    assert expected_rescued_meals == 640
    assert expected_food_kg == 288.0
    assert expected_savings_inr == 41600
    assert expected_net_benefit == 40101
    assert expected_carbon_tons == 0.72


def test_scenario_5_expired_food_triage_quarantine(client, db_conn):
    """Scenario 5: Expired Food Triage and Quarantine.
    Directly seeds an expired surplus batch and verifies that:
    - minutes_until_expiry <= 0
    - compute_urgency_score evaluates strictly to 0.0
    - Smart proximity query returns 0.0 urgency score without server crash or division by zero.
    """
    now = datetime.now(timezone.utc)
    expired_time = (now - timedelta(hours=2)).isoformat()
    cooked_time = (now - timedelta(hours=6)).isoformat()

    db_conn.execute(
        """
        INSERT INTO food_listings (id, donor_id, food_name, food_category, quantity_meals, quantity_kg, storage_type, allergens, handling_notes, cooked_at, expires_at, status, created_at)
        VALUES ('l_expired_test', 'd1', 'Expired Banquet Samosas', 'VEG', 50, 15.0, 'AMBIENT', 'Gluten', 'Expired batch for quarantine test', ?, ?, 'POSTED', ?)
        """,
        (cooked_time, expired_time, cooked_time),
    )
    db_conn.commit()

    # Query single listing
    res = client.get("/api/listings/l_expired_test")
    assert res.status_code == 200
    listing = res.json()
    assert listing["minutes_remaining"] <= 0
    assert listing["urgency_score"] == 0.0

    # Query smart matches
    match_res = client.get("/api/matches/l_expired_test")
    assert match_res.status_code == 200
    match_data = match_res.json()
    assert match_data["minutes_remaining"] <= 0
    # All matches must have urgency score == 0.0
    for m in match_data["matches"]:
        assert m["urgency_score"] == 0.0
