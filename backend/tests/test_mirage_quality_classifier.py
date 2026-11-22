"""Tests for Mirage VLM Food Quality & Spoilage Classifier ("Food is Good or Gone")."""

import base64
import pytest
from PIL import Image
import io


def test_mirage_fresh_biryani_preset(client):
    """Verifies fresh_biryani preset returns >=98% quality, FRESH_AND_GOOD verdict, and passed status."""
    res = client.post("/api/inspect-food", json={"sample_id": "fresh_biryani"})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True

    # Check top-level metrics
    assert data["is_safe"] is True
    assert data["quality_score"] == 98
    assert data["verdict"] == "FRESH_AND_GOOD"
    assert data["spoilage_risk"] == "LOW"
    assert data["fssai_grade"] == "GRADE_A_PRIME"
    assert "Thermal Hold >65°C" in data["temperature_check"]
    assert data["rejection_reasons"] == []

    # Check food_inspection sub-object
    fi = data["food_inspection"]
    assert fi["is_safe"] is True
    assert fi["quality_score"] == 98.0
    assert fi["verdict"] == "FRESH_AND_GOOD"
    assert fi["fssai_status"] == "PASSED - SAFE FOR IMMEDIATE DISTRIBUTION"
    assert fi["packaging_integrity"] == "SEALED_CONTAINER_VERIFIED"
    assert fi["thermal_holding_detected"] == "HOT"
    assert "Biryani" in fi["detected_food_name"]


def test_mirage_fresh_paneer_preset(client):
    """Verifies fresh_paneer preset returns 94% quality, Grade A, and PASSED status."""
    res = client.post("/api/inspect-food", json={"sample_id": "fresh_paneer"})
    assert res.status_code == 200
    data = res.json()
    assert data["is_safe"] is True
    assert data["quality_score"] == 94
    assert data["verdict"] == "FRESH_AND_GOOD"
    assert data["spoilage_risk"] == "LOW"
    assert data["fssai_grade"] == "GRADE_A"
    assert data["food_inspection"]["fssai_status"] == "PASSED - SAFE FOR IMMEDIATE DISTRIBUTION"
    assert "Paneer" in data["food_inspection"]["detected_food_name"]


def test_mirage_spoiled_curry_preset(client):
    """Verifies spoiled_curry preset returns 18% quality, Grade F, SPOILED_AND_GONE verdict, and rejection reasons."""
    res = client.post("/api/inspect-food", json={"sample_id": "spoiled_curry"})
    assert res.status_code == 200
    data = res.json()

    assert data["is_safe"] is False
    assert data["quality_score"] == 18
    assert data["verdict"] == "SPOILED_AND_GONE"
    assert data["spoilage_risk"] == "CRITICAL"
    assert data["fssai_grade"] == "GRADE_F"
    assert "REJECTED - FOOD IS SPOILED / GONE" in data["food_inspection"]["fssai_status"]
    assert "Extended ambient" in data["temperature_check"]
    assert len(data["rejection_reasons"]) >= 2
    assert any("Bacterial" in r or "Sour" in r or "separation" in r for r in data["rejection_reasons"])
    assert data["food_inspection"]["packaging_integrity"] == "COMPROMISED_OR_DEGRADED"


def test_mirage_expired_rice_preset(client):
    """Verifies expired_rice preset returns 28% quality, Grade F, and Cold hazard rejection."""
    res = client.post("/api/inspect-food", json={"sample_id": "expired_rice"})
    assert res.status_code == 200
    data = res.json()

    assert data["is_safe"] is False
    assert data["quality_score"] == 28
    assert data["verdict"] == "SPOILED_AND_GONE"
    assert data["spoilage_risk"] == "CRITICAL"
    assert data["fssai_grade"] == "GRADE_F"
    assert data["food_inspection"]["fssai_status"] == "REJECTED - SAFE HOLD WINDOW EXPIRED"
    assert "Cold hazard" in data["temperature_check"]
    assert len(data["rejection_reasons"]) >= 2
    assert any("danger zone" in r.lower() or "bacillus" in r.lower() for r in data["rejection_reasons"])


def test_mirage_custom_upload_inspection(client):
    """Verifies custom uploaded image inspection with base64 payload."""
    # Create simple valid png image in base64
    img = Image.new("RGB", (100, 100), color=(200, 150, 100))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64_str = f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}"

    res = client.post("/api/inspect-food", json={"sample_id": "custom", "image_base64": b64_str})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "is_safe" in data
    assert "quality_score" in data
    assert data["verdict"] in ("FRESH_AND_GOOD", "SPOILED_AND_GONE")
    assert "temperature_check" in data
    assert isinstance(data["rejection_reasons"], list)


def test_mirage_custom_upload_without_sample_id_inspects_custom_image(client):
    """Verifies that uploading an image without sample_id does NOT default to Biryani preset."""
    img = Image.new("RGB", (100, 100), color=(100, 180, 120))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64_str = base64.b64encode(buf.getvalue()).decode("utf-8")

    res = client.post("/api/inspect-food", json={"image_base64": b64_str})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    # Should be identified as custom prepared food, not hardcoded Hyderabadi Dum Biryani
    assert "Biryani" not in data["food_inspection"]["detected_food_name"]
    assert "Custom Prepared Food" in data["food_inspection"]["detected_food_name"] or data["verdict"] in ("FRESH_AND_GOOD", "SPOILED_AND_GONE")


def test_mirage_custom_spoiled_image_rejected(client):
    """Verifies that an uploaded image with spoilage indicators is rejected with <70 score."""
    from PIL import ImageDraw
    img = Image.new("RGB", (200, 200), (40, 40, 40))
    d = ImageDraw.Draw(img)
    d.text((10, 10), "SPOILED ROTTEN EXPIRED", fill=(255, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64_str = base64.b64encode(buf.getvalue()).decode("utf-8")

    res = client.post("/api/inspect-food", json={"image_base64": b64_str, "sample_id": "custom"})
    assert res.status_code == 200
    data = res.json()
    assert data["is_safe"] is False
    assert data["quality_score"] < 70
    assert data["verdict"] == "SPOILED_AND_GONE"
    assert data["spoilage_risk"] == "CRITICAL"
    assert data["fssai_grade"] == "GRADE_F"
    assert "REJECTED" in data["food_inspection"]["fssai_status"]
    assert len(data["rejection_reasons"]) > 0


def test_mirage_corrupted_non_image_upload_returns_400(client):
    """Verifies that uploading non-image data returns HTTP 400 Bad Request."""
    corrupted_b64 = base64.b64encode(b"this is plain text and not a png or jpeg image at all").decode("utf-8")
    res = client.post("/api/inspect-food", json={"image_base64": corrupted_b64, "sample_id": "custom"})
    assert res.status_code == 400
    assert "not a valid image" in res.json()["detail"].lower() or "corrupted" in res.json()["detail"].lower()


def test_mirage_vlm_reasoning_detects_spoilage():
    """Verifies that VLM reasoning trace containing spoilage keywords marks food as spoiled."""
    import app.mirage_inspector as mi
    from app.mirage_inspector import inspect_food_payload

    class MockSpoiledMirage:
        def describe(self, b):
            return {
                "text": [],
                "objects": [{"name": "food_sample", "description": {"condition": "moldy"}}],
                "reasoning": "Visual analysis indicates green fungal mold growth and acidic decay.",
                "scene": {"condition": "spoiled"},
            }

    orig_inst = mi._MIRAGE_INSTANCE
    orig_avail = mi._MIRAGE_AVAILABLE
    try:
        mi._MIRAGE_AVAILABLE = True
        mi._MIRAGE_INSTANCE = MockSpoiledMirage()
        img = Image.new("RGB", (60, 60), color=(150, 150, 150))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        res = inspect_food_payload(buf.getvalue(), "custom")
        assert res["is_safe"] is False
        assert res["verdict"] == "SPOILED_AND_GONE"
        assert res["quality_score"] < 70
        assert "REJECTED" in res["food_inspection"]["fssai_status"]
    finally:
        mi._MIRAGE_INSTANCE = orig_inst
        mi._MIRAGE_AVAILABLE = orig_avail


def test_quality_gating_threshold():
    """Directly verifies that quality scores strictly enforce <70 REJECTED vs >=70 PASSED."""
    from app.mirage_inspector import inspect_food_payload

    # Spoiled curry is 18 (< 70)
    spoiled = inspect_food_payload(sample_id="spoiled_curry")
    assert spoiled["quality_score"] < 70
    assert spoiled["is_safe"] is False
    assert spoiled["verdict"] == "SPOILED_AND_GONE"
    assert "REJECTED" in spoiled["food_inspection"]["fssai_status"]

    # Biryani is 98 (>= 70)
    fresh = inspect_food_payload(sample_id="fresh_biryani")
    assert fresh["quality_score"] >= 70
    assert fresh["is_safe"] is True
    assert fresh["verdict"] == "FRESH_AND_GOOD"
    assert "PASSED" in fresh["food_inspection"]["fssai_status"]
