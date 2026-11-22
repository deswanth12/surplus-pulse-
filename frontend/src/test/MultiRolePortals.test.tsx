import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "../App";
import { DonorPortal } from "../components/portals/DonorPortal";
import { CourierPortal, calculateUrnCount } from "../components/portals/CourierPortal";
import { ShelterPortal } from "../components/portals/ShelterPortal";
import { MunicipalCommand } from "../components/portals/MunicipalCommand";
import {
  mockDonors,
  mockReceivers,
  mockListings,
  mockImpactSummary,
  setupFetchMock,
  clearMockErrors,
} from "./test-mocks";

describe("Milestone 3: Multi-Role Portals Integration & Navigation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearMockErrors();
    setupFetchMock();
  });

  describe("DonorPortal Component", () => {
    it("renders donor kitchen details, FSSAI registration, and hygiene compliance metrics", () => {
      const handleOpenPostModal = vi.fn();
      const handleOpenCertificate = vi.fn();

      render(
        <DonorPortal
          donors={mockDonors}
          listings={mockListings}
          onOpenPostModal={handleOpenPostModal}
          onOpenCertificate={handleOpenCertificate}
        />
      );

      // Verify portal header & donor entity
      expect(screen.getByText(/DONOR KITCHEN OPERATIONS PORTAL/i)).toBeInTheDocument();
      expect(screen.getByText(/The Grand Amber Banquet Hall/i)).toBeInTheDocument();
      expect(screen.getByText(/FSSAI REG #11224334000189/i)).toBeInTheDocument();

      // Verify hygiene rating & Cambro thermal holding metrics
      expect(screen.getByText(/FSSAI HYGIENE RATING/i)).toBeInTheDocument();
      expect(screen.getByText(/98.5%/i)).toBeInTheDocument();
      expect(screen.getByText(/GRADE A PRIME/i)).toBeInTheDocument();
      expect(screen.getByText(/CAMBRO THERMAL LOGS/i)).toBeInTheDocument();
      expect(screen.getByText(/HOT HOLD >65°C/i)).toBeInTheDocument();
      expect(screen.getByText(/ZERO-WASTE STREAK/i)).toBeInTheDocument();

      // Quick Post Surplus Batch button
      const postBtns = screen.getAllByRole("button", { name: /Quick Post Surplus Batch/i });
      expect(postBtns.length).toBeGreaterThanOrEqual(1);
      fireEvent.click(postBtns[0]);
      expect(handleOpenPostModal).toHaveBeenCalledTimes(1);

      // Section 80G Tax slips action
      const taxCertBtns = screen.getAllByRole("button", { name: /View Section 80G Tax Slip/i });
      expect(taxCertBtns.length).toBeGreaterThanOrEqual(1);
      fireEvent.click(taxCertBtns[0]);
      expect(handleOpenCertificate).toHaveBeenCalled();
    });
  });

  describe("CourierPortal Component", () => {
    it("calculates urn containers accurately based on 18 kg payload threshold", () => {
      expect(calculateUrnCount(0)).toBe(0);
      expect(calculateUrnCount(10)).toBe(1);
      expect(calculateUrnCount(18)).toBe(1);
      expect(calculateUrnCount(19)).toBe(2);
      expect(calculateUrnCount(55)).toBe(4);
    });

    it("renders EV Cargo Trike HUD, live telemetry meters, and 1-Click WhatsApp/SMS dispatch links", () => {
      const handleAdvanceStatus = vi.fn();
      const handleTrackDelivery = vi.fn();

      render(
        <CourierPortal
          listings={mockListings}
          receivers={mockReceivers}
          onAdvanceStatus={handleAdvanceStatus}
          onTrackDelivery={handleTrackDelivery}
        />
      );

      // Verify corridor header
      expect(screen.getByText(/VOLUNTEER COURIER FLEET WORKSPACE/i)).toBeInTheDocument();
      expect(screen.getByText(/Volunteer Courier Fleet View/i)).toBeInTheDocument();

      // Verify EV Cargo Trike Telemetry HUD meters
      expect(screen.getByText(/EV CARGO TRIKE LIVE TELEMETRY HUD/i)).toBeInTheDocument();
      expect(screen.getByText(/VELOCITY/i)).toBeInTheDocument();
      expect(screen.getByText(/28.4 km\/h/i)).toBeInTheDocument();
      expect(screen.getByText(/BATTERY \(LiFePO4\)/i)).toBeInTheDocument();
      expect(screen.getByText(/⚡ REGEN ACTIVE/i)).toBeInTheDocument();
      expect(screen.getByText(/CAMBRO THERMAL CORE/i)).toBeInTheDocument();

      // Verify mission cards & 1-Click dispatch links
      const waLinks = screen.getAllByText(/1-Click WhatsApp Dispatch/i);
      expect(waLinks.length).toBeGreaterThanOrEqual(1);
      const smsLinks = screen.getAllByText(/SMS/i);
      expect(smsLinks.length).toBeGreaterThanOrEqual(1);

      // Verify routing details
      expect(screen.getByText(/Available & Active Rescue Missions/i)).toBeInTheDocument();
    });
  });

  describe("ShelterPortal Component", () => {
    it("renders shelter capacity bars, incoming shipments, and thermal triage arrival checklist", () => {
      const handleConfirmDelivery = vi.fn();
      const handleAdvanceStatus = vi.fn();

      render(
        <ShelterPortal
          receivers={mockReceivers}
          listings={mockListings}
          onConfirmDelivery={handleConfirmDelivery}
          onAdvanceStatus={handleAdvanceStatus}
        />
      );

      // Verify Shelter Portal header
      expect(screen.getByText(/CERTIFIED BENEFICIARY RELIEF PORTAL/i)).toBeInTheDocument();
      expect(screen.getByText(/Shelter Intake & Beneficiary Board/i)).toBeInTheDocument();

      // Verify capacity utilization bars
      expect(screen.getAllByText(/CAPACITY REMAINING:/i).length).toBeGreaterThanOrEqual(1);

      // Verify incoming shipments en route
      expect(screen.getByText(/Incoming Shipments En Route/i)).toBeInTheDocument();

      // Verify thermal triage arrival checklist (>65°C / <4°C requirement)
      expect(screen.getByText(/Thermal Triage Arrival Checklist/i)).toBeInTheDocument();
      expect(screen.getByText(/>65.0°C Core Hold/i)).toBeInTheDocument();
      expect(screen.getByText(/<4.0°C Chilled/i)).toBeInTheDocument();
    });
  });

  describe("MunicipalCommand Component", () => {
    it("renders city-wide macro overview KPI cards and BBMP ward matrix table", () => {
      render(
        <MunicipalCommand
          listings={mockListings}
          impact={mockImpactSummary}
          donors={mockDonors}
          receivers={mockReceivers}
        />
      );

      // Verify Municipal Command Header
      expect(screen.getByText(/CIVIC GOVERNANCE & MUNICIPAL OPERATIONS/i)).toBeInTheDocument();
      expect(screen.getByText(/BBMP BRUHAT BENGALURU MAHANAGARA PALIKE/i)).toBeInTheDocument();
      expect(screen.getByText(/Municipal Command Center • Bengaluru Relief Matrix/i)).toBeInTheDocument();

      // 4 Core KPI cards
      expect(screen.getByText(/ACTIVE SALVAGING THROUGHPUT/i)).toBeInTheDocument();
      expect(screen.getByText(/COURIER FLEET DENSITY/i)).toBeInTheDocument();
      expect(screen.getByText(/8 TRIKES/i)).toBeInTheDocument();
      expect(screen.getByText(/SPOILAGE PREVENTION RATE/i)).toBeInTheDocument();
      expect(screen.getByText(/BIO-COMPOST DIVERSION/i)).toBeInTheDocument();
      expect(screen.getByText(/2 BATCHES/i)).toBeInTheDocument();

      // Ward matrix table
      expect(screen.getByText(/Bengaluru Municipal Ward Salvaging Matrix/i)).toBeInTheDocument();
      expect(screen.getByText(/Koramangala Ward 151/i)).toBeInTheDocument();
      expect(screen.getByText(/Indiranagar Ward 74/i)).toBeInTheDocument();
      expect(screen.getByText(/HSR Layout Ward 174/i)).toBeInTheDocument();
      expect(screen.getByText(/Whitefield Ward 84/i)).toBeInTheDocument();
      expect(screen.getByText(/Malleshwaram Ward 65/i)).toBeInTheDocument();
    });
  });

  describe("Header Role Switcher & App Navigation Integration", () => {
    it("switches roles cleanly via Header role buttons and preserves full backward compatibility", async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("SURPLUSPULSE")).toBeInTheDocument();
      });

      // Role Switcher buttons exist in Header
      const allOpsBtn = screen.getByRole("button", { name: /All Operations/i });
      const donorBtn = screen.getByRole("button", { name: /Donor Kitchen/i });
      const courierBtn = screen.getByRole("button", { name: /Volunteer Courier/i });
      const shelterBtn = screen.getByRole("button", { name: /Shelter Intake/i });
      const municipalBtn = screen.getByRole("button", { name: /Municipal Command/i });

      expect(allOpsBtn).toBeInTheDocument();
      expect(donorBtn).toBeInTheDocument();
      expect(courierBtn).toBeInTheDocument();
      expect(shelterBtn).toBeInTheDocument();
      expect(municipalBtn).toBeInTheDocument();

      // Switch to Donor Kitchen
      fireEvent.click(donorBtn);
      await waitFor(() => {
        expect(screen.getByText(/DONOR KITCHEN OPERATIONS PORTAL/i)).toBeInTheDocument();
      });

      // Switch to Volunteer Courier
      fireEvent.click(courierBtn);
      await waitFor(() => {
        expect(screen.getByText(/VOLUNTEER COURIER FLEET WORKSPACE/i)).toBeInTheDocument();
      });

      // Switch to Shelter Intake
      fireEvent.click(shelterBtn);
      await waitFor(() => {
        expect(screen.getByText(/CERTIFIED BENEFICIARY RELIEF PORTAL/i)).toBeInTheDocument();
      });

      // Switch to Municipal Command
      fireEvent.click(municipalBtn);
      await waitFor(() => {
        expect(screen.getByText(/BBMP BRUHAT BENGALURU MAHANAGARA PALIKE/i)).toBeInTheDocument();
      });

      // Backward compatibility: Clicking [1] RESCUE RADAR resets role to ALL and returns to tab 1
      const radarTabBtn = screen.getByRole("button", { name: /\[1\] RESCUE RADAR/i });
      fireEvent.click(radarTabBtn);

      await waitFor(() => {
        expect(screen.getByText(/RESCUED TO DATE/i)).toBeInTheDocument();
      });

      // Verify all 4 standard tabs remain accessible
      expect(screen.getByRole("button", { name: /\[1\] RESCUE RADAR/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /\[2\] HOLOGRAPHIC DISPATCH MATRIX/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /\[3\] QUANTUM ESG & (CARBON LEDGER|COMPTOMETER)/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /\[4\] HYGIENE PROTOCOL DIRECTIVES/i })).toBeInTheDocument();
    });
  });
});
