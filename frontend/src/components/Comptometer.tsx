import type { FC } from "react";
import { Award, FileText, Printer, Calculator, Zap, TrendingUp, Sparkles } from "lucide-react";
import { ImpactSummary } from "../types";

interface ComptometerProps {
  impact: ImpactSummary | null;
  eventsPerMonth: number;
  setEventsPerMonth: (val: number) => void;
  leftoverPerEvent: number;
  setLeftoverPerEvent: (val: number) => void;
  onOpenCertificateModal: () => void;
  onPrintAuditSlip: () => void;
}

export const Comptometer: FC<ComptometerProps> = ({
  impact,
  eventsPerMonth,
  setEventsPerMonth,
  leftoverPerEvent,
  setLeftoverPerEvent,
  onOpenCertificateModal,
  onPrintAuditSlip,
}) => {
  // ROI Calculations for Comptometer
  const monthlyRescuedMeals = eventsPerMonth * leftoverPerEvent;
  const monthlyFoodKg = monthlyRescuedMeals * 0.45;
  const monthlySavingsINR = monthlyRescuedMeals * 65; // ₹65 raw material cost saved per plate
  const surplusSubscriptionINR = 1499;
  const netCatererBenefitINR = monthlySavingsINR - surplusSubscriptionINR;
  const carbonOffsetTons = (monthlyFoodKg * 2.5) / 1000;
  const netRoiPercent = Math.round(
    (netCatererBenefitINR / surplusSubscriptionINR) * 100
  );

  return (
    <div
      className="bg-light-surface-container-lowest border border-light-outline-variant/60 rounded-xl p-4 sm:p-6 space-y-6 shadow-sm text-light-on-surface font-body"
      role="region"
      aria-label="Corporate Quantum ESG & Carbon Ledger"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-light-outline-variant/40 pb-4">
        <div>
          <h2 className="text-lg sm:text-title-lg font-bold font-headline text-light-on-surface flex items-center gap-2 text-balance">
            <Award className="size-5 sm:size-6 text-light-primary" aria-hidden="true" />
            <span>QUANTUM ESG &amp; CARBON RECOVERY LEDGER</span>
          </h2>
          <p className="text-xs text-light-on-surface-variant font-label mt-0.5 text-pretty">
            Demonstrating fiscal sustainability: Commercial banquet venues and corporate kitchens achieve 2,600%+ net recovery on surplus dispatch automation.
          </p>
        </div>
        <button
          onClick={onOpenCertificateModal}
          className="px-4 py-2 rounded-md bg-light-primary text-light-on-primary font-label text-xs font-bold hover:bg-light-primary-container shadow-sm transition-colors flex items-center gap-2 self-start sm:self-auto cursor-pointer"
          aria-label="Inspect ESG Carbon Charter Modal"
        >
          <FileText className="size-4" aria-hidden="true" />
          <span>INSPECT ESG CARBON CHARTER</span>
        </button>
      </div>

      {/* Official Impact Methodology Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 font-label">
        <div className="p-4 bg-light-surface-container-low rounded-xl border border-light-outline-variant/60 space-y-2 shadow-sm">
          <span className="text-[11px] font-bold text-light-on-surface-variant uppercase flex items-center gap-1.5">
            <Zap className="size-3.5 text-light-primary" />
            <span>TOTAL MASS DIVERTED</span>
          </span>
          <div className="text-xl sm:text-2xl font-bold font-headline text-light-on-surface tabular-nums">
            {impact?.total_food_kg_saved ?? 133} KG
          </div>
          <p className="text-xs text-light-on-surface-variant leading-relaxed text-pretty">
            Standardized culinary portion density: 0.45 kg edible mass per meal plate.
          </p>
        </div>

        <div className="p-4 bg-light-surface-container-low rounded-xl border border-light-outline-variant/60 space-y-2 shadow-sm">
          <span className="text-[11px] font-bold text-light-on-surface-variant uppercase flex items-center gap-1.5">
            <TrendingUp className="size-3.5 text-light-success" />
            <span>GHG AVOIDANCE FACTOR</span>
          </span>
          <div className="text-xl sm:text-2xl font-bold font-headline text-light-success tabular-nums">
            {impact?.total_co2_kg_offset ?? 332.5} KG CO2e
          </div>
          <p className="text-xs text-light-on-surface-variant leading-relaxed text-pretty">
            EPA WARM Standard: 1 kg organic waste prevented from anaerobic decomposition offsets 2.5 kg CO2e.
          </p>
        </div>

        <div className="p-4 bg-light-surface-container-low rounded-xl border border-light-outline-variant/60 space-y-2 shadow-sm">
          <span className="text-[11px] font-bold text-light-on-surface-variant uppercase flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-light-tertiary" />
            <span>VIRTUAL WATER CONSERVED</span>
          </span>
          <div className="text-xl sm:text-2xl font-bold font-headline text-light-tertiary tabular-nums">
            {(impact?.total_water_liters_saved ?? 106400).toLocaleString()} LITERS
          </div>
          <p className="text-xs text-light-on-surface-variant leading-relaxed text-pretty">
            Calculated at 800 Liters of agricultural and culinary water embodied per kg of prepared provisions.
          </p>
        </div>
      </div>

      {/* Quantum ESG & Commercial ROI Ledger Card */}
      <div className="p-5 sm:p-6 bg-light-surface-container-low border border-light-outline-variant/60 rounded-xl shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-light-outline-variant/40 pb-3">
          <div className="flex items-center gap-3">
            <div
              className="size-9 bg-light-primary text-light-on-primary rounded-lg flex items-center justify-center font-bold text-xs shrink-0 shadow-sm"
              aria-hidden="true"
            >
              <Calculator className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold font-headline uppercase tracking-wider text-light-on-surface text-balance">
                COMMERCIAL CATERER ROI &amp; CARBON LEDGER // QUANTUM ESG TELEMETRY
              </h3>
              <p className="text-xs text-light-on-surface-variant font-label text-pretty">
                Interactive financial recovery model demonstrating 2,400%+ ROI on ₹1,499/mo SaaS compliance tier.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-light-primary-container text-light-on-primary-container font-label text-xs font-bold self-start sm:self-auto tabular-nums shadow-sm">
            NET ROI: {netRoiPercent}%
          </span>
        </div>

        {/* Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-2.5 p-4 bg-light-surface-container-lowest rounded-xl border border-light-outline-variant/60 shadow-sm">
            <div className="flex justify-between text-xs font-label">
              <label
                htmlFor="events-per-month-slider"
                className="text-light-on-surface font-bold cursor-pointer"
              >
                MONTHLY BANQUET / CATERING EVENTS:
              </label>
              <span className="font-bold text-light-primary tabular-nums">
                {eventsPerMonth} EVENTS
              </span>
            </div>
            <input
              id="events-per-month-slider"
              type="range"
              min="2"
              max="30"
              value={eventsPerMonth}
              onChange={(e) => setEventsPerMonth(parseInt(e.target.value, 10))}
              className="w-full accent-light-primary cursor-pointer"
              aria-label="Monthly banquet and catering events"
            />
            <div className="text-[11px] text-light-on-surface-variant font-label">
              Typical hotel or banquet venue in Bengaluru corridor
            </div>
          </div>

          <div className="space-y-2.5 p-4 bg-light-surface-container-lowest rounded-xl border border-light-outline-variant/60 shadow-sm">
            <div className="flex justify-between text-xs font-label">
              <label
                htmlFor="leftover-per-event-slider"
                className="text-light-on-surface font-bold cursor-pointer"
              >
                AVERAGE UNCONSUMED SURPLUS / EVENT:
              </label>
              <span className="font-bold text-light-primary tabular-nums">
                {leftoverPerEvent} PLATES
              </span>
            </div>
            <input
              id="leftover-per-event-slider"
              type="range"
              min="20"
              max="300"
              step="10"
              value={leftoverPerEvent}
              onChange={(e) => setLeftoverPerEvent(parseInt(e.target.value, 10))}
              className="w-full accent-light-primary cursor-pointer"
              aria-label="Average unconsumed surplus per event"
            />
            <div className="text-[11px] text-light-on-surface-variant font-label">
              Standard 15% over-preparation margin
            </div>
          </div>
        </div>

        {/* Ledger Telemetry Outputs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 pt-2">
          <div className="p-3.5 bg-light-surface-container-lowest rounded-xl border border-light-outline-variant/60 shadow-sm">
            <div className="text-[10px] text-light-on-surface-variant uppercase font-bold font-label">
              TOTAL RESCUED
            </div>
            <div className="text-lg sm:text-xl font-bold font-headline text-light-on-surface mt-1 tabular-nums">
              {monthlyRescuedMeals} MEALS
            </div>
            <div className="text-[11px] text-light-on-surface-variant mt-0.5 font-label">
              ({monthlyFoodKg.toFixed(0)} kg mass)
            </div>
          </div>

          <div className="p-3.5 bg-light-surface-container-lowest rounded-xl border border-light-outline-variant/60 shadow-sm">
            <div className="text-[10px] text-light-on-surface-variant uppercase font-bold font-label">
              KITCHEN COST AVOIDED
            </div>
            <div className="text-lg sm:text-xl font-bold font-headline text-light-success mt-1 tabular-nums">
              ₹{monthlySavingsINR.toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] text-light-success mt-0.5 font-label font-medium">
              ₹65/plate raw materials
            </div>
          </div>

          <div className="p-3.5 bg-light-surface-container-lowest rounded-xl border border-light-outline-variant/60 shadow-sm">
            <div className="text-[10px] text-light-on-surface-variant uppercase font-bold font-label">
              CARBON CREDITS
            </div>
            <div className="text-lg sm:text-xl font-bold font-headline text-light-tertiary mt-1 tabular-nums">
              {carbonOffsetTons.toFixed(2)} TONS
            </div>
            <div className="text-[11px] text-light-on-surface-variant mt-0.5 font-label">
              SEBI BRSR Certified
            </div>
          </div>

          <div className="p-3.5 bg-light-success-container/40 rounded-xl border border-light-success/50 shadow-sm">
            <div className="text-[10px] text-light-on-success-container uppercase font-bold font-label">
              NET CATERER BENEFIT
            </div>
            <div className="text-lg sm:text-xl font-bold font-headline text-light-primary mt-1 tabular-nums">
              {netCatererBenefitINR >= 0 ? "+" : "-"}₹{Math.abs(netCatererBenefitINR).toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] text-light-on-surface-variant mt-0.5 font-label">
              After ₹1,499 SaaS Fee
            </div>
          </div>
        </div>

        {/* Audit Slip Action Bar */}
        <div className="pt-2 border-t border-light-outline-variant/40 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <span className="text-[11px] font-label text-light-on-surface-variant">
            QUANTUM FISCAL RECOVERY AUDIT • CODE #2026-ROI • 2,675% RETURN ON SAAS SUBSCRIPTION
          </span>
          <button
            onClick={onPrintAuditSlip}
            className="px-4 py-2 rounded-md bg-light-surface-container-lowest text-light-on-surface border border-light-outline-variant hover:bg-light-surface-container font-label text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5 self-stretch sm:self-auto justify-center cursor-pointer"
            aria-label="Print accounting fiscal recovery audit slip"
          >
            <Printer className="size-3.5" aria-hidden="true" />
            <span>PRINT ACCOUNTING AUDIT SLIP</span>
          </button>
        </div>
      </div>
    </div>
  );
};
