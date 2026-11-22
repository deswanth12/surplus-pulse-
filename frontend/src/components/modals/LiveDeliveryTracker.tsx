import { useState, useEffect, useRef, type FC } from "react";
import { gsap } from "gsap";
import {
  X,
  Truck,
  Phone,
  CheckCircle2,
  Thermometer,
  BatteryCharging,
  ChevronRight,
  MessageSquare,
  Send,
  Zap,
} from "lucide-react";
import { FoodListing } from "../../types";
import { getSimulatedRouteProgress } from "../CrtRadarMap";
import * as api from "../../services/api";

interface LiveDeliveryTrackerProps {
  isOpen: boolean;
  onClose: () => void;
  listing: FoodListing | null;
  onAdvanceStatus: (listingId: string, nextStatus: "COLLECTED" | "DELIVERED") => Promise<void>;
  isAdvancing?: boolean;
  onOpenCertificate?: () => void;
}

const STEPS = [
  { step: 1, key: "INSPECTED", title: "Surplus Inspected & Verified", code: "FSSAI-2026" },
  { step: 2, key: "CLAIMED", title: "Courier Assigned", code: "ELECTRIC-TRIKE" },
  { step: 3, key: "COLLECTED", title: "Food Collected from Kitchen", code: "THERMAL-HOLD" },
  { step: 4, key: "IN_TRANSIT", title: "Courier in Transit (Live ETA)", code: "KORAMANGALA-GRID" },
  { step: 5, key: "DELIVERED", title: "Delivered to Shelter", code: "80G-VERIFIED" },
];

export const LiveDeliveryTracker: FC<LiveDeliveryTrackerProps> = ({
  isOpen,
  onClose,
  listing,
  onAdvanceStatus,
  isAdvancing = false,
  onOpenCertificate,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [etaMinutes, setEtaMinutes] = useState<number>(14);
  const [simulatedDistance, setSimulatedDistance] = useState<number>(2.4);
  const [callActive, setCallActive] = useState<boolean>(false);
  const [routeProgress, setRouteProgress] = useState<number>(0);

  // Same progress function as the radar marker, so both show the same position.
  useEffect(() => {
    if (!isOpen || !listing) return;

    const tick = () => setRouteProgress(getSimulatedRouteProgress(listing.id, listing.status));
    tick();
    const progressInterval = setInterval(tick, 1000);

    return () => {
      clearInterval(progressInterval);
    };
  }, [isOpen, listing]);

  useEffect(() => {
    if (!isOpen || !listing) return;

    const baseMins = listing.status === "COLLECTED" ? 8 : listing.status === "CLAIMED" ? 14 : 0;
    setEtaMinutes(baseMins);
    setSimulatedDistance(listing.status === "COLLECTED" ? 1.2 : 2.4);

    const interval = setInterval(() => {
      setEtaMinutes((prev) => (prev > 1 ? prev - 1 : 1));
      setSimulatedDistance((prev) => (prev > 0.3 ? parseFloat((prev - 0.2).toFixed(1)) : 0.2));
    }, 18000);

    return () => {
      clearInterval(interval);
    };
  }, [isOpen, listing]);

  useEffect(() => {
    if (!isOpen) return;

    if (modalRef.current) {
      gsap.fromTo(
        modalRef.current,
        { scale: 0.95, opacity: 0, y: 15 },
        { scale: 1, opacity: 1, y: 0, duration: 0.25, ease: "power2.out" }
      );
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !listing) return null;

  let activeStep = 1;
  if (listing.status === "POSTED") activeStep = 1;
  else if (listing.status === "CLAIMED") activeStep = 2;
  else if (listing.status === "COLLECTED") activeStep = 4;
  else if (listing.status === "DELIVERED") activeStep = 5;

  const driverName = listing.pickup?.volunteer_name || "Vikram Adiga";
  const driverPhone = listing.pickup?.volunteer_phone || "+91 99112 33445";
  const vehicleType = listing.pickup?.vehicle_type || "Maruti Eeco Cargo Van";
  const receiverName = listing.pickup?.receiver_name || "Robin Hood Army - Indiranagar Hub";

  const briefText = api.generateDispatchBriefText({
    listingId: listing.id,
    foodName: listing.food_name,
    quantityKg: listing.quantity_kg,
    quantityMeals: listing.quantity_meals,
    donorName: listing.donor_name,
    donorAddress: listing.donor_address,
    donorPhone: listing.donor_phone,
    shelterName: receiverName,
    shelterAddress: "Bengaluru Relief Shelter",
    shelterPhone: "+91 98200 44556",
    scwMinutesRemaining: listing.minutes_remaining,
    vehicleType,
  });
  const waCourierLink = api.formatWhatsAppDispatchLink(driverPhone, briefText);
  const smsCourierLink = api.formatSmsDispatchLink(driverPhone, briefText);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 overflow-y-auto font-body"
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-tracker-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-2xl bg-white text-stone-900 border border-stone-200 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col my-6"
      >
        {/* Header */}
        <header className="px-6 py-4 border-b border-light-outline-variant/50 flex items-start justify-between gap-4 bg-light-surface-container-low">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-md bg-light-primary text-light-on-primary flex items-center justify-center shadow-sm">
                <Truck className="w-4 h-4" />
              </span>
              <h2 id="live-tracker-title" className="font-headline text-title-lg text-light-on-surface font-bold">
                LIVE RESCUE DISPATCH TRACKER
              </h2>
            </div>
            <p className="font-body text-xs text-light-on-surface-variant mt-1">
              Hyperlocal Thermal Courier Relay • {listing.food_name} from {listing.donor_name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close delivery tracker"
            className="w-9 h-9 rounded-full bg-light-surface-container text-light-on-surface inline-flex items-center justify-center hover:bg-light-surface-container-high transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="p-6 overflow-y-auto flex flex-col gap-5">
          {/* Real-time ETA & Distance Hero Banner with Dynamic Telemetry */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-light-surface-container-low border border-light-outline-variant/60 rounded-xl p-4">
            <div>
              <span className="font-label text-xs font-semibold text-light-on-surface-variant block uppercase tracking-wider">
                ESTIMATED ARRIVAL
              </span>
              <span className="font-headline text-2xl font-bold text-light-primary tabular-nums">
                ETA: {etaMinutes} mins • {simulatedDistance} km away
              </span>
            </div>
            <div>
              <span className="font-label text-xs font-semibold text-light-on-surface-variant block uppercase tracking-wider">
                THERMAL VESSEL
              </span>
              <span className="font-headline text-lg font-bold text-light-success tabular-nums flex items-center gap-1 mt-1">
                <Thermometer className="w-4 h-4" />
                <span>66.4°C Hot Hold</span>
              </span>
              <span className="text-[10px] text-emerald-700 font-label font-bold block mt-0.5">
                &gt;65°C FSSAI Compliant
              </span>
            </div>
            <div>
              <span className="font-label text-xs font-semibold text-light-on-surface-variant block uppercase tracking-wider">
                VEHICLE BATTERY
              </span>
              <span className="font-headline text-lg font-bold text-light-primary tabular-nums flex items-center gap-1 mt-1">
                <BatteryCharging className="w-4 h-4" />
                <span>88% Electric Fleet</span>
              </span>
              <span className="text-[10px] text-amber-700 font-label font-bold flex items-center gap-1 mt-0.5">
                <Zap className="w-3 h-3 text-amber-600" />
                <span>⚡ REGEN ACTIVE</span>
              </span>
            </div>
            <div>
              <span className="font-label text-xs font-semibold text-light-on-surface-variant block uppercase tracking-wider">
                EV CRUISE SPEED
              </span>
              <span className="font-headline text-lg font-bold text-light-on-surface tabular-nums flex items-center gap-1 mt-1">
                <Truck className="w-4 h-4 text-emerald-600" />
                <span>28.6 km/h</span>
              </span>
              <span className="text-[10px] text-stone-500 font-label font-medium block mt-0.5">
                Arterial Eco-Transit
              </span>
            </div>
          </div>

          {/* Simulated route progress (same value as the radar marker) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 text-xs font-label text-light-on-surface-variant">
              <span className="font-semibold uppercase tracking-wider">Route progress • SIMULATED route, not real GPS</span>
              <span className="tabular-nums">{Math.round(routeProgress * 100)}%</span>
            </div>
            <div
              role="progressbar"
              aria-label="Simulated route progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(routeProgress * 100)}
              className="w-full h-2 rounded-full bg-light-surface-container-highest overflow-hidden"
            >
              <div
                className="h-full bg-light-primary transition-all duration-1000 ease-linear motion-reduce:transition-none"
                style={{ width: `${Math.round(routeProgress * 100)}%` }}
              />
            </div>
          </div>

          {/* 5-Step Interactive Status Progression Bar */}
          <div className="flex flex-col gap-2">
            <span className="font-label text-xs font-bold text-light-on-surface uppercase tracking-wider">
              5-Step Status Progression
            </span>
            <div className="space-y-2">
              {STEPS.map((st) => {
                const isPassed = st.step < activeStep;
                const isCurrent = st.step === activeStep;
                return (
                  <div
                    key={st.step}
                    className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                      isCurrent
                        ? "bg-light-surface-variant/50 border-light-primary shadow-sm"
                        : isPassed
                        ? "bg-light-surface-container-low border-light-outline-variant/40"
                        : "bg-light-surface-container-lowest border-light-outline-variant/30 opacity-75"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-label text-xs font-bold shrink-0 mt-0.5 tabular-nums ${
                        isPassed || isCurrent
                          ? "bg-light-primary text-light-on-primary"
                          : "bg-light-surface-container-highest text-light-on-surface-variant"
                      }`}
                    >
                      {isPassed ? <CheckCircle2 className="w-4 h-4" /> : st.step}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-label text-sm font-bold text-light-on-surface">
                          {st.title}
                        </p>
                        <span className="font-label text-xs text-light-on-surface-variant tabular-nums">
                          {st.code}
                        </span>
                      </div>
                      <p className="font-body text-xs text-light-on-surface-variant mt-0.5">
                        {st.step === 1 && "Optical, thermal, and FSSAI safe-hold guidelines certified."}
                        {st.step === 2 && `Volunteer courier ${driverName} assigned to mission.`}
                        {st.step === 3 && `Surplus secured in insulated cambros from ${listing.donor_name}.`}
                        {st.step === 4 && `Live transit to ${receiverName} • ${simulatedDistance} km remaining.`}
                        {st.step === 5 && `Signed and received at ${receiverName} • Form 68-A complete.`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Assigned Courier Telemetry Card */}
          <div className="p-4 rounded-xl bg-light-surface-container-low border border-light-outline-variant/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <img
                src="https://lh3.googleusercontent.com/aida/ALJJyrCvcsCccOOvoyLKqcpEeOvGbXYys5igk1yAcP1si51TEaJt4HiBdOAVg9Yv3_9IQHbf8v4_4LRtxQEYfU6kmE4D3oVDcQbvecV7o_wVNTUXg_Yx2zNsxMSL2ht6T1RzsKJDUOEZMNFC8oNyMUaRlwxzBxtX1RY-9DGjf4QX9yLntE2DWg7YzNlmKt59eba3OQgseQtSrvnA5w0RXlA_ubtKVDt6EMJGVXxAjWSZt84zV5zJ54kLQTLt"
                alt={driverName}
                className="w-12 h-12 rounded-full object-cover border border-light-outline-variant shrink-0"
              />
              <div className="min-w-0">
                <span className="font-label text-[10px] font-bold text-light-primary uppercase tracking-wider block">
                  ASSIGNED COURIER TELEMETRY
                </span>
                <p className="font-label text-sm font-bold text-light-on-surface">
                  {driverName} • 4.94 ★
                </p>
                <p className="font-body text-xs text-light-on-surface-variant truncate">
                  {vehicleType} • KA-01-EV-4821
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
              <button
                type="button"
                onClick={() => setCallActive((c) => !c)}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-md bg-light-primary text-light-on-primary hover:bg-light-primary-container font-label text-xs sm:text-sm font-bold shrink-0 transition-colors cursor-pointer"
              >
                <Phone className="w-4 h-4" />
                <span>{callActive ? `Dialing ${driverPhone}...` : "CALL COURIER"}</span>
              </button>
              <a
                href={waCourierLink}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp Courier"
                title="Send WhatsApp dispatch coordinates to courier"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 font-label text-xs sm:text-sm font-bold shrink-0 transition-colors cursor-pointer no-underline"
              >
                <MessageSquare className="w-4 h-4" />
                <span>WHATSAPP</span>
              </a>
              <a
                href={smsCourierLink}
                aria-label="SMS Courier"
                title="Send SMS dispatch alert to courier"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-stone-100 text-stone-800 hover:bg-stone-200 border border-stone-300 font-label text-xs sm:text-sm font-bold shrink-0 transition-colors cursor-pointer no-underline"
              >
                <Send className="w-4 h-4" />
                <span>SMS</span>
              </a>
            </div>
          </div>

          {/* Action Trigger in Modal */}
          {listing.status === "CLAIMED" && (
            <div className="pt-2 border-t border-light-outline-variant/40">
              <button
                type="button"
                disabled={isAdvancing}
                onClick={async () => {
                  await onAdvanceStatus(listing.id, "COLLECTED");
                }}
                className="w-full py-3 px-4 rounded-md bg-light-warning-container text-light-on-warning-container hover:opacity-90 font-label text-sm font-bold shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <span>CONFIRM FOOD COLLECTED FROM KITCHEN</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {listing.status === "COLLECTED" && (
            <div className="pt-2 border-t border-light-outline-variant/40">
              <button
                type="button"
                disabled={isAdvancing}
                onClick={async () => {
                  await onAdvanceStatus(listing.id, "DELIVERED");
                }}
                className="w-full py-3 px-4 rounded-md bg-light-primary text-light-on-primary hover:bg-light-primary-container font-label text-sm font-bold shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <span>CONFIRM DELIVERED TO SHELTER</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {listing.status === "DELIVERED" && onOpenCertificate && (
            <div className="pt-2 border-t border-light-outline-variant/40">
              <button
                type="button"
                onClick={onOpenCertificate}
                className="w-full py-3 px-4 rounded-md bg-light-success-container text-light-on-success-container hover:opacity-90 font-label text-sm font-bold shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <span>View Handover Audit Certificate</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="px-6 py-4 bg-light-surface-container-low border-t border-light-outline-variant/50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-light-surface-container-lowest border border-light-outline-variant text-light-on-surface font-label text-sm font-semibold hover:bg-light-surface-container cursor-pointer"
          >
            Close Tracker
          </button>
        </footer>
      </div>
    </div>
  );
};
