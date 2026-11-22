"""SurplusPulse Optical Food Inspection Router.
Integrates Cactus Mirage 22MB VLM for on-device OCR, object detection, and FSSAI scoring.
Enforces payload size bounds and base64 security validation.
"""
from __future__ import annotations

import base64
import io
from typing import Optional
from PIL import Image

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import require_auth
from app.config import settings
from app.mirage_inspector import inspect_food_payload
from app.schemas import FoodInspectionRequest

router = APIRouter(tags=["inspection"])


@router.post("/inspect-food", dependencies=[Depends(require_auth)])
def inspect_food(payload: Optional[FoodInspectionRequest] = None):
    """Executes on-device 22 MB Mirage VLM inference for OCR, object detection, and FSSAI scoring."""
    image_bytes = None
    sample_id: Optional[str] = None

    if payload:
        sample_id = payload.sample_id
        if payload.image_base64 is not None:
            raw_b64 = payload.image_base64.strip()
            if not raw_b64:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid base64 encoded image data",
                )

            # Enforce 10MB maximum payload limit
            if len(raw_b64) > settings.max_upload_size_bytes:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Image payload exceeds maximum allowed size of 10MB",
                )

            b64_content = raw_b64
            if "," in b64_content:
                b64_content = b64_content.split(",", 1)[1]

            try:
                image_bytes = base64.b64decode(b64_content, validate=True)
                if not image_bytes or len(image_bytes) < 10:
                    raise ValueError("Empty or invalid image data")
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid base64 encoded image data",
                )

            if len(image_bytes) > settings.max_upload_size_bytes:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Image payload exceeds maximum allowed size of 10MB",
                )

            # Validate that image_bytes is actually a valid readable image format via PIL
            try:
                verified_img = Image.open(io.BytesIO(image_bytes))
                verified_img.verify()
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Uploaded file is not a valid image or is corrupted",
                )

    if image_bytes is not None:
        # When real image bytes are uploaded, ALWAYS inspect dynamically instead of short-circuiting to static preset answers
        sample_id = "custom"
    else:
        # No image provided; default sample to fresh_biryani if omitted
        sample_id = (sample_id or "fresh_biryani").strip().lower()

    return inspect_food_payload(image_bytes=image_bytes, sample_id=sample_id)
