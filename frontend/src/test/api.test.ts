import { describe, it, expect, beforeEach } from "vitest";
import {
  ApiError,
  getListings,
  getDonors,
  getReceivers,
  getImpact,
  inspectFood,
  getMatches,
  claimListing,
  updateListingStatus,
  createListing,
  seedDatabase,
} from "../services/api";
import { setupFetchMock, setMockError, clearMockErrors } from "./test-mocks";

describe("Typed Centralized API Service (src/services/api.ts)", () => {
  beforeEach(() => {
    clearMockErrors();
    setupFetchMock();
  });

  it("successfully retrieves listings, donors, receivers, and impact", async () => {
    const listings = await getListings();
    expect(Array.isArray(listings)).toBe(true);
    expect(listings.length).toBeGreaterThan(0);
    expect(listings[0].id).toBe("l1");

    const donors = await getDonors();
    expect(Array.isArray(donors)).toBe(true);
    expect(donors[0].name).toContain("Grand Amber");

    const receivers = await getReceivers();
    expect(Array.isArray(receivers)).toBe(true);
    expect(receivers[0].name).toContain("Robin Hood");

    const impact = await getImpact();
    expect(impact.total_meals_rescued).toBe(280);
    expect(impact.total_food_kg_saved).toBe(133.0);
  });

  it("safely handles non-array responses in getListings, preventing filter crashes", async () => {
    // Override fetch to return an object instead of array (simulating error payload)
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({ detail: "Database locked" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    const listings = await getListings();
    expect(Array.isArray(listings)).toBe(true);
    expect(listings).toEqual([]);
    // Ensure filter does not crash
    expect(listings.filter((l) => l.status === "POSTED")).toEqual([]);
  });

  it("throws ApiError when server returns HTTP 400, 422, or 500 error", async () => {
    setMockError("/api/listings", 422, { detail: "Invalid status query" }, "GET");

    await expect(getListings("INVALID_STATUS")).rejects.toThrow(ApiError);

    try {
      await getListings("INVALID_STATUS");
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(422);
      expect(err.message).toContain("Invalid status query");
    }
  });

  it("inspects food using Mirage 22MB VLM endpoint", async () => {
    const result = await inspectFood({ sample_id: "biryani" });
    expect(result.success).toBe(true);
    expect(result.mirage_engine.model_name).toContain("Mirage");
    expect(result.food_inspection.quality_score).toBeGreaterThanOrEqual(95.0);
  });

  it("fetches ranked smart matches for a listing", async () => {
    const matchData = await getMatches("l1");
    expect(matchData.listing_id).toBe("l1");
    expect(matchData.matches.length).toBeGreaterThanOrEqual(1);
    expect(matchData.matches[0].match_fit).toBe("EXCELLENT");
  });

  it("claims a listing with courier details", async () => {
    const claimed = await claimListing("l1", {
      receiver_id: "r1",
      volunteer_name: "Vikram Adiga",
      volunteer_phone: "+91 99112 33445",
      vehicle_type: "Two-Wheeler Cargo",
    });
    expect(claimed.status).toBe("CLAIMED");
  });

  it("advances status to COLLECTED or DELIVERED", async () => {
    const updated = await updateListingStatus("l2", { status: "COLLECTED" });
    expect(updated.status).toBe("COLLECTED");
  });

  it("creates a new emergency food salvage listing", async () => {
    const created = await createListing({
      donor_id: "d1",
      food_name: "Hot Sambar Rice",
      food_category: "VEG",
      quantity_meals: 75,
      quantity_kg: 32.0,
      storage_type: "HOT",
      allergens: "Mustard",
      hours_valid: 3.5,
    });
    expect(created.id).toBe("l_new123");
    expect(created.status).toBe("POSTED");
  });

  it("seeds or resets the database state", async () => {
    const res = await seedDatabase(true);
    expect(res).toBeDefined();
  });
});
