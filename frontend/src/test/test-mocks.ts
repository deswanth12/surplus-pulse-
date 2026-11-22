import {
  Donor,
  Receiver,
  FoodListing,
  SmartMatchResponse,
  ImpactSummary,
  MirageInspectionResult,
  Section80GTaxSlip,
  CourierTelemetry,
  DispatchTriggerResponse,
  TaxVerificationDocket,
  DonorPortalData,
  CourierPortalData,
  ShelterPortalData,
  MunicipalCommandData,
} from '../types'

export const mockDonors: Donor[] = [
  {
    id: 'd1',
    name: 'The Grand Amber Banquet Hall',
    donor_type: 'WEDDING_VENUE',
    contact_name: 'Suresh R.',
    contact_phone: '+91 98450 11234',
    address: '100 Feet Rd, Indiranagar',
    city: 'Bengaluru',
    lat: 12.9716,
    lng: 77.6412,
    created_at: '2026-11-10T12:00:00Z',
  },
  {
    id: 'd2',
    name: 'TechPark Central Food Court',
    donor_type: 'CATERER',
    contact_name: 'Amit Sharma',
    contact_phone: '+91 98860 55678',
    address: 'EPIP Zone, Whitefield',
    city: 'Bengaluru',
    lat: 12.9698,
    lng: 77.75,
    created_at: '2026-11-05T12:00:00Z',
  },
]

export const mockReceivers: Receiver[] = [
  {
    id: 'r1',
    name: 'Robin Hood Army - Indiranagar Hub',
    receiver_type: 'NGO',
    contact_name: 'Neha Sen',
    contact_phone: '+91 98200 44556',
    capacity_meals: 150,
    address: 'Double Road, Indiranagar',
    city: 'Bengaluru',
    lat: 12.9783,
    lng: 77.6408,
    created_at: '2026-11-20T12:00:00Z',
  },
  {
    id: 'r2',
    name: 'City Hope Homeless Shelter',
    receiver_type: 'SHELTER',
    contact_name: 'Fr. Joseph Mathew',
    contact_phone: '+91 94490 77112',
    capacity_meals: 100,
    address: '8th Main, Koramangala 4th Block',
    city: 'Bengaluru',
    lat: 12.938,
    lng: 77.618,
    created_at: '2026-11-20T12:00:00Z',
  },
]

export const mockListings: FoodListing[] = [
  {
    id: 'l1',
    donor_id: 'd1',
    donor_name: 'The Grand Amber Banquet Hall',
    donor_type: 'WEDDING_VENUE',
    donor_address: '100 Feet Rd, Indiranagar',
    donor_phone: '+91 98450 11234',
    food_name: 'Royal Hyderabadi Veg Pulao & Paneer Makhani',
    food_category: 'VEG',
    quantity_meals: 120,
    quantity_kg: 55.0,
    storage_type: 'HOT',
    allergens: 'Dairy (Paneer)',
    handling_notes: 'Hot thermal containers sealed with foil.',
    cooked_at: '2026-11-21T11:00:00Z',
    expires_at: '2026-11-21T14:30:00Z',
    status: 'POSTED',
    created_at: '2026-11-21T11:00:00Z',
    minutes_remaining: 150,
    urgency_score: 85.5,
    pickup: null,
  },
  {
    id: 'l2',
    donor_id: 'd2',
    donor_name: 'TechPark Central Food Court',
    donor_type: 'CATERER',
    donor_address: 'EPIP Zone, Whitefield',
    donor_phone: '+91 98860 55678',
    food_name: 'Wholesome Roti, Dal Tadka & Mix Veg Sabzi',
    food_category: 'VEG',
    quantity_meals: 80,
    quantity_kg: 36.0,
    storage_type: 'HOT',
    allergens: 'Gluten (Wheat)',
    handling_notes: 'Stainless steel catering trays.',
    cooked_at: '2026-11-21T10:00:00Z',
    expires_at: '2026-11-21T14:00:00Z',
    status: 'CLAIMED',
    created_at: '2026-11-21T10:00:00Z',
    minutes_remaining: 120,
    urgency_score: 72.0,
    pickup: {
      id: 'p1',
      listing_id: 'l2',
      receiver_id: 'r1',
      receiver_name: 'Robin Hood Army - Indiranagar Hub',
      volunteer_name: 'Vikram Adiga',
      volunteer_phone: '+91 99112 33445',
      vehicle_type: 'Maruti Eeco Cargo Van',
      claimed_at: '2026-11-21T11:15:00Z',
      collected_at: null,
      delivered_at: null,
      notes: 'Driver dispatched, ETA 15 mins.',
    },
  },
  {
    id: 'l3',
    donor_id: 'd1',
    donor_name: 'The Grand Amber Banquet Hall',
    donor_type: 'WEDDING_VENUE',
    donor_address: '100 Feet Rd, Indiranagar',
    donor_phone: '+91 98450 11234',
    food_name: 'Lemon Rice & Sambar',
    food_category: 'VEG',
    quantity_meals: 60,
    quantity_kg: 25.0,
    storage_type: 'HOT',
    allergens: 'Mustard',
    handling_notes: 'Packed hygienically.',
    cooked_at: '2026-11-21T08:00:00Z',
    expires_at: '2026-11-21T12:00:00Z',
    status: 'COLLECTED',
    created_at: '2026-11-21T08:00:00Z',
    minutes_remaining: 30,
    urgency_score: 90.0,
    pickup: {
      id: 'p2',
      listing_id: 'l3',
      receiver_id: 'r2',
      receiver_name: 'City Hope Homeless Shelter',
      volunteer_name: 'Santosh Kumar',
      volunteer_phone: '+91 98441 22334',
      vehicle_type: 'Electric Three-Wheeler',
      claimed_at: '2026-11-21T09:00:00Z',
      collected_at: '2026-11-21T09:30:00Z',
      delivered_at: null,
      notes: 'Picked up from Amber hall.',
    },
  },
]

export const mockMatchResponse: SmartMatchResponse = {
  listing_id: 'l1',
  food_name: 'Royal Hyderabadi Veg Pulao & Paneer Makhani',
  quantity_meals: 120,
  donor_name: 'The Grand Amber Banquet Hall',
  donor_address: '100 Feet Rd, Indiranagar',
  minutes_remaining: 150,
  matches: [
    {
      receiver_id: 'r1',
      receiver_name: 'Robin Hood Army - Indiranagar Hub',
      receiver_type: 'NGO',
      capacity_meals: 150,
      distance_km: 0.8,
      contact_name: 'Neha Sen',
      contact_phone: '+91 98200 44556',
      urgency_score: 92.4,
      match_fit: 'EXCELLENT',
    },
    {
      receiver_id: 'r2',
      receiver_name: 'City Hope Homeless Shelter',
      receiver_type: 'SHELTER',
      capacity_meals: 100,
      distance_km: 4.2,
      contact_name: 'Fr. Joseph Mathew',
      contact_phone: '+91 94490 77112',
      urgency_score: 74.5,
      match_fit: 'GOOD',
    },
  ],
}

export const mockImpactSummary: ImpactSummary = {
  total_meals_rescued: 280,
  total_food_kg_saved: 133.0,
  total_co2_kg_offset: 332.5,
  total_water_liters_saved: 106400.0,
  total_donors_active: 4,
  total_receivers_served: 4,
  esg_compliance_index: 93.0,
  assumptions: {
    meal_weight_basis: '1 standard nutritious meal is computed as ~0.45 kg of balanced prepared food.',
    greenhouse_gas_metric: '1 kg food diverted prevents 2.5 kg CO2e emissions (UNEP / EPA WARM standard).',
    water_footprint_metric: 'Embedded water equivalent calculated at 800 Liters per kg food.',
    commercial_business_case: 'Corporate donors subscribe at ₹1,499/mo for automated BRSR / ESG verification.',
  },
}

export const mockMirageResult: MirageInspectionResult = {
  success: true,
  filename: 'paneer_makhani_thermal_urn.png',
  image_data_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  is_safe: true,
  quality_score: 96,
  verdict: 'FRESH_AND_GOOD',
  spoilage_risk: 'LOW',
  fssai_grade: 'GRADE_A_PRIME',
  temperature_check: 'Compliant: Thermal Hold >65°C',
  rejection_reasons: [],
  mirage_engine: {
    model_name: 'Mirage VLM (Cactus Compute)',
    weights_size: '22.0 MB (2-bit quantized)',
    parameters: '51.3 Million (VLM + OCR + BBox + Mask + Form)',
    inference_mode: '100% Local On-Device (Zero External API)',
    latency_ms: 45.2,
  },
  food_inspection: {
    is_safe: true,
    quality_score: 96.0,
    verdict: 'FRESH_AND_GOOD',
    spoilage_risk: 'LOW',
    fssai_grade: 'GRADE_A_PRIME',
    fssai_status: 'PASSED - SAFE FOR IMMEDIATE DISTRIBUTION',
    temperature_check: 'Compliant: Thermal Hold >65°C',
    rejection_reasons: [],
    packaging_integrity: 'SEALED_CONTAINER_VERIFIED',
    thermal_holding_detected: 'HOT',
    detected_food_name: 'Paneer Butter Masala (Inspected)',
    food_category: 'VEG',
    recommended_safe_hours: 3.5,
    allergens_detected: 'Dairy (Paneer & Cream)',
    fssai_notes: 'Mirage VLM confirmed intact secondary container holding.',
  },
  vlm_raw_telemetry: {
    extracted_text: [{ string: 'PANEER BUTTER MASALA' }],
    detected_objects: [{ name: 'container' }],
    scene_description: {},
    reasoning_trace: 'VLM verified food container integrity.',
  },
  auto_fill_form_data: {
    food_name: 'Paneer Butter Masala (Inspected)',
    food_category: 'VEG',
    storage_type: 'HOT',
    allergens: 'Dairy (Paneer & Cream)',
    hours_valid: 3.5,
    handling_notes: 'Mirage VLM Certified Quality (96.0%). Thermal Hold: HOT. FSSAI Safe.',
  },
  thermography: {
    core_temp_c: 67.5,
    surface_temp_c: 65.8,
    ambient_temp_c: 25.5,
    thermal_mode: 'FLIR_IRONBOW',
    holding_compliance: true,
    hotspot_matrix: [
      [65.8, 66.4, 66.9, 66.0],
      [66.5, 67.8, 68.1, 67.2],
      [66.2, 67.5, 68.0, 67.0],
      [65.5, 66.1, 66.6, 65.9],
    ],
  },
  fssai_rule_engine: {
    compliance_status: 'COMPLIANT_SAFE_HOLD',
    hot_hold_valid: true,
    cold_hold_valid: false,
    elapsed_hours_since_prep: 0.8,
    scw_remaining_minutes: 192,
    microbial_risk_level: 'LOW',
  },
  ocr_prep_timestamp: 'PREP: 22-NOV-2026 13:00 IST • BATCH #KOR-8821',
  vessel_seal_status: 'Hermetic Cambro Seal Verified',
}

export const mockMirageFreshBiryani: MirageInspectionResult = {
  ...mockMirageResult,
  quality_score: 98,
  food_inspection: {
    ...mockMirageResult.food_inspection,
    quality_score: 98.0,
    detected_food_name: 'Hyderabadi Dum Biryani (Inspected)',
    fssai_notes: 'Mirage VLM verified fresh banquet state. Thermal core >68°C.',
  },
  auto_fill_form_data: {
    food_name: 'Hyderabadi Dum Biryani (Inspected)',
    food_category: 'VEG',
    storage_type: 'HOT',
    allergens: 'Dairy (Ghee)',
    hours_valid: 3.5,
    handling_notes: 'Mirage VLM Certified Quality (98%). Thermal Hold: HOT. FSSAI Safe.',
  },
  thermography: {
    core_temp_c: 68.4,
    surface_temp_c: 66.2,
    ambient_temp_c: 26.0,
    thermal_mode: 'HOT_HOLD',
    holding_compliance: true,
    hotspot_matrix: [
      [66.5, 67.2, 67.8, 66.8],
      [67.4, 68.9, 69.1, 67.9],
      [67.0, 68.8, 69.4, 68.1],
      [66.1, 67.0, 67.3, 66.4],
    ],
  },
  fssai_rule_engine: {
    compliance_status: 'COMPLIANT_SAFE_HOLD',
    hot_hold_valid: true,
    cold_hold_valid: false,
    elapsed_hours_since_prep: 0.5,
    scw_remaining_minutes: 210,
    microbial_risk_level: 'LOW',
  },
  ocr_prep_timestamp: 'PREP: 22-NOV-2026 12:30 IST • BATCH #IND-4412',
  vessel_seal_status: 'Hermetic Cambro Seal Verified',
}

export const mockMirageSpoiledCurry: MirageInspectionResult = {
  success: true,
  filename: 'spoiled_curry_acidic_separation.png',
  image_data_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  is_safe: false,
  quality_score: 18,
  verdict: 'SPOILED_AND_GONE',
  spoilage_risk: 'CRITICAL',
  fssai_grade: 'GRADE_F',
  temperature_check: 'Failure: Extended ambient temperature exposure (31°C)',
  rejection_reasons: [
    'Bacterial proliferation risk detected',
    'Sour odor & acidic separation visible in emulsion',
    'Exceeded microbial safety threshold',
  ],
  mirage_engine: {
    model_name: 'Mirage VLM (Cactus Compute)',
    weights_size: '22.0 MB (2-bit quantized)',
    parameters: '51.3 Million (VLM + OCR + BBox + Mask + Form)',
    inference_mode: '100% Local On-Device (Zero External API)',
    latency_ms: 48.0,
  },
  food_inspection: {
    is_safe: false,
    quality_score: 18.0,
    verdict: 'SPOILED_AND_GONE',
    spoilage_risk: 'CRITICAL',
    fssai_grade: 'GRADE_F',
    fssai_status: 'REJECTED - FOOD IS SPOILED / GONE (UNSAFE FOR CONSUMPTION)',
    temperature_check: 'Failure: Extended ambient temperature exposure (31°C)',
    rejection_reasons: [
      'Bacterial proliferation risk detected',
      'Sour odor & acidic separation visible in emulsion',
      'Exceeded microbial safety threshold',
    ],
    packaging_integrity: 'COMPROMISED_OR_DEGRADED',
    thermal_holding_detected: 'AMBIENT',
    detected_food_name: 'Spoiled Vegetable Curry (Degraded)',
    food_category: 'VEG',
    recommended_safe_hours: 0,
    allergens_detected: 'Multiple / Decomposed',
    fssai_notes: 'REJECTED - FOOD IS SPOILED / GONE (UNSAFE FOR CONSUMPTION).',
  },
  vlm_raw_telemetry: {
    extracted_text: [{ string: 'SPOILED VEGETABLE CURRY' }],
    detected_objects: [{ name: 'container' }],
    scene_description: {},
    reasoning_trace: 'VLM detected acidic separation and microbial risk.',
  },
  auto_fill_form_data: {
    food_name: 'Spoiled Vegetable Curry (Degraded)',
    food_category: 'VEG',
    storage_type: 'AMBIENT',
    allergens: 'Decomposed',
    hours_valid: 0.5,
    handling_notes: 'REJECTED - FOOD IS SPOILED / GONE (UNSAFE FOR CONSUMPTION).',
  },
  thermography: {
    core_temp_c: 31.2,
    surface_temp_c: 30.8,
    ambient_temp_c: 28.5,
    thermal_mode: 'DANGER_ZONE',
    holding_compliance: false,
    hotspot_matrix: [
      [30.1, 30.5, 30.8, 30.2],
      [30.6, 31.4, 31.8, 30.9],
      [30.4, 31.2, 31.5, 30.7],
      [29.8, 30.3, 30.5, 30.0],
    ],
  },
  fssai_rule_engine: {
    compliance_status: 'DANGER_ZONE_VIOLATION',
    hot_hold_valid: false,
    cold_hold_valid: false,
    elapsed_hours_since_prep: 4.8,
    scw_remaining_minutes: 0,
    microbial_risk_level: 'CRITICAL',
    rejection_reasons: [
      'Temperature Danger Zone violation (31.2°C: requires >65°C hot-hold or <4°C cold-hold)',
      'FSSAI 4-hour microbial proliferation window exceeded (288 mins elapsed)',
      'Compromised secondary vessel seal or physical container breach',
    ],
  },
  ocr_prep_timestamp: 'PREP: 22-NOV-2026 06:15 IST • BATCH #EXPIRED-09',
  vessel_seal_status: 'Compromised Seal',
}

export const mockMirageExpiredRice: MirageInspectionResult = {
  ...mockMirageSpoiledCurry,
  quality_score: 28,
  food_inspection: {
    ...mockMirageSpoiledCurry.food_inspection,
    quality_score: 28.0,
    fssai_status: 'REJECTED - SAFE HOLD WINDOW EXPIRED',
    temperature_check: 'Failure: Cold hazard (22°C Danger Zone >4 hrs)',
    detected_food_name: 'Stale Cooked Rice (Cold Hazard)',
    rejection_reasons: [
      'Cold hazard: Stored in 22°C danger zone for >4 hours',
      'Bacillus cereus spore proliferation hazard',
    ],
  },
  thermography: {
    core_temp_c: 22.0,
    surface_temp_c: 21.8,
    ambient_temp_c: 24.0,
    thermal_mode: 'DANGER_ZONE',
    holding_compliance: false,
  },
  fssai_rule_engine: {
    compliance_status: 'DANGER_ZONE_VIOLATION',
    hot_hold_valid: false,
    cold_hold_valid: false,
    elapsed_hours_since_prep: 5.0,
    scw_remaining_minutes: 0,
    microbial_risk_level: 'CRITICAL',
  },
  ocr_prep_timestamp: 'PREP: 22-NOV-2026 05:00 IST • BATCH #RICE-02',
  vessel_seal_status: 'Compromised Seal',
}

export const mockSection80GTaxSlip: Section80GTaxSlip = {
  certificate_number: '80G-BLR-2026-AABTS1234F',
  registration_order: 'CIT(E)/BLR/80G/2026/AABTS1234F',
  donor_name: 'The Grand Amber Banquet Hall',
  donor_pan: 'AABCS1948K',
  donor_address: '100 Feet Rd, Indiranagar, Bengaluru, Karnataka 560038',
  food_name: 'Royal Hyderabadi Veg Pulao & Paneer Makhani',
  quantity_kg: 55.0,
  quantity_meals: 120,
  fmv_rate_per_plate: 65.0,
  gross_salvage_valuation: 7800.0,
  eligible_80g_deduction: 3900.0,
  projected_corporate_tax_savings: 1014.0,
  esg_co2e_offset_kg: 137.5,
  ca_attestation: {
    ca_name: 'CA Rajeshwari Sundaram, FCA',
    ca_firm: 'R. Sundaram & Associates, Chartered Accountants',
    icai_reg_no: '021948S',
    udin: '26021948AAAAAA1968',
  },
  qr_verification_url: '/api/tax/verify/tc_80g_blr_2026',
  verification_hash: 'a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890',
  created_at: '2026-11-21T11:00:00Z',
}

export const mockCourierTelemetry: CourierTelemetry = {
  listing_id: 'l2',
  courier_name: 'Vikram Adiga',
  vehicle_type: 'EV Cargo Trike',
  route_name: 'Indiranagar ➔ Koramangala Eco-Corridor',
  current_coordinates: { lat: 12.9745, lng: 77.635 },
  heading_degrees: 145.2,
  speed_kmh: 28.6,
  battery_percent: 82.5,
  is_regen_active: true,
  cambro_core_temp_c: 66.8,
  thermal_status: 'HOT_HOLD_COMPLIANT',
  eta_minutes: 8,
  distance_remaining_km: 1.4,
  is_delivered: false,
  waypoints: [
    { lat: 12.9716, lng: 77.6412, label: 'Grand Amber Banquet Hall (Pickup)' },
    { lat: 12.965, lng: 77.638, label: 'Indiranagar 100ft Road Corridor' },
    { lat: 12.955, lng: 77.63, label: 'Domlur Flyover Transit' },
    { lat: 12.938, lng: 77.618, label: 'City Hope Shelter Intake' },
  ],
}

export const mockDispatchTriggerResponse: DispatchTriggerResponse = {
  success: true,
  listing_id: 'l1',
  pickup_id: 'p_mock123',
  whatsapp_deep_link: 'https://wa.me/919911233445?text=%F0%9F%9A%A8%20*SURPLUSPULSE%20RESCUE%20MISSION%20DISPATCH*',
  sms_trigger_uri: 'sms:919911233445?body=%F0%9F%9A%A8%20*SURPLUSPULSE%20RESCUE%20MISSION%20DISPATCH*',
  urn_count: 4,
  scw_minutes_remaining: 150,
  donor_coordinates: { lat: 12.9716, lng: 77.6412 },
  target_shelter: {
    id: 'r1',
    name: 'Robin Hood Army - Indiranagar Hub',
    address: 'Double Road, Indiranagar',
    phone: '+91 98200 44556',
  },
}

export const mockTaxVerificationDocket: TaxVerificationDocket = {
  valid: true,
  certificate_number: '80G-BLR-2026-AABTS1234F',
  donor_name: 'The Grand Amber Banquet Hall',
  eligible_80g_deduction: 3900.0,
  esg_co2e_offset_kg: 137.5,
  ca_udin: '26021948AAAAAA1968',
  issuer: 'SurplusPulse Municipal Food Relief Trust & Income Tax Department',
  issued_at: '2026-11-21T11:00:00Z',
  verification_status: 'OFFICIALLY_VERIFIED_AND_SEALED',
}

export const mockDonorPortalData: DonorPortalData = {
  donor: mockDonors[0],
  active_listings: [mockListings[0]],
  completed_rescues: [
    {
      ...mockListings[1],
      status: 'DELIVERED',
    },
  ],
  total_kg_saved: 133.0,
  total_meals_saved: 295,
  tax_certificates: [mockSection80GTaxSlip],
  hygiene_rating_score: 98.5,
  fssai_hygiene_grade: 'GRADE_A_PRIME',
  cambro_temp_logs: [
    { timestamp: '12:00 IST', temp_c: 68.4, status: 'SAFE_HOT_HOLD' },
    { timestamp: '12:30 IST', temp_c: 67.2, status: 'SAFE_HOT_HOLD' },
    { timestamp: '13:00 IST', temp_c: 66.8, status: 'SAFE_HOT_HOLD' },
  ],
  zero_waste_streak_days: 14,
}

export const mockCourierPortalData: CourierPortalData = {
  available_missions: [
    {
      listing_id: mockListings[0].id,
      food_name: mockListings[0].food_name,
      quantity_kg: mockListings[0].quantity_kg,
      quantity_meals: mockListings[0].quantity_meals,
      status: 'POSTED',
      storage_type: mockListings[0].storage_type,
      donor_name: mockListings[0].donor_name,
      donor_address: mockListings[0].donor_address,
      donor_coordinates: { lat: 12.9716, lng: 77.6412 },
      target_shelter: {
        id: 'r1',
        name: 'Robin Hood Army - Indiranagar Hub',
        address: 'Double Road, Indiranagar',
        phone: '+91 98200 44556',
      },
      urn_count: 4,
      scw_minutes_remaining: 150,
      urgency_score: 85.5,
      whatsapp_deep_link: 'https://wa.me/919820044556?text=MISSION%20DISPATCH',
      sms_trigger_uri: 'sms:919820044556?body=MISSION%20DISPATCH',
      pickup: null,
    },
  ],
  active_missions: [
    {
      listing_id: mockListings[1].id,
      food_name: mockListings[1].food_name,
      quantity_kg: mockListings[1].quantity_kg,
      quantity_meals: mockListings[1].quantity_meals,
      status: 'CLAIMED',
      storage_type: mockListings[1].storage_type,
      donor_name: mockListings[1].donor_name,
      donor_address: mockListings[1].donor_address,
      donor_coordinates: { lat: 12.9698, lng: 77.75 },
      target_shelter: {
        id: 'r2',
        name: 'City Hope Homeless Shelter',
        address: '8th Main, Koramangala',
        phone: '+91 94490 77112',
      },
      urn_count: 2,
      scw_minutes_remaining: 180,
      urgency_score: 72.0,
      whatsapp_deep_link: 'https://wa.me/919449077112?text=MISSION%20CLAIMED',
      sms_trigger_uri: 'sms:919449077112?body=MISSION%20CLAIMED',
      pickup: mockListings[1].pickup,
    },
  ],
  courier_fleet_status: {
    active_couriers: 8,
    fleet_type: 'EV Cargo Trikes & Clean Energy Two-Wheelers',
    missions_completed_today: 14,
    avg_pickup_time_minutes: 18.5,
    co2e_saved_by_ev_fleet_kg: 198.8,
  },
}

export const mockShelterPortalData: ShelterPortalData = {
  shelter: mockReceivers[0],
  incoming_deliveries: [mockListings[1]],
  completed_intakes: [
    {
      id: 'in_mock1',
      listing_id: 'l3',
      food_name: 'Hyderabadi Veg Dum Biryani',
      receiver_id: mockReceivers[0].id,
      volunteer_name: 'Vikram Adiga',
      arrived_at: '2026-11-21T12:00:00Z',
      intake_temp_c: 67.4,
      meals_accepted: 100,
      fssai_compliance_status: 'SAFE_HOT_HOLD_VERIFIED',
      notes: 'Thermally compliant Cambro urn delivery.',
      created_at: '2026-11-21T12:00:00Z',
    },
  ],
  current_occupancy_meals: 100,
  capacity_meals: 150,
  utilization_percent: 66.7,
}

export const mockMunicipalCommandData: MunicipalCommandData = {
  city: 'Bengaluru (BBMP Municipal Zone)',
  total_meals_rescued: 295,
  total_food_kg_saved: 133.0,
  active_rescues_count: 3,
  spoilage_prevention_rate: 99.2,
  esg_co2e_total_kg: 332.5,
  active_courier_density: [
    {
      courier_id: 'c_koramangala_01',
      vehicle_type: 'EV Cargo Trike',
      lat: 12.936,
      lng: 77.622,
      status: 'IN_TRANSIT',
    },
    {
      courier_id: 'c_indiranagar_02',
      vehicle_type: 'EV Cargo Trike',
      lat: 12.973,
      lng: 77.639,
      status: 'PICKUP_ACTIVE',
    },
  ],
  ward_summaries: [
    {
      ward_name: 'Koramangala Ward 151',
      active_donors: 8,
      active_shelters: 3,
      meals_rescued: 420,
      kg_saved: 185.0,
      urgency_level: 'NORMAL',
    },
    {
      ward_name: 'Indiranagar Ward 74',
      active_donors: 12,
      active_shelters: 4,
      meals_rescued: 680,
      kg_saved: 310.5,
      urgency_level: 'ELEVATED',
    },
  ],
}

export interface MockErrorRule {
  urlPattern: string | RegExp
  status: number
  body?: any
  method?: string
}

export interface FetchMockOptions {
  autoValidate?: boolean
  errorRules?: MockErrorRule[]
}

export interface FetchCallRecord {
  url: string
  method: string
  body?: any
  response: {
    status: number
    ok: boolean
    data: any
  }
}

export let fetchCallHistory: FetchCallRecord[] = []
let activeErrorRules: MockErrorRule[] = []

export function setMockError(urlPattern: string | RegExp, status: number, body?: any, method?: string) {
  activeErrorRules.push({ urlPattern, status, body, method })
}

export function clearMockErrors() {
  activeErrorRules = []
}

export function clearFetchCallHistory() {
  fetchCallHistory = []
}

export function getFetchCallHistory(): FetchCallRecord[] {
  return fetchCallHistory
}

export function setupFetchMock(options?: FetchMockOptions) {
  fetchCallHistory = []
  activeErrorRules = options?.errorRules ? [...options.errorRules] : []
  const autoValidate = options?.autoValidate !== false

  const fetchMock = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = (init?.method || 'GET').toUpperCase()
    let body: any = null
    if (init?.body && typeof init.body === 'string') {
      try {
        body = JSON.parse(init.body)
      } catch {
        body = init.body
      }
    }

    // 1. Check dynamic error rules
    const matchedRule = activeErrorRules.find((rule) => {
      const urlMatch = typeof rule.urlPattern === 'string' ? url.includes(rule.urlPattern) : rule.urlPattern.test(url)
      const methodMatch = !rule.method || rule.method.toUpperCase() === method
      return urlMatch && methodMatch
    })

    if (matchedRule) {
      const respBody = matchedRule.body !== undefined ? matchedRule.body : { detail: 'Simulated mock error response' }
      const resp = new Response(JSON.stringify(respBody), {
        status: matchedRule.status,
        statusText: matchedRule.status === 422 ? 'Unprocessable Entity' : matchedRule.status === 400 ? 'Bad Request' : 'Error',
        headers: { 'Content-Type': 'application/json' },
      })
      fetchCallHistory.push({
        url,
        method,
        body,
        response: { status: matchedRule.status, ok: resp.ok, data: respBody },
      })
      return Promise.resolve(resp)
    }

    // 2. Built-in negative & error validation rules (autoValidate)
    if (autoValidate && url === '/api/listings' && method === 'POST') {
      if (body?.quantity_meals !== undefined && Number(body.quantity_meals) <= 0) {
        const err = { detail: [{ loc: ['body', 'quantity_meals'], msg: 'quantity_meals must be greater than 0', type: 'greater_than' }] }
        const resp = new Response(JSON.stringify(err), {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'Content-Type': 'application/json' },
        })
        fetchCallHistory.push({ url, method, body, response: { status: 422, ok: false, data: err } })
        return Promise.resolve(resp)
      }
      if (body?.quantity_kg !== undefined && Number(body.quantity_kg) <= 0) {
        const err = { detail: [{ loc: ['body', 'quantity_kg'], msg: 'quantity_kg must be greater than 0', type: 'greater_than' }] }
        const resp = new Response(JSON.stringify(err), {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'Content-Type': 'application/json' },
        })
        fetchCallHistory.push({ url, method, body, response: { status: 422, ok: false, data: err } })
        return Promise.resolve(resp)
      }
      if (body?.hours_valid !== undefined && (Number(body.hours_valid) < 0.5 || Number(body.hours_valid) > 12.0)) {
        const err = { detail: [{ loc: ['body', 'hours_valid'], msg: 'hours_valid must be between 0.5 and 12.0', type: 'value_error' }] }
        const resp = new Response(JSON.stringify(err), {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'Content-Type': 'application/json' },
        })
        fetchCallHistory.push({ url, method, body, response: { status: 422, ok: false, data: err } })
        return Promise.resolve(resp)
      }
    }

    if (autoValidate && url.includes('/claim') && method === 'POST') {
      if (url.includes('l_expired') || url.includes('expired')) {
        const err = { detail: 'Cannot claim expired food listing' }
        const resp = new Response(JSON.stringify(err), {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'Content-Type': 'application/json' },
        })
        fetchCallHistory.push({ url, method, body, response: { status: 400, ok: false, data: err } })
        return Promise.resolve(resp)
      }
      if (url.includes('/api/listings/l2/claim') || url.includes('/api/listings/l3/claim')) {
        const err = { detail: 'Cannot claim listing in status CLAIMED: already claimed by another courier' }
        const resp = new Response(JSON.stringify(err), {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'Content-Type': 'application/json' },
        })
        fetchCallHistory.push({ url, method, body, response: { status: 400, ok: false, data: err } })
        return Promise.resolve(resp)
      }
    }

    if (autoValidate && url.includes('/status') && method === 'POST') {
      const targetStatus = body?.status
      if (!targetStatus || !['COLLECTED', 'DELIVERED'].includes(targetStatus)) {
        const err = { detail: `Invalid status transition: ${targetStatus}` }
        const resp = new Response(JSON.stringify(err), {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'Content-Type': 'application/json' },
        })
        fetchCallHistory.push({ url, method, body, response: { status: 400, ok: false, data: err } })
        return Promise.resolve(resp)
      }
      if (url.includes('/api/listings/l1/status')) {
        const err = { detail: 'Cannot transition listing from POSTED directly to COLLECTED; courier claim required first' }
        const resp = new Response(JSON.stringify(err), {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'Content-Type': 'application/json' },
        })
        fetchCallHistory.push({ url, method, body, response: { status: 400, ok: false, data: err } })
        return Promise.resolve(resp)
      }
    }

    // 3. Standard successful responses
    if (url === '/api/listings') {
      if (method === 'POST') {
        const created: FoodListing = {
          ...mockListings[0],
          id: 'l_new123',
          food_name: body?.food_name || 'New Listing',
          quantity_meals: body?.quantity_meals || 50,
          quantity_kg: body?.quantity_kg || 20.0,
          status: 'POSTED',
          pickup: null,
        }
        const resp = new Response(JSON.stringify(created), { status: 201, headers: { 'Content-Type': 'application/json' } })
        fetchCallHistory.push({ url, method, body, response: { status: 201, ok: true, data: created } })
        return Promise.resolve(resp)
      }
      const resp = new Response(JSON.stringify(mockListings), { status: 200, headers: { 'Content-Type': 'application/json' } })
      fetchCallHistory.push({ url, method, body, response: { status: 200, ok: true, data: mockListings } })
      return Promise.resolve(resp)
    }

    if (url === '/api/donors') {
      const resp = new Response(JSON.stringify(mockDonors), { status: 200, headers: { 'Content-Type': 'application/json' } })
      fetchCallHistory.push({ url, method, body, response: { status: 200, ok: true, data: mockDonors } })
      return Promise.resolve(resp)
    }

    if (url === '/api/receivers') {
      const resp = new Response(JSON.stringify(mockReceivers), { status: 200, headers: { 'Content-Type': 'application/json' } })
      fetchCallHistory.push({ url, method, body, response: { status: 200, ok: true, data: mockReceivers } })
      return Promise.resolve(resp)
    }

    if (url === '/api/impact') {
      const resp = new Response(JSON.stringify(mockImpactSummary), { status: 200, headers: { 'Content-Type': 'application/json' } })
      fetchCallHistory.push({ url, method, body, response: { status: 200, ok: true, data: mockImpactSummary } })
      return Promise.resolve(resp)
    }

    if (url.startsWith('/api/matches/')) {
      const resp = new Response(JSON.stringify(mockMatchResponse), { status: 200, headers: { 'Content-Type': 'application/json' } })
      fetchCallHistory.push({ url, method, body, response: { status: 200, ok: true, data: mockMatchResponse } })
      return Promise.resolve(resp)
    }

    if (url.includes('/claim') && method === 'POST') {
      const updated = { ...mockListings[0], status: 'CLAIMED' }
      const resp = new Response(JSON.stringify(updated), { status: 200, headers: { 'Content-Type': 'application/json' } })
      fetchCallHistory.push({ url, method, body, response: { status: 200, ok: true, data: updated } })
      return Promise.resolve(resp)
    }

    if (url.includes('/status') && method === 'POST') {
      const updated = { ...mockListings[1], status: body?.status || 'COLLECTED' }
      const resp = new Response(JSON.stringify(updated), { status: 200, headers: { 'Content-Type': 'application/json' } })
      fetchCallHistory.push({ url, method, body, response: { status: 200, ok: true, data: updated } })
      return Promise.resolve(resp)
    }

    if (url.includes('/dispatch-trigger') && method === 'GET') {
      const resp = new Response(JSON.stringify(mockDispatchTriggerResponse), { status: 200, headers: { 'Content-Type': 'application/json' } })
      fetchCallHistory.push({ url, method, body, response: { status: 200, ok: true, data: mockDispatchTriggerResponse } })
      return Promise.resolve(resp)
    }

    if (url.includes('/dispatch') && method === 'POST') {
      const resp = new Response(JSON.stringify(mockDispatchTriggerResponse), { status: 200, headers: { 'Content-Type': 'application/json' } })
      fetchCallHistory.push({ url, method, body, response: { status: 200, ok: true, data: mockDispatchTriggerResponse } })
      return Promise.resolve(resp)
    }

    if (url.startsWith('/api/telemetry/') && method === 'GET') {
      const resp = new Response(JSON.stringify(mockCourierTelemetry), { status: 200, headers: { 'Content-Type': 'application/json' } })
      fetchCallHistory.push({ url, method, body, response: { status: 200, ok: true, data: mockCourierTelemetry } })
      return Promise.resolve(resp)
    }

    if (url.includes('/confirm-delivery') && method === 'POST') {
      const confirmData = {
        success: true,
        intake_id: 'in_mock123',
        listing_id: 'l2',
        status: 'DELIVERED',
        delivered_at: '2026-11-21T12:00:00Z',
        intake_verified: true,
      }
      const resp = new Response(JSON.stringify(confirmData), { status: 200, headers: { 'Content-Type': 'application/json' } })
      fetchCallHistory.push({ url, method, body, response: { status: 200, ok: true, data: confirmData } })
      return Promise.resolve(resp)
    }

    if (url.startsWith('/api/portals/donor/') && method === 'GET') {
      const resp = new Response(JSON.stringify(mockDonorPortalData), { status: 200, headers: { 'Content-Type': 'application/json' } })
      fetchCallHistory.push({ url, method, body, response: { status: 200, ok: true, data: mockDonorPortalData } })
      return Promise.resolve(resp)
    }

    if (url === '/api/portals/courier' && method === 'GET') {
      const resp = new Response(JSON.stringify(mockCourierPortalData), { status: 200, headers: { 'Content-Type': 'application/json' } })
      fetchCallHistory.push({ url, method, body, response: { status: 200, ok: true, data: mockCourierPortalData } })
      return Promise.resolve(resp)
    }

    if (url.startsWith('/api/portals/shelter/') && method === 'GET') {
      const resp = new Response(JSON.stringify(mockShelterPortalData), { status: 200, headers: { 'Content-Type': 'application/json' } })
      fetchCallHistory.push({ url, method, body, response: { status: 200, ok: true, data: mockShelterPortalData } })
      return Promise.resolve(resp)
    }

    if (url === '/api/portals/municipal' && method === 'GET') {
      const resp = new Response(JSON.stringify(mockMunicipalCommandData), { status: 200, headers: { 'Content-Type': 'application/json' } })
      fetchCallHistory.push({ url, method, body, response: { status: 200, ok: true, data: mockMunicipalCommandData } })
      return Promise.resolve(resp)
    }

    if (url.startsWith('/api/tax/80g/') && method === 'GET') {
      const resp = new Response(JSON.stringify(mockSection80GTaxSlip), { status: 200, headers: { 'Content-Type': 'application/json' } })
      fetchCallHistory.push({ url, method, body, response: { status: 200, ok: true, data: mockSection80GTaxSlip } })
      return Promise.resolve(resp)
    }

    if (url.startsWith('/api/tax/verify/') && method === 'GET') {
      const resp = new Response(JSON.stringify(mockTaxVerificationDocket), { status: 200, headers: { 'Content-Type': 'application/json' } })
      fetchCallHistory.push({ url, method, body, response: { status: 200, ok: true, data: mockTaxVerificationDocket } })
      return Promise.resolve(resp)
    }

    if (url === '/api/inspect-food') {
      const sample = (body?.sample_id || '').toLowerCase()
      const b64 = (body?.image_base64 || '').toLowerCase()
      let resultData = mockMirageResult
      if (sample.includes('spoiled') || b64.includes('spoil') || b64.includes('rot')) {
        resultData = mockMirageSpoiledCurry
      } else if (sample.includes('expired') || b64.includes('expired') || b64.includes('danger')) {
        resultData = mockMirageExpiredRice
      } else if (sample === 'fresh_biryani') {
        resultData = mockMirageFreshBiryani
      } else {
        resultData = mockMirageResult
      }
      const resp = new Response(JSON.stringify(resultData), { status: 200, headers: { 'Content-Type': 'application/json' } })
      fetchCallHistory.push({ url, method, body, response: { status: 200, ok: true, data: resultData } })
      return Promise.resolve(resp)
    }

    const resp = new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    fetchCallHistory.push({ url, method, body, response: { status: 200, ok: true, data: {} } })
    return Promise.resolve(resp)
  }

  // Assign to globalThis.fetch
  globalThis.fetch = fetchMock as any
}
