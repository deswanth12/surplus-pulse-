"""Tier 1 Feature Coverage & API Contract Test Suite.
Verifies all 11 API endpoints, HTTP status codes, response schemas, ordering,
filtering, calculations, and static file mount for SurplusPulse.
Requirement: >=55 assertions.
"""

from __future__ import annotations

import os

import pytest


def test_get_donors_directory_contract(client):
    """TC1.1: GET /api/donors returns all registered donors with complete schema and sorted by name."""
    res = client.get("/api/donors")
    assert res.status_code == 200
    donors = res.json()
    assert isinstance(donors, list)
    assert len(donors) == 4

    # Verify donor schema contracts
    for d in donors:
        assert "id" in d and isinstance(d["id"], str)
        assert "name" in d and len(d["name"]) >= 2
        assert d["donor_type"] in ("RESTAURANT", "CATERER", "HOSTEL_MESS", "WEDDING_VENUE")
        assert "contact_name" in d and len(d["contact_name"]) > 0
        assert "contact_phone" in d and "+91" in d["contact_phone"]
        assert "address" in d and len(d["address"]) > 0
        assert d["city"] == "Bengaluru"
        assert 12.0 <= d["lat"] <= 14.0
        assert 77.0 <= d["lng"] <= 78.0
        assert "created_at" in d

    # Verify alphabetical sorting by name ASC
    names = [d["name"] for d in donors]
    assert names == sorted(names)

    # Verify known seeded donor
    amber = next((d for d in donors if d["id"] == "d1"), None)
    assert amber is not None
    assert amber["name"] == "The Grand Amber Banquet Hall"
    assert amber["donor_type"] == "WEDDING_VENUE"


def test_get_receivers_directory_contract(client):
    """TC1.2: GET /api/receivers returns all accredited receivers with capacity and schema."""
    res = client.get("/api/receivers")
    assert res.status_code == 200
    receivers = res.json()
    assert isinstance(receivers, list)
    assert len(receivers) == 4

    # Verify receiver schema contracts
    for r in receivers:
        assert "id" in r and isinstance(r["id"], str)
        assert "name" in r and len(r["name"]) >= 2
        assert r["receiver_type"] in ("NGO", "SHELTER", "COMMUNITY_KITCHEN", "VOLUNTEER_HUB")
        assert "contact_name" in r and len(r["contact_name"]) > 0
        assert "contact_phone" in r and len(r["contact_phone"]) >= 8
        assert isinstance(r["capacity_meals"], int) and r["capacity_meals"] > 0
        assert "address" in r and len(r["address"]) > 0
        assert r["city"] == "Bengaluru"
        assert 12.0 <= r["lat"] <= 14.0
        assert 77.0 <= r["lng"] <= 78.0
        assert "created_at" in r

    # Verify alphabetical sorting by name ASC
    names = [r["name"] for r in receivers]
    assert names == sorted(names)

    # Verify known seeded receiver
    r1 = next((r for r in receivers if r["id"] == "r1"), None)
    assert r1 is not None
    assert r1["name"] == "Robin Hood Army - Indiranagar Hub"
    assert r1["capacity_meals"] == 150


def test_get_listings_default_ordering_and_fields(client):
    """TC1.3: GET /api/listings returns all listings sorted by expires_at ASC with urgency scores."""
    res = client.get("/api/listings")
    assert res.status_code == 200
    listings = res.json()
    assert isinstance(listings, list)
    assert len(listings) >= 4

    # Verify ordering by expires_at ASC
    expiry_dates = [l["expires_at"] for l in listings]
    assert expiry_dates == sorted(expiry_dates)

    # Verify listing schema and calculated telemetry
    for l in listings:
        assert "id" in l and isinstance(l["id"], str)
        assert "donor_id" in l and isinstance(l["donor_id"], str)
        assert "donor_name" in l and len(l["donor_name"]) > 0
        assert "donor_type" in l
        assert "donor_address" in l
        assert "donor_phone" in l
        assert "food_name" in l and len(l["food_name"]) >= 3
        assert l["food_category"] in ("VEG", "NON_VEG")
        assert isinstance(l["quantity_meals"], int) and l["quantity_meals"] > 0
        assert isinstance(l["quantity_kg"], (int, float)) and l["quantity_kg"] > 0
        assert l["storage_type"] in ("HOT", "AMBIENT", "REFRIGERATED")
        assert "allergens" in l
        assert l["status"] in ("POSTED", "CLAIMED", "COLLECTED", "DELIVERED", "EXPIRED")
        assert isinstance(l["minutes_remaining"], int)
        assert isinstance(l["urgency_score"], (int, float))
        assert 0.0 <= l["urgency_score"] <= 100.0


def test_get_listings_pickup_subobject_association(client):
    """TC1.4: Verifies attached pickup objects for active/completed listings and null for posted."""
    res = client.get("/api/listings")
    listings = res.json()

    # Listing l1 is POSTED -> pickup should be None
    l1 = next(l for l in listings if l["id"] == "l1")
    assert l1["status"] == "POSTED"
    assert l1["pickup"] is None

    # Listing l2 is CLAIMED -> pickup sub-object should be populated
    l2 = next(l for l in listings if l["id"] == "l2")
    assert l2["status"] == "CLAIMED"
    assert l2["pickup"] is not None
    assert l2["pickup"]["listing_id"] == "l2"
    assert l2["pickup"]["receiver_id"] == "r3"
    assert l2["pickup"]["volunteer_name"] == "Vikram Adiga"
    assert l2["pickup"]["claimed_at"] is not None
    assert l2["pickup"]["collected_at"] is None

    # Listing l3 is DELIVERED -> pickup sub-object has all timestamps
    l3 = next(l for l in listings if l["id"] == "l3")
    assert l3["status"] == "DELIVERED"
    assert l3["pickup"] is not None
    assert l3["pickup"]["volunteer_name"] == "Santosh Kumar"
    assert l3["pickup"]["delivered_at"] is not None


def test_get_listings_status_filtering(client):
    """TC1.5: GET /api/listings?status=... filters accurately by valid status."""
    # POSTED filter
    res_posted = client.get("/api/listings?status=POSTED")
    assert res_posted.status_code == 200
    posted_items = res_posted.json()
    assert len(posted_items) >= 1
    assert all(l["status"] == "POSTED" for l in posted_items)
    assert any(l["id"] == "l1" for l in posted_items)

    # CLAIMED filter
    res_claimed = client.get("/api/listings?status=CLAIMED")
    assert res_claimed.status_code == 200
    claimed_items = res_claimed.json()
    assert len(claimed_items) >= 1
    assert all(l["status"] == "CLAIMED" for l in claimed_items)
    assert any(l["id"] == "l2" for l in claimed_items)

    # DELIVERED filter
    res_delivered = client.get("/api/listings?status=DELIVERED")
    assert res_delivered.status_code == 200
    delivered_items = res_delivered.json()
    assert len(delivered_items) >= 2
    assert all(l["status"] == "DELIVERED" for l in delivered_items)
    assert any(l["id"] == "l3" for l in delivered_items)
    assert any(l["id"] == "l4" for l in delivered_items)


def test_create_listing_form_68a_success(client):
    """TC1.6: POST /api/listings creates Form 68-A salvage declaration and calculates expires_at."""
    payload = {
        "donor_id": "d1",
        "food_name": "Mysore Pak & Khara Bath Assortment",
        "food_category": "VEG",
        "quantity_meals": 65,
        "quantity_kg": 28.5,
        "storage_type": "HOT",
        "allergens": "Dairy (Ghee), Cashews",
        "handling_notes": "Kept in food-grade insulated thermoware at >65C.",
        "hours_valid": 4.5,
    }
    res = client.post("/api/listings", json=payload, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res.status_code == 201
    created = res.json()

    assert created["id"].startswith("l_")
    assert created["donor_id"] == "d1"
    assert created["donor_name"] == "The Grand Amber Banquet Hall"
    assert created["food_name"] == payload["food_name"]
    assert created["food_category"] == "VEG"
    assert created["quantity_meals"] == 65
    assert created["quantity_kg"] == 28.5
    assert created["storage_type"] == "HOT"
    assert created["allergens"] == payload["allergens"]
    assert created["handling_notes"] == payload["handling_notes"]
    assert created["status"] == "POSTED"
    assert created["pickup"] is None
    assert created["minutes_remaining"] > 240  # ~4.5 hours = 270 mins
    assert created["urgency_score"] > 0.0

    # Verify listing is queryable in GET /api/listings
    get_res = client.get(f"/api/listings/{created['id']}")
    assert get_res.status_code == 200
    assert get_res.json()["food_name"] == payload["food_name"]


def test_get_single_listing_by_id(client):
    """TC1.7: GET /api/listings/{id} fetches complete listing detail."""
    res = client.get("/api/listings/l1")
    assert res.status_code == 200
    listing = res.json()
    assert listing["id"] == "l1"
    assert listing["donor_id"] == "d1"
    assert listing["donor_name"] == "The Grand Amber Banquet Hall"
    assert listing["quantity_meals"] == 120
    assert listing["status"] == "POSTED"

    # Fetch delivered listing with pickup
    res_deliv = client.get("/api/listings/l3")
    assert res_deliv.status_code == 200
    deliv_listing = res_deliv.json()
    assert deliv_listing["id"] == "l3"
    assert deliv_listing["status"] == "DELIVERED"
    assert deliv_listing["pickup"] is not None
    assert deliv_listing["pickup"]["receiver_name"] == "City Hope Homeless Shelter"


def test_claim_listing_courier_dispatch(client):
    """TC1.8: POST /api/listings/{id}/claim assigns volunteer courier and transitions to CLAIMED."""
    claim_payload = {
        "receiver_id": "r1",
        "volunteer_name": "Deepak Natarajan",
        "volunteer_phone": "+91 98451 99887",
        "vehicle_type": "Auto Rickshaw Cargo",
        "notes": "Fast-track dispatch route via Indiranagar 100ft road.",
    }
    res = client.post("/api/listings/l1/claim", json=claim_payload, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res.status_code == 200
    updated = res.json()

    assert updated["id"] == "l1"
    assert updated["status"] == "CLAIMED"
    assert updated["pickup"] is not None
    assert updated["pickup"]["id"].startswith("p_")
    assert updated["pickup"]["receiver_id"] == "r1"
    assert updated["pickup"]["receiver_name"] == "Robin Hood Army - Indiranagar Hub"
    assert updated["pickup"]["volunteer_name"] == "Deepak Natarajan"
    assert updated["pickup"]["volunteer_phone"] == "+91 98451 99887"
    assert updated["pickup"]["vehicle_type"] == "Auto Rickshaw Cargo"
    assert updated["pickup"]["notes"] == claim_payload["notes"]
    assert updated["pickup"]["claimed_at"] is not None
    assert updated["pickup"]["collected_at"] is None

    # Verify persistent state in database
    verify_res = client.get("/api/listings/l1")
    assert verify_res.status_code == 200
    assert verify_res.json()["status"] == "CLAIMED"


def test_status_lifecycle_advance(client):
    """TC1.9: POST /api/listings/{id}/status transitions CLAIMED -> COLLECTED -> DELIVERED."""
    # Advance l2 (currently CLAIMED) to COLLECTED
    col_payload = {"status": "COLLECTED", "notes": "Ration verified and secured in hot carriers."}
    res_col = client.post("/api/listings/l2/status", json=col_payload, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res_col.status_code == 200
    col_listing = res_col.json()
    assert col_listing["status"] == "COLLECTED"
    assert col_listing["pickup"]["collected_at"] is not None
    assert col_listing["pickup"]["delivered_at"] is None
    assert col_listing["pickup"]["notes"] == col_payload["notes"]

    # Advance l2 from COLLECTED to DELIVERED
    del_payload = {"status": "DELIVERED", "notes": "Distributed to 80 beneficiaries at Whitefield kitchen."}
    res_del = client.post("/api/listings/l2/status", json=del_payload, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res_del.status_code == 200
    del_listing = res_del.json()
    assert del_listing["status"] == "DELIVERED"
    assert del_listing["pickup"]["collected_at"] is not None
    assert del_listing["pickup"]["delivered_at"] is not None
    assert del_listing["pickup"]["notes"] == del_payload["notes"]


def test_smart_proximity_matches_calculation(client):
    """TC1.10: GET /api/matches/{id} computes Haversine distance and urgency sorting."""
    res = client.get("/api/matches/l1")
    assert res.status_code == 200
    match_data = res.json()

    assert match_data["listing_id"] == "l1"
    assert match_data["food_name"] == "Royal Hyderabadi Veg Pulao & Paneer Makhani"
    assert match_data["quantity_meals"] == 120
    assert match_data["donor_name"] == "The Grand Amber Banquet Hall"
    assert isinstance(match_data["minutes_remaining"], int)
    assert isinstance(match_data["matches"], list)
    assert len(match_data["matches"]) == 4

    # Verify descending urgency score ordering
    urgencies = [m["urgency_score"] for m in match_data["matches"]]
    assert urgencies == sorted(urgencies, reverse=True)

    # Verify match attributes and fit criteria
    for m in match_data["matches"]:
        assert "receiver_id" in m
        assert "receiver_name" in m
        assert "receiver_type" in m
        assert isinstance(m["capacity_meals"], int) and m["capacity_meals"] > 0
        assert isinstance(m["distance_km"], (int, float)) and m["distance_km"] >= 0.0
        assert m["match_fit"] in ("EXCELLENT", "GOOD", "ACCEPTABLE")

    # Indiranagar Hub (r1) should be EXCELLENT match for d1 (< 1 km distance, capacity 150 >= 120 meals)
    top_match = match_data["matches"][0]
    assert top_match["receiver_id"] == "r1"
    assert top_match["distance_km"] < 1.5
    assert top_match["match_fit"] == "EXCELLENT"


def test_get_impact_metrics_aggregation(client):
    """TC1.11: GET /api/impact aggregates rescued meals, kg, CO2, water, and ESG index."""
    res = client.get("/api/impact")
    assert res.status_code == 200
    impact = res.json()

    # In seed data: l2 (80 meals, 36kg) is CLAIMED; l3 (60 meals, 32kg) is DELIVERED; l4 (140 meals, 65kg) is DELIVERED
    # Total meals = 80 + 60 + 140 = 280; Total kg = 36.0 + 32.0 + 65.0 = 133.0 kg
    assert impact["total_meals_rescued"] == 280
    assert impact["total_food_kg_saved"] == 133.0

    # UNEP / EPA standards: CO2 = kg * 2.5, Water = kg * 800.0
    expected_co2 = round(133.0 * 2.5, 1)
    expected_water = round(133.0 * 800.0, 1)
    assert impact["total_co2_kg_offset"] == expected_co2
    assert impact["total_water_liters_saved"] == expected_water

    # ESG index = min(100.0, round(65.0 + 280 / 10.0, 1)) = 65.0 + 28.0 = 93.0
    expected_esg = min(100.0, round(65.0 + (280 / 10.0), 1))
    assert impact["esg_compliance_index"] == expected_esg

    assert impact["total_donors_active"] >= 3
    assert impact["total_receivers_served"] >= 3
    assert "meal_weight_basis" in impact["assumptions"]
    assert "greenhouse_gas_metric" in impact["assumptions"]
    assert "water_footprint_metric" in impact["assumptions"]
    assert "commercial_business_case" in impact["assumptions"]


def test_seed_database_idempotency_and_force(client, monkeypatch):
    """TC1.12: POST /api/seed without force returns already_seeded; with force=true resets."""
    monkeypatch.setenv("SURPLUSPULSE_ENV", "development")
    monkeypatch.setenv("ADMIN_SECRET", "test-admin-secret-fixture")
    seed_headers = {
        "X-Admin-Secret": "test-admin-secret-fixture",
        "X-API-Key": os.environ["SURPLUSPULSE_API_KEY"],
    }

    # Initial call without force
    res_no_force = client.post("/api/seed", headers=seed_headers)
    assert res_no_force.status_code == 201
    assert res_no_force.json()["status"] == "already_seeded"

    # Call with force=true
    res_force = client.post("/api/seed?force=true", headers=seed_headers)
    assert res_force.status_code == 201
    force_data = res_force.json()
    assert force_data["status"] == "seeded"
    assert force_data["donors"] == 4
    assert force_data["receivers"] == 4
    assert force_data["listings"] == 4


def test_inspect_food_mirage_vlm_synthetic_samples(client):
    """TC1.13: POST /api/inspect-food processes image samples and returns quality telemetry."""
    # Test biryani sample
    res_biryani = client.post("/api/inspect-food", json={"sample_id": "biryani"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res_biryani.status_code == 200
    data = res_biryani.json()
    assert data["success"] is True
    assert "image_data_url" in data and data["image_data_url"].startswith("data:image/png;base64,")
    assert data["mirage_engine"]["model_name"] == "Mirage VLM (Cactus Compute)"

    inspection = data["food_inspection"]
    assert 75.0 <= inspection["quality_score"] <= 99.0
    assert inspection["fssai_grade"] in ("GRADE_A_PRIME", "GRADE_B_ACCEPTABLE")
    assert inspection["food_category"] in ("VEG", "NON_VEG")
    assert "Biryani" in inspection["detected_food_name"]

    auto_fill = data["auto_fill_form_data"]
    assert "food_name" in auto_fill
    assert auto_fill["food_category"] in ("VEG", "NON_VEG")
    assert auto_fill["storage_type"] in ("HOT", "AMBIENT", "REFRIGERATED")
    assert auto_fill["hours_valid"] > 0

    # Test paneer sample
    res_paneer = client.post("/api/inspect-food", json={"sample_id": "paneer"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res_paneer.status_code == 200
    assert "Paneer" in res_paneer.json()["food_inspection"]["detected_food_name"]

    # Test salad sample
    res_salad = client.post("/api/inspect-food", json={"sample_id": "salad"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res_salad.status_code == 200
    assert res_salad.json()["food_inspection"]["thermal_holding_detected"] == "REFRIGERATED"


def test_production_static_mount_serves_html(client):
    """TC1.14: GET / serves compiled production bundle index.html."""
    res = client.get("/")
    assert res.status_code == 200
    assert "text/html" in res.headers.get("content-type", "")
    assert "<!DOCTYPE html>" in res.text or "<div id=\"root\">" in res.text or "SurplusPulse" in res.text
