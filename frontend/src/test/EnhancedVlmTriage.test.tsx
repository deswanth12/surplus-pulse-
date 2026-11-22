import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MirageModal } from "../components/modals/MirageModal";
import App from "../App";
import {
  mockMirageFreshBiryani,
  mockMirageSpoiledCurry,
  setupFetchMock,
  clearMockErrors,
} from "./test-mocks";

describe("Milestone 3: Enhanced Edge VLM / SLM Intelligence & FLIR Thermography UI", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearMockErrors();
    setupFetchMock();
  });

  describe("Visual Mode Switcher & Simulated FLIR Thermography Heatmap Overlay", () => {
    it("renders visual mode switcher with Optical RGB, FLIR Thermal Heatmap, and Multi-Spectral Fusion", () => {
      const handleRunInspection = vi.fn().mockResolvedValue(undefined);
      const handleApplyToForm = vi.fn();
      const handleClose = vi.fn();

      render(
        <MirageModal
          isOpen={true}
          onClose={handleClose}
          mirageInspection={mockMirageFreshBiryani}
          mirageScanning={false}
          onRunInspection={handleRunInspection}
          onApplyToForm={handleApplyToForm}
        />
      );

      // Verify visual mode switcher buttons exist
      const opticalBtn = screen.getByRole("button", { name: /Optical RGB/i });
      const thermalBtn = screen.getByRole("button", { name: /FLIR Thermal Heatmap/i });
      const fusionBtn = screen.getByRole("button", { name: /Multi-Spectral Fusion/i });

      expect(opticalBtn).toBeInTheDocument();
      expect(thermalBtn).toBeInTheDocument();
      expect(fusionBtn).toBeInTheDocument();

      // Initially in OPTICAL mode: thermal overlay is not rendered
      expect(screen.queryByTestId("flir-thermal-overlay")).not.toBeInTheDocument();

      // Switch to FLIR Thermal Heatmap: thermal overlay is rendered
      fireEvent.click(thermalBtn);
      expect(screen.getByTestId("flir-thermal-overlay")).toBeInTheDocument();

      // Switch to Multi-Spectral Fusion: thermal overlay remains rendered with fusion styling
      fireEvent.click(fusionBtn);
      expect(screen.getByTestId("flir-thermal-overlay")).toBeInTheDocument();

      // Switch back to Optical RGB: overlay disappears
      fireEvent.click(opticalBtn);
      expect(screen.queryByTestId("flir-thermal-overlay")).not.toBeInTheDocument();
    });

    it("renders interactive spot temperature sensors (Core, Surface, Ambient) with false-color spectrum legend", () => {
      const handleRunInspection = vi.fn().mockResolvedValue(undefined);
      const handleApplyToForm = vi.fn();
      const handleClose = vi.fn();

      render(
        <MirageModal
          isOpen={true}
          onClose={handleClose}
          mirageInspection={mockMirageFreshBiryani}
          mirageScanning={false}
          onRunInspection={handleRunInspection}
          onApplyToForm={handleApplyToForm}
        />
      );

      // Core temp sensor spot (>65°C hot hold for fresh sample)
      expect(screen.getByTestId("spot-sensor-core")).toBeInTheDocument();
      expect(screen.getByText(/CORE: 68.4°C/i)).toBeInTheDocument();
      expect(screen.getAllByText(/>65°C Hot Hold/i).length).toBeGreaterThanOrEqual(1);

      // Surface & Ambient temp sensor spots
      expect(screen.getByTestId("spot-sensor-surface")).toBeInTheDocument();
      expect(screen.getByText(/SURF: 66.2°C/i)).toBeInTheDocument();
      expect(screen.getByTestId("spot-sensor-ambient")).toBeInTheDocument();
      expect(screen.getByText(/AMB: 26.0°C/i)).toBeInTheDocument();

      // False-color spectrum bar legend
      expect(screen.getByText(/<4°C Cold Hold/i)).toBeInTheDocument();
      expect(screen.getAllByText(/21°C–31°C Microbial Danger Zone/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/>65°C Hot Hold/i).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("FSSAI Compliance Verification Metrics & Microbial Window", () => {
    it("verifies Hot-Hold >65°C check badge, Cold-Hold <4°C check badge, and 4-hour microbial risk window", () => {
      const handleRunInspection = vi.fn().mockResolvedValue(undefined);
      const handleApplyToForm = vi.fn();
      const handleClose = vi.fn();

      render(
        <MirageModal
          isOpen={true}
          onClose={handleClose}
          mirageInspection={mockMirageFreshBiryani}
          mirageScanning={false}
          onRunInspection={handleRunInspection}
          onApplyToForm={handleApplyToForm}
        />
      );

      // FSSAI section
      expect(screen.getByText(/FSSAI COMPLIANCE VERIFICATION METRICS/i)).toBeInTheDocument();

      // Hot-Hold >65°C check badge: PASS for fresh sample
      expect(screen.getByText(/HOT-HOLD >65°C CHECK:/i)).toBeInTheDocument();
      expect(screen.getByText(/PASS \(68.4°C\)/i)).toBeInTheDocument();

      // Cold-Hold check badge
      expect(screen.getByText(/COLD-HOLD <4°C CHECK:/i)).toBeInTheDocument();

      // 4-Hour Microbial Proliferation Window & Risk curve
      expect(screen.getByText(/4-HOUR MICROBIAL PROLIFERATION WINDOW:/i)).toBeInTheDocument();
      expect(screen.getByText(/SAFE ZONE \(210 MINS REMAINING\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Safe Zone \(<2h\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Exponential Doubling Hazard/i)).toBeInTheDocument();
    });
  });

  describe("Packaging Integrity & OCR Timestamp Extraction", () => {
    it("displays extracted OCR kitchen prep timestamp and vessel seal integrity status badge", () => {
      const handleRunInspection = vi.fn().mockResolvedValue(undefined);
      const handleApplyToForm = vi.fn();
      const handleClose = vi.fn();

      render(
        <MirageModal
          isOpen={true}
          onClose={handleClose}
          mirageInspection={mockMirageFreshBiryani}
          mirageScanning={false}
          onRunInspection={handleRunInspection}
          onApplyToForm={handleApplyToForm}
        />
      );

      // Extracted OCR Kitchen Prep Timestamp
      expect(screen.getByText(/OCR KITCHEN PREP TIMESTAMP:/i)).toBeInTheDocument();
      expect(screen.getByText(/PREP: 22-NOV-2026 12:30 IST • BATCH #IND-4412/i)).toBeInTheDocument();

      // Vessel Seal Integrity status badge
      expect(screen.getByText(/VESSEL SEAL INTEGRITY:/i)).toBeInTheDocument();
      expect(screen.getByText(/Hermetic Cambro Seal Verified/i)).toBeInTheDocument();

      // Safe batch permits auto-fill
      expect(screen.getByRole("button", { name: /Auto-Fill Form 68-A/i })).toBeInTheDocument();
    });
  });

  describe("Fail-Closed Zero-Trust Safety & Rejection Alert", () => {
    it("renders emergency rejection alert, flags 21-31°C microbial danger zone, and locks dispatch auto-fill on spoiled sample", () => {
      const handleRunInspection = vi.fn().mockResolvedValue(undefined);
      const handleApplyToForm = vi.fn();
      const handleClose = vi.fn();

      render(
        <MirageModal
          isOpen={true}
          onClose={handleClose}
          mirageInspection={mockMirageSpoiledCurry}
          mirageScanning={false}
          onRunInspection={handleRunInspection}
          onApplyToForm={handleApplyToForm}
        />
      );

      // Emergency Containment Alert Banner
      expect(screen.getByText(/FAIL-CLOSED ZERO-TRUST CONTAINMENT: EMERGENCY REJECTION ALERT/i)).toBeInTheDocument();
      expect(screen.getByText(/Holding in 21°C–31°C microbial danger zone/i)).toBeInTheDocument();
      expect(screen.getByText(/Vessel seal compromised/i)).toBeInTheDocument();
      expect(screen.getByText(/Diverting to BBMP Municipal Bio-Compost Facility/i)).toBeInTheDocument();

      // Core temp sensor reflects microbial danger zone
      expect(screen.getByText(/CORE: 31.2°C/i)).toBeInTheDocument();
      expect(screen.getByText(/21-31°C DANGER ZONE/i)).toBeInTheDocument();

      // Hot-Hold FAILED check badge
      expect(screen.getByText(/FAILED \(31.2°C\)/i)).toBeInTheDocument();

      // Critical Risk microbial window indicator
      expect(screen.getByText(/CRITICAL RISK \(4.8H ELAPSED\)/i)).toBeInTheDocument();

      // Vessel seal compromised badge
      expect(screen.getByText(/Compromised Seal/i)).toBeInTheDocument();

      // Fail-closed lockout: auto-fill button is blocked
      expect(screen.queryByRole("button", { name: /Auto-Fill Form 68-A/i })).not.toBeInTheDocument();
      expect(screen.getByText(/CANNOT DISPATCH: FOOD FAILED FSSAI HYGIENE INSPECTION \(SPOILED\)/i)).toBeInTheDocument();
    });

    it("verifies zero-trust gating across sample switching in full App modal journey", async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("SURPLUSPULSE")).toBeInTheDocument();
      });

      // Open Mirage inspection modal from header
      const inspectBtn = screen.getByRole("button", { name: /Mirage VLM \(22MB\)/i });
      fireEvent.click(inspectBtn);

      await waitFor(() => {
        expect(screen.getByText(/CIVIC FOOD HYGIENE SPECTROGRAPH • MIRAGE VLM/i)).toBeInTheDocument();
      });

      // Test fresh sample: auto-fill is available
      const biryaniBtn = screen.getByRole("button", { name: /Inspect Dum Biryani sample/i });
      fireEvent.click(biryaniBtn);
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Auto-Fill Form 68-A/i })).toBeInTheDocument();
      });

      // Test spoiled sample: fail-closed containment activates and blocks auto-fill
      const curryBtn = screen.getByRole("button", { name: /Inspect Spoiled Curry sample/i });
      fireEvent.click(curryBtn);

      await waitFor(() => {
        expect(screen.getByText(/FAIL-CLOSED ZERO-TRUST CONTAINMENT: EMERGENCY REJECTION ALERT/i)).toBeInTheDocument();
      });
      expect(screen.queryByRole("button", { name: /Auto-Fill Form 68-A/i })).not.toBeInTheDocument();
      expect(screen.getByText(/CANNOT DISPATCH: FOOD FAILED FSSAI HYGIENE INSPECTION \(SPOILED\)/i)).toBeInTheDocument();
    });
  });
});
