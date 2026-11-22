"""SurplusPulse Smart Proximity Matching Router.
Matches active surplus declarations against nearby receiving shelters and NGOs.
"""
from __future__ import annotations

import sqlite3
from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_db
from app.matching import compute_urgency_score, haversine_distance_km, minutes_until_expiry
from app.schemas import SmartMatchReceiver, SmartMatchResponse

router = APIRouter(tags=["matching"])


@router.get("/matches/{listing_id}", response_model=SmartMatchResponse)
def get_smart_matches(listing_id: str, conn: sqlite3.Connection = Depends(get_db)):
    """Calculates proximity-weighted matches for an active food rescue listing."""
    row = conn.execute(
        """
        SELECT l.*, d.name as donor_name, d.address, d.lat, d.lng
        FROM food_listings l
        JOIN donors d ON l.donor_id = d.id
        WHERE l.id = ?
        """,
        (listing_id,),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Listing not found")

    donor_lat = row["lat"]
    donor_lng = row["lng"]
    mins_rem = minutes_until_expiry(row["expires_at"])
    qty = row["quantity_meals"]

    receivers = conn.execute("SELECT * FROM receivers").fetchall()
    matches = []

    for r in receivers:
        dist = haversine_distance_km(donor_lat, donor_lng, r["lat"], r["lng"])
        urgency = compute_urgency_score(mins_rem, qty, dist)

        # Proximity and capacity fit triage
        if dist <= 3.0 and r["capacity_meals"] >= qty:
            fit = "EXCELLENT"
        elif dist <= 8.0:
            fit = "GOOD"
        else:
            fit = "ACCEPTABLE"

        matches.append(
            SmartMatchReceiver(
                receiver_id=r["id"],
                receiver_name=r["name"],
                receiver_type=r["receiver_type"],
                capacity_meals=r["capacity_meals"],
                distance_km=dist,
                contact_name=r["contact_name"],
                contact_phone=r["contact_phone"],
                urgency_score=urgency,
                match_fit=fit,
            )
        )

    # Sort matches by urgency score descending (closest and best capacity first)
    matches.sort(key=lambda x: x.urgency_score, reverse=True)

    return SmartMatchResponse(
        listing_id=listing_id,
        food_name=row["food_name"],
        quantity_meals=qty,
        donor_name=row["donor_name"],
        donor_address=row["address"],
        minutes_remaining=mins_rem,
        matches=matches,
    )
