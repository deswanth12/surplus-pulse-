import { useState, useEffect, useRef, type FC } from "react";
import { gsap } from "gsap";
import { Navigation, X, Send, RefreshCw, AlertTriangle, Lock, MessageSquare } from "lucide-react";
import { SmartMatchResponse } from "../../types";
import * as api from "../../services/api";

interface MatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchData: SmartMatchResponse | null;
  selectedReceiverId: string;
  setSelectedReceiverId: (id: string) => void;
  onConfirmClaim: (payload: {
    receiver_id: string;
    volunteer_name: string;
    volunteer_phone: string;
    vehicle_type: string;
  }) => Promise<void>;
}

export const MatchModal: FC<MatchModalProps> = ({
  isOpen,
  onClose,
  matchData,
  selectedReceiverId,
  setSelectedReceiverId,
  onConfirmClaim,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [volunteerName, setVolunteerName] = useState<string>("Vikram Adiga");
  const [volunteerPhone, setVolunteerPhone] = useState<string>("+91 99112 33445");
  const [vehicleType, setVehicleType] = useState<string>("Two-Wheeler Cargo");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-select first match if available
  useEffect(() => {
    if (matchData?.matches && matchData.matches.length > 0 && !selectedReceiverId) {
      setSelectedReceiverId(matchData.matches[0].receiver_id);
    }
  }, [matchData, selectedReceiverId, setSelectedReceiverId]);

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

  if (!isOpen || !matchData) return null;

  const handleClaim = async () => {
    if (isSubmitting) return;
    if (!selectedReceiverId) {
      setErrorMessage("Please select a recipient shelter from the ranked list.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await onConfirmClaim({
        receiver_id: selectedReceiverId,
        volunteer_name: volunteerName,
        volunteer_phone: volunteerPhone,
        vehicle_type: vehicleType,
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(
        err?.message || "Courier assignment failed. Please retry."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWhatsAppClaim = async () => {
    if (isSubmitting) return;
    if (!selectedReceiverId) {
      setErrorMessage("Please select a recipient shelter from the ranked list.");
      return;
    }
    const selectedReceiver = matchData.matches.find(
      (m) => m.receiver_id === selectedReceiverId
    );
    const brief = api.generateDispatchBriefText({
      listingId: matchData.listing_id,
      foodName: matchData.food_name,
      quantityKg: Math.round(matchData.quantity_meals * 0.45),
      quantityMeals: matchData.quantity_meals,
      donorName: matchData.donor_name,
      donorAddress: matchData.donor_address,
      donorCoordinates: { lat: 12.9716, lng: 77.6412 },
      shelterName: selectedReceiver?.receiver_name || "Relief Shelter Hub",
      shelterAddress: "Bengaluru Relief Corridor",
      shelterPhone: selectedReceiver?.contact_phone || "+91 98200 44556",
      scwMinutesRemaining: matchData.minutes_remaining,
      vehicleType,
    });
    const waLink = api.formatWhatsAppDispatchLink(volunteerPhone, brief);
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await onConfirmClaim({
        receiver_id: selectedReceiverId,
        volunteer_name: volunteerName,
        volunteer_phone: volunteerPhone,
        vehicle_type: vehicleType,
      });
      window.open(waLink, "_blank");
      onClose();
    } catch (err: any) {
      setErrorMessage(
        err?.message || "Courier assignment failed. Please retry."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 font-body overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-order-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="bg-white text-stone-900 border border-stone-200 shadow-2xl rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 my-8 max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-light-outline-variant/40 pb-3">
          <div>
            <h2
              id="match-order-title"
              className="text-base sm:text-title-md font-bold font-headline text-light-on-surface flex items-center gap-2"
            >
              <Navigation className="h-5 w-5 text-light-primary" aria-hidden="true" />
              <span>HAVERSINE PROXIMITY SMART DISPATCH ORDER</span>
            </h2>
            <p className="text-xs text-light-on-surface-variant font-label mt-0.5">
              TARGET: {matchData.food_name} • {matchData.quantity_meals} MEALS AVAILABLE
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-light-on-surface-variant hover:text-light-on-surface p-1.5 rounded-md hover:bg-light-surface-container transition-colors cursor-pointer"
            aria-label="Close Smart Match dialog"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Inline Error Banner */}
        {errorMessage && (
          <div
            className="p-3 bg-light-error-container text-light-on-error-container text-xs font-label flex items-start gap-2 rounded-xl border border-light-error/40 shadow-sm"
            role="alert"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-light-error" aria-hidden="true" />
            <div className="flex-1">
              <strong>DISPATCH ORDER ERROR:</strong> {errorMessage}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <label className="text-xs font-bold text-light-on-surface font-headline uppercase tracking-wide block">
            RANKED NEARBY CERTIFIED SHELTERS (PROXIMITY TELEMETRY):
          </label>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {matchData.matches.map((m) => {
              const matchPercent =
                m.match_fit === "OPTIMAL" || m.match_fit.includes("EXCELLENT")
                  ? 98
                  : m.match_fit === "GOOD"
                  ? 86
                  : 74;
              const isSelected = selectedReceiverId === m.receiver_id;

              return (
                <div
                  key={m.receiver_id}
                  onClick={() => setSelectedReceiverId(m.receiver_id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-colors flex items-center justify-between shadow-sm ${
                    isSelected
                      ? "bg-light-primary-container/20 border-light-primary text-light-on-surface shadow-md"
                      : "bg-light-surface-container-low border-light-outline-variant/60 hover:bg-light-surface-container text-light-on-surface"
                  }`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setSelectedReceiverId(m.receiver_id);
                    }
                  }}
                >
                  <div className="flex-1 pr-2">
                    <div className="font-bold text-xs sm:text-sm font-headline flex items-center gap-2 flex-wrap">
                      <span className="text-light-on-surface">{m.receiver_name}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-label font-bold ${
                          isSelected
                            ? "bg-light-primary text-light-on-primary"
                            : "bg-light-success-container text-light-on-success-container"
                        }`}
                      >
                        {m.match_fit} FIT
                      </span>
                    </div>
                    <div className="text-xs mt-1 flex items-center gap-2 font-label text-light-on-surface-variant flex-wrap">
                      <span className="tabular-nums">Capacity: {m.capacity_meals} meals</span>
                      <span>•</span>
                      <span className="font-bold text-light-primary tabular-nums">
                        {m.distance_km} km away
                      </span>
                    </div>
                  </div>

                  {/* Match Percentage Radial Gauge & Rank Score */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="relative h-10 w-10 flex items-center justify-center shrink-0">
                      <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-light-outline-variant/40"
                          strokeWidth="3.5"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className={isSelected ? "text-light-primary" : "text-light-success"}
                          strokeDasharray={`${matchPercent}, 100`}
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="none"
                        />
                      </svg>
                      <span className="absolute text-[9px] font-label font-bold text-light-on-surface tabular-nums">
                        {matchPercent}%
                      </span>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-label font-bold tabular-nums text-light-on-surface">
                        {m.urgency_score} PTS
                      </div>
                      <div className="text-[10px] text-light-primary font-label font-bold flex items-center justify-end gap-0.5">
                        {isSelected && <Lock className="h-3 w-3 inline text-light-primary" />}
                        <span>{isSelected ? "LOCKED" : "1-CLICK"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Courier Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs pt-2 font-label">
            <div>
              <label
                htmlFor="courier-name"
                className="text-light-on-surface-variant font-bold text-[11px] block"
              >
                COURIER NAME
              </label>
              <input
                id="courier-name"
                type="text"
                value={volunteerName}
                onChange={(e) => setVolunteerName(e.target.value)}
                className="w-full bg-light-surface-container-low border border-light-outline-variant/70 rounded-lg px-2.5 py-1.5 text-light-on-surface mt-1 font-semibold focus:border-light-primary focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="courier-phone"
                className="text-light-on-surface-variant font-bold text-[11px] block"
              >
                TELEPHONE
              </label>
              <input
                id="courier-phone"
                type="text"
                value={volunteerPhone}
                onChange={(e) => setVolunteerPhone(e.target.value)}
                className="w-full bg-light-surface-container-low border border-light-outline-variant/70 rounded-lg px-2.5 py-1.5 text-light-on-surface mt-1 font-medium focus:border-light-primary focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="courier-vehicle"
                className="text-light-on-surface-variant font-bold text-[11px] block"
              >
                VEHICLE TYPE
              </label>
              <select
                id="courier-vehicle"
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="w-full bg-light-surface-container-low border border-light-outline-variant/70 rounded-lg px-2 py-1.5 text-light-on-surface mt-1 font-semibold focus:border-light-primary focus:outline-none transition-colors"
              >
                <option value="Two-Wheeler Cargo">Two-Wheeler Cargo</option>
                <option value="Auto-Rickshaw">Auto-Rickshaw</option>
                <option value="Electric Delivery Van">Electric Cargo Van</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submit action buttons */}
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          <button
            type="button"
            onClick={handleClaim}
            disabled={isSubmitting}
            className="flex-1 py-3 rounded-md bg-light-primary text-light-on-primary font-label text-xs flex items-center justify-center gap-2 uppercase font-bold disabled:opacity-50 cursor-pointer shadow-sm hover:bg-light-primary-container transition-colors"
            aria-label="Transmit Dispatch and Claim Food Ration"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>TRANSMITTING DISPATCH ORDER...</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4 stroke-[2.5]" aria-hidden="true" />
                <span>[1-CLICK DISPATCH LOCK] TRANSMIT DISPATCH &amp; CLAIM FOOD RATION</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleWhatsAppClaim}
            disabled={isSubmitting}
            className="py-3 px-4 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-label text-xs flex items-center justify-center gap-1.5 uppercase font-bold disabled:opacity-50 cursor-pointer shadow-sm transition-colors shrink-0"
            aria-label="1-Click WhatsApp Dispatch and Claim"
            title="Claim mission and launch WhatsApp dispatch brief"
          >
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            <span>WHATSAPP DISPATCH</span>
          </button>
        </div>
      </div>
    </div>
  );
};
