import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Section80GCertificate } from "../components/Section80GCertificate";
import { CertificateModal } from "../components/modals/CertificateModal";
import { mockSection80GTaxSlip, mockImpactSummary } from "./test-mocks";

describe("Section 80G Tax Exemption Certificate Journey", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders official Section 80G Indian Income Tax deduction slip with Form 10BE header and registration order", () => {
    render(<Section80GCertificate taxSlip={mockSection80GTaxSlip} />);

    // Government / Municipal Header
    expect(
      screen.getByText(/GOVERNMENT OF KARNATAKA \/ MUNICIPAL DISPATCH RELIEF CORPS • FORM 10BE \/ SECTION 80G\(5\)\(vi\)/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/CERTIFICATE OF CHARITABLE FOOD SALVAGE/i)
    ).toBeInTheDocument();

    // 80G Registration Order
    expect(screen.getByText(/CIT\(E\)\/BLR\/80G\/2026\/AABTS1234F/i)).toBeInTheDocument();

    // Donor Entity Details & PAN
    expect(screen.getByText(/The Grand Amber Banquet Hall/i)).toBeInTheDocument();
    expect(screen.getByText(/AABCS1948K/i)).toBeInTheDocument();
    expect(screen.getByText(/100 Feet Rd, Indiranagar, Bengaluru/i)).toBeInTheDocument();

    // Mass & Meal Tally
    expect(screen.getByText(/55 kg/i)).toBeInTheDocument();
    expect(screen.getByText(/120 Meals/i)).toBeInTheDocument();
  });

  it("renders itemized Chartered Accountant valuation breakdown and ESG carbon credit", () => {
    render(<Section80GCertificate taxSlip={mockSection80GTaxSlip} />);

    // Subsidized meal FMV rate
    expect(screen.getByText(/₹65.00 \/ plate/i)).toBeInTheDocument();

    // Gross valuation
    expect(screen.getByText(/₹7,800/i)).toBeInTheDocument();

    // 50% eligible deduction under Section 80G
    expect(screen.getByText(/Eligible Tax Deduction under Section 80G\(5\)\(vi\) \(50% of FMV\)/i)).toBeInTheDocument();
    expect(screen.getByText(/₹3,900/i)).toBeInTheDocument();

    // Projected corporate tax savings (26%)
    expect(screen.getByText(/₹1,014/i)).toBeInTheDocument();

    // ESG Carbon offset (2.5 kg CO2e / kg)
    expect(screen.getByText(/137.5 kg CO₂e/i)).toBeInTheDocument();
  });

  it("renders scannable vector SVG QR code and authentic ICAI UDIN attestation seal", () => {
    render(<Section80GCertificate taxSlip={mockSection80GTaxSlip} />);

    // QR Code SVG
    const qrSvg = screen.getByRole("img", {
      name: /Scannable QR Verification Matrix/i,
    });
    expect(qrSvg).toBeInTheDocument();

    // Public verification URL
    expect(
      screen.getByText(/\/api\/tax\/verify\/tc_80g_blr_2026/i)
    ).toBeInTheDocument();

    // ICAI Chartered Accountant Attestation
    expect(screen.getByText(/CA Rajeshwari Sundaram, FCA/i)).toBeInTheDocument();
    expect(screen.getByText(/R\. Sundaram & Associates, Chartered Accountants/i)).toBeInTheDocument();
    expect(screen.getByText(/UDIN: 26021948AAAAAA1968/i)).toBeInTheDocument();
    expect(screen.getByText(/DIGITALLY ATTESTED & SEALED/i)).toBeInTheDocument();
  });

  it("triggers window.print() when print button is clicked", () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});

    render(<Section80GCertificate taxSlip={mockSection80GTaxSlip} />);

    const printBtn = screen.getByRole("button", {
      name: /Print Section 80G Tax Exemption Certificate/i,
    });
    expect(printBtn).toBeInTheDocument();

    fireEvent.click(printBtn);
    expect(printSpy).toHaveBeenCalled();
  });

  it("renders Section80GCertificate inside CertificateModal with print and share options", () => {
    render(
      <CertificateModal
        isOpen={true}
        onClose={() => {}}
        impact={mockImpactSummary}
        onShare={() => {}}
        taxSlip={mockSection80GTaxSlip}
      />
    );

    // Section 80G tab is active by default
    expect(
      screen.getByText(/SECTION 80G TAX SLIP \(FORM 10BE\)/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/CERTIFICATE OF CHARITABLE FOOD SALVAGE/i)
    ).toBeInTheDocument();

    // Action buttons are present
    expect(
      screen.getByRole("button", { name: /Print official charter as PDF/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Share verification dispatch cyber link/i })
    ).toBeInTheDocument();
  });
});
