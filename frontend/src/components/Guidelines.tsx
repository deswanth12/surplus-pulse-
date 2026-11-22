import type { FC } from "react";
import { ShieldCheck, Flame, Clock, Package, AlertTriangle } from "lucide-react";

export const Guidelines: FC = () => {
  return (
    <div
      className="bg-light-surface-container-lowest border border-light-outline-variant/60 rounded-xl p-4 sm:p-6 space-y-5 shadow-sm text-light-on-surface font-body"
      role="region"
      aria-label="FSSAI Municipal Food Code and Cyber Hygiene Guidelines"
    >
      <div className="border-b border-light-outline-variant/40 pb-3">
        <h2 className="text-lg sm:text-title-lg font-bold font-headline text-light-on-surface flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6 text-light-primary" aria-hidden="true" />
          <span>MUNICIPAL FOOD CODE &amp; SAFE HOLDING DIRECTIVE (FSSAI DIVISION)</span>
        </h2>
        <p className="text-xs text-light-on-surface-variant font-label mt-0.5">
          Zero-liability autonomous protocol governing all participating commercial banquet donors and certified charity receivers.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 text-xs font-label">
        <div className="p-4 bg-light-surface-container-low rounded-xl border border-light-outline-variant/60 space-y-2 shadow-sm">
          <h3 className="font-bold text-light-secondary text-sm flex items-center gap-1.5 font-headline">
            <Flame className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>[1] THERMAL HOLDING MANDATE</span>
          </h3>
          <p className="text-light-on-surface-variant leading-relaxed">
            Hot banquet items must be maintained continuously at or above{" "}
            <strong className="text-light-on-surface font-semibold">65°C</strong> in insulated food-grade containers. Chilled dairy
            and salads must remain below <strong className="text-light-on-surface font-semibold">4°C</strong>. Any food kept in the
            5°C - 60°C &quot;Danger Zone&quot; exceeds tolerance after 120 minutes.
          </p>
        </div>

        <div className="p-4 bg-light-surface-container-low rounded-xl border border-light-outline-variant/60 space-y-2 shadow-sm">
          <h3 className="font-bold text-light-primary text-sm flex items-center gap-1.5 font-headline">
            <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>[2] THE 4-HOUR CONSUMPTION WINDOW</span>
          </h3>
          <p className="text-light-on-surface-variant leading-relaxed">
            All rescued banquet provisions must be transferred and served to
            beneficiaries within a strict <strong className="text-light-on-surface font-semibold">4-hour lifecycle</strong> from the
            conclusion of event food service. Telemetry listings auto-expire when this
            safe margin lapses.
          </p>
        </div>

        <div className="p-4 bg-light-surface-container-low rounded-xl border border-light-outline-variant/60 space-y-2 shadow-sm">
          <h3 className="font-bold text-light-success text-sm flex items-center gap-1.5 font-headline">
            <Package className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>[3] VESSEL SEALING &amp; HYGIENE</span>
          </h3>
          <p className="text-light-on-surface-variant leading-relaxed">
            Only surplus food unserved on the buffet and held in secondary kitchen
            warming trays is eligible. Food must be sealed in heavy-gauge aluminum
            foil or food-grade stainless transport urns. Uncovered plate waste is
            strictly rejected.
          </p>
        </div>

        <div className="p-4 bg-light-surface-container-low rounded-xl border border-light-outline-variant/60 space-y-2 shadow-sm">
          <h3 className="font-bold text-light-warning text-sm flex items-center gap-1.5 font-headline">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>[4] MANDATORY ALLERGEN DISCLOSURE</span>
          </h3>
          <p className="text-light-on-surface-variant leading-relaxed">
            Donors must register mandatory disclosure of key allergens (Dairy/Paneer,
            Peanuts/Nuts, Gluten/Wheat, Mustard) on Form 68-A to allow shelter meal
            supervisors to safely direct rations.
          </p>
        </div>
      </div>

      {/* Special Statutory Section: FSSAI Surplus Food Regulations 2019 */}
      <div className="p-4 sm:p-5 bg-light-surface-container-lowest rounded-xl border border-light-primary/40 shadow-sm space-y-3 font-body">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-light-outline-variant/40 pb-2.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-light-primary" aria-hidden="true" />
            <h3 className="font-headline font-bold text-sm sm:text-base text-light-on-surface">
              FSSAI (RECOVERY &amp; DISTRIBUTION OF SURPLUS FOOD) REGULATIONS, 2019
            </h3>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-light-primary-container text-light-on-primary-container font-label text-xs font-bold">
            STATUTORY COMPLIANCE
          </span>
        </div>

        <p className="text-xs text-light-on-surface-variant leading-relaxed">
          Under Indian food safety law, <strong className="text-light-on-surface font-semibold">freshly cooked bulk banquet surplus (weddings, hotels, temple kitchens, messes) NEVER carries a commercial retail label or barcode</strong>. The Government of India explicitly established the <strong className="text-light-primary font-bold">3-Check Verification Standard</strong> for unlabelled cooked surplus:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs font-label">
          <div className="p-3 bg-light-surface-container-low rounded-lg border border-light-outline-variant/60 shadow-sm">
            <strong className="text-light-secondary block text-[10px] uppercase font-bold">
              1. VESSEL INTEGRITY
            </strong>
            <span className="text-light-on-surface-variant mt-1 block leading-relaxed">
              Food-grade stainless steel <em>degchis</em>, thermal urns, or heavy-gauge foil. Uncovered plate waste is disqualified.
            </span>
          </div>
          <div className="p-3 bg-light-surface-container-low rounded-lg border border-light-outline-variant/60 shadow-sm">
            <strong className="text-light-primary block text-[10px] uppercase font-bold">
              2. THE 4-HOUR THERMAL RULE
            </strong>
            <span className="text-light-on-surface-variant mt-1 block leading-relaxed">
              Hot food (&gt;65°C) must be distributed within 4 hours. Ambient food has a 2-hour window. Chilled items must stay &lt;5°C.
            </span>
          </div>
          <div className="p-3 bg-light-surface-container-low rounded-lg border border-light-outline-variant/60 shadow-sm">
            <strong className="text-light-success block text-[10px] uppercase font-bold">
              3. VISUAL SPOILAGE TRIAGE
            </strong>
            <span className="text-light-on-surface-variant mt-1 block leading-relaxed">
              VLM optical verification of rising steam, stable emulsion, intact grains, and zero fungal spores or sour curdling.
            </span>
          </div>
        </div>

        <div className="p-2.5 bg-light-surface-container-low rounded-lg border border-light-outline-variant/50 text-[11px] font-label flex items-center justify-between flex-wrap gap-2 text-light-on-surface-variant">
          <span>
            DUAL-TRACK VLM ENGINE: <strong className="text-light-primary font-semibold">TRACK A (Packaged FMCG OCR)</strong> + <strong className="text-light-success font-semibold">TRACK B (FSSAI 2019 Unpackaged Surplus)</strong>
          </span>
          <span className="text-light-success font-bold flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-light-success animate-ping" />
            <span>ZERO-BARCODE GROUND REALITY ACTIVE</span>
          </span>
        </div>
      </div>
    </div>
  );
};
