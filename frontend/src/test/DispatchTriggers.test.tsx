import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import * as api from "../services/api";
import { DocketCard } from "../components/DocketCard";
import { MatchModal } from "../components/modals/MatchModal";
import { LiveDeliveryTracker } from "../components/modals/LiveDeliveryTracker";
import { DispatchCartDrawer } from "../components/modals/DispatchCartDrawer";
import {
  mockListings,
  mockMatchResponse,
  setupFetchMock,
  fetchCallHistory,
  clearMockErrors,
} from "./test-mocks";

describe("1-Click WhatsApp & SMS Dispatch Triggers Journey", () => {
  beforeEach(() => {
    clearMockErrors();
    setupFetchMock();
    vi.restoreAllMocks();
  });

  it("formats WhatsApp deep link with pickup GPS, container urn count, destination, and SCW minutes", () => {
    const brief = api.generateDispatchBriefText({
      listingId: "l1",
      foodName: "Royal Hyderabadi Veg Pulao & Paneer Makhani",
      quantityKg: 55.0,
      quantityMeals: 120,
      donorName: "The Grand Amber Banquet Hall",
      donorAddress: "100 Feet Rd, Indiranagar",
      donorPhone: "+91 98450 11234",
      donorCoordinates: { lat: 12.9716, lng: 77.6412 },
      shelterName: "Robin Hood Army - Indiranagar Hub",
      shelterAddress: "Double Road, Indiranagar",
      shelterPhone: "+91 98200 44556",
      scwMinutesRemaining: 150,
      vehicleType: "EV Cargo Trike",
    });

    expect(brief).toContain("SURPLUSPULSE RESCUE MISSION DISPATCH");
    expect(brief).toContain("Payload: 4 Cambro Insulated Urn(s)"); // Math.ceil(55/18) = 4
    expect(brief).toContain("GPS Coordinates: 12.9716, 77.6412");
    expect(brief).toContain("Shelter: Robin Hood Army - Indiranagar Hub");
    expect(brief).toContain("150 minutes remaining");

    const waLink = api.formatWhatsAppDispatchLink("+91 99112 33445", brief);
    expect(waLink).toMatch(/^https:\/\/wa\.me\/919911233445\?text=/);
    expect(decodeURIComponent(waLink)).toContain("GPS Coordinates: 12.9716, 77.6412");
    expect(decodeURIComponent(waLink)).toContain("4 Cambro Insulated Urn(s)");
  });

  it("formats SMS trigger URI with recipient phone and encoded brief", () => {
    const brief = api.generateDispatchBriefText({
      listingId: "l1",
      foodName: "Vegetable Dum Pulao",
      quantityKg: 36.0,
      quantityMeals: 80,
      donorName: "TechPark Central Food Court",
      donorAddress: "EPIP Zone, Whitefield",
      shelterName: "City Hope Shelter",
      shelterAddress: "Koramangala 4th Block",
      scwMinutesRemaining: 120,
    });

    const smsUri = api.formatSmsDispatchLink("+91 98860 55678", brief);
    expect(smsUri).toMatch(/^sms:919886055678\?body=/);
    expect(decodeURIComponent(smsUri)).toContain("Payload: 2 Cambro Insulated Urn(s)"); // Math.ceil(36/18) = 2
  });

  it("renders 1-Click WhatsApp and SMS buttons on posted docket cards and triggers atomic claim", async () => {
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const postedListing = { ...mockListings[0], status: "POSTED" };

    render(
      <DocketCard
        listing={postedListing}
        onOpenSmartMatch={() => {}}
        onAdvanceStatus={() => {}}
      />
    );

    // Verify buttons are rendered
    const waBtn = screen.getByRole("button", { name: /1-Click WhatsApp Dispatch/i });
    const smsBtn = screen.getByRole("button", { name: /SMS Dispatch Alert/i });
    expect(waBtn).toBeInTheDocument();
    expect(smsBtn).toBeInTheDocument();

    // Click WhatsApp Dispatch button
    fireEvent.click(waBtn);

    await waitFor(() => {
      // Verify dispatch API was invoked to lock assignment atomically
      const dispatchCall = fetchCallHistory.find(
        (c) => c.url.includes("/dispatch") && c.method === "POST"
      );
      expect(dispatchCall).toBeDefined();
    });

    // Verify window.open was called with formatted wa.me link
    await waitFor(() => {
      expect(windowOpenSpy).toHaveBeenCalled();
      const calledUrl = windowOpenSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain("wa.me");
    });
  });

  it("provides 1-Click WhatsApp dispatch option in MatchModal when assigning courier", async () => {
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const onConfirmClaim = vi.fn().mockResolvedValue(undefined);

    render(
      <MatchModal
        isOpen={true}
        onClose={() => {}}
        matchData={mockMatchResponse}
        selectedReceiverId="r1"
        setSelectedReceiverId={() => {}}
        onConfirmClaim={onConfirmClaim}
      />
    );

    // Verify WhatsApp button is rendered
    const waClaimBtn = screen.getByRole("button", { name: /WhatsApp Dispatch and Claim/i });
    expect(waClaimBtn).toBeInTheDocument();

    // Click WhatsApp dispatch and claim
    fireEvent.click(waClaimBtn);

    await waitFor(() => {
      expect(onConfirmClaim).toHaveBeenCalledWith(
        expect.objectContaining({
          receiver_id: "r1",
          vehicle_type: expect.any(String),
        })
      );
      expect(windowOpenSpy).toHaveBeenCalled();
    });
  });

  it("renders WhatsApp and SMS communication triggers beside CALL COURIER in LiveDeliveryTracker", () => {
    render(
      <LiveDeliveryTracker
        isOpen={true}
        onClose={() => {}}
        listing={mockListings[1]} // CLAIMED listing
        onAdvanceStatus={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText(/CALL COURIER/i)).toBeInTheDocument();
    const waLink = screen.getByRole("link", { name: /WhatsApp Courier/i });
    const smsLink = screen.getByRole("link", { name: /SMS Courier/i });

    expect(waLink).toBeInTheDocument();
    expect(waLink).toHaveAttribute("href");
    expect(waLink.getAttribute("href")).toContain("wa.me");

    expect(smsLink).toBeInTheDocument();
    expect(smsLink).toHaveAttribute("href");
    expect(smsLink.getAttribute("href")).toContain("sms:");
  });

  it("renders WhatsApp corridor dispatch trigger for active missions in DispatchCartDrawer", () => {
    render(
      <DispatchCartDrawer
        isOpen={true}
        onToggle={() => {}}
        listings={mockListings} // contains CLAIMED and COLLECTED
        onTrackListing={() => {}}
        onOpenSmartMatch={() => {}}
      />
    );

    const waTriggers = screen.getAllByRole("link", { name: /WhatsApp courier for/i });
    expect(waTriggers.length).toBeGreaterThanOrEqual(1);
    expect(waTriggers[0].getAttribute("href")).toContain("wa.me");
  });
});
