"""Tests for SurplusPulse Section 80G Indian Income Tax Deduction Slips.
Validates Fair Market Valuation (FMV ₹65/plate), 50% deduction rule,
corporate tax savings (26%), ICAI Chartered Accountant UDIN format, and QR docket verification.
"""
from __future__ import annotations

import re
from fastapi.testclient import TestClient


def test_get_80g_certificate_delivered_listing(client: TestClient, db_conn):
    """GET /api/tax/80g/{id} retrieves or computes official Section 80G tax slip

    with ₹65/plate FMV rate, 50% eligible deduction, 26% tax savings, and 2.5 kg CO2e/kg ESG offset.
    """
    resp = client.get("/api/tax/80g/l3")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["certificate_number"].startswith("80G-BLR-2026-")
    assert "CIT(E)/BLR/80G/" in data["registration_order"]
    assert data["donor_name"] == "Paradise Biryani & Coastal Grill"

    # Authentic 10-char PAN format check
    pan = data["donor_pan"]
    assert re.match(r"^[A-Z]{5}[0-9]{4}[A-Z]$", pan), f"Invalid PAN format: {pan}"

    # Financial calculations
    assert data["quantity_meals"] == 60
    assert data["quantity_kg"] == 32.0
    assert data["fmv_rate_per_plate"] == 65.0

    # Gross salvage = 60 * 65.0 = 3900.0
    assert data["gross_salvage_valuation"] == 3900.0
    # Eligible 80G deduction = 50% of 3900 = 1950.0
    assert data["eligible_80g_deduction"] == 1950.0
    # Projected corporate tax savings = 1950.0 * 0.26 = 507.0
    assert data["projected_corporate_tax_savings"] == 507.0
    # ESG CO2e offset = 32.0 * 2.5 = 80.0
    assert data["esg_co2e_offset_kg"] == 80.0

    # CA attestation details
    ca = data["ca_attestation"]
    assert "CA Rajeshwari Sundaram" in ca["ca_name"]
    assert "Chartered Accountants" in ca["ca_firm"]
    assert ca["icai_reg_no"] == "021948S"

    # UDIN must be exactly 18 characters and start with 26021948
    udin = ca["udin"]
    assert len(udin) == 18, f"UDIN must be 18 chars, got {len(udin)} ({udin})"
    assert udin.startswith("26021948")

    # QR verification URL and SHA-256 hash
    assert data["qr_verification_url"].startswith("/api/tax/verify/")
    assert len(data["verification_hash"]) == 64

    # Verify persisted in tax_certificates table
    cert_row = db_conn.execute("SELECT * FROM tax_certificates WHERE listing_id = 'l3'").fetchone()
    assert cert_row is not None
    assert cert_row["certificate_number"] == data["certificate_number"]


def test_get_80g_certificate_computed_on_demand(client: TestClient):
    """GET /api/tax/80g/l1 computes certificate dynamically on demand."""
    resp = client.get("/api/tax/80g/l1")
    assert resp.status_code == 200
    data = resp.json()

    assert data["donor_name"] == "The Grand Amber Banquet Hall"
    assert data["quantity_meals"] == 120
    assert data["quantity_kg"] == 55.0
    assert data["gross_salvage_valuation"] == 7800.0  # 120 * 65
    assert data["eligible_80g_deduction"] == 3900.0  # 50%
    assert data["projected_corporate_tax_savings"] == 1014.0  # 3900 * 0.26
    assert data["esg_co2e_offset_kg"] == 137.5  # 55 * 2.5


def test_get_80g_certificate_404(client: TestClient):
    """GET /api/tax/80g/{id} returns 404 for unknown listing."""
    resp = client.get("/api/tax/80g/unknown_listing_99")
    assert resp.status_code == 404


def test_get_donor_tax_summary(client: TestClient):
    """GET /api/tax/80g/donor/{donor_id} returns cumulative tax deduction breakdown."""
    resp = client.get("/api/tax/80g/donor/d3")
    assert resp.status_code == 200
    data = resp.json()

    assert data["donor_id"] == "d3"
    assert data["donor_name"] == "Paradise Biryani & Coastal Grill"
    assert data["total_certificates"] >= 1
    assert data["total_kg_rescued"] >= 32.0
    assert data["total_meals_rescued"] >= 60
    assert data["total_gross_salvage_valuation"] >= 3900.0
    assert data["total_eligible_80g_deduction"] >= 1950.0
    assert data["total_projected_tax_savings"] >= 507.0
    assert data["total_esg_co2e_offset_kg"] >= 80.0
    assert len(data["certificates"]) >= 1


def test_get_donor_tax_summary_404(client: TestClient):
    """GET /api/tax/80g/donor/{donor_id} returns 404 for unknown donor."""
    resp = client.get("/api/tax/80g/donor/unknown_d99")
    assert resp.status_code == 404


def test_verify_tax_certificate_public_docket(client: TestClient):
    """GET /api/tax/verify/{id} returns public verification docket validating integrity."""
    # First get certificate for l3
    cert_resp = client.get("/api/tax/80g/l3")
    cert_num = cert_resp.json()["certificate_number"]

    # Verify by certificate number
    verify_resp = client.get(f"/api/tax/verify/{cert_num}")
    assert verify_resp.status_code == 200
    v_data = verify_resp.json()

    assert v_data["valid"] is True
    assert v_data["certificate_number"] == cert_num
    assert v_data["donor_name"] == "Paradise Biryani & Coastal Grill"
    assert v_data["eligible_80g_deduction"] == 1950.0
    assert v_data["esg_co2e_offset_kg"] == 80.0
    assert v_data["verification_status"] == "OFFICIALLY_VERIFIED_AND_SEALED"
    assert "Municipal Food Relief Trust" in v_data["issuer"]


def test_verify_tax_certificate_404(client: TestClient):
    """GET /api/tax/verify/{id} returns 404 for non-existent certificate."""
    resp = client.get("/api/tax/verify/fake_cert_000")
    assert resp.status_code == 404
