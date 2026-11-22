"""Verification suite for Milestone M1 Backend Hardening.
Tests:
- Defunct file cleanup
- Haversine floating point clamping & domain protection
- Mirage VLM base64 input validation (HTTP 400)
- Query filter validation for status parameter (HTTP 422)
- Expired listing claim prevention (HTTP 400)
- Atomic courier claim & UNIQUE(listing_id) constraint in pickups table
- Multi-threaded concurrent claim race condition prevention
- Transaction rollback on mutation failures
"""

import concurrent.futures
import os
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient

from app.database import get_connection, seed_data, STATUS_POSTED, STATUS_CLAIMED
from app.main import app
from app.matching import haversine_distance_km


def test_forecast_module_is_deleted():
    with pytest.raises(ModuleNotFoundError):
        import app.forecast  # type: ignore


def test_haversine_extreme_and_noisy_coordinates():
    # Antipodal coordinates
    dist_antipodal = haversine_distance_km(90.0, 0.0, -90.0, 180.0)
    assert dist_antipodal == 20015.09

    # Identical coordinates
    dist_same = haversine_distance_km(12.9716, 77.6412, 12.9716, 77.6412)
    assert dist_same == 0.0

    # Coordinates near boundaries
    dist_extreme = haversine_distance_km(89.999999, -179.999999, -89.999999, 0.000001)
    assert dist_extreme > 19000.0


def test_inspect_food_invalid_base64_returns_400():
    client = TestClient(app)

    # Malformed base64 string
    res = client.post("/api/inspect-food", json={"image_base64": "!!!invalid_base64!!!"}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res.status_code == 400
    assert res.json()["detail"] == "Invalid base64 encoded image data"

    # Empty base64 string provided
    res_empty = client.post("/api/inspect-food", json={"image_base64": ""}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res_empty.status_code == 400
    assert res_empty.json()["detail"] == "Invalid base64 encoded image data"

    # Whitespace-only base64 string
    res_ws = client.post("/api/inspect-food", json={"image_base64": "   "}, headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]})
    assert res_ws.status_code == 400
    assert res_ws.json()["detail"] == "Invalid base64 encoded image data"


def test_query_filter_status_validation_returns_422():
    client = TestClient(app)

    # Invalid status
    res = client.get("/api/listings?status=INVALID_STATUS")
    assert res.status_code == 422

    # Another invalid status
    res_garbage = client.get("/api/listings?status=12345")
    assert res_garbage.status_code == 422

    # Valid status
    res_valid = client.get("/api/listings?status=POSTED")
    assert res_valid.status_code == 200
    listings = res_valid.json()
    assert all(l["status"] == "POSTED" for l in listings)


def test_cannot_claim_expired_listing():
    client = TestClient(app)

    # Force listing l1 expires_at into the past
    conn = get_connection()
    past_iso = (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat()
    conn.execute("UPDATE food_listings SET expires_at = ? WHERE id = ?", (past_iso, "l1"))
    conn.commit()
    conn.close()

    res = client.post(
        "/api/listings/l1/claim",
        headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
        json={
            "receiver_id": "r1",
            "volunteer_name": "Emergency Courier",
            "volunteer_phone": "+91 98888 77777",
            "vehicle_type": "Auto",
        },
    )
    assert res.status_code == 400
    assert res.json()["detail"] == "Cannot claim expired food listing"


def test_unique_constraint_on_pickups_table():
    conn = get_connection()
    # Check table DDL in sqlite_master
    row = conn.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='pickups'").fetchone()
    assert "UNIQUE" in row[0], f"pickups schema missing UNIQUE constraint: {row[0]}"
    conn.close()


def test_atomic_claim_and_concurrent_claims_race_condition():
    client = TestClient(app)

    # Listing l1 is POSTED in seed data
    def attempt_claim(worker_id: int):
        c = TestClient(app)
        return c.post(
            "/api/listings/l1/claim",
            headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
            json={
                "receiver_id": f"r{((worker_id % 4) + 1)}",
                "volunteer_name": f"Courier {worker_id}",
                "volunteer_phone": f"+91 90000 0000{worker_id}",
                "vehicle_type": "Van",
            },
        )

    # Launch 5 concurrent claims on listing l1 simultaneously
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(attempt_claim, i) for i in range(5)]
        responses = [f.result() for f in futures]

    success_responses = [r for r in responses if r.status_code == 200]
    rejected_responses = [r for r in responses if r.status_code == 400]

    # Exactly 1 must succeed; all others must be rejected
    assert len(success_responses) == 1, f"Expected exactly 1 success, got {len(success_responses)}"
    assert len(rejected_responses) == 4, f"Expected 4 rejections, got {len(rejected_responses)}"

    # Check database state: exactly 1 pickup record in pickups for l1
    conn = get_connection()
    pickups_count = conn.execute("SELECT COUNT(*) FROM pickups WHERE listing_id = 'l1'").fetchone()[0]
    assert pickups_count == 1
    conn.close()


def test_transaction_rollback_on_failure():
    from app.database import get_connection as real_get_conn
    import app.main as main_mod

    client = TestClient(main_mod.app, raise_server_exceptions=False)

    class FailingConnection:
        def __init__(self, conn):
            self._conn = conn
            self.rollback_called = False

        def execute(self, *args, **kwargs):
            return self._conn.execute(*args, **kwargs)

        def commit(self):
            raise RuntimeError("Simulated DB I/O disk failure on commit")

        def rollback(self):
            self.rollback_called = True
            return self._conn.rollback()

        def close(self):
            return self._conn.close()

    real_c = real_get_conn()
    failing_c = FailingConnection(real_c)
    old_get_conn = main_mod.get_connection
    main_mod.get_connection = lambda: failing_c

    try:
        res = client.post(
            "/api/listings/l1/claim",
            headers={"X-API-Key": os.environ["SURPLUSPULSE_API_KEY"]},
            json={
                "receiver_id": "r1",
                "volunteer_name": "Test Volunteer",
                "volunteer_phone": "+91 99999 11111",
                "vehicle_type": "Van",
            },
        )
        assert res.status_code == 500
        assert failing_c.rollback_called is True
    finally:
        main_mod.get_connection = old_get_conn

    # Check listing l1 is still POSTED and no pickup created
    conn = real_get_conn()
    listing_row = conn.execute("SELECT status FROM food_listings WHERE id = 'l1'").fetchone()
    assert listing_row["status"] == STATUS_POSTED
    pickup_row = conn.execute("SELECT * FROM pickups WHERE listing_id = 'l1'").fetchone()
    assert pickup_row is None
    conn.close()


def test_cors_middleware_explicit_origins_and_credentials():
    client = TestClient(app)

    allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    for origin in allowed_origins:
        # Preflight OPTIONS
        res = client.options(
            "/api/listings",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        assert res.status_code == 200
        assert res.headers.get("access-control-allow-origin") == origin
        assert res.headers.get("access-control-allow-credentials") == "true"

        # Direct GET
        get_res = client.get(
            "/api/impact",
            headers={"Origin": origin},
        )
        assert get_res.status_code == 200
        assert get_res.headers.get("access-control-allow-origin") == origin
        assert get_res.headers.get("access-control-allow-credentials") == "true"

    # Disallowed origin
    bad_res = client.options(
        "/api/listings",
        headers={
            "Origin": "http://unauthorized-domain.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert bad_res.headers.get("access-control-allow-origin") != "http://unauthorized-domain.com"

