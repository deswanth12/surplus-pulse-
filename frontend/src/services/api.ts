import {
  FoodListing,
  Donor,
  Receiver,
  ImpactSummary,
  MirageInspectionResult,
  SmartMatchResponse,
  DispatchTriggerResponse,
  DeliveryConfirmationPayload,
  DeliveryConfirmationResponse,
} from "../types";

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// In-memory TTL query cache and in-flight Promise deduplication registry
const queryCache = new Map<string, CacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();
let lastFetchRef: typeof globalThis.fetch | null = null;

/**
 * Clear the in-memory API query cache and pending in-flight requests.
 * Useful for tests and cache invalidation after data mutations.
 */
export function clearApiCache(): void {
  queryCache.clear();
  inFlightRequests.clear();
}

const DEMO_API_KEY =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SURPLUSPULSE_API_KEY) ||
  "surpluspulse-demo-key-2026";

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const customHeaders: Record<string, string> = {
    "X-API-Key": DEMO_API_KEY,
    "Authorization": `Bearer ${DEMO_API_KEY}`,
  };
  if (options?.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((val, key) => {
        customHeaders[key] = val;
      });
    } else if (Array.isArray(options.headers)) {
      options.headers.forEach(([key, val]) => {
        customHeaders[key] = val;
      });
    } else {
      Object.assign(customHeaders, options.headers);
    }
  }

  const res = await fetch(endpoint, {
    ...options,
    headers: customHeaders,
  });
  if (!res.ok) {
    let errorDetail = `API Error (${res.status}): ${res.statusText || "Request failed"}`;
    let errorData: any = null;
    try {
      errorData = await res.json();
      if (errorData?.detail) {
        errorDetail =
          typeof errorData.detail === "string"
            ? errorData.detail
            : JSON.stringify(errorData.detail);
      }
    } catch {
      // Response body is not JSON
    }
    throw new ApiError(errorDetail, res.status, errorData);
  }
  return res.json();
}

/**
 * Execute request with TTL query caching and in-flight request deduplication.
 * Non-GET methods bypass and invalidate the cache.
 * Automatically clears cache when globalThis.fetch changes (test isolation).
 */
async function cachedRequest<T>(
  endpoint: string,
  options?: RequestInit,
  ttlMs: number = 30000
): Promise<T> {
  // Test isolation: if fetch reference changed, clear stale cache immediately
  if (globalThis.fetch !== lastFetchRef) {
    clearApiCache();
    lastFetchRef = globalThis.fetch;
  }

  const method = (options?.method || "GET").toUpperCase();
  if (method !== "GET") {
    clearApiCache();
    return request<T>(endpoint, options);
  }

  const now = Date.now();
  const cached = queryCache.get(endpoint);
  if (cached && now < cached.expiresAt) {
    return JSON.parse(JSON.stringify(cached.data));
  }

  if (inFlightRequests.has(endpoint)) {
    return inFlightRequests.get(endpoint)!;
  }

  const fetchPromise = (async () => {
    try {
      const data = await request<T>(endpoint, options);
      queryCache.set(endpoint, {
        data,
        expiresAt: Date.now() + ttlMs,
      });
      return data;
    } finally {
      inFlightRequests.delete(endpoint);
    }
  })();

  inFlightRequests.set(endpoint, fetchPromise);
  return fetchPromise;
}

/**
 * Fetch all food listings with optional status filter.
 * Safely handles non-array responses by defaulting to an empty array.
 */
export async function getListings(status?: string): Promise<FoodListing[]> {
  const query = status && status !== "ALL" ? `?status=${encodeURIComponent(status)}` : "";
  const data = await cachedRequest<FoodListing[]>(`/api/listings${query}`);
  if (!Array.isArray(data)) {
    return [];
  }
  return data;
}

/**
 * Fetch all registered donors.
 */
export async function getDonors(): Promise<Donor[]> {
  const data = await cachedRequest<Donor[]>("/api/donors");
  return Array.isArray(data) ? data : [];
}

/**
 * Fetch all certified receivers/shelters.
 */
export async function getReceivers(): Promise<Receiver[]> {
  const data = await cachedRequest<Receiver[]>("/api/receivers");
  return Array.isArray(data) ? data : [];
}

/**
 * Fetch aggregated environmental and economic impact summary.
 */
export async function getImpact(): Promise<ImpactSummary> {
  return cachedRequest<ImpactSummary>("/api/impact");
}

/**
 * Trigger Mirage 22MB VLM food quality inspection.
 */
export async function inspectFood(data: {
  image_base64?: string;
  sample_id?: string;
}): Promise<MirageInspectionResult> {
  return request<MirageInspectionResult>("/api/inspect-food", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

/**
 * Get ranked Haversine proximity shelter matches for a listing.
 */
export async function getMatches(listingId: string): Promise<SmartMatchResponse> {
  return cachedRequest<SmartMatchResponse>(`/api/matches/${encodeURIComponent(listingId)}`);
}

/**
 * Claim a listing for courier dispatch.
 */
export async function claimListing(
  listingId: string,
  payload: {
    receiver_id: string;
    volunteer_name: string;
    volunteer_phone: string;
    vehicle_type: string;
  }
): Promise<FoodListing> {
  clearApiCache();
  return request<FoodListing>(`/api/listings/${encodeURIComponent(listingId)}/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/**
 * Transition the status of an in-flight listing (e.g. COLLECTED or DELIVERED).
 */
export async function updateListingStatus(
  listingId: string,
  payload: {
    status: string;
    notes?: string;
  }
): Promise<FoodListing> {
  clearApiCache();
  return request<FoodListing>(`/api/listings/${encodeURIComponent(listingId)}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/**
 * Create a new emergency food salvage listing (Form 68-A).
 */
export async function createListing(payload: Partial<FoodListing> | any): Promise<FoodListing> {
  clearApiCache();
  return request<FoodListing>("/api/listings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/**
 * Seed or reset the database demo state.
 */
export async function seedDatabase(
  force: boolean = true
): Promise<{ message: string; counts: Record<string, number> }> {
  clearApiCache();
  return request<{ message: string; counts: Record<string, number> }>(
    `/api/seed?force=${force}`,
    {
      method: "POST",
    }
  );
}

/**
 * Dispatch courier to claim a food listing atomically and generate WhatsApp / SMS triggers.
 */
export async function dispatchListing(
  listingId: string,
  payload: {
    volunteer_name: string;
    volunteer_phone: string;
    vehicle_type: string;
    receiver_id?: string;
    notes?: string;
  }
): Promise<DispatchTriggerResponse> {
  clearApiCache();
  return request<DispatchTriggerResponse>(
    `/api/listings/${encodeURIComponent(listingId)}/dispatch`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
}

/**
 * Confirm food delivery at receiving shelter and log verified shelter intake.
 */
export async function confirmDelivery(
  listingId: string,
  payload: DeliveryConfirmationPayload
): Promise<DeliveryConfirmationResponse> {
  clearApiCache();
  return request<DeliveryConfirmationResponse>(
    `/api/listings/${encodeURIComponent(listingId)}/confirm-delivery`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
}

/**
 * Format standard WhatsApp deep-link URL.
 */
export function formatWhatsAppDispatchLink(phone: string, text: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  const cleanPhone = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

/**
 * Format standard SMS trigger URI.
 */
export function formatSmsDispatchLink(phone: string, text: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  const cleanPhone = digits.length === 10 ? `91${digits}` : digits;
  return `sms:${cleanPhone}?body=${encodeURIComponent(text)}`;
}

/**
 * Generate formatted mission dispatch brief text with coordinates, urn count, and SCW.
 */
export function generateDispatchBriefText(params: {
  listingId: string;
  foodName: string;
  quantityKg: number;
  quantityMeals: number;
  donorName: string;
  donorAddress: string;
  donorPhone?: string;
  donorCoordinates?: { lat: number; lng: number };
  shelterName: string;
  shelterAddress: string;
  shelterPhone?: string;
  scwMinutesRemaining: number;
  vehicleType?: string;
}): string {
  const urnCount = Math.max(1, Math.ceil(params.quantityKg / 18.0));
  const latStr = params.donorCoordinates ? params.donorCoordinates.lat.toFixed(4) : "12.9716";
  const lngStr = params.donorCoordinates ? params.donorCoordinates.lng.toFixed(4) : "77.6412";

  return (
    `🚨 *SURPLUSPULSE RESCUE MISSION DISPATCH* 🚨\n` +
    `Mission ID: ${params.listingId}\n` +
    `Food: ${params.foodName} (${params.quantityKg} kg | ~${params.quantityMeals} meals)\n` +
    `Payload: ${urnCount} Cambro Insulated Urn(s) (18kg capacity each)\n\n` +
    `📍 *PICKUP LOCATION*:\n` +
    `Donor: ${params.donorName}\n` +
    `Address: ${params.donorAddress}\n` +
    `GPS Coordinates: ${latStr}, ${lngStr}\n` +
    `Donor Phone: ${params.donorPhone || "+91 98450 11234"}\n\n` +
    `🎯 *DESTINATION SHELTER*:\n` +
    `Shelter: ${params.shelterName}\n` +
    `Address: ${params.shelterAddress}\n` +
    `Shelter Contact: ${params.shelterPhone || "+91 98200 44556"}\n\n` +
    `⏱️ *SAFE CONSUMPTION WINDOW (SCW)*:\n` +
    `${Math.max(0, params.scwMinutesRemaining)} minutes remaining before bacterial proliferation window.\n` +
    `Assigned Transport: ${params.vehicleType || "EV Cargo Trike"}\n` +
    `Action: Confirm pickup immediately via SurplusPulse.`
  );
}


