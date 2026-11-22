"""SurplusPulse Smart Matching Engine.
Calculates Haversine geographic distance between donors and receivers,
spoilage urgency score, and capacity fit index.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance between two points on the earth in km."""
    R = 6371.0  # Earth radius in kilometers

    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)

    a = (
        math.sin(d_lat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2.0) ** 2
    )
    a = max(0.0, min(1.0, a))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(R * c, 2)


def compute_urgency_score(
    minutes_remaining: float, quantity_meals: int, distance_km: float
) -> float:
    """Computes an Urgency Score between 0.0 and 100.0.

    Higher urgency indicates:
    - Less time remaining before food expires
    - Higher quantity of meals at risk of spoilage
    - Closer geographic proximity for viable pickup
    """
    if minutes_remaining <= 0:
        return 0.0

    # Time factor: 0-120 mins gets top weight (up to 50 pts)
    if minutes_remaining <= 60:
        time_score = 50.0
    elif minutes_remaining <= 180:
        time_score = 50.0 - ((minutes_remaining - 60) / 120.0) * 20.0
    elif minutes_remaining <= 360:
        time_score = 30.0 - ((minutes_remaining - 180) / 180.0) * 15.0
    else:
        time_score = 10.0

    # Quantity factor: more meals rescued = higher priority (up to 30 pts)
    qty_score = min(30.0, (quantity_meals / 150.0) * 30.0)

    # Distance penalty: closer = higher score (up to 20 pts)
    dist_score = max(0.0, 20.0 - (distance_km * 2.0))

    return round(time_score + qty_score + dist_score, 1)


def minutes_until_expiry(expires_at_iso: str) -> int:
    try:
        exp = datetime.fromisoformat(expires_at_iso)
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        diff = exp - now
        return int(diff.total_seconds() / 60)
    except Exception:
        return 0
