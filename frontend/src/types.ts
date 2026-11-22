export interface Pickup {
  id: string;
  listing_id: string;
  receiver_id: string;
  receiver_name?: string | null;
  volunteer_name: string;
  volunteer_phone: string;
  vehicle_type: string;
  claimed_at: string;
  collected_at?: string | null;
  delivered_at?: string | null;
  notes?: string | null;
}

export interface FoodListing {
  id: string;
  donor_id: string;
  donor_name: string;
  donor_type: string;
  donor_address: string;
  donor_phone: string;
  food_name: string;
  food_category: "VEG" | "NON_VEG" | string;
  quantity_meals: number;
  quantity_kg: number;
  storage_type: "HOT" | "AMBIENT" | "REFRIGERATED" | string;
  allergens: string;
  handling_notes?: string | null;
  cooked_at: string;
  expires_at: string;
  status: "POSTED" | "CLAIMED" | "COLLECTED" | "DELIVERED" | "EXPIRED" | string;
  created_at: string;
  minutes_remaining: number;
  urgency_score: number;
  pickup?: Pickup | null;
}

export interface Donor {
  id: string;
  name: string;
  donor_type: string;
  contact_name: string;
  contact_phone: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  created_at: string;
}

export interface Receiver {
  id: string;
  name: string;
  receiver_type: string;
  contact_name: string;
  contact_phone: string;
  capacity_meals: number;
  address: string;
  city: string;
  lat: number;
  lng: number;
  created_at: string;
}

export interface SmartMatchReceiver {
  receiver_id: string;
  receiver_name: string;
  receiver_type: string;
  capacity_meals: number;
  distance_km: number;
  contact_name: string;
  contact_phone: string;
  urgency_score: number;
  match_fit: "EXCELLENT" | "GOOD" | "ACCEPTABLE" | string;
}

export interface SmartMatchResponse {
  listing_id: string;
  food_name: string;
  quantity_meals: number;
  donor_name: string;
  donor_address: string;
  minutes_remaining: number;
  matches: SmartMatchReceiver[];
}

export interface ImpactSummary {
  total_meals_rescued: number;
  total_food_kg_saved: number;
  total_co2_kg_offset: number;
  total_water_liters_saved: number;
  total_donors_active: number;
  total_receivers_served: number;
  esg_compliance_index: number;
  assumptions: Record<string, string>;
}

export interface MirageInspectionResult {
  success: boolean;
  filename: string;
  image_data_url: string;
  is_safe?: boolean;
  quality_score?: number;
  verdict?: "FRESH_AND_GOOD" | "SPOILED_AND_GONE" | string;
  spoilage_risk?: "LOW" | "CRITICAL" | string;
  fssai_grade?: string;
  temperature_check?: string;
  rejection_reasons?: string[];
  mirage_engine: {
    model_name: string;
    weights_size: string;
    parameters: string;
    inference_mode: string;
    latency_ms: number;
    tier1_edge_detector?: string;
    tier2_visual_qa?: string;
    tier3_regulatory_engine?: string;
    cloud_token_cost?: string;
  };
  food_inspection: {
    is_safe?: boolean;
    quality_score: number;
    verdict?: "FRESH_AND_GOOD" | "SPOILED_AND_GONE" | string;
    spoilage_risk?: "LOW" | "CRITICAL" | string;
    fssai_grade: string;
    fssai_status: string;
    temperature_check?: string;
    rejection_reasons?: string[];
    packaging_integrity: string;
    thermal_holding_detected: string;
    detected_food_name: string;
    food_category: string;
    recommended_safe_hours: number;
    allergens_detected: string;
    fssai_notes: string;
    inspection_track?: string;
    the_4_hour_rule?: string;
    vessel_integrity?: string;
    fssai_compliance_badge?: string;
  };
  vlm_raw_telemetry: {
    extracted_text: Array<{ string?: string; bbox?: number[]; score?: number }>;
    detected_objects: Array<{ id?: number; name?: string; bbox?: number[]; score?: number }>;
    scene_description?: Record<string, string>;
    reasoning_trace?: string;
  };
  auto_fill_form_data: {
    food_name: string;
    food_category: string;
    storage_type: string;
    allergens: string;
    hours_valid: number;
    handling_notes: string;
  };
  thermography?: ThermographyData;
  fssai_rule_engine?: FssaiRuleEngineData;
  ocr_prep_timestamp?: string;
  vessel_seal_status?: string;
}

export interface ThermographyData {
  core_temp_c: number;
  surface_temp_c: number;
  ambient_temp_c: number;
  thermal_mode: "OPTICAL_RGB" | "FLIR_IRONBOW" | "MULTI_SPECTRAL" | string;
  holding_compliance: boolean;
  hotspot_matrix?: number[][];
  thermal_status?: string;
}

export interface FssaiRuleEngineData {
  compliance_status: string;
  hot_hold_valid: boolean;
  cold_hold_valid: boolean;
  elapsed_hours_since_prep: number;
  scw_remaining_minutes: number;
  microbial_risk_level: "LOW" | "MODERATE" | "CRITICAL" | string;
  rejection_reasons?: string[];
}

export type OperationalRole =
  | "ALL"
  | "DONOR"
  | "COURIER"
  | "SHELTER"
  | "MUNICIPAL";

export interface DonorPortalData {
  donor: Donor;
  active_listings: FoodListing[];
  completed_rescues: FoodListing[];
  total_kg_saved: number;
  total_meals_saved: number;
  tax_certificates: Section80GTaxSlip[];
  hygiene_rating_score?: number;
  fssai_hygiene_grade?: string;
  cambro_temp_logs?: Array<{ timestamp: string; temp_c: number; status: string }>;
  zero_waste_streak_days?: number;
}

export interface CourierMission {
  listing_id: string;
  food_name: string;
  quantity_kg: number;
  quantity_meals: number;
  status: string;
  storage_type: string;
  donor_name: string;
  donor_address: string;
  donor_coordinates: { lat: number; lng: number };
  target_shelter: {
    id: string;
    name: string;
    address: string;
    phone: string;
  };
  urn_count: number;
  scw_minutes_remaining: number;
  urgency_score: number;
  whatsapp_deep_link: string;
  sms_trigger_uri: string;
  pickup?: Pickup | null;
}

export interface CourierFleetStatus {
  active_couriers: number;
  fleet_type: string;
  missions_completed_today: number;
  avg_pickup_time_minutes: number;
  co2e_saved_by_ev_fleet_kg: number;
}

export interface CourierPortalData {
  available_missions: CourierMission[];
  active_missions: CourierMission[];
  courier_fleet_status: CourierFleetStatus;
}

export interface ShelterIntakeItem {
  id: string;
  listing_id: string;
  food_name: string;
  receiver_id: string;
  volunteer_name: string;
  arrived_at: string;
  intake_temp_c: number;
  meals_accepted: number;
  fssai_compliance_status: string;
  notes?: string | null;
  created_at: string;
}

export interface ShelterPortalData {
  shelter: Receiver;
  incoming_deliveries: FoodListing[];
  completed_intakes: ShelterIntakeItem[];
  current_occupancy_meals: number;
  capacity_meals: number;
  utilization_percent: number;
}

export interface CourierDensityPoint {
  courier_id: string;
  vehicle_type: string;
  lat: number;
  lng: number;
  status: string;
}

export interface WardSummary {
  ward_name: string;
  active_donors: number;
  active_shelters: number;
  meals_rescued: number;
  kg_saved: number;
  urgency_level: string;
}

export interface MunicipalCommandData {
  city: string;
  total_meals_rescued: number;
  total_food_kg_saved: number;
  active_rescues_count: number;
  spoilage_prevention_rate: number;
  esg_co2e_total_kg: number;
  active_courier_density: CourierDensityPoint[];
  ward_summaries: WardSummary[];
}

export interface TeletypeToast {
  id: string;
  type: "DISPATCH" | "SUCCESS" | "VERIFIED" | "SCAN" | "ERROR";
  message: string;
  timestamp: string;
}

export interface FoodListingFormData {
  donor_id: string;
  food_name: string;
  food_category: string;
  quantity_meals: number;
  quantity_kg: number;
  storage_type: string;
  allergens: string;
  handling_notes: string;
  hours_valid: number;
}

export interface Section80GTaxSlip {
  certificate_number: string;
  registration_order: string;
  donor_name: string;
  donor_pan: string;
  donor_address: string;
  food_name: string;
  quantity_kg: number;
  quantity_meals: number;
  fmv_rate_per_plate: number;
  gross_salvage_valuation: number;
  eligible_80g_deduction: number;
  projected_corporate_tax_savings: number;
  esg_co2e_offset_kg: number;
  ca_attestation: {
    ca_name: string;
    ca_firm: string;
    icai_reg_no: string;
    udin: string;
  };
  qr_verification_url: string;
  verification_hash: string;
  created_at: string;
}

export interface CourierWaypoint {
  lat: number;
  lng: number;
  label: string;
}

export interface CourierTelemetry {
  listing_id: string;
  courier_name: string;
  vehicle_type: string;
  route_name: string;
  current_coordinates: { lat: number; lng: number };
  heading_degrees: number;
  speed_kmh: number;
  battery_percent: number;
  is_regen_active: boolean;
  cambro_core_temp_c: number;
  thermal_status: string;
  eta_minutes: number;
  distance_remaining_km: number;
  is_delivered: boolean;
  waypoints: CourierWaypoint[];
}

export interface DispatchTriggerResponse {
  success: boolean;
  listing_id: string;
  pickup_id: string;
  whatsapp_deep_link: string;
  sms_trigger_uri: string;
  urn_count: number;
  scw_minutes_remaining: number;
  donor_coordinates: { lat: number; lng: number };
  target_shelter: {
    id: string;
    name: string;
    address: string;
    phone: string;
  };
}

export interface DeliveryConfirmationPayload {
  receiver_id: string;
  arrived_at?: string;
  intake_temp_c: number;
  meals_accepted: number;
  notes?: string;
}

export interface DeliveryConfirmationResponse {
  success: boolean;
  intake_id: string;
  listing_id: string;
  status: string;
  delivered_at: string;
  intake_verified: boolean;
}

export interface TaxVerificationDocket {
  valid: boolean;
  certificate_number: string;
  donor_name: string;
  eligible_80g_deduction: number;
  esg_co2e_offset_kg: number;
  ca_udin: string;
  issuer: string;
  issued_at: string;
  verification_status: string;
}

