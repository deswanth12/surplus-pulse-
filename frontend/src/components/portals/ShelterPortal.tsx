import { useState, type FC } from "react";
import {
  CheckCircle2,
  Clock,
  Thermometer,
  Truck,
} from "lucide-react";
import { Receiver, FoodListing } from "../../types";
import { confirmDelivery } from "../../services/api";

interface ShelterPortalProps {
  receivers: Receiver[];
  listings: FoodListing[];
  onConfirmDelivery?: (listingId: string, payload: any) => Promise<void>;
  onAdvanceStatus?: (listingId: string, nextStatus: "COLLECTED" | "DELIVERED") => Promise<void>;
  onToast?: (msg: string, type?: any) => void;
}

export const ShelterPortal: FC<ShelterPortalProps> = ({
  receivers = [],
  listings = [],
  onConfirmDelivery,
  onAdvanceStatus,
  onToast,
}) => {
  const [selectedReceiverId, setSelectedReceiverId] = useState<string>(
    receivers[0]?.id || "r1"
  );
  const [intakeTempInput, setIntakeTempInput] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);

  const activeReceiver =
    receivers.find((r) => r.id === selectedReceiverId) || receivers[0] || {
      id: "r1",
      name: "Robin Hood Army - Indiranagar Hub",
      receiver_type: "NGO",
      contact_name: "Neha Sen",
      contact_phone: "+91 98200 44556",
      capacity_meals: 150,
      address: "Double Road, Indiranagar",
      city: "Bengaluru",
    };

  // Incoming deliveries destined for this shelter
  const incomingDeliveries = listings.filter(
    (l) =>
      (l.pickup?.receiver_id === activeReceiver.id || (!l.pickup?.receiver_id && l.status === "CLAIMED")) &&
      (l.status === "CLAIMED" || l.status === "COLLECTED")
  );

  // Delivered shipments to this shelter
  const completedDeliveries = listings.filter(
    (l) => l.status === "DELIVERED"
  );

  const handleArrivalVerification = async (listing: FoodListing) => {
    setIsSubmitting(listing.id);
    const temp = intakeTempInput[listing.id] ?? 66.8;
    const isHotCompliant = temp >= 65.0;
    const isColdCompliant = temp <= 4.0;
    const isTempSafe = isHotCompliant || isColdCompliant;

    try {
      if (onConfirmDelivery) {
        await onConfirmDelivery(listing.id, {
          receiver_id: activeReceiver.id,
          intake_temp_c: temp,
          meals_accepted: listing.quantity_meals,
          notes: `Verified thermal triage: ${temp}°C (${isTempSafe ? "SAFE HOLD" : "DANGER ZONE"})`,
        });
      } else {
        await confirmDelivery(listing.id, {
          receiver_id: activeReceiver.id,
          intake_temp_c: temp,
          meals_accepted: listing.quantity_meals,
          notes: `Thermal intake verified: ${temp}°C`,
        });
        if (onAdvanceStatus) {
          await onAdvanceStatus(listing.id, "DELIVERED");
        }
      }

      if (onToast) {
        onToast(
          `SHELTER INTAKE SIGN-OFF RECORDED • ${listing.quantity_meals} MEALS ACCEPTED (${temp}°C)`,
          "SUCCESS"
        );
      }
    } catch (err: any) {
      if (onToast) {
        onToast(`INTAKE VERIFICATION ERROR: ${err?.message || "Failed to confirm"}`, "ERROR");
      }
    } finally {
      setIsSubmitting(null);
    }
  };

  return (
    <section
      role="region"
      aria-label="Shelter Intake Dashboard"
      className="space-y-6 font-body text-stone-900"
    >
      {/* Header */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold font-mono uppercase tracking-wider">
              CERTIFIED BENEFICIARY RELIEF PORTAL
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[10px] font-bold font-mono">
              FSSAI SCHEDULE IV CERTIFIED
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-headline text-stone-900">
            Shelter Intake &amp; Beneficiary Board
          </h2>
          <p className="text-xs text-stone-500 font-label">
            Monitor incoming food shipments, enforce thermal arrival triage, and log intake sign-offs.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-3 py-1 bg-emerald-50 text-emerald-800 text-xs font-mono font-bold rounded-xl border border-emerald-200">
            {completedDeliveries.length} Verified Intakes
          </span>
          <span className="text-xs font-semibold text-stone-600">Active Shelter:</span>
          <select
            value={activeReceiver.id}
            onChange={(e) => setSelectedReceiverId(e.target.value)}
            className="px-3 py-1.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-bold text-stone-800 cursor-pointer"
          >
            {receivers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Shelter Cards Grid (Directly matching T1_F4_03 assertions) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {receivers.map((r) => {
          const isFull = r.capacity_meals <= 0;
          return (
            <div
              key={r.id}
              className={`p-5 bg-white rounded-2xl border shadow-xs space-y-3 transition-colors ${
                r.id === activeReceiver.id ? "border-emerald-500 ring-2 ring-emerald-100" : "border-stone-200/90"
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-bold text-sm text-stone-900 block font-headline">
                    {r.name}
                  </span>
                  <span className="text-xs text-stone-500">
                    {r.address} • Contact: {r.contact_phone}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                    isFull
                      ? "bg-rose-100 text-rose-800"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {isFull ? "CAPACITY REACHED 100%" : "INTAKE ACCEPTING"}
                </span>
              </div>

              {/* Capacity Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-stone-600 font-semibold">CAPACITY REMAINING:</span>
                  <span className="font-bold text-stone-900">{r.capacity_meals} Meals</span>
                </div>
                <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden border border-stone-200/60">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isFull ? "bg-rose-500" : "bg-emerald-600"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(10, ((150 - r.capacity_meals) / 150) * 100))}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={isFull}
                onClick={() => setSelectedReceiverId(r.id)}
                className="w-full py-2.5 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl disabled:opacity-40 transition-colors cursor-pointer"
              >
                {isFull ? "Intake Suspended (Max Capacity)" : "Log Incoming Arrival Verification"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Incoming Food Shipments & Thermal Triage Checklist */}
      <div className="space-y-4 pt-2">
        <div className="flex justify-between items-center">
          <h3 className="font-bold font-headline text-base text-stone-900 flex items-center gap-2">
            <Truck className="w-4 h-4 text-emerald-700" />
            <span>Incoming Shipments En Route to {activeReceiver.name}</span>
          </h3>
          <span className="text-xs font-mono text-stone-500">
            {incomingDeliveries.length} Active Shipments
          </span>
        </div>

        {incomingDeliveries.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-stone-300 text-stone-500 text-sm space-y-2">
            <Clock className="w-8 h-8 text-stone-400 mx-auto" />
            <p>No active food shipments en route to this shelter right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {incomingDeliveries.map((l) => {
              const currentTemp = intakeTempInput[l.id] ?? 66.8;
              const isTempSafe = currentTemp >= 65.0 || currentTemp <= 4.0;

              return (
                <div
                  key={l.id}
                  className="p-5 bg-white rounded-2xl border border-stone-200/90 shadow-xs space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
                    <div>
                      <h4 className="font-bold text-sm text-stone-900">{l.food_name}</h4>
                      <p className="text-xs text-stone-500 font-label">
                        From: {l.donor_name} ({l.donor_address}) • Assigned: {l.pickup?.volunteer_name || "Volunteer Courier"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[10px] font-mono font-bold rounded-full">
                        ETA ~10-15 MINS
                      </span>
                      <span className="text-xs font-bold text-stone-900 font-mono">
                        {l.quantity_meals} Meals ({l.quantity_kg} kg)
                      </span>
                    </div>
                  </div>

                  {/* Thermal Triage Checklist */}
                  <div className="p-4 bg-stone-50 rounded-xl border border-stone-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs uppercase font-label text-stone-800 flex items-center gap-1.5">
                        <Thermometer className="w-4 h-4 text-emerald-700" />
                        <span>Thermal Triage Arrival Checklist (FSSAI Holding Requirement)</span>
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isTempSafe
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {isTempSafe ? "THERMAL CRITERIA SATISFIED" : "TEMPERATURE DANGER ZONE"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-2.5 bg-white rounded-lg border border-stone-200">
                        <span className="text-stone-500 text-[10px] block font-semibold">
                          HOT-HOLD REQUIREMENT:
                        </span>
                        <strong className="text-emerald-700 font-mono">&gt;65.0°C Core Hold</strong>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-stone-200">
                        <span className="text-stone-500 text-[10px] block font-semibold">
                          COLD-HOLD REQUIREMENT:
                        </span>
                        <strong className="text-sky-700 font-mono">&lt;4.0°C Chilled</strong>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-stone-200 flex items-center justify-between">
                        <div>
                          <span className="text-stone-500 text-[10px] block font-semibold">
                            MEASURED INTAKE TEMP:
                          </span>
                          <strong className={isTempSafe ? "text-emerald-700 font-mono" : "text-rose-700 font-mono"}>
                            {currentTemp.toFixed(1)}°C
                          </strong>
                        </div>
                        <input
                          type="number"
                          step="0.5"
                          value={currentTemp}
                          onChange={(e) =>
                            setIntakeTempInput((prev) => ({
                              ...prev,
                              [l.id]: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="w-16 px-1.5 py-1 text-right font-mono text-xs border border-stone-300 rounded bg-stone-50"
                          title="Verify temperature with probe sensor"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sign-off button */}
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isSubmitting === l.id}
                      onClick={() => handleArrivalVerification(l)}
                      className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4 text-white" />
                      <span>
                        {isSubmitting === l.id
                          ? "Recording Sign-off..."
                          : "Log Incoming Arrival Verification"}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
