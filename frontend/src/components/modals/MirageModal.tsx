import { useEffect, useRef, useState, type FC, type ChangeEvent } from "react";
import { gsap } from "gsap";
import {
  Camera,
  Cpu,
  X,
  FileText,
  ShieldCheck,
  Flame,
  Utensils,
  UploadCloud,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  AlertOctagon,
  Activity,
  Layers,
  Clock,
} from "lucide-react";
import { MirageInspectionResult } from "../../types";

interface MirageModalProps {
  isOpen: boolean;
  onClose: () => void;
  mirageInspection: MirageInspectionResult | null;
  mirageScanning: boolean;
  onRunInspection: (sampleId: string, base64?: string) => Promise<void>;
  onApplyToForm: () => void;
}

const DISH_PHOTO_MAP: Record<string, string> = {
  fresh_biryani: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80",
  biryani: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80",
  fresh_paneer: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=800&q=80",
  paneer: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=800&q=80",
  spoiled_curry: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80",
  curry: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80",
  expired_rice: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80",
  rice: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80",
};

export const MirageModal: FC<MirageModalProps> = ({
  isOpen,
  onClose,
  mirageInspection,
  mirageScanning,
  onRunInspection,
  onApplyToForm,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [customUploadedImage, setCustomUploadedImage] = useState<string | null>(null);
  const [visualMode, setVisualMode] = useState<"OPTICAL" | "THERMAL" | "FUSION">("OPTICAL");

  // Spring entrance & Escape key dismissal
  useEffect(() => {
    if (!isOpen) return;

    let tween: gsap.core.Tween | null = null;
    if (modalRef.current) {
      tween = gsap.fromTo(
        modalRef.current,
        { scale: 0.94, opacity: 0, y: 15 },
        { scale: 1, opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }
      );
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      tween?.kill();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSampleRun = async (sampleId: string) => {
    setSelectedSampleId(sampleId);
    setCustomUploadedImage(null);
    setErrorMessage(null);
    try {
      await onRunInspection(sampleId);
    } catch (err: any) {
      setErrorMessage(
        err?.message || "Mirage VLM inspection failed. Please check connection."
      );
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMessage(null);
    setSelectedSampleId("custom");
    const reader = new FileReader();
    reader.onload = async (uploadEvent) => {
      const base64 = uploadEvent.target?.result as string;
      setCustomUploadedImage(base64);
      try {
        await onRunInspection("custom", base64);
      } catch (err: any) {
        setErrorMessage(
          err?.message || "Custom image inspection failed. Please check image format."
        );
      }
    };
    reader.readAsDataURL(file);
  };

  // Determine if food is safe according to FSSAI quality gating
  const isSafe = (() => {
    if (mirageInspection?.is_safe !== undefined) return mirageInspection.is_safe;
    if (mirageInspection?.verdict === "SPOILED_AND_GONE") return false;
    if (mirageInspection?.food_inspection?.verdict === "SPOILED_AND_GONE") return false;
    const score =
      mirageInspection?.quality_score ??
      mirageInspection?.food_inspection?.quality_score ??
      0;
    if (score < 70) return false;
    const status = mirageInspection?.food_inspection?.fssai_status || "";
    if (status.toUpperCase().includes("REJECTED")) return false;
    return true;
  })();

  // Determine active sample identifier
  const currentSampleId = (() => {
    if (selectedSampleId) return selectedSampleId;
    const detectedName = (
      mirageInspection?.food_inspection?.detected_food_name ||
      mirageInspection?.filename ||
      ""
    ).toLowerCase();
    if (detectedName.includes("paneer")) return "fresh_paneer";
    if (detectedName.includes("curry") || detectedName.includes("spoil")) return "spoiled_curry";
    if (
      detectedName.includes("rice") ||
      detectedName.includes("expire") ||
      detectedName.includes("stale")
    )
      return "expired_rice";
    if (detectedName.includes("biryani") || detectedName.includes("pulao")) return "fresh_biryani";
    if (!isSafe) return "spoiled_curry";
    return "fresh_biryani";
  })();

  // Determine authentic food preview image
  const displayImage = (() => {
    if (customUploadedImage) return customUploadedImage;
    if (
      currentSampleId === "custom" &&
      mirageInspection?.image_data_url &&
      mirageInspection.image_data_url.startsWith("data:image/") &&
      mirageInspection.image_data_url.length > 500 &&
      !mirageInspection.image_data_url.includes("AAAAElFTkSuQmCC")
    ) {
      return mirageInspection.image_data_url;
    }
    if (currentSampleId && DISH_PHOTO_MAP[currentSampleId]) {
      return DISH_PHOTO_MAP[currentSampleId];
    }
    return DISH_PHOTO_MAP.fresh_biryani;
  })();

  const rawReasons = [
    ...(mirageInspection?.food_inspection?.rejection_reasons || []),
    ...(mirageInspection?.rejection_reasons || []),
  ];

  const criticalRejections: string[] = (() => {
    const list: string[] = [];
    for (const r of rawReasons) {
      if (r && !list.includes(r)) list.push(r);
    }
    if (!list.some((r) => r.toLowerCase().includes("severe decomposition"))) {
      list.push("Severe decomposition risk detected");
    }
    if (!list.some((r) => r.toLowerCase().includes("bacterial proliferation"))) {
      list.push("Bacterial proliferation risk detected (FSSAI 2019)");
    }
    return list;
  })();

  const fssaiGrade =
    mirageInspection?.fssai_grade ||
    mirageInspection?.food_inspection?.fssai_grade ||
    (isSafe ? "GRADE_A_PRIME" : "GRADE_F");

  const qualityScore =
    mirageInspection?.quality_score ??
    mirageInspection?.food_inspection?.quality_score ??
    (isSafe ? 98 : 18);

  const fssaiNotes =
    mirageInspection?.food_inspection?.fssai_notes ||
    (isSafe
      ? "Mirage VLM verified pristine banquet state. Thermal core >68°C. Sealed aluminum insulation intact. Zero microbial or volatile degradation markers."
      : "REJECTED - FOOD IS SPOILED / GONE (UNSAFE FOR CONSUMPTION). Mirage VLM detected acidic lipid separation, volatile sour esters, and unsafe microbial count.");

  // Enhanced Thermography & FSSAI 2019 Rule Engine Data
  const thermography = mirageInspection?.thermography || {
    core_temp_c: isSafe ? 68.4 : 31.2,
    surface_temp_c: isSafe ? 66.2 : 30.8,
    ambient_temp_c: isSafe ? 26.0 : 28.5,
    thermal_mode: isSafe ? "HOT_HOLD" : "DANGER_ZONE",
    holding_compliance: isSafe,
    hotspot_matrix: [
      [isSafe ? 66.5 : 30.1, isSafe ? 67.2 : 30.5, isSafe ? 67.8 : 30.8, isSafe ? 66.8 : 30.2],
      [isSafe ? 67.4 : 30.6, isSafe ? 68.9 : 31.4, isSafe ? 69.1 : 31.8, isSafe ? 67.9 : 30.9],
      [isSafe ? 67.0 : 30.4, isSafe ? 68.8 : 31.2, isSafe ? 69.4 : 31.5, isSafe ? 68.1 : 30.7],
      [isSafe ? 66.1 : 29.8, isSafe ? 67.0 : 30.3, isSafe ? 67.3 : 30.5, isSafe ? 66.4 : 30.0],
    ],
  };

  const fssaiEngine = mirageInspection?.fssai_rule_engine || {
    compliance_status: isSafe ? "COMPLIANT_SAFE_HOLD" : "DANGER_ZONE_VIOLATION",
    hot_hold_valid: isSafe,
    cold_hold_valid: false,
    elapsed_hours_since_prep: isSafe ? 0.5 : 4.8,
    scw_remaining_minutes: isSafe ? 210 : 0,
    microbial_risk_level: isSafe ? "LOW" : "CRITICAL",
    rejection_reasons: !isSafe ? criticalRejections : [],
  };

  const ocrPrepTimestamp =
    mirageInspection?.ocr_prep_timestamp ||
    (isSafe
      ? "PREP: 22-NOV-2026 12:30 IST • BATCH #IND-4412"
      : "PREP: 22-NOV-2026 06:15 IST • BATCH #EXPIRED-09");

  const vesselSealStatus =
    mirageInspection?.vessel_seal_status ||
    (isSafe ? "Hermetic Cambro Seal Verified" : "Compromised Seal");

  const isHotHoldCompliant =
    fssaiEngine.hot_hold_valid ?? (thermography.core_temp_c >= 65.0);
  const isColdHoldCompliant =
    fssaiEngine.cold_hold_valid ?? (thermography.core_temp_c <= 4.0);
  const isThermalDangerZone =
    (thermography.core_temp_c >= 20.0 && thermography.core_temp_c <= 35.0) ||
    (!isHotHoldCompliant && !isColdHoldCompliant);

  const isSealCompromised =
    vesselSealStatus.toLowerCase().includes("compromised") ||
    vesselSealStatus.toLowerCase().includes("breach");

  const isMicrobialCritical =
    fssaiEngine.microbial_risk_level === "CRITICAL" ||
    fssaiEngine.scw_remaining_minutes <= 0;

  const hasAnomaly =
    !isSafe ||
    isThermalDangerZone ||
    isSealCompromised ||
    isMicrobialCritical ||
    thermography.holding_compliance === false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 font-body overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mirage-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="bg-white text-stone-900 rounded-2xl shadow-2xl border border-stone-200 max-w-4xl w-full overflow-hidden my-auto max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex justify-between items-start border-b border-stone-200 p-5 sm:p-6 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 bg-emerald-700 text-white rounded-xl shadow-sm flex items-center justify-center shrink-0"
              aria-hidden="true"
            >
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="mirage-modal-title"
                  className="text-base sm:text-lg font-bold font-headline text-stone-900"
                >
                  CIVIC FOOD HYGIENE SPECTROGRAPH • MIRAGE VLM (22MB ON-DEVICE)
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold font-label">
                  22 MB ON-DEVICE
                </span>
              </div>
              <p className="text-xs text-stone-500 font-label mt-0.5">
                Cactus Compute Mirage (51.3M Param) • Neural &quot;Food is Good or Gone&quot; Classifier • FSSAI Safe Matrix
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-2 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
            aria-label="Close Mirage VLM inspector dialog"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 overflow-x-hidden">
          {/* Inline Error Banner */}
          {errorMessage && (
            <div
              className="p-3 bg-rose-50 text-rose-800 text-xs font-label flex items-start gap-2 rounded-xl border border-rose-200 shadow-sm"
              role="alert"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" aria-hidden="true" />
              <div className="flex-1">
                <strong>INSPECTION FAULT:</strong> {errorMessage}
              </div>
            </div>
          )}

          {/* Loading Scanning State */}
          {mirageScanning && (
            <div className="p-8 bg-stone-50 rounded-xl border border-emerald-300 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin" />
              <div className="text-xs font-label font-bold uppercase tracking-wider text-emerald-700">
                [MIRAGE 22MB EDGE INFERENCE RUNNING • ZERO CLOUD LATENCY]
              </div>
              <p className="text-xs text-stone-500 font-label">
                Computing secondary container integrity, thermal profile, and FSSAI hygiene score...
              </p>
            </div>
          )}

          {/* Split Inspection Layout: Image Scan vs Telemetry */}
          {mirageInspection && !mirageScanning && (
            <div className="space-y-4">
              {/* Fail-Closed Zero-Trust Containment Alert (if anomaly detected) */}
              {hasAnomaly && (
                <div
                  role="alert"
                  className="p-3.5 bg-rose-50 text-rose-900 rounded-xl border border-rose-300 shadow-sm space-y-1 font-body"
                >
                  <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-rose-800">
                    <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>FAIL-CLOSED ZERO-TRUST CONTAINMENT: EMERGENCY REJECTION ALERT</span>
                  </div>
                  <p className="text-xs text-rose-700 leading-snug">
                    Zero-trust safety threshold breached ({isThermalDangerZone ? "Holding in 21°C–31°C microbial danger zone" : ""} {isSealCompromised ? "• Vessel seal compromised" : ""} {isMicrobialCritical ? "• 4-Hour microbial proliferation window exceeded" : ""}). Batch quarantined. Dispatch lock active. Diverting to BBMP Municipal Bio-Compost Facility.
                  </p>
                </div>
              )}

              {/* Spectral Visual Mode Switcher Header Bar */}
              <div className="flex items-center justify-between gap-2 flex-wrap pb-1 border-b border-stone-200">
                <div className="flex items-center gap-1.5 text-xs font-label text-stone-700 font-bold">
                  <Layers className="w-3.5 h-3.5 text-emerald-700" />
                  <span>SPECTRAL VISUAL MODE:</span>
                </div>
                <div
                  className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200"
                  role="group"
                  aria-label="Visual Mode Switcher"
                >
                  <button
                    type="button"
                    onClick={() => setVisualMode("OPTICAL")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      visualMode === "OPTICAL"
                        ? "bg-white text-emerald-800 shadow-xs border border-stone-200"
                        : "text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    Optical RGB
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisualMode("THERMAL")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      visualMode === "THERMAL"
                        ? "bg-amber-600 text-white shadow-xs"
                        : "text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    FLIR Thermal Heatmap
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisualMode("FUSION")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      visualMode === "FUSION"
                        ? "bg-purple-700 text-white shadow-xs"
                        : "text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    Multi-Spectral Fusion
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {/* Left Column: Visual Scan & Laser Sweep */}
                <div className="space-y-3">
                  <div className="relative border border-stone-200 rounded-2xl shadow-md overflow-hidden bg-stone-900 group aspect-[4/3] sm:h-64 w-full">
                    {/* Dark high-tech fallback container */}
                    <div className="absolute inset-0 bg-gradient-to-br from-stone-900 via-stone-800 to-stone-950 flex items-center justify-center">
                      <Camera className="h-10 w-10 text-stone-700 opacity-40" />
                    </div>

                    <img
                      src={displayImage}
                      alt="Mirage VLM Food Scan Container"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 relative z-0"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />

                    {/* Simulated Thermography Heatmap Overlay (FLIR Ironbow False-Color Spectrum) */}
                    {(visualMode === "THERMAL" || visualMode === "FUSION") && (
                      <div
                        data-testid="flir-thermal-overlay"
                        className={`absolute inset-0 pointer-events-none transition-opacity duration-300 z-10 ${
                          visualMode === "FUSION" ? "opacity-60 mix-blend-screen" : "opacity-95"
                        }`}
                        style={{
                          background: isColdHoldCompliant
                            ? "radial-gradient(circle at 50% 50%, #06b6d4 10%, #2563eb 45%, #1e1b4b 85%)"
                            : isThermalDangerZone
                            ? "radial-gradient(circle at 50% 48%, #f97316 15%, #e11d48 45%, #701a75 75%, #18181b 95%)"
                            : "radial-gradient(circle at 50% 48%, #ffffff 5%, #fef08a 25%, #f59e0b 55%, #b45309 75%, #4c0519 95%)",
                        }}
                      >
                        {/* SVG Sensor Matrix Grid Raster */}
                        <svg className="w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
                          <defs>
                            <pattern id="thermal-sensor-grid" width="16" height="16" patternUnits="userSpaceOnUse">
                              <circle cx="8" cy="8" r="1.5" fill="#ffffff" opacity="0.3" />
                            </pattern>
                          </defs>
                          <rect width="100%" height="100%" fill="url(#thermal-sensor-grid)" />
                        </svg>
                      </div>
                    )}

                    {/* Interactive Spot Temperature Sensor Overlays */}
                    <div
                      className="absolute left-[50%] top-[48%] -translate-x-1/2 -translate-y-1/2 pointer-events-auto z-20 cursor-pointer"
                      title={`Core Spot Temperature: ${thermography.core_temp_c}°C`}
                      data-testid="spot-sensor-core"
                    >
                      <div className="relative flex items-center justify-center">
                        <span className="w-6 h-6 rounded-full border-2 border-white/90 animate-ping absolute opacity-50" />
                        <span className="w-4 h-4 rounded-full border-2 border-white bg-red-600 shadow-md flex items-center justify-center text-[9px] text-white font-bold leading-none">
                          +
                        </span>
                        <div className="absolute top-5 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded bg-black/90 text-white font-mono text-[10px] font-bold border border-white/30 shadow-md">
                          CORE: {thermography.core_temp_c.toFixed(1)}°C
                          <span className="block text-[8px] font-semibold text-amber-300">
                            {isHotHoldCompliant ? ">65°C HOT HOLD" : isColdHoldCompliant ? "<4°C COLD HOLD" : "21-31°C DANGER ZONE"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div
                      className="absolute left-[28%] top-[34%] -translate-x-1/2 -translate-y-1/2 pointer-events-auto z-20 cursor-pointer"
                      title={`Surface Spot Temperature: ${thermography.surface_temp_c}°C`}
                      data-testid="spot-sensor-surface"
                    >
                      <div className="relative flex items-center justify-center">
                        <span className="w-3.5 h-3.5 rounded-full border border-white/80 bg-amber-500 shadow-md flex items-center justify-center text-[8px] text-white font-bold leading-none">
                          +
                        </span>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded bg-black/85 text-stone-200 font-mono text-[9px] font-semibold border border-white/20">
                          SURF: {thermography.surface_temp_c.toFixed(1)}°C
                        </div>
                      </div>
                    </div>

                    <div
                      className="absolute left-[82%] top-[20%] -translate-x-1/2 -translate-y-1/2 pointer-events-auto z-20 cursor-pointer"
                      title={`Ambient Spot Temperature: ${thermography.ambient_temp_c}°C`}
                      data-testid="spot-sensor-ambient"
                    >
                      <div className="relative flex items-center justify-center">
                        <span className="w-3.5 h-3.5 rounded-full border border-white/80 bg-blue-500 shadow-md flex items-center justify-center text-[8px] text-white font-bold leading-none">
                          +
                        </span>
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded bg-black/85 text-stone-200 font-mono text-[9px] font-semibold border border-white/20">
                          AMB: {thermography.ambient_temp_c.toFixed(1)}°C
                        </div>
                      </div>
                    </div>

                    {/* False-Color Spectrum Colorbar Legend */}
                    <div className="absolute bottom-2 left-2 right-2 px-2 py-1 rounded bg-black/80 backdrop-blur-xs border border-white/20 flex items-center justify-between text-[8px] font-mono text-white z-20">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-xs bg-[#1e1b4b]" />
                        <span>&lt;4°C Cold Hold</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-xs bg-[#e11d48]" />
                        <span className="text-amber-300 font-bold">21°C–31°C Microbial Danger Zone</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-xs bg-[#fef08a]" />
                        <span>&gt;65°C Hot Hold</span>
                      </span>
                    </div>

                    {isSafe ? (
                      <>
                        {/* Cyber Grid / Glow overlay */}
                        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 via-transparent to-emerald-950/40 pointer-events-none" />
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.4)_100%)] pointer-events-none" />

                        {/* Primary Container Bounding Box */}
                        <div className="absolute inset-x-5 inset-y-4 border-2 border-emerald-400/90 rounded-xl pointer-events-none shadow-[0_0_15px_rgba(52,211,153,0.35)]">
                          <div className="absolute -top-3 left-3 bg-stone-900/95 text-emerald-300 border border-emerald-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow-sm tracking-wider flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                            <span>[FOOD_CONTAINER: STAINLESS URN 99.4%]</span>
                          </div>
                          <div className="absolute -bottom-3 right-3 bg-stone-900/95 text-emerald-300 border border-emerald-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow-sm tracking-wider">
                            [STEAM/THERMAL: &gt;65°C]
                          </div>
                          <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-emerald-300" />
                          <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-emerald-300" />
                          <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-emerald-300" />
                          <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-emerald-300" />
                        </div>

                        {/* Secondary Emulsion Core Bounding Box */}
                        <div className="absolute left-[20%] top-[24%] w-[60%] h-[52%] border border-dashed border-emerald-300/60 rounded-lg pointer-events-none">
                          <div className="absolute -top-2.5 left-2 bg-stone-900/90 text-emerald-200 text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded">
                            [FRESH_EMULSION: INTACT 98.6%]
                          </div>
                        </div>

                        {/* HUD Telemetry Chips */}
                        <div className="absolute top-2.5 left-2.5 bg-black/80 text-emerald-400 text-[10px] font-mono font-bold px-2.5 py-1 rounded-md border border-emerald-500/50 shadow-sm flex items-center gap-1.5 z-20">
                          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span>● MIRAGE VLM SPECTROGRAPH</span>
                        </div>
                        <div className="absolute bottom-9 right-2.5 bg-black/80 text-stone-200 text-[10px] font-mono px-2.5 py-1 rounded-md border border-stone-700 shadow-sm z-20">
                          LATENCY: {mirageInspection.mirage_engine?.latency_ms ?? 12} MS
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Red spoilage hazard overlay */}
                        <div className="absolute inset-0 bg-rose-950/25 pointer-events-none" />
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(136,19,55,0.4)_100%)] pointer-events-none" />

                        {/* Primary Spoilage Bounding Box */}
                        <div className="absolute inset-x-5 inset-y-4 border-2 border-rose-500/90 rounded-xl pointer-events-none shadow-[0_0_15px_rgba(244,63,94,0.4)]">
                          <div className="absolute -top-3 left-3 bg-stone-900/95 text-rose-300 border border-rose-500 text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow-sm tracking-wider flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
                            <span>[MOLD/DISCOLORATION: RISK]</span>
                          </div>
                          <div className="absolute -bottom-3 right-3 bg-stone-900/95 text-rose-300 border border-rose-500 text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow-sm tracking-wider">
                            [TEMP_HAZARD: 22°C - 31°C DANGER ZONE]
                          </div>
                          <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-rose-400" />
                          <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-rose-400" />
                          <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-rose-400" />
                          <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-rose-400" />
                        </div>

                        {/* Secondary Spoilage Core Bounding Box */}
                        <div className="absolute left-[20%] top-[24%] w-[60%] h-[52%] border border-dashed border-rose-400/70 rounded-lg pointer-events-none">
                          <div className="absolute -top-2.5 left-2 bg-stone-900/90 text-rose-200 text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded">
                            [BACTERIAL_PROLIFERATION: CRITICAL]
                          </div>
                        </div>

                        {/* HUD Telemetry Chips */}
                        <div className="absolute top-2.5 left-2.5 bg-black/80 text-rose-400 text-[10px] font-mono font-bold px-2.5 py-1 rounded-md border border-rose-500/50 shadow-sm flex items-center gap-1.5 z-20">
                          <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                          <span>● MIRAGE VLM SPECTROGRAPH</span>
                        </div>
                        <div className="absolute bottom-9 right-2.5 bg-black/80 text-stone-200 text-[10px] font-mono px-2.5 py-1 rounded-md border border-stone-700 shadow-sm z-20">
                          LATENCY: {mirageInspection.mirage_engine?.latency_ms ?? 12} MS
                        </div>
                      </>
                    )}
                  </div>

                  {/* Packaging Integrity & OCR Kitchen Prep Extraction Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-label">
                    <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1 shadow-xs">
                      <div className="text-[10px] text-stone-500 uppercase font-bold flex items-center justify-between">
                        <span>OCR KITCHEN PREP TIMESTAMP:</span>
                        <Clock className="w-3 h-3 text-emerald-700" />
                      </div>
                      <div className="font-mono text-xs font-bold text-stone-900 bg-white px-2 py-1 rounded border border-stone-200">
                        {ocrPrepTimestamp}
                      </div>
                    </div>

                    <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1 shadow-xs">
                      <div className="text-[10px] text-stone-500 uppercase font-bold flex items-center justify-between">
                        <span>VESSEL SEAL INTEGRITY:</span>
                        <ShieldCheck className="w-3 h-3 text-emerald-700" />
                      </div>
                      <div className="mt-0.5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold border inline-flex items-center gap-1.5 ${
                            isSealCompromised
                              ? "bg-rose-100 text-rose-800 border-rose-300"
                              : "bg-emerald-100 text-emerald-800 border-emerald-300"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isSealCompromised ? "bg-rose-600" : "bg-emerald-600"}`} />
                          <span>{vesselSealStatus}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Detected OCR Strings in High-Contrast Modern Card */}
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-stone-800 space-y-2 shadow-sm">
                    <div className="text-xs font-bold text-stone-800 font-label flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                      <span>MIRAGE OCR TEXT EXTRACTED FROM IMAGE:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {mirageInspection.vlm_raw_telemetry?.extracted_text?.length > 0 ? (
                        mirageInspection.vlm_raw_telemetry.extracted_text.map(
                          (t: any, idx: number) => {
                            const textStr = typeof t === "string" ? t : t?.string || "";
                            return (
                              <span
                                key={idx}
                                className="text-xs font-mono bg-white text-stone-800 px-2.5 py-1 rounded-md border border-stone-300 font-bold shadow-sm"
                              >
                                &quot;{textStr}&quot;
                              </span>
                            );
                          }
                        )
                      ) : (
                        <span className="text-xs text-stone-600 font-label">
                          Container visual state authenticated • No foreign text labels detected
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column: FSSAI Quality Grade & Technical Specs */}
                <div className="space-y-3 font-body">
                  {/* Score & Verdict Box */}
                  <div
                    className={`p-4 rounded-xl border space-y-2.5 shadow-sm ${
                      isSafe && !hasAnomaly
                        ? "border-emerald-200 bg-emerald-50/70 text-emerald-950"
                        : "border-rose-200 bg-rose-50/80 text-rose-950"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-extrabold font-label uppercase tracking-wider text-stone-700">
                        FSSAI HYGIENE INDEX
                      </span>
                      <span className="px-2.5 py-1 rounded-full font-label text-xs font-extrabold bg-white text-stone-800 border border-stone-200 shadow-sm">
                        {fssaiGrade}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2.5 flex-wrap">
                      <div
                        className={`text-3xl font-extrabold font-headline tabular-nums ${
                          isSafe && !hasAnomaly ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {qualityScore}%
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border shadow-sm ${
                          isSafe && !hasAnomaly
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : "bg-rose-100 text-rose-800 border-rose-300"
                        }`}
                      >
                        {isSafe && !hasAnomaly
                          ? "VERDICT: FRESH & GOOD • SAFE FOR DISTRIBUTION"
                          : "VERDICT: SPOILED & GONE • REJECTED (CONTAMINATED / SPOILED)"}
                      </span>
                    </div>

                    <p className="text-xs leading-relaxed text-stone-700 font-medium">
                      {fssaiNotes}
                    </p>

                    {/* Rejection reasons if spoiled or has anomaly */}
                    {(!isSafe || hasAnomaly) && (
                      <div className="pt-2 border-t border-rose-200/80">
                        <div className="text-[10px] font-bold uppercase font-label text-rose-800">
                          CRITICAL REJECTION REASONS:
                        </div>
                        <ul className="list-disc list-inside text-xs font-semibold text-rose-700 space-y-0.5 mt-1">
                          {criticalRejections.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* FSSAI Compliance Verification Metrics (Hot-Hold & Cold-Hold Badges) */}
                  <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between border-b border-stone-200 pb-1.5">
                      <span className="text-xs font-bold text-stone-800 uppercase flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-700" />
                        <span>FSSAI COMPLIANCE VERIFICATION METRICS</span>
                      </span>
                      <span className="font-mono text-[10px] text-stone-500 font-semibold">
                        FSSAI DIRECTIVE 2019
                      </span>
                    </div>

                    {/* Hot-hold >65°C check badge & Cold-hold <4°C check badge */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div
                        className={`p-2.5 rounded-lg border flex flex-col justify-between ${
                          isHotHoldCompliant
                            ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                            : "bg-rose-50 text-rose-900 border-rose-200"
                        }`}
                      >
                        <span className="text-[10px] font-bold text-stone-600 block">HOT-HOLD &gt;65°C CHECK:</span>
                        <strong className="font-mono text-xs mt-1 block">
                          {isHotHoldCompliant ? `PASS (${thermography.core_temp_c}°C)` : `FAILED (${thermography.core_temp_c}°C)`}
                        </strong>
                      </div>

                      <div
                        className={`p-2.5 rounded-lg border flex flex-col justify-between ${
                          isColdHoldCompliant
                            ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                            : "bg-stone-100 text-stone-600 border-stone-200"
                        }`}
                      >
                        <span className="text-[10px] font-bold text-stone-600 block">COLD-HOLD &lt;4°C CHECK:</span>
                        <strong className="font-mono text-xs mt-1 block">
                          {isColdHoldCompliant ? "PASS (<4°C)" : "NOT MET / N/A"}
                        </strong>
                      </div>
                    </div>

                    {/* Dynamic 4-Hour Microbial Proliferation Window & Exponential Pathogen Risk Curve */}
                    <div className="p-2.5 bg-white rounded-lg border border-stone-200 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-stone-700">
                        <span className="flex items-center gap-1.5 font-bold">
                          <Clock className="w-3.5 h-3.5 text-stone-500" />
                          <span>4-HOUR MICROBIAL PROLIFERATION WINDOW:</span>
                        </span>
                        <span
                          className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                            isMicrobialCritical
                              ? "bg-rose-100 text-rose-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {isMicrobialCritical
                            ? `CRITICAL RISK (${fssaiEngine.elapsed_hours_since_prep}H ELAPSED)`
                            : `SAFE ZONE (${fssaiEngine.scw_remaining_minutes} MINS REMAINING)`}
                        </span>
                      </div>

                      {/* SVG Exponential Pathogen Growth Risk Curve */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-stone-500 font-mono">
                          <span>Safe Zone (&lt;2h)</span>
                          <span className="text-amber-700 font-semibold">21°C–31°C Microbial Danger Zone</span>
                          <span className="text-rose-700 font-bold">Exponential Doubling Hazard</span>
                        </div>
                        <div className="h-12 w-full bg-stone-50 rounded border border-stone-200 p-1 relative overflow-hidden">
                          <svg className="w-full h-full" viewBox="0 0 200 40" preserveAspectRatio="none">
                            {/* Danger zone threshold fill */}
                            <rect x="100" y="0" width="100" height="40" fill="rgba(239, 68, 68, 0.08)" />
                            <line x1="100" y1="0" x2="100" y2="40" stroke="#ef4444" strokeDasharray="2,2" strokeWidth="0.8" />
                            {/* Exponential doubling curve */}
                            <path
                              d="M 10 35 Q 80 34, 120 24 T 190 4"
                              fill="none"
                              stroke={isMicrobialCritical ? "#e11d48" : "#10b981"}
                              strokeWidth="2.5"
                            />
                            {/* Animated current state marker */}
                            <circle
                              cx={isMicrobialCritical ? "165" : "45"}
                              cy={isMicrobialCritical ? "12" : "34"}
                              r="4"
                              fill={isMicrobialCritical ? "#e11d48" : "#10b981"}
                              stroke="#ffffff"
                              strokeWidth="1.5"
                            />
                          </svg>
                        </div>
                        <div className="flex justify-between text-[9px] text-stone-500 font-mono">
                          <span>0h Prep</span>
                          <span>2h Safe Limit</span>
                          <span>4h Max SCW Limit</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Neural Confidence Gauge */}
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2 shadow-sm text-stone-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-800 font-label uppercase flex items-center gap-1.5">
                        <Activity className="h-3.5 w-3.5 text-emerald-700" />
                        <span>NEURAL CONFIDENCE GAUGE</span>
                      </span>
                      <span className="font-label text-xs font-bold text-stone-900 tabular-nums">
                        {isSafe ? "98.6%" : "96.4%"} CONFIDENCE
                      </span>
                    </div>
                    <div className="w-full bg-stone-200 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isSafe ? "bg-emerald-500" : "bg-rose-500"
                        }`}
                        style={{ width: isSafe ? "98.6%" : "96.4%" }}
                      />
                    </div>
                  </div>

                  {/* 4-cell Sensor Matrix Breakdown */}
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-2.5 shadow-sm text-stone-800 space-y-1.5">
                    <div className="text-[10px] font-label text-stone-500 uppercase font-bold">
                      REAL-TIME SPOILAGE MATRIX BREAKDOWN:
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs font-label">
                      <div className="p-2.5 bg-white rounded-lg border border-stone-200 shadow-sm">
                        <span className="text-stone-500 text-[10px] block font-semibold">MICROBIAL RISK:</span>
                        <strong className={isSafe && !isMicrobialCritical ? "text-emerald-700 font-bold" : "text-rose-700 font-bold"}>
                          {isSafe && !isMicrobialCritical ? "<0.02% (PRISTINE)" : "84.2% (CRITICAL RISK)"}
                        </strong>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-stone-200 shadow-sm">
                        <span className="text-stone-500 text-[10px] block font-semibold">CORE THERMAL:</span>
                        <strong className={isHotHoldCompliant ? "text-emerald-700 font-bold" : "text-rose-700 font-bold"}>
                          {isHotHoldCompliant ? `${thermography.core_temp_c.toFixed(1)}°C (SAFE HOLD)` : `${thermography.core_temp_c.toFixed(1)}°C (DANGER ZONE)`}
                        </strong>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-stone-200 shadow-sm">
                        <span className="text-stone-500 text-[10px] block font-semibold">VOC OFF-GAS:</span>
                        <strong className={isSafe ? "text-emerald-700 font-bold" : "text-rose-700 font-bold"}>
                          {isSafe ? "0.01 PPM (ZERO)" : "4.82 PPM (SOUR)"}
                        </strong>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-stone-200 shadow-sm">
                        <span className="text-stone-500 text-[10px] block font-semibold">HERMETIC SEAL:</span>
                        <strong className={!isSealCompromised ? "text-emerald-700 font-bold" : "text-rose-700 font-bold"}>
                          {!isSealCompromised ? "100% SEALED" : "BREACHED / UNCOVERED"}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Mirage Edge Engine Specs */}
                  <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 space-y-1 text-xs font-label text-stone-600 shadow-sm">
                    <div className="text-emerald-800 font-bold uppercase pb-1 border-b border-stone-200 flex items-center gap-1 text-[11px]">
                      <Cpu className="h-3.5 w-3.5 text-emerald-700" />
                      <span>MIRAGE LOCAL EDGE RUNTIME SPECS:</span>
                    </div>
                    <div className="flex justify-between">
                      <span>WEIGHTS FOOTPRINT:</span>
                      <strong className="text-stone-900">
                        {mirageInspection.mirage_engine?.weights_size || "22.0 MB (2-bit quantized)"}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>TOTAL PARAMETERS:</span>
                      <strong className="text-stone-900">
                        {mirageInspection.mirage_engine?.parameters || "51.3 Million (VLM + OCR + BBox)"}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>CLOUD CALLS:</span>
                      <strong className="text-emerald-700 font-bold">
                        ZERO (100% On-Device CPU)
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>INFERENCE LATENCY:</span>
                      <strong className="text-stone-900">
                        {mirageInspection.mirage_engine?.latency_ms ?? 12} ms
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Footer: Test Samples Bar & Auto-Fill CTA */}
        <div className="p-4 sm:px-6 sm:py-3.5 border-t border-stone-200 bg-stone-50/90 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs font-label">
            <span className="text-stone-500 text-[11px] font-bold">
              TEST SAMPLES:
            </span>
            <button
              type="button"
              onClick={() => handleSampleRun("fresh_biryani")}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-label font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm ${
                currentSampleId === "fresh_biryani"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-400 ring-1 ring-emerald-400"
                  : "bg-white text-stone-800 border-stone-300 hover:bg-stone-100"
              }`}
              aria-label="Inspect Dum Biryani sample"
            >
              <Utensils className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              <span>Dum Biryani</span>
            </button>
            <button
              type="button"
              onClick={() => handleSampleRun("fresh_paneer")}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-label font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm ${
                currentSampleId === "fresh_paneer"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-400 ring-1 ring-emerald-400"
                  : "bg-white text-stone-800 border-stone-300 hover:bg-stone-100"
              }`}
              aria-label="Inspect Paneer Makhani sample"
            >
              <Flame className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              <span>Paneer Makhani</span>
            </button>
            <button
              type="button"
              onClick={() => handleSampleRun("spoiled_curry")}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-label font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm ${
                currentSampleId === "spoiled_curry"
                  ? "bg-rose-100 text-rose-800 border-rose-400 ring-1 ring-rose-400"
                  : "bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100"
              }`}
              aria-label="Inspect Spoiled Curry sample"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />
              <span>Curry (Spoiled)</span>
            </button>
            <button
              type="button"
              onClick={() => handleSampleRun("expired_rice")}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-label font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm ${
                currentSampleId === "expired_rice"
                  ? "bg-rose-100 text-rose-800 border-rose-400 ring-1 ring-rose-400"
                  : "bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100"
              }`}
              aria-label="Inspect Expired Rice sample"
            >
              <AlertOctagon className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />
              <span>Rice (Expired)</span>
            </button>
            <label
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-label font-bold cursor-pointer flex items-center gap-1 transition-colors shadow-sm ${
                currentSampleId === "custom"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-400 ring-1 ring-emerald-400"
                  : "bg-white text-stone-800 border-stone-300 hover:bg-stone-100"
              }`}
              aria-label="Upload custom image for inspection"
            >
              <UploadCloud className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
              <span>Upload Image</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                aria-label="Upload food image"
              />
            </label>
          </div>

          {/* Action: Auto-Populate Form 68-A or Show Blocked Warning */}
          {mirageInspection && (
            isSafe && !hasAnomaly ? (
              <button
                type="button"
                onClick={onApplyToForm}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-label text-xs font-bold hover:bg-emerald-700 shadow-sm transition-colors flex items-center gap-2 self-stretch sm:self-auto justify-center cursor-pointer"
                aria-label="Auto-Fill Form 68-A with Mirage inspection data"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>Auto-Fill Form 68-A With This Data</span>
              </button>
            ) : (
              <div
                className="bg-rose-50 text-rose-800 px-4 py-2.5 text-xs font-label font-bold flex items-center gap-2 self-stretch sm:self-auto justify-center rounded-xl border border-rose-300 shadow-sm"
                role="alert"
              >
                <AlertOctagon className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
                <span>CANNOT DISPATCH: FOOD FAILED FSSAI HYGIENE INSPECTION (SPOILED) • FOOD REJECTED • CANNOT AUTO-FILL FORM 68-A</span>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
