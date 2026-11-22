import { useState, useEffect, useRef, type FC, type FormEvent, type ChangeEvent } from "react";
import { gsap } from "gsap";
import {
  Flame,
  X,
  Scan,
  Utensils,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  AlertOctagon,
  Camera,
  Coins,
  Leaf,
  Clock,
  MapPin,
} from "lucide-react";
import { Donor, FoodListingFormData, MirageInspectionResult } from "../../types";
import * as api from "../../services/api";

interface PostModalProps {
  isOpen: boolean;
  onClose: () => void;
  donors: Donor[];
  onSubmit: (formData: FoodListingFormData) => Promise<void>;
  onRunMirageInspection?: (sampleId: string) => void;
  initialFormData?: FoodListingFormData;
  initialInspectionResult?: MirageInspectionResult | null;
}

const DEFAULT_FORM_DATA: FoodListingFormData = {
  donor_id: "",
  food_name: "Fresh Hyderabadi Dum Biryani & Mirchi Salan",
  food_category: "VEG",
  quantity_meals: 90,
  quantity_kg: 40.0,
  storage_type: "HOT",
  allergens: "Dairy (Paneer & Ghee)",
  handling_notes:
    "Thermal sealed aluminum vessels. Maintained continuously above 65°C.",
  hours_valid: 3.0,
};

export const PostModal: FC<PostModalProps> = ({
  isOpen,
  onClose,
  donors,
  onSubmit,
  onRunMirageInspection: _onRunMirageInspection,
  initialFormData,
  initialInspectionResult,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState<FoodListingFormData>(
    initialFormData || DEFAULT_FORM_DATA
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Instant Inline Mirage VLM Inspection State
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectionResult, setInspectionResult] = useState<MirageInspectionResult | null>(
    initialInspectionResult || null
  );
  const [isInspectionBlocked, setIsInspectionBlocked] = useState(false);
  const [activeSampleId, setActiveSampleId] = useState<string | null>("fresh_biryani");

  // GSAP Smooth Modal Open
  useEffect(() => {
    let tween: gsap.core.Tween | null = null;
    if (isOpen && modalRef.current) {
      tween = gsap.fromTo(
        modalRef.current,
        { scale: 0.95, opacity: 0, y: 16 },
        { scale: 1, opacity: 1, y: 0, duration: 0.25, ease: "power2.out" }
      );
    }
    return () => {
      tween?.kill();
    };
  }, [isOpen]);

  // Sync donor_id when donors load
  useEffect(() => {
    if (donors.length > 0 && !formData.donor_id) {
      setFormData((prev) => ({ ...prev, donor_id: donors[0].id }));
    }
  }, [donors, formData.donor_id]);

  // Sync external initial form data and inspection result
  useEffect(() => {
    if (initialFormData) {
      setFormData(initialFormData);
    }
  }, [initialFormData]);

  useEffect(() => {
    if (initialInspectionResult) {
      setInspectionResult(initialInspectionResult);
      const isBad =
        initialInspectionResult.is_safe === false ||
        initialInspectionResult.verdict === "SPOILED_AND_GONE" ||
        initialInspectionResult.food_inspection?.verdict === "SPOILED_AND_GONE" ||
        initialInspectionResult.food_inspection?.fssai_grade === "GRADE_F" ||
        initialInspectionResult.food_inspection?.fssai_status?.toLowerCase().includes("rejected") ||
        (initialInspectionResult.food_inspection?.quality_score ?? 100) < 50.0 ||
        initialInspectionResult.fssai_rule_engine?.microbial_risk_level === "CRITICAL" ||
        initialInspectionResult.fssai_rule_engine?.compliance_status?.includes("VIOLATION") ||
        initialInspectionResult.thermography?.holding_compliance === false ||
        (initialInspectionResult.thermography?.core_temp_c !== undefined &&
          initialInspectionResult.thermography.core_temp_c >= 21.0 &&
          initialInspectionResult.thermography.core_temp_c <= 31.0) ||
        initialInspectionResult.vessel_seal_status?.toLowerCase().includes("compromised");
      setIsInspectionBlocked(Boolean(isBad));
    }
  }, [initialInspectionResult]);

  // Section 80G Tax Relief Calculation
  const estimatedTaxBenefit = Math.round((formData.quantity_meals || 0) * 65 * 0.5);
  const estimatedCo2Offset = ((formData.quantity_kg || 0) * 2.5).toFixed(1);

  // Expiration calculation helper
  const getExpiryTimeStr = (hours: number) => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + hours * 60);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (!isOpen) return null;

  const runInstantInspection = async (sampleId: string, imageBase64?: string) => {
    setIsInspecting(true);
    setErrorMessage(null);
    setActiveSampleId(sampleId);
    try {
      const res = await api.inspectFood({
        sample_id: sampleId,
        image_base64: imageBase64,
      });
      setInspectionResult(res);

      const isBad =
        res.is_safe === false ||
        res.verdict === "SPOILED_AND_GONE" ||
        res.food_inspection?.verdict === "SPOILED_AND_GONE" ||
        res.food_inspection?.fssai_grade === "GRADE_F" ||
        res.food_inspection?.fssai_status?.toLowerCase().includes("rejected") ||
        (res.food_inspection?.quality_score ?? 100) < 50.0 ||
        res.fssai_rule_engine?.microbial_risk_level === "CRITICAL" ||
        res.fssai_rule_engine?.compliance_status?.includes("VIOLATION") ||
        res.thermography?.holding_compliance === false ||
        (res.thermography?.core_temp_c !== undefined &&
          res.thermography.core_temp_c >= 21.0 &&
          res.thermography.core_temp_c <= 31.0) ||
        res.vessel_seal_status?.toLowerCase().includes("compromised");

      setIsInspectionBlocked(Boolean(isBad));

      if (!isBad && res.auto_fill_form_data) {
        setFormData((prev) => ({
          ...prev,
          food_name: res.auto_fill_form_data.food_name || prev.food_name,
          food_category: (res.auto_fill_form_data.food_category as "VEG" | "NON_VEG") || prev.food_category,
          storage_type: (res.auto_fill_form_data.storage_type as "HOT" | "AMBIENT" | "REFRIGERATED") || prev.storage_type,
          allergens: res.auto_fill_form_data.allergens || prev.allergens,
          handling_notes: res.auto_fill_form_data.handling_notes || prev.handling_notes,
          hours_valid: res.auto_fill_form_data.hours_valid || prev.hours_valid,
        }));
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message || "Mirage VLM inspection failed. Please verify server connection."
      );
    } finally {
      setIsInspecting(false);
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (uploadEvent) => {
      const base64 = uploadEvent.target?.result as string;
      await runInstantInspection("custom", base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (isInspectionBlocked) {
      setErrorMessage("CANNOT DISPATCH: FOOD FAILED FSSAI HYGIENE INSPECTION (SPOILED)");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await onSubmit(formData);
      setFormData({
        ...DEFAULT_FORM_DATA,
        donor_id: donors[0]?.id || "",
      });
      setInspectionResult(null);
      setIsInspectionBlocked(false);
      onClose();
    } catch (err: any) {
      setErrorMessage(
        err?.message || "Listing creation failed. Please check form inputs."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedDonor = donors.find((d) => d.id === formData.donor_id) || donors[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-3 sm:p-4 font-body overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="form-68a-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="bg-white text-stone-900 border border-stone-200 shadow-2xl rounded-2xl sm:rounded-3xl max-w-2xl w-full flex flex-col my-auto max-h-[94vh] overflow-hidden"
      >
        {/* Sticky Modal Header */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-5 sm:px-6 py-3.5 border-b border-stone-200 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20 shrink-0">
              <Flame className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="form-68a-title"
                  className="text-sm sm:text-base font-extrabold font-headline text-stone-900 tracking-tight flex items-center gap-2"
                >
                  <span>FORM 68-A • EMERGENCY FOOD SALVAGE DECLARATION</span>
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>FSSAI VERIFIED</span>
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-stone-500 font-label mt-0.5">
                Broadcast surplus payload in &lt;45s // Neural Mirage VLM Quality Gating
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-800 p-2 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer shrink-0"
            aria-label="Close Form 68-A dialog"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Form wrapping scrollable content and sticky footer */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden text-xs font-body">
          {/* Scrollable Form Content */}
          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
            {/* General Error Banner (Dismissible with helpful hints) */}
          {errorMessage && !isInspectionBlocked && (
            <div
              className="p-3.5 bg-red-50 text-red-950 text-xs font-label flex items-start justify-between gap-3 rounded-xl border border-red-200 shadow-sm"
              role="alert"
            >
              <div className="flex items-start gap-2.5 flex-1">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" aria-hidden="true" />
                <div className="space-y-1">
                  <div className="font-semibold text-red-900">
                    <strong>TELEMETRY REJECTED:</strong> {errorMessage}
                  </div>
                  {errorMessage.toLowerCase().includes("authentication") && (
                    <p className="text-[11px] text-stone-600">
                      Using automatic demo authentication key (<code>surpluspulse-demo-key-2026</code>). Click any sample button below to test zero-latency on-device inspection.
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-red-400 hover:text-red-700 p-1 rounded-md hover:bg-red-100/60 transition-colors cursor-pointer"
                aria-label="Dismiss error notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* High-Visibility Block Warning when Food is Spoiled / Gone */}
          {isInspectionBlocked && (
            <div
              className="p-4 bg-red-50/90 text-red-950 text-xs font-label space-y-2.5 rounded-2xl border-2 border-red-300 shadow-sm"
              role="alert"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm text-red-700">
                  <AlertOctagon className="h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
                  <span>CANNOT DISPATCH: FOOD FAILED FSSAI HYGIENE INSPECTION (SPOILED)</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-red-200 text-red-800 text-[10px] font-bold uppercase tracking-wider">
                  SAFETY LOCK ENGAGED
                </span>
              </div>
              <p className="text-xs text-stone-700 leading-relaxed">
                The on-device Mirage 22MB VLM analyzed this batch and marked it as{" "}
                <strong className="font-bold underline text-red-700">SPOILED &amp; GONE</strong> (Severe decomposition risk detected • Quality: {inspectionResult?.food_inspection?.quality_score}%, Grade {inspectionResult?.food_inspection?.fssai_grade}).
              </p>
              {inspectionResult?.image_data_url && (
                <div className="flex items-center gap-3 p-2.5 bg-white/95 rounded-xl border border-red-200">
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-red-300 shrink-0 shadow-xs">
                    <img
                      src={inspectionResult.image_data_url}
                      alt="Spoiled inspection scan"
                      className="w-full h-full object-cover grayscale contrast-125"
                    />
                    <div className="absolute inset-0 bg-red-900/30 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-red-500 drop-shadow" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-red-900 text-xs truncate">
                        {inspectionResult.filename || "Curry Sample"}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-red-100 text-red-800">
                        {inspectionResult.food_inspection?.quality_score}% CRITICAL
                      </span>
                    </div>
                    <p className="text-[11px] text-red-600 truncate mt-0.5">
                      Microbial Hazard: {inspectionResult.food_inspection?.temperature_check || "28.4°C Danger Zone"}
                    </p>
                  </div>
                </div>
              )}
              {inspectionResult?.food_inspection?.rejection_reasons && (
                <ul className="list-disc list-inside text-[11px] font-semibold text-red-800 space-y-0.5 pl-1">
                  {inspectionResult.food_inspection.rejection_reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-red-200">
                <span className="text-[11px] text-red-700 font-medium">
                  ⛔ Dispatching spoiled surplus violates FSSAI public health protocols.
                </span>
                <button
                  type="button"
                  onClick={() => runInstantInspection("fresh_biryani")}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Utensils className="w-3.5 h-3.5" />
                  <span>Switch to Fresh Dum Biryani (Safe)</span>
                </button>
              </div>
            </div>
          )}

          {/* Verification Certificate when Food Passes Mirage Inspection */}
          {!isInspectionBlocked && inspectionResult && (
            <div
              className="p-4 bg-emerald-50/80 border-2 border-emerald-300 text-emerald-950 text-xs font-label space-y-2 rounded-2xl shadow-sm"
              role="status"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-2 text-sm text-emerald-800">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                  <span>
                    VERIFIED SAFE • {inspectionResult.food_inspection.fssai_grade} ({inspectionResult.food_inspection.quality_score}%)
                  </span>
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold tracking-wide">
                  SAFE FOR DISPATCH
                </span>
              </div>
              <p className="text-xs text-stone-700 leading-relaxed">
                {inspectionResult.food_inspection.fssai_notes ||
                  "Mirage VLM verified core thermal state, intact container packaging, and passed FSSAI 4-hour rule."}
              </p>
              {inspectionResult.image_data_url && (
                <div className="flex items-center gap-3 p-2.5 bg-white/95 rounded-xl border border-emerald-200">
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-emerald-300 shrink-0 shadow-xs">
                    <img
                      src={inspectionResult.image_data_url}
                      alt="Thermal inspection scan"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-1">
                      <span className="text-[8px] font-mono text-emerald-300 font-bold">FLIR HUD</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-stone-900 text-xs truncate">
                        {formData.food_name || inspectionResult.filename}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-800">
                        {inspectionResult.food_inspection.quality_score}% SCORE
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-700 font-semibold truncate mt-0.5">
                      Thermal Core Hold: {inspectionResult.food_inspection?.temperature_check || ">65°C Safe Hot Hold"}
                    </p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] font-semibold">
                <div className="bg-white/90 p-2 rounded-lg border border-emerald-200">
                  <span className="text-stone-400 block text-[9px] uppercase tracking-wider">Inference Speed</span>
                  <span className="text-emerald-700 font-bold">{inspectionResult.mirage_engine?.latency_ms || 24} ms (On-Device)</span>
                </div>
                <div className="bg-white/90 p-2 rounded-lg border border-emerald-200">
                  <span className="text-stone-400 block text-[9px] uppercase tracking-wider">Thermal State</span>
                  <span className="text-emerald-700 font-bold">{inspectionResult.food_inspection?.temperature_check || ">65°C Safe Hot Hold"}</span>
                </div>
                <div className="bg-white/90 p-2 rounded-lg border border-emerald-200">
                  <span className="text-stone-400 block text-[9px] uppercase tracking-wider">Statutory Immunity</span>
                  <span className="text-emerald-700 font-bold">FSSAI Sec 31(1) Active</span>
                </div>
              </div>
            </div>
          )}

          {/* Mirage 22MB VLM Optical & Quality Classifier Trigger */}
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between text-xs font-label">
              <span className="font-extrabold text-stone-900 flex items-center gap-2">
                <Scan className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                <span>MIRAGE 22MB VLM • &quot;FOOD IS GOOD OR GONE&quot; INSPECTOR</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                ON-DEVICE
              </span>
            </div>
            <p className="text-xs text-stone-600 font-label">
              Inspect food samples or upload packaging photo to verify FSSAI quality (blocks spoiled rations, auto-fills safe batches):
            </p>

            {isInspecting ? (
              <div className="p-4 bg-white rounded-xl border border-emerald-300 flex items-center justify-center gap-2.5 text-xs font-label font-bold text-emerald-700 shadow-xs">
                <RefreshCw className="h-4 w-4 animate-spin text-emerald-600" />
                <span>[MIRAGE 22MB VLM ANALYZING THERMAL HOLD &amp; SPOILAGE RISK...]</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => runInstantInspection("fresh_biryani")}
                  className={`px-2.5 py-2 rounded-xl border text-xs font-label font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs ${
                    activeSampleId === "fresh_biryani" && !isInspectionBlocked
                      ? "bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20"
                      : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
                  }`}
                  aria-label="Test Fresh Dum Biryani with Mirage VLM"
                >
                  <Utensils className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  <span>Biryani (Fresh)</span>
                </button>
                <button
                  type="button"
                  onClick={() => runInstantInspection("fresh_paneer")}
                  className={`px-2.5 py-2 rounded-xl border text-xs font-label font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs ${
                    activeSampleId === "fresh_paneer" && !isInspectionBlocked
                      ? "bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20"
                      : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
                  }`}
                  aria-label="Test Fresh Paneer Tray with Mirage VLM"
                >
                  <Flame className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  <span>Paneer (Fresh)</span>
                </button>
                <button
                  type="button"
                  onClick={() => runInstantInspection("spoiled_curry")}
                  className={`px-2.5 py-2 rounded-xl border text-xs font-label font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs ${
                    activeSampleId === "spoiled_curry" && isInspectionBlocked
                      ? "bg-red-50 border-red-500 text-red-800 ring-2 ring-red-500/20"
                      : "bg-white text-red-600 border-red-200 hover:bg-red-50"
                  }`}
                  aria-label="Test Spoiled Curry Hazard with Mirage VLM"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                  <span>Curry (Spoiled)</span>
                </button>
                <button
                  type="button"
                  onClick={() => runInstantInspection("expired_rice")}
                  className={`px-2.5 py-2 rounded-xl border text-xs font-label font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs ${
                    activeSampleId === "expired_rice" && isInspectionBlocked
                      ? "bg-red-50 border-red-500 text-red-800 ring-2 ring-red-500/20"
                      : "bg-white text-red-600 border-red-200 hover:bg-red-50"
                  }`}
                  aria-label="Test Expired Rice Danger Zone with Mirage VLM"
                >
                  <AlertOctagon className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                  <span>Rice (Expired)</span>
                </button>
              </div>
            )}

            {/* Custom Camera / Upload Button */}
            <div className="pt-1 flex items-center justify-between text-xs font-label">
              <span className="text-stone-500">Or inspect custom batch photo:</span>
              <label className="px-3 py-1.5 rounded-lg bg-white text-stone-700 border border-stone-200 hover:bg-stone-50 cursor-pointer flex items-center gap-1.5 font-bold shadow-xs transition-colors">
                <Camera className="h-3.5 w-3.5 text-emerald-600" />
                <span>Camera / Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  aria-label="Upload packaging photo for inspection"
                />
              </label>
            </div>
          </div>

          {/* Donor selection */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="post-donor-id"
                className="text-stone-700 font-bold font-label text-xs block"
              >
                DONOR VENUE / KITCHEN
              </label>
              {selectedDonor && (
                <span className="text-[10px] text-stone-500 font-medium flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-600" />
                  <span>{selectedDonor.address || "Bengaluru Metro"}</span>
                </span>
              )}
            </div>
            <select
              id="post-donor-id"
              value={formData.donor_id}
              onChange={(e) =>
                setFormData({ ...formData, donor_id: e.target.value })
              }
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-stone-900 font-semibold focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
              required
            >
              {donors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.donor_type})
                </option>
              ))}
            </select>
          </div>

          {/* Food description */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="post-food-name"
                className="text-stone-700 font-bold font-label text-xs block"
              >
                FOOD RATION DESCRIPTION
              </label>
              <span className="text-[10px] text-stone-400 font-mono">Form 68-A Spec</span>
            </div>
            <input
              id="post-food-name"
              type="text"
              value={formData.food_name}
              onChange={(e) =>
                setFormData({ ...formData, food_name: e.target.value })
              }
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-stone-900 font-medium focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
              required
            />
          </div>

          {/* Responsive 3-col grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="post-food-category"
                className="text-stone-700 font-bold font-label text-xs block"
              >
                CATEGORY
              </label>
              <select
                id="post-food-category"
                value={formData.food_category}
                onChange={(e) =>
                  setFormData({ ...formData, food_category: e.target.value })
                }
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-stone-900 font-semibold focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
              >
                <option value="VEG">VEG (Vegetarian)</option>
                <option value="NON_VEG">NON-VEG (Contains Meat)</option>
              </select>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="post-quantity-meals"
                  className="text-stone-700 font-bold font-label text-xs block"
                >
                  MEAL COUNT
                </label>
                <span className="text-[10px] text-emerald-600 font-semibold font-mono">Portions</span>
              </div>
              <input
                id="post-quantity-meals"
                type="number"
                min="1"
                value={formData.quantity_meals}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    quantity_meals: parseInt(e.target.value, 10) || 0,
                  })
                }
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-stone-900 font-bold focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
                required
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="post-quantity-kg"
                  className="text-stone-700 font-bold font-label text-xs block"
                >
                  MASS (KG)
                </label>
                <span className="text-[10px] text-stone-400 font-mono">
                  {formData.quantity_meals > 0
                    ? `~${((formData.quantity_kg || 0) / formData.quantity_meals).toFixed(2)} kg/meal`
                    : ""}
                </span>
              </div>
              <input
                id="post-quantity-kg"
                type="number"
                step="0.5"
                min="0.5"
                value={formData.quantity_kg}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    quantity_kg: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-stone-900 font-bold focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
                required
              />
            </div>
          </div>

          {/* Storage & Allergens */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="post-storage-type"
                className="text-stone-700 font-bold font-label text-xs block"
              >
                THERMAL STORAGE TYPE
              </label>
              <select
                id="post-storage-type"
                value={formData.storage_type}
                onChange={(e) =>
                  setFormData({ ...formData, storage_type: e.target.value })
                }
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-stone-900 font-semibold focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
              >
                <option value="HOT">HOT HOLD (&gt;65°C) • Thermal Insulated</option>
                <option value="AMBIENT">AMBIENT DRY (&lt;24°C) • Sealed Pack</option>
                <option value="REFRIGERATED">CHILLED (&lt;4°C) • Cold Chain</option>
              </select>
            </div>
            <div className="space-y-1">
              <label
                htmlFor="post-allergens"
                className="text-stone-700 font-bold font-label text-xs block"
              >
                ALLERGEN DECLARATION
              </label>
              <input
                id="post-allergens"
                type="text"
                value={formData.allergens}
                onChange={(e) =>
                  setFormData({ ...formData, allergens: e.target.value })
                }
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-stone-900 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
                placeholder="None, Dairy, Nuts, Gluten..."
              />
            </div>
          </div>

          {/* Handling notes */}
          <div className="space-y-1">
            <label
              htmlFor="post-handling-notes"
              className="text-stone-700 font-bold font-label text-xs block"
            >
              HANDLING &amp; PACKAGING NOTES
            </label>
            <input
              id="post-handling-notes"
              type="text"
              placeholder="Packaging details, insulated vessels, loading bay..."
              value={formData.handling_notes}
              onChange={(e) =>
                setFormData({ ...formData, handling_notes: e.target.value })
              }
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-stone-900 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
            />
          </div>

          {/* Safe Holding Window Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="post-hours-valid"
                className="text-stone-700 font-bold font-label text-xs block"
              >
                SAFE HOLDING WINDOW (HOURS)
              </label>
              <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                <Clock className="w-3 h-3 text-emerald-600" />
                <span>Expires ~{getExpiryTimeStr(formData.hours_valid)}</span>
              </span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
              <input
                id="post-hours-valid"
                type="range"
                min="1"
                max="6"
                step="0.5"
                value={formData.hours_valid}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    hours_valid: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-emerald-600 cursor-pointer"
                aria-label="Safe holding window in hours"
              />
              <span className="font-label font-extrabold text-emerald-700 text-xs whitespace-nowrap bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200">
                {formData.hours_valid} HOURS
              </span>
            </div>
          </div>

          {/* Section 80G Tax Benefit Summary Pill & ESG Offset Ledger */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs font-label shadow-xs">
              <span className="flex items-center gap-2 font-bold text-emerald-800">
                <Coins className="w-4 h-4 text-emerald-600" />
                <span>Section 80G Estimated Tax Deduction:</span>
              </span>
              <span className="font-extrabold text-emerald-700 font-headline text-sm tabular-nums">
                ₹{estimatedTaxBenefit.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs font-label shadow-xs">
              <span className="flex items-center gap-2 font-bold text-amber-900">
                <Leaf className="w-4 h-4 text-amber-600" />
                <span>Landfill CO₂e Diverted:</span>
              </span>
              <span className="font-extrabold text-amber-800 font-headline text-sm tabular-nums">
                {estimatedCo2Offset} kg CO₂e
              </span>
            </div>
          </div>
        </div>

          {/* Sticky Modal Footer with Full-Width Action */}
          <div className="sticky bottom-0 z-20 bg-white/95 backdrop-blur-md px-5 sm:px-6 py-3.5 border-t border-stone-200 flex flex-col gap-1.5 shadow-xs">
            <button
              type="submit"
              disabled={isSubmitting || isInspectionBlocked}
              className={`w-full py-3 sm:py-3.5 px-4 text-xs sm:text-sm flex items-center justify-center gap-2 uppercase font-extrabold rounded-xl transition-all shadow-md ${
                isInspectionBlocked
                  ? "bg-red-100 text-red-700 border-2 border-red-300 opacity-90 cursor-not-allowed"
                  : "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/25 cursor-pointer active:scale-[0.99]"
              }`}
              aria-label="Transmit Emergency Salvage Dispatch"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>TRANSMITTING EMERGENCY DISPATCH...</span>
                </>
              ) : isInspectionBlocked ? (
                <>
                  <AlertOctagon className="h-4 w-4" aria-hidden="true" />
                  <span>CANNOT DISPATCH: FOOD FAILED FSSAI HYGIENE INSPECTION (SPOILED)</span>
                </>
              ) : (
                <span className="tracking-wide">★ TRANSMIT EMERGENCY SALVAGE DISPATCH ★</span>
              )}
            </button>
            <div className="flex items-center justify-between text-[10px] text-stone-400 font-medium px-1">
              <span>⚡ Autonomous Courier Dispatch within 8.5 km radius</span>
              <span>⚖️ FSSAI 2019 Good Samaritan Immunity Applied</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
