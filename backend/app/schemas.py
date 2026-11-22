"""Pydantic schemas for SurplusPulse API."""

from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field


class DonorOut(BaseModel):
    id: str
    name: str
    donor_type: str
    contact_name: str
    contact_phone: str
    address: str
    city: str
    lat: float
    lng: float
    created_at: str


class ReceiverOut(BaseModel):
    id: str
    name: str
    receiver_type: str
    contact_name: str
    contact_phone: str
    capacity_meals: int
    address: str
    city: str
    lat: float
    lng: float
    created_at: str


class FoodListingCreate(BaseModel):
    donor_id: str
    food_name: str = Field(min_length=3)
    food_category: Literal["VEG", "NON_VEG"]
    quantity_meals: int = Field(gt=0)
    quantity_kg: float = Field(gt=0)
    storage_type: Literal["HOT", "AMBIENT", "REFRIGERATED"] = "HOT"
    allergens: str = "None"
    handling_notes: str | None = None
    hours_valid: float = Field(default=3.0, le=12.0)


class PickupOut(BaseModel):
    id: str
    listing_id: str
    receiver_id: str
    receiver_name: str | None = None
    volunteer_name: str
    volunteer_phone: str
    vehicle_type: str
    claimed_at: str
    collected_at: str | None = None
    delivered_at: str | None = None
    notes: str | None = None


class FoodListingOut(BaseModel):
    id: str
    donor_id: str
    donor_name: str
    donor_type: str
    donor_address: str
    donor_phone: str
    donor_lat: float | None = None
    donor_lng: float | None = None
    food_name: str
    food_category: str
    quantity_meals: int
    quantity_kg: float
    storage_type: str
    allergens: str
    handling_notes: str | None = None
    cooked_at: str
    expires_at: str
    status: str
    created_at: str
    minutes_remaining: int
    urgency_score: float
    pickup: PickupOut | None = None


class ClaimListingRequest(BaseModel):
    receiver_id: str
    volunteer_name: str = Field(min_length=2)
    volunteer_phone: str = Field(min_length=8)
    vehicle_type: str = "Two-Wheeler / Auto"
    notes: str | None = None


class UpdatePickupStatusRequest(BaseModel):
    status: Literal["COLLECTED", "DELIVERED"]
    notes: str | None = None


class SmartMatchReceiver(BaseModel):
    receiver_id: str
    receiver_name: str
    receiver_type: str
    capacity_meals: int
    distance_km: float
    contact_name: str
    contact_phone: str
    urgency_score: float
    match_fit: str  # "EXCELLENT", "GOOD", "ACCEPTABLE"


class SmartMatchResponse(BaseModel):
    listing_id: str
    food_name: str
    quantity_meals: int
    donor_name: str
    donor_address: str
    minutes_remaining: int
    matches: list[SmartMatchReceiver]


class ImpactSummaryOut(BaseModel):
    total_meals_rescued: int
    total_food_kg_saved: float
    total_co2_kg_offset: float  # (kg CO2e emissions avoided)
    total_water_liters_saved: float
    total_donors_active: int
    total_receivers_served: int
    esg_compliance_index: float  # 0 to 100 ESG rating score
    assumptions: dict[str, str]


class FoodInspectionRequest(BaseModel):
    image_base64: str | None = None
    sample_id: str | None = None


# =============================================================================
# Milestone 1: Dispatch, Telemetry, Section 80G Tax, Portals, & VLM Schemas
# =============================================================================

class DonorCoordinates(BaseModel):
    lat: float
    lng: float


class TargetShelter(BaseModel):
    id: str
    name: str
    address: str
    phone: str


class DispatchListingRequest(BaseModel):
    volunteer_name: str = Field(min_length=2)
    volunteer_phone: str = Field(min_length=8)
    vehicle_type: str = "EV Cargo Trike"
    receiver_id: str | None = None
    notes: str | None = None


class DispatchResponse(BaseModel):
    success: bool
    listing_id: str
    pickup_id: str
    whatsapp_deep_link: str
    sms_trigger_uri: str
    urn_count: int
    scw_minutes_remaining: int
    donor_coordinates: DonorCoordinates
    target_shelter: TargetShelter


class DispatchTriggerOut(BaseModel):
    listing_id: str
    whatsapp_deep_link: str
    sms_trigger_uri: str
    urn_count: int
    scw_minutes_remaining: int
    donor_coordinates: DonorCoordinates
    target_shelter: TargetShelter


class RouteWaypoint(BaseModel):
    lat: float
    lng: float
    label: str


class CourierTelemetryOut(BaseModel):
    listing_id: str
    courier_name: str
    vehicle_type: str
    route_name: str
    current_coordinates: DonorCoordinates
    heading_degrees: float
    speed_kmh: float
    battery_percent: float
    is_regen_active: bool
    cambro_core_temp_c: float
    thermal_status: str
    eta_minutes: int
    distance_remaining_km: float
    is_delivered: bool
    waypoints: list[RouteWaypoint]


class ConfirmDeliveryRequest(BaseModel):
    receiver_id: str
    arrived_at: str | None = None
    intake_temp_c: float = 68.5
    meals_accepted: int = Field(gt=0)
    notes: str | None = None


class ConfirmDeliveryResponse(BaseModel):
    success: bool
    intake_id: str
    listing_id: str
    status: str
    delivered_at: str
    intake_verified: bool


class CAAttestationOut(BaseModel):
    ca_name: str
    ca_firm: str
    icai_reg_no: str
    udin: str


class TaxCertificate80GOut(BaseModel):
    certificate_number: str
    registration_order: str
    donor_name: str
    donor_pan: str
    donor_address: str
    food_name: str
    quantity_kg: float
    quantity_meals: int
    fmv_rate_per_plate: float
    gross_salvage_valuation: float
    eligible_80g_deduction: float
    projected_corporate_tax_savings: float
    esg_co2e_offset_kg: float
    ca_attestation: CAAttestationOut
    qr_verification_url: str
    verification_hash: str
    created_at: str


class DonorTaxSummaryOut(BaseModel):
    donor_id: str
    donor_name: str
    donor_pan: str
    total_certificates: int
    total_kg_rescued: float
    total_meals_rescued: int
    total_gross_salvage_valuation: float
    total_eligible_80g_deduction: float
    total_projected_tax_savings: float
    total_esg_co2e_offset_kg: float
    certificates: list[TaxCertificate80GOut]


class TaxVerifyOut(BaseModel):
    valid: bool
    certificate_number: str
    donor_name: str
    eligible_80g_deduction: float
    esg_co2e_offset_kg: float
    ca_udin: str
    issuer: str
    issued_at: str
    verification_status: str


class ShelterIntakeOut(BaseModel):
    id: str
    listing_id: str
    food_name: str | None = None
    receiver_id: str
    volunteer_name: str
    arrived_at: str
    intake_temp_c: float
    meals_accepted: int
    fssai_compliance_status: str
    notes: str | None = None
    created_at: str


class ShelterPortalOut(BaseModel):
    shelter: ReceiverOut
    incoming_deliveries: list[FoodListingOut]
    completed_intakes: list[ShelterIntakeOut]
    current_occupancy_meals: int
    capacity_meals: int
    utilization_percent: float


class CourierMissionOut(BaseModel):
    listing_id: str
    food_name: str
    quantity_kg: float
    quantity_meals: int
    status: str
    storage_type: str
    donor_name: str
    donor_address: str
    donor_coordinates: DonorCoordinates
    target_shelter: TargetShelter
    urn_count: int
    scw_minutes_remaining: int
    urgency_score: float
    whatsapp_deep_link: str
    sms_trigger_uri: str
    pickup: PickupOut | None = None


class CourierFleetStatus(BaseModel):
    active_couriers: int
    fleet_type: str
    missions_completed_today: int
    avg_pickup_time_minutes: float
    co2e_saved_by_ev_fleet_kg: float


class CourierPortalOut(BaseModel):
    available_missions: list[CourierMissionOut]
    active_missions: list[CourierMissionOut]
    courier_fleet_status: CourierFleetStatus


class DonorPortalOut(BaseModel):
    donor: DonorOut
    active_listings: list[FoodListingOut]
    completed_rescues: list[FoodListingOut]
    total_kg_saved: float
    total_meals_saved: int
    tax_certificates: list[TaxCertificate80GOut]


class WardSummary(BaseModel):
    ward_name: str
    active_donors: int
    active_shelters: int
    meals_rescued: int
    kg_saved: float
    urgency_level: str


class CourierDensityPoint(BaseModel):
    courier_id: str
    vehicle_type: str
    lat: float
    lng: float
    status: str


class MunicipalPortalOut(BaseModel):
    city: str
    total_meals_rescued: int
    total_food_kg_saved: float
    active_rescues_count: int
    spoilage_prevention_rate: float
    esg_co2e_total_kg: float
    active_courier_density: list[CourierDensityPoint]
    ward_summaries: list[WardSummary]


