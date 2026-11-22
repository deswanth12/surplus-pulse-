import { useState, useCallback, useEffect } from "react";
import {
  FoodListing,
  Donor,
  Receiver,
  ImpactSummary,
  FoodListingFormData,
  SmartMatchResponse,
} from "../types";
import * as api from "../services/api";

export interface UseSurplusDataOptions {
  onToast?: (
    message: string,
    type?: "DISPATCH" | "SUCCESS" | "VERIFIED" | "SCAN" | "ERROR"
  ) => void;
}

export function useSurplusData(options: UseSurplusDataOptions = {}) {
  const { onToast } = options;

  const [listings, setListings] = useState<FoodListing[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [receivers, setReceivers] = useState<Receiver[]>([]);
  const [impact, setImpact] = useState<ImpactSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [advancingListingId, setAdvancingListingId] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  // Initial full load (fetches all static and dynamic master data)
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [lRes, dRes, rRes, iRes] = await Promise.all([
        api.getListings(),
        api.getDonors(),
        api.getReceivers(),
        api.getImpact(),
      ]);
      setListings(Array.isArray(lRes) ? lRes : []);
      setDonors(Array.isArray(dRes) ? dRes : []);
      setReceivers(Array.isArray(rRes) ? rRes : []);
      setImpact(iRes || null);
    } catch (err: any) {
      console.error("Data fetch error:", err);
      // Fallback to empty array to prevent fatal crashes
      setListings([]);
      onToast?.(
        `TELEGRAPH SYNC FAILED: ${err?.message || "Check connection"}`,
        "ERROR"
      );
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  // Targeted refresh: refreshes dynamic listings and impact without re-fetching static donors and receivers
  const refreshTargeted = useCallback(async () => {
    try {
      const [lRes, iRes] = await Promise.all([
        api.getListings(),
        api.getImpact(),
      ]);
      setListings(Array.isArray(lRes) ? lRes : []);
      setImpact(iRes || null);
    } catch (err: any) {
      console.error("Targeted refresh error:", err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Submit Courier Claim and perform targeted refresh
  const handleConfirmClaim = useCallback(
    async (
      listingId: string,
      payload: {
        receiver_id: string;
        volunteer_name: string;
        volunteer_phone: string;
        vehicle_type: string;
      },
      matchData?: SmartMatchResponse | null
    ) => {
      const selectedMatch = matchData?.matches.find(
        (m) => m.receiver_id === payload.receiver_id
      );
      const receiverName =
        selectedMatch?.receiver_name?.toUpperCase() || "BENEFICIARY HUB";
      const sector = receiverName.includes("INDIRANAGAR")
        ? "INDIRANAGAR"
        : receiverName.includes("KORAMANGALA")
        ? "KORAMANGALA"
        : receiverName.includes("WHITEFIELD")
        ? "WHITEFIELD"
        : receiverName;

      await api.claimListing(listingId, payload);
      await refreshTargeted();
      onToast?.(
        `COURIER ASSIGNED • DISPATCH ROUTE ACTIVE TO ${sector}`,
        "SUCCESS"
      );
    },
    [refreshTargeted, onToast]
  );

  // Advance Status (COLLECTED or DELIVERED) and perform targeted refresh
  const handleAdvanceStatus = useCallback(
    async (
      listingId: string,
      nextStatus: "COLLECTED" | "DELIVERED",
      onSuccess?: (updated: FoodListing) => void
    ) => {
      setAdvancingListingId(listingId);
      try {
        const updated = await api.updateListingStatus(listingId, {
          status: nextStatus,
        });
        await refreshTargeted();
        onSuccess?.(updated);
        if (nextStatus === "COLLECTED") {
          onToast?.(
            "FOOD RATION COLLECTED • THERMAL PRESERVATION PROTOCOL ACTIVE",
            "VERIFIED"
          );
        } else {
          onToast?.(
            "RELIEF DELIVERED TO SHELTER BENEFICIARIES • CIVIC AUDIT COMPLETED",
            "SUCCESS"
          );
        }
        return updated;
      } catch (err: any) {
        onToast?.(
          `STATUS UPDATE FAILED: ${err?.message || "Transition rejected"}`,
          "ERROR"
        );
        return null;
      } finally {
        setAdvancingListingId(null);
      }
    },
    [refreshTargeted, onToast]
  );

  // Submit New Emergency Food Listing (Form 68-A) and perform targeted refresh
  const handleCreateListing = useCallback(
    async (formData: FoodListingFormData) => {
      try {
        const created = await api.createListing(formData);
        await refreshTargeted();
        onToast?.(
          "FORM 68-A TRANSMITTED • SURPLUS BROADCAST TO METRO DISPATCH SECTOR",
          "DISPATCH"
        );
        return created;
      } catch (err: any) {
        onToast?.(
          `LISTING CREATION FAILED: ${err?.message || err}`,
          "ERROR"
        );
        throw err;
      }
    },
    [refreshTargeted, onToast]
  );

  // Reset demo registry (seeds DB and triggers full reload)
  const handleResetRegistry = useCallback(
    async (onSuccess?: () => void) => {
      setIsResetting(true);
      try {
        await api.seedDatabase(true);
        await loadData();
        onSuccess?.();
        onToast?.(
          "MUNICIPAL REGISTRY RE-INITIALIZED • DEMO SCENARIO RESTORED",
          "VERIFIED"
        );
      } catch (err: any) {
        onToast?.(
          `REGISTRY RESET FAILED: ${err?.message || "Server error"}`,
          "ERROR"
        );
      } finally {
        setIsResetting(false);
      }
    },
    [loadData, onToast]
  );

  return {
    listings,
    setListings,
    donors,
    receivers,
    impact,
    loading,
    advancingListingId,
    isResetting,
    loadData,
    refreshTargeted,
    handleConfirmClaim,
    handleAdvanceStatus,
    handleCreateListing,
    handleResetRegistry,
  };
}
