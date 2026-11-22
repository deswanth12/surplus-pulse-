import { type FC } from "react";
import {
  Utensils,
  Plus,
  ShieldCheck,
  Award,
  Thermometer,
  Flame,
  FileCheck2,
  Clock,
  Building2,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { Donor, FoodListing } from "../../types";

interface DonorPortalProps {
  donors: Donor[];
  listings: FoodListing[];
  onOpenPostModal: () => void;
  onOpenCertificate: (listingId?: string) => void;
  onRunMirageInspection?: () => void;
}

export const DonorPortal: FC<DonorPortalProps> = ({
  donors = [],
  listings = [],
  onOpenPostModal,
  onOpenCertificate,
  onRunMirageInspection,
}) => {
  const activeDonor = donors[0] || {
    id: "d1",
    name: "The Grand Amber Banquet Hall",
    donor_type: "WEDDING_VENUE",
    contact_name: "Suresh R.",
    contact_phone: "+91 98450 11234",
    address: "100 Feet Rd, Indiranagar",
    city: "Bengaluru",
  };

  const donorListings = listings.filter(
    (l) => l.donor_id === activeDonor.id || !l.donor_id || donors.some((d) => d.id === l.donor_id)
  );

  const activeRescues = donorListings.filter(
    (l) => l.status === "POSTED" || l.status === "CLAIMED" || l.status === "COLLECTED"
  );
  const completedRescues = donorListings.filter((l) => l.status === "DELIVERED");

  const totalKgDonated = donorListings.reduce((sum, l) => sum + (l.quantity_kg || 0), 0);
  const totalMealsDonated = donorListings.reduce((sum, l) => sum + (l.quantity_meals || 0), 0);

  return (
    <section
      role="region"
      aria-label="Donor Kitchen Dashboard"
      className="space-y-6 font-body text-stone-900"
    >
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold font-mono uppercase tracking-wider">
              DONOR KITCHEN OPERATIONS PORTAL
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[10px] font-bold font-mono">
              FSSAI REG #11224334000189
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-headline text-stone-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-emerald-700" />
            <span>{activeDonor.name}</span>
          </h2>
          <p className="text-xs text-stone-500 font-label flex items-center gap-2">
            <span>{activeDonor.address}, {activeDonor.city}</span>
            <span>•</span>
            <span>Coordinator: {activeDonor.contact_name} ({activeDonor.contact_phone})</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onRunMirageInspection && (
            <button
              type="button"
              onClick={onRunMirageInspection}
              className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Verify Hygiene</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenPostModal}
            className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
            aria-label="Quick Post Surplus Batch"
          >
            <Plus className="w-4 h-4" />
            <span>Quick Post Surplus Batch</span>
          </button>
        </div>
      </div>

      {/* Hygiene & Compliance Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: FSSAI Hygiene Rating */}
        <div className="bg-white rounded-2xl border border-stone-200/90 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-stone-500 text-xs font-semibold">
            <span>FSSAI HYGIENE RATING</span>
            <Award className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-headline text-emerald-700">98.5%</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
              GRADE A PRIME
            </span>
          </div>
          <p className="text-[11px] text-stone-500 leading-tight">
            Certified compliant with FSSAI 2019 Surplus Food Directives.
          </p>
        </div>

        {/* Card 2: Cambro Core Thermal Logs */}
        <div className="bg-white rounded-2xl border border-stone-200/90 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-stone-500 text-xs font-semibold">
            <span>CAMBRO THERMAL LOGS</span>
            <Thermometer className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-headline text-stone-900">68.4°C</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200 flex items-center gap-1">
              <Flame className="w-3 h-3 text-amber-600" />
              HOT HOLD &gt;65°C
            </span>
          </div>
          <p className="text-[11px] text-stone-500 leading-tight">
            Insulated stainless urn holding verified above critical microbial threshold.
          </p>
        </div>

        {/* Card 3: Zero-Waste Streak */}
        <div className="bg-white rounded-2xl border border-stone-200/90 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-stone-500 text-xs font-semibold">
            <span>ZERO-WASTE STREAK</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-headline text-emerald-700">14 DAYS</span>
            <span className="text-xs text-stone-500 font-label">Active Streak</span>
          </div>
          <p className="text-[11px] text-stone-500 leading-tight">
            Zero edible food diverted to landfill for 14 consecutive commercial banquet events.
          </p>
        </div>

        {/* Card 4: Section 80G Tax Deductions */}
        <div className="bg-white rounded-2xl border border-stone-200/90 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-stone-500 text-xs font-semibold">
            <span>SECTION 80G DEDUCTION</span>
            <FileCheck2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-headline text-stone-900">
              ₹{Math.round(totalMealsDonated * 65 * 0.5).toLocaleString()}
            </span>
            <span className="text-[10px] font-mono text-emerald-700 font-bold">50% ALLOWABLE</span>
          </div>
          <p className="text-[11px] text-stone-500 leading-tight">
            Verified CA deduction schedule under Section 80G(5)(vi) of IT Act.
          </p>
        </div>
      </div>

      {/* Form 68-A Quick Post Callout Banner */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-50 via-stone-50 to-emerald-50 rounded-2xl border border-emerald-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="font-bold text-sm block tracking-wide text-emerald-900">
            LOG SURPLUS FOOD DECLARATION (FORM 68-A)
          </span>
          <p className="text-xs text-stone-600">
            Automatic Mirage 22MB VLM hygiene triage &amp; Section 80G tax generation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-stone-500 font-bold">
            {donors.length} Registered Commercial Kitchens
          </span>
          <button
            type="button"
            onClick={onOpenPostModal}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Quick Post Surplus Batch
          </button>
        </div>
      </div>

      {/* Active Rescue Pickup Status Tracking */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold font-headline text-stone-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-700" />
            <span>Active Food Rescue Pickups ({activeRescues.length})</span>
          </h3>
          <span className="text-xs text-stone-500 font-mono">
            Total Rescued: {totalKgDonated.toFixed(1)} kg ({totalMealsDonated} meals)
          </span>
        </div>

        {activeRescues.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-stone-300 text-stone-500 text-sm space-y-2">
            <Utensils className="w-8 h-8 text-stone-400 mx-auto" />
            <p>No active food batches logged. Click &quot;Quick Post Surplus Batch&quot; to register excess food.</p>
            <button
              type="button"
              onClick={onOpenPostModal}
              className="px-3.5 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Quick Post Surplus Batch
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeRescues.map((l) => {
              const isClaimed = l.status === "CLAIMED" || l.status === "COLLECTED";
              return (
                <div
                  key={l.id}
                  className="p-4 sm:p-5 bg-white rounded-2xl border border-stone-200/90 shadow-xs space-y-3"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-stone-900">{l.food_name}</h4>
                      <p className="text-xs text-stone-500 font-label">
                        {l.quantity_meals} meals • {l.quantity_kg} kg • Storage: {l.storage_type}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                        l.status === "POSTED"
                          ? "bg-amber-100 text-amber-800"
                          : l.status === "CLAIMED"
                          ? "bg-sky-100 text-sky-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {l.status === "POSTED"
                        ? "PENDING CLAIM"
                        : l.status === "CLAIMED"
                        ? "COURIER EN ROUTE"
                        : "COLLECTED IN TRANSIT"}
                    </span>
                  </div>

                  {/* Pickup Courier Telemetry / Destination */}
                  <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-100 text-xs font-label space-y-1">
                    <div className="flex justify-between text-stone-600">
                      <span>Destination Shelter:</span>
                      <strong className="text-stone-900">
                        {l.pickup?.receiver_name || "Nearest Verified Hub"}
                      </strong>
                    </div>
                    {isClaimed && l.pickup && (
                      <div className="flex justify-between text-stone-600">
                        <span>Assigned Volunteer:</span>
                        <strong className="text-emerald-700">
                          {l.pickup.volunteer_name} ({l.pickup.vehicle_type})
                        </strong>
                      </div>
                    )}
                    <div className="flex justify-between text-stone-600">
                      <span>Safe Consumption Window:</span>
                      <strong className="text-amber-700">{l.minutes_remaining} mins remaining</strong>
                    </div>
                  </div>

                  {/* 80G Tax Eligibility & Actions */}
                  <div className="flex items-center justify-between pt-1 border-t border-stone-100">
                    <span className="text-xs font-mono font-bold text-emerald-700 flex items-center gap-1">
                      <FileCheck2 className="w-3.5 h-3.5" />
                      <span>80G TAX SLIP ELIGIBLE</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenCertificate(l.id)}
                      className="text-xs font-bold text-stone-700 hover:text-emerald-700 flex items-center gap-1 cursor-pointer transition-colors"
                      aria-label="View Section 80G Tax Slip"
                    >
                      <span>View 80G Tax Slip</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed Rescues History */}
      {completedRescues.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-bold font-headline text-stone-800 uppercase tracking-wide">
            Delivered &amp; Audited Rations ({completedRescues.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {completedRescues.map((l) => (
              <div
                key={l.id}
                className="p-3.5 bg-stone-50/80 rounded-xl border border-stone-200/80 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-stone-900 block">{l.food_name}</span>
                  <span className="text-stone-500 font-label">
                    {l.quantity_meals} meals • {l.quantity_kg} kg • Delivered to Beneficiaries
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenCertificate(l.id)}
                  className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-emerald-800 font-bold hover:bg-emerald-50 transition-colors cursor-pointer text-xs"
                >
                  80G Slip
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
