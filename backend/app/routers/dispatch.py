"""SurplusPulse Courier Dispatch Router.
Provides 1-Click WhatsApp and SMS Courier Dispatch, Atomic Claim Locking,
and Safe Consumption Window (SCW) countdown.
"""
from __future__ import annotations

import logging
import math
import re
import sqlite3
import urllib.parse
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import require_auth
from app.cache import cache_service
from app.database import (
    STATUS_CLAIMED,
    STATUS_COLLECTED,
    STATUS_DELIVERED,
    STATUS_EXPIRED,
    STATUS_POSTED,
    utc_now_iso,
)
from app.dependencies import get_db
from app.matching import haversine_distance_km, minutes_until_expiry
from app.schemas import (
    DispatchListingRequest,
    DispatchResponse,
    DispatchTriggerOut,
    DonorCoordinates,
    TargetShelter,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["dispatch"])


def _format_dispatch_message(
    listing_id: str,
    food_name: str,
    quantity_kg: float,
    quantity_meals: int,
    urn_count: int,
    donor_name: str,
    donor_address: str,
    donor_lat: float,
    donor_lng: float,
    donor_phone: str,
    shelter_name: str,
    shelter_address: str,
    shelter_phone: str,
    scw_minutes: int,
    vehicle_type: str,
) -> str:
    return (
        f"🚨 *SURPLUSPULSE RESCUE MISSION DISPATCH* 🚨\n"
        f"Mission ID: {listing_id}\n"
        f"Food: {food_name} ({quantity_kg} kg | ~{quantity_meals} meals)\n"
        f"Payload: {urn_count} Cambro Insulated Urn(s) (18kg capacity each)\n\n"
        f"📍 *PICKUP LOCATION*:\n"
        f"Donor: {donor_name}\n"
        f"Address: {donor_address}\n"
        f"GPS Coordinates: {donor_lat:.4f}, {donor_lng:.4f}\n"
        f"Donor Phone: {donor_phone}\n\n"
        f"🎯 *DESTINATION SHELTER*:\n"
        f"Shelter: {shelter_name}\n"
        f"Address: {shelter_address}\n"
        f"Shelter Contact: {shelter_phone}\n\n"
        f"⏱️ *SAFE CONSUMPTION WINDOW (SCW)*:\n"
        f"{scw_minutes} minutes remaining before bacterial proliferation window.\n"
        f"Assigned Transport: {vehicle_type}\n"
        f"Action: Confirm pickup immediately via SurplusPulse."
    )


@router.post("/listings/{listing_id}/dispatch", response_model=DispatchResponse, dependencies=[Depends(require_auth)])
@router.post("/dispatch/{listing_id}", response_model=DispatchResponse, dependencies=[Depends(require_auth)])
def dispatch_courier(
    listing_id: str,
    payload: DispatchListingRequest,
    conn: sqlite3.Connection = Depends(get_db),
):
    """Atomically claims a food listing for courier dispatch and generates pre-composed

    WhatsApp (wa.me) and SMS deep-links with urn counts and SCW minutes.
    """
    cursor = conn.cursor()

    try:
        # 1. Inspect pre-fetched listing row to validate existence, claim status, and clock-expiry
        listing_row = cursor.execute("SELECT * FROM food_listings WHERE id = ?", (listing_id,)).fetchone()
        if not listing_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Food listing '{listing_id}' not found.",
            )
        current_status = listing_row["status"]
        if current_status in (STATUS_CLAIMED, STATUS_COLLECTED, STATUS_DELIVERED):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Listing '{listing_id}' has already been claimed by another courier (status: {current_status}).",
            )
        if current_status == STATUS_EXPIRED or minutes_until_expiry(listing_row["expires_at"]) <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Listing '{listing_id}' has expired and cannot be dispatched.",
            )
        if current_status != STATUS_POSTED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Listing '{listing_id}' cannot be dispatched in status '{current_status}'.",
            )

        # 2. Atomic claim locking check-and-set query
        cursor.execute(
            "UPDATE food_listings SET status = ? WHERE id = ? AND status = ?",
            (STATUS_CLAIMED, listing_id, STATUS_POSTED),
        )

        if cursor.rowcount == 0:
            # Check why update failed if raced with another transaction
            refetched = cursor.execute("SELECT * FROM food_listings WHERE id = ?", (listing_id,)).fetchone()
            if not refetched:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Food listing '{listing_id}' not found.",
                )
            ref_status = refetched["status"]
            if ref_status in (STATUS_CLAIMED, STATUS_COLLECTED, STATUS_DELIVERED):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Listing '{listing_id}' has already been claimed by another courier (status: {ref_status}).",
                )
            if ref_status == STATUS_EXPIRED or minutes_until_expiry(refetched["expires_at"]) <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Listing '{listing_id}' has expired and cannot be dispatched.",
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Listing '{listing_id}' cannot be dispatched in status '{ref_status}'.",
            )

        # 3. Fetch listing joined with donor
        listing_data = cursor.execute(
            """
            SELECT l.*, d.name AS donor_name, d.address AS donor_address, d.contact_phone AS donor_phone,
                   d.lat AS donor_lat, d.lng AS donor_lng
            FROM food_listings l
            JOIN donors d ON l.donor_id = d.id
            WHERE l.id = ?
            """,
            (listing_id,),
        ).fetchone()

        if not listing_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Donor information for listing '{listing_id}' not found.",
            )
        if listing_data["donor_lat"] is None or listing_data["donor_lng"] is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Donor coordinates are missing for listing '{listing_id}'.",
            )

        # 3. Resolve Target Shelter (Receiver)
        receiver_row = None
        if payload.receiver_id:
            receiver_row = cursor.execute("SELECT * FROM receivers WHERE id = ?", (payload.receiver_id,)).fetchone()

        if not receiver_row:
            # Pick the nearest receiver by Haversine distance
            all_receivers = cursor.execute("SELECT * FROM receivers").fetchall()
            if all_receivers:
                receiver_row = min(
                    all_receivers,
                    key=lambda r: haversine_distance_km(
                        listing_data["donor_lat"],
                        listing_data["donor_lng"],
                        r["lat"],
                        r["lng"],
                    ),
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No registered receiving shelters available in municipal registry.",
                )

        # 4. Insert pickup assignment record
        pickup_id = f"p_{uuid4().hex[:8]}"
        now_iso = utc_now_iso()
        cursor.execute(
            """
            INSERT INTO pickups (id, listing_id, receiver_id, volunteer_name, volunteer_phone, vehicle_type, claimed_at, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                pickup_id,
                listing_id,
                receiver_row["id"],
                payload.volunteer_name,
                payload.volunteer_phone,
                payload.vehicle_type,
                now_iso,
                payload.notes or f"Dispatched via WhatsApp courier integration to {payload.volunteer_name}.",
            ),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise

    # 5. Calculate payload containers and SCW countdown
    quantity_kg = float(listing_data["quantity_kg"])
    quantity_meals = int(listing_data["quantity_meals"])
    urn_count = max(1, math.ceil(quantity_kg / 18.0))
    scw_minutes = max(0, minutes_until_expiry(listing_data["expires_at"]))

    # 6. Format WhatsApp deep-link and SMS trigger URI
    raw_phone = re.sub(r"\D", "", payload.volunteer_phone)
    # If phone does not include country code (e.g. 10 digits Indian mobile), prepend 91
    clean_phone = f"91{raw_phone}" if len(raw_phone) == 10 else raw_phone

    msg_text = _format_dispatch_message(
        listing_id=listing_id,
        food_name=listing_data["food_name"],
        quantity_kg=quantity_kg,
        quantity_meals=quantity_meals,
        urn_count=urn_count,
        donor_name=listing_data["donor_name"],
        donor_address=listing_data["donor_address"],
        donor_lat=float(listing_data["donor_lat"]),
        donor_lng=float(listing_data["donor_lng"]),
        donor_phone=listing_data["donor_phone"],
        shelter_name=receiver_row["name"],
        shelter_address=receiver_row["address"],
        shelter_phone=receiver_row["contact_phone"],
        scw_minutes=scw_minutes,
        vehicle_type=payload.vehicle_type,
    )
    encoded_text = urllib.parse.quote(msg_text)
    whatsapp_deep_link = f"https://wa.me/{clean_phone}?text={encoded_text}"
    sms_trigger_uri = f"sms:{clean_phone}?body={encoded_text}"

    # Invalidate cached endpoints
    try:
        cache_service.invalidate_tag("listings")
        cache_service.invalidate_tag("impact")
    except Exception as exc:
        logger.warning("Failed to invalidate cache tags after courier dispatch: %s", exc)

    return DispatchResponse(
        success=True,
        listing_id=listing_id,
        pickup_id=pickup_id,
        whatsapp_deep_link=whatsapp_deep_link,
        sms_trigger_uri=sms_trigger_uri,
        urn_count=urn_count,
        scw_minutes_remaining=scw_minutes,
        donor_coordinates=DonorCoordinates(
            lat=float(listing_data["donor_lat"]),
            lng=float(listing_data["donor_lng"]),
        ),
        target_shelter=TargetShelter(
            id=receiver_row["id"],
            name=receiver_row["name"],
            address=receiver_row["address"],
            phone=receiver_row["contact_phone"],
        ),
    )


@router.get("/listings/{listing_id}/dispatch-trigger", response_model=DispatchTriggerOut, dependencies=[Depends(require_auth)])
@router.get("/dispatch/{listing_id}/trigger", response_model=DispatchTriggerOut, dependencies=[Depends(require_auth)])
def get_dispatch_trigger(
    listing_id: str,
    conn: sqlite3.Connection = Depends(get_db),
):
    """Returns pre-composed WhatsApp and SMS URIs, urn count, SCW minutes, and target shelter

    without mutating database state.
    """
    cursor = conn.cursor()
    listing_data = cursor.execute(
        """
        SELECT l.*, d.name AS donor_name, d.address AS donor_address, d.contact_phone AS donor_phone,
               d.lat AS donor_lat, d.lng AS donor_lng
        FROM food_listings l
        JOIN donors d ON l.donor_id = d.id
        WHERE l.id = ?
        """,
        (listing_id,),
    ).fetchone()

    if not listing_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Food listing '{listing_id}' not found.",
        )
    if listing_data["donor_lat"] is None or listing_data["donor_lng"] is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Donor coordinates are missing for listing '{listing_id}'.",
        )

    if listing_data["status"] == STATUS_EXPIRED or minutes_until_expiry(listing_data["expires_at"]) <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Listing '{listing_id}' has expired and cannot be dispatched.",
        )

    # Check if there is an existing pickup with assigned receiver
    pickup_row = cursor.execute(
        """
        SELECT p.*, r.id AS r_id, r.name AS r_name, r.address AS r_address, r.contact_phone AS r_phone
        FROM pickups p
        JOIN receivers r ON p.receiver_id = r.id
        WHERE p.listing_id = ?
        """,
        (listing_id,),
    ).fetchone()

    if pickup_row:
        shelter_id = pickup_row["r_id"]
        shelter_name = pickup_row["r_name"]
        shelter_address = pickup_row["r_address"]
        shelter_phone = pickup_row["r_phone"]
        volunteer_phone = pickup_row["volunteer_phone"]
        vehicle_type = pickup_row["vehicle_type"]
    else:
        # Default to nearest receiver
        all_receivers = cursor.execute("SELECT * FROM receivers").fetchall()
        if not all_receivers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No registered receivers found.",
            )
        nearest = min(
            all_receivers,
            key=lambda r: haversine_distance_km(
                listing_data["donor_lat"],
                listing_data["donor_lng"],
                r["lat"],
                r["lng"],
            ),
        )
        shelter_id = nearest["id"]
        shelter_name = nearest["name"]
        shelter_address = nearest["address"]
        shelter_phone = nearest["contact_phone"]
        volunteer_phone = shelter_phone  # Use shelter contact when no volunteer claimed yet
        vehicle_type = "EV Cargo Trike"

    quantity_kg = float(listing_data["quantity_kg"])
    quantity_meals = int(listing_data["quantity_meals"])
    urn_count = max(1, math.ceil(quantity_kg / 18.0))
    scw_minutes = max(0, minutes_until_expiry(listing_data["expires_at"]))

    raw_phone = re.sub(r"\D", "", volunteer_phone) if volunteer_phone else ""
    clean_phone = f"91{raw_phone}" if len(raw_phone) == 10 else raw_phone

    msg_text = _format_dispatch_message(
        listing_id=listing_id,
        food_name=listing_data["food_name"],
        quantity_kg=quantity_kg,
        quantity_meals=quantity_meals,
        urn_count=urn_count,
        donor_name=listing_data["donor_name"],
        donor_address=listing_data["donor_address"],
        donor_lat=float(listing_data["donor_lat"]),
        donor_lng=float(listing_data["donor_lng"]),
        donor_phone=listing_data["donor_phone"],
        shelter_name=shelter_name,
        shelter_address=shelter_address,
        shelter_phone=shelter_phone,
        scw_minutes=scw_minutes,
        vehicle_type=vehicle_type,
    )
    encoded_text = urllib.parse.quote(msg_text)
    whatsapp_deep_link = f"https://wa.me/{clean_phone}?text={encoded_text}" if clean_phone else f"https://wa.me/?text={encoded_text}"
    sms_trigger_uri = f"sms:{clean_phone}?body={encoded_text}" if clean_phone else f"sms:?body={encoded_text}"

    return DispatchTriggerOut(
        listing_id=listing_id,
        whatsapp_deep_link=whatsapp_deep_link,
        sms_trigger_uri=sms_trigger_uri,
        urn_count=urn_count,
        scw_minutes_remaining=scw_minutes,
        donor_coordinates=DonorCoordinates(
            lat=float(listing_data["donor_lat"]),
            lng=float(listing_data["donor_lng"]),
        ),
        target_shelter=TargetShelter(
            id=shelter_id,
            name=shelter_name,
            address=shelter_address,
            phone=shelter_phone,
        ),
    )
