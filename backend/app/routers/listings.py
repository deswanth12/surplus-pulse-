"""SurplusPulse Listings Router.
Handles Food Listings CRUD, Atomic Claiming, and Courier Status Lifecycle.
Uses single LEFT JOIN queries to eliminate N+1 roundtrips.
"""
from __future__ import annotations

import re
import sqlite3
from datetime import timedelta
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth import require_auth
from app.cache import cache_service
from app.database import (
    STATUS_POSTED,
    STATUS_COLLECTED,
    STATUS_DELIVERED,
    STATUS_EXPIRED,
    utc_now,
    utc_now_iso,
)
from app.dependencies import get_db
from app.matching import compute_urgency_score, minutes_until_expiry
from app.schemas import (
    ClaimListingRequest,
    FoodListingCreate,
    FoodListingOut,
    PickupOut,
    UpdatePickupStatusRequest,
)

router = APIRouter(tags=["listings"])

LISTING_JOINED_SELECT = """
    SELECT 
        l.id, l.donor_id, l.food_name, l.food_category, l.quantity_meals, l.quantity_kg,
        l.storage_type, l.allergens, l.handling_notes, l.cooked_at, l.expires_at, l.status, l.created_at,
        d.name as donor_name, d.donor_type, d.address as donor_address, d.contact_phone as donor_phone, d.lat as donor_lat, d.lng as donor_lng,
        p.id as pickup_id, p.listing_id as pickup_listing_id, p.receiver_id as pickup_receiver_id,
        p.volunteer_name as pickup_volunteer_name, p.volunteer_phone as pickup_volunteer_phone,
        p.vehicle_type as pickup_vehicle_type, p.claimed_at as pickup_claimed_at,
        p.collected_at as pickup_collected_at, p.delivered_at as pickup_delivered_at,
        p.notes as pickup_notes,
        r.name as receiver_name
    FROM food_listings l
    JOIN donors d ON l.donor_id = d.id
    LEFT JOIN pickups p ON l.id = p.listing_id
    LEFT JOIN receivers r ON p.receiver_id = r.id
"""


def _row_to_listing_joined(row: sqlite3.Row) -> FoodListingOut:
    mins_rem = minutes_until_expiry(row["expires_at"])
    urgency = compute_urgency_score(mins_rem, row["quantity_meals"], 2.5)

    pickup_out = None
    if row["pickup_id"] is not None:
        pickup_out = PickupOut(
            id=row["pickup_id"],
            listing_id=row["pickup_listing_id"] or row["id"],
            receiver_id=row["pickup_receiver_id"],
            receiver_name=row["receiver_name"],
            volunteer_name=row["pickup_volunteer_name"],
            volunteer_phone=row["pickup_volunteer_phone"],
            vehicle_type=row["pickup_vehicle_type"],
            claimed_at=row["pickup_claimed_at"],
            collected_at=row["pickup_collected_at"],
            delivered_at=row["pickup_delivered_at"],
            notes=row["pickup_notes"],
        )

    donor_lat = row["donor_lat"] if "donor_lat" in row.keys() else None
    donor_lng = row["donor_lng"] if "donor_lng" in row.keys() else None

    return FoodListingOut(
        id=row["id"],
        donor_id=row["donor_id"],
        donor_name=row["donor_name"],
        donor_type=row["donor_type"],
        donor_address=row["donor_address"],
        donor_phone=row["donor_phone"],
        donor_lat=donor_lat,
        donor_lng=donor_lng,
        food_name=row["food_name"],
        food_category=row["food_category"],
        quantity_meals=row["quantity_meals"],
        quantity_kg=row["quantity_kg"],
        storage_type=row["storage_type"],
        allergens=row["allergens"],
        handling_notes=row["handling_notes"],
        cooked_at=row["cooked_at"],
        expires_at=row["expires_at"],
        status=row["status"],
        created_at=row["created_at"],
        minutes_remaining=mins_rem,
        urgency_score=urgency,
        pickup=pickup_out,
    )


@router.get("/listings", response_model=list[FoodListingOut])
def get_listings(
    status: Literal["POSTED", "CLAIMED", "COLLECTED", "DELIVERED", "EXPIRED"] | None = Query(None, alias="status"),
    conn: sqlite3.Connection = Depends(get_db),
):
    """Fetches all food listings with embedded pickup details using a single joined query, eliminating N+1 roundtrips."""
    query = LISTING_JOINED_SELECT
    params = []
    if status:
        query += " WHERE l.status = ?"
        params.append(status)
    query += " ORDER BY l.expires_at ASC"

    rows = conn.execute(query, params).fetchall()
    return [_row_to_listing_joined(r) for r in rows]


@router.post(
    "/listings",
    status_code=status.HTTP_201_CREATED,
    response_model=FoodListingOut,
    dependencies=[Depends(require_auth)],
)
def create_listing(req: FoodListingCreate, conn: sqlite3.Connection = Depends(get_db)):
    """Creates a new food rescue salvage declaration."""
    # Safety Check: Unsafe food cannot be listed for distribution
    notes_upper = (req.handling_notes or "").upper()
    is_spoiled = bool(
        re.search(
            r"\b(SPOILED|GONE|REJECTED|UNSAFE|DECOMPOSED|GRADE_F|INSPECTION_FAILED)\b|GRADE\s*F",
            notes_upper,
        )
    )
    score_match = re.search(r'QUALITY(?:\s*SCORE)?\s*[:\-(]?\s*(\d+)', notes_upper)
    if score_match:
        try:
            if int(score_match.group(1)) < 70:
                is_spoiled = True
        except ValueError:
            pass

    if req.hours_valid <= 0 or is_spoiled:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Unsafe food cannot be listed for distribution",
        )
    if req.hours_valid < 0.5:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="hours_valid must be at least 0.5 hours",
        )

    try:
        donor = conn.execute("SELECT * FROM donors WHERE id = ?", (req.donor_id,)).fetchone()
        if not donor:
            raise HTTPException(404, "Donor not found")

        now = utc_now()
        listing_id = "l_" + uuid4().hex[:10]
        expires = now + timedelta(hours=req.hours_valid)

        conn.execute(
            """
            INSERT INTO food_listings (
                id, donor_id, food_name, food_category, quantity_meals, quantity_kg,
                storage_type, allergens, handling_notes, cooked_at, expires_at, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                listing_id,
                req.donor_id,
                req.food_name,
                req.food_category,
                req.quantity_meals,
                req.quantity_kg,
                req.storage_type,
                req.allergens,
                req.handling_notes or "Packed securely in hygienic food-grade containers.",
                now.isoformat(),
                expires.isoformat(),
                STATUS_POSTED,
                now.isoformat(),
            ),
        )
        conn.commit()

        # Invalidate impact cache upon listing creation
        cache_service.invalidate_tag("impact")

        query = LISTING_JOINED_SELECT + " WHERE l.id = ?"
        row = conn.execute(query, (listing_id,)).fetchone()
        return _row_to_listing_joined(row)
    except Exception:
        conn.rollback()
        raise


@router.get("/listings/{listing_id}", response_model=FoodListingOut)
def get_single_listing(listing_id: str, conn: sqlite3.Connection = Depends(get_db)):
    """Fetches single listing details with embedded donor and pickup sub-objects in a single query."""
    query = LISTING_JOINED_SELECT + " WHERE l.id = ?"
    row = conn.execute(query, (listing_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Listing not found")
    return _row_to_listing_joined(row)


@router.post(
    "/listings/{listing_id}/claim",
    response_model=FoodListingOut,
    dependencies=[Depends(require_auth)],
)
def claim_listing(listing_id: str, req: ClaimListingRequest, conn: sqlite3.Connection = Depends(get_db)):
    """Atomically claims a food listing for a volunteer courier and shelter receiver."""
    try:
        listing = conn.execute("SELECT * FROM food_listings WHERE id = ?", (listing_id,)).fetchone()
        if not listing:
            raise HTTPException(404, "Listing not found")
        if listing["status"] != STATUS_POSTED:
            raise HTTPException(400, f"Cannot claim listing in {listing['status']} status")

        if minutes_until_expiry(listing["expires_at"]) <= 0:
            raise HTTPException(status_code=400, detail="Cannot claim expired food listing")

        receiver = conn.execute("SELECT * FROM receivers WHERE id = ?", (req.receiver_id,)).fetchone()
        if not receiver:
            raise HTTPException(404, "Receiver NGO/Shelter not found")

        cursor = conn.execute(
            "UPDATE food_listings SET status = 'CLAIMED' WHERE id = ? AND status = 'POSTED'",
            (listing_id,),
        )
        if cursor.rowcount != 1:
            raise HTTPException(status_code=400, detail="Listing is no longer available for claim")

        pickup_id = "p_" + uuid4().hex[:10]
        now = utc_now_iso()

        conn.execute(
            """
            INSERT INTO pickups (id, listing_id, receiver_id, volunteer_name, volunteer_phone, vehicle_type, claimed_at, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                pickup_id,
                listing_id,
                req.receiver_id,
                req.volunteer_name,
                req.volunteer_phone,
                req.vehicle_type,
                now,
                req.notes or f"Pickup scheduled by {receiver['name']}",
            ),
        )

        conn.commit()

        # Invalidate impact cache on claim
        cache_service.invalidate_tag("impact")

        query = LISTING_JOINED_SELECT + " WHERE l.id = ?"
        row = conn.execute(query, (listing_id,)).fetchone()
        return _row_to_listing_joined(row)
    except Exception:
        conn.rollback()
        raise


@router.post(
    "/listings/{listing_id}/status",
    response_model=FoodListingOut,
    dependencies=[Depends(require_auth)],
)
def update_pickup_status(
    listing_id: str,
    req: UpdatePickupStatusRequest,
    conn: sqlite3.Connection = Depends(get_db),
):
    """Advances courier pickup status: CLAIMED -> COLLECTED -> DELIVERED."""
    try:
        listing = conn.execute("SELECT * FROM food_listings WHERE id = ?", (listing_id,)).fetchone()
        if not listing:
            raise HTTPException(404, "Listing not found")

        now = utc_now_iso()
        current_status = listing["status"]
        if req.status == STATUS_COLLECTED:
            if current_status in (STATUS_POSTED, STATUS_EXPIRED):
                raise HTTPException(400, f"Cannot collect listing in status {current_status}")
            if current_status == STATUS_DELIVERED:
                raise HTTPException(400, f"Cannot collect listing in status {current_status}")
            cursor = conn.execute(
                "UPDATE food_listings SET status = ? WHERE id = ? AND status = 'CLAIMED'",
                (STATUS_COLLECTED, listing_id),
            )
            if cursor.rowcount != 1:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cannot collect listing: status is not CLAIMED or conflict occurred")
            conn.execute("UPDATE pickups SET collected_at = ? WHERE listing_id = ?", (now, listing_id))
        elif req.status == STATUS_DELIVERED:
            if current_status in (STATUS_POSTED, STATUS_EXPIRED):
                raise HTTPException(400, f"Cannot deliver listing in status {current_status}")
            cursor = conn.execute(
                "UPDATE food_listings SET status = ? WHERE id = ? AND status IN ('CLAIMED', 'COLLECTED')",
                (STATUS_DELIVERED, listing_id),
            )
            if cursor.rowcount != 1:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cannot deliver listing: status is not CLAIMED or COLLECTED or conflict occurred")
            conn.execute("UPDATE pickups SET delivered_at = ? WHERE listing_id = ?", (now, listing_id))

        if req.notes:
            conn.execute("UPDATE pickups SET notes = ? WHERE listing_id = ?", (req.notes, listing_id))

        conn.commit()

        # Invalidate impact cache on status change
        cache_service.invalidate_tag("impact")

        query = LISTING_JOINED_SELECT + " WHERE l.id = ?"
        row = conn.execute(query, (listing_id,)).fetchone()
        return _row_to_listing_joined(row)
    except Exception:
        conn.rollback()
        raise
