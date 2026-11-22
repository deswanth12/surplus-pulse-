import { useState, type FC } from "react";
import {
  Zap,
  Navigation,
  MapPin,
  Clock,
  Phone,
  CheckCircle2,
  BatteryCharging,
  Gauge,
  Thermometer,
  ShieldCheck,
  Send,
  Truck,
} from "lucide-react";
import { FoodListing, Receiver } from "../../types";
import {
  formatWhatsAppDispatchLink,
  formatSmsDispatchLink,
  generateDispatchBriefText,
  dispatchListing,
} from "../../services/api";

interface CourierPortalProps {
  listings: FoodListing[];
  receivers: Receiver[];
  onAdvanceStatus?: (listingId: string, nextStatus: "COLLECTED" | "DELIVERED") => Promise<void>;
  onTrackDelivery?: (listing: FoodListing) => void;
  onToast?: (msg: string, type?: any) => void;
}

export function calculateUrnCount(quantityKg: number): number {
  if (quantityKg <= 0) return 0;
  return Math.max(1, Math.ceil(quantityKg / 18));
}

export const CourierPortal: FC<CourierPortalProps> = ({
  listings = [],
  receivers = [],
  onAdvanceStatus,
  onTrackDelivery,
  onToast,
}) => {
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

  // Active or Available missions
  const allMissions = listings.filter(
    (l) => l.status === "POSTED" || l.status === "CLAIMED" || l.status === "COLLECTED"
  );

  const defaultShelter = receivers[0] || {
    id: "r1",
    name: "Robin Hood Army - Indiranagar Hub",
    address: "Double Road, Indiranagar",
    contact_phone: "+91 98200 44556",
  };

  const handleWhatsAppDispatch = async (listing: FoodListing) => {
    setDispatchingId(listing.id);
    try {
      if (listing.status === "POSTED") {
        await dispatchListing(listing.id, {
          volunteer_name: "Robin Hood Army Volunteer Corps",
          volunteer_phone: "+91 98200 44556",
          vehicle_type: "EV Cargo Trike",
          notes: "1-Click WhatsApp mission dispatch from Courier Portal",
        });
      }

      const shelter =
        receivers.find((r) => r.id === listing.pickup?.receiver_id) || defaultShelter;
      const text = generateDispatchBriefText({
        listingId: listing.id,
        foodName: listing.food_name,
        quantityKg: listing.quantity_kg,
        quantityMeals: listing.quantity_meals,
        donorName: listing.donor_name,
        donorAddress: listing.donor_address,
        donorPhone: listing.donor_phone,
        donorCoordinates: { lat: 12.9716, lng: 77.6412 },
        shelterName: shelter.name,
        shelterAddress: shelter.address,
        shelterPhone: shelter.contact_phone,
        scwMinutesRemaining: listing.minutes_remaining,
        vehicleType: "EV Cargo Trike",
      });

      const url = formatWhatsAppDispatchLink(shelter.contact_phone, text);
      window.open(url, "_blank", "noopener,noreferrer");
      if (onToast) {
        onToast("1-CLICK WHATSAPP DISPATCH BRIEF TRANSMITTED TO VOLUNTEER CORPS", "DISPATCH");
      }
    } catch (err: any) {
      if (onToast) {
        onToast(`DISPATCH CLAIM ERROR: ${err?.message || "Failed to lock mission"}`, "ERROR");
      }
    } finally {
      setDispatchingId(null);
    }
  };

  return (
    <section
      role="region"
      aria-label="Volunteer Courier Dashboard"
      className="space-y-6 font-body text-stone-900"
    >
      {/* Corridor Header */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold font-mono uppercase tracking-wider">
              VOLUNTEER COURIER FLEET WORKSPACE
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[10px] font-bold font-mono">
              ROBIN HOOD ARMY &amp; FEEDING INDIA CORPS
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-headline text-stone-900">
            Volunteer Courier Fleet View
          </h2>
          <p className="text-xs text-stone-500 font-label">
            Real-time surplus dispatch, multi-waypoint navigation, and EV Cargo Trike telemetry.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3.5 py-1.5 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-full border border-emerald-300 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-emerald-600 fill-emerald-500" />
            <span>⚡ FLEET READY</span>
          </span>
        </div>
      </div>

      {/* EV Cargo Trike Live Telemetry HUD */}
      <div className="bg-stone-900 text-white rounded-2xl p-5 shadow-lg border border-stone-800 space-y-4">
        <div className="flex justify-between items-center border-b border-stone-800 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-emerald-400" />
            <span className="font-bold font-headline text-sm text-stone-100">
              EV CARGO TRIKE LIVE TELEMETRY HUD (LiFePO4 MATRIX)
            </span>
          </div>
          <span className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>CORRIDOR LINK ACTIVE • BENGALURU ARTERIAL 100FT RD</span>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
          {/* Speed Indicator */}
          <div className="p-3 bg-stone-800/80 rounded-xl border border-stone-700/80 space-y-1">
            <div className="flex items-center justify-between text-stone-400 text-[10px]">
              <span>VELOCITY</span>
              <Gauge className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="text-xl font-bold text-sky-300">28.4 km/h</div>
            <div className="text-[10px] text-stone-400">Target: 22–36 km/h</div>
          </div>

          {/* Battery Regen */}
          <div className="p-3 bg-stone-800/80 rounded-xl border border-stone-700/80 space-y-1">
            <div className="flex items-center justify-between text-stone-400 text-[10px]">
              <span>BATTERY (LiFePO4)</span>
              <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-emerald-400">88.2%</div>
            <div className="text-[10px] text-emerald-300 font-bold">⚡ REGEN ACTIVE</div>
          </div>

          {/* Cambro Core Temp */}
          <div className="p-3 bg-stone-800/80 rounded-xl border border-stone-700/80 space-y-1">
            <div className="flex items-center justify-between text-stone-400 text-[10px]">
              <span>CAMBRO THERMAL CORE</span>
              <Thermometer className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-bold text-amber-400">68.2°C</div>
            <div className="text-[10px] text-amber-300 font-bold">HOT HOLD &gt;65°C</div>
          </div>

          {/* Dynamic ETA */}
          <div className="p-3 bg-stone-800/80 rounded-xl border border-stone-700/80 space-y-1">
            <div className="flex items-center justify-between text-stone-400 text-[10px]">
              <span>ESTIMATED ARRIVAL</span>
              <Clock className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-xl font-bold text-purple-300">12 MINS</div>
            <div className="text-[10px] text-stone-400">Dist: 2.1 km remaining</div>
          </div>
        </div>
      </div>

      {/* Dispatch Corridor Banner */}
      <div className="p-4 bg-white rounded-2xl shadow-xs border border-stone-200/90 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="font-bold text-sm block font-headline tracking-wide text-stone-900">
            EV CARGO TRIKE DISPATCH CORRIDOR
          </span>
          <span className="text-xs text-stone-600">
            Active missions ready for 1-Click WhatsApp deep-link dispatch.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-bold text-emerald-700">
            {allMissions.length} Active Corridors
          </span>
        </div>
      </div>

      {/* Mission Discovery & Routing Cards */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold font-headline text-base text-stone-900 flex items-center gap-2">
            <Navigation className="w-4 h-4 text-emerald-700" />
            <span>Available &amp; Active Rescue Missions ({allMissions.length})</span>
          </h3>
        </div>

        {allMissions.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-stone-300 text-stone-500 text-sm">
            No active courier missions in corridor. Standby for newly declared commercial banquet surplus.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allMissions.map((l) => {
              const urnCount = calculateUrnCount(l.quantity_kg);
              const targetShelter =
                receivers.find((r) => r.id === l.pickup?.receiver_id) || defaultShelter;
              const isClaimed = l.status === "CLAIMED";
              const isCollected = l.status === "COLLECTED";

              const briefText = generateDispatchBriefText({
                listingId: l.id,
                foodName: l.food_name,
                quantityKg: l.quantity_kg,
                quantityMeals: l.quantity_meals,
                donorName: l.donor_name,
                donorAddress: l.donor_address,
                donorPhone: l.donor_phone,
                donorCoordinates: { lat: 12.9716, lng: 77.6412 },
                shelterName: targetShelter.name,
                shelterAddress: targetShelter.address,
                shelterPhone: targetShelter.contact_phone,
                scwMinutesRemaining: l.minutes_remaining,
                vehicleType: "EV Cargo Trike",
              });

              const waHref = formatWhatsAppDispatchLink(targetShelter.contact_phone, briefText);
              const smsHref = formatSmsDispatchLink(targetShelter.contact_phone, briefText);

              return (
                <div
                  key={l.id}
                  className="p-5 bg-white rounded-2xl border border-stone-200/90 shadow-xs space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-stone-900">{l.food_name}</h4>
                        <p className="text-xs text-stone-500 font-label">
                          {l.donor_name} ➔ {l.pickup?.receiver_name || targetShelter.name}
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
                        {l.status}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-amber-600 font-mono">
                      Containers: {urnCount} Urns ({l.quantity_kg} kg)
                    </div>

                    {/* Routing Waypoints Card */}
                    <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-stone-700">
                        <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span className="font-semibold truncate">Pickup: {l.donor_address}</span>
                      </div>
                      <div className="flex items-center gap-2 text-stone-700">
                        <Navigation className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="font-semibold truncate">Dropoff: {targetShelter.address}</span>
                      </div>
                      <div className="flex items-center justify-between text-stone-500 text-[11px] pt-1 border-t border-stone-200/60">
                        <span>Safe Consumption Window:</span>
                        <strong className="text-amber-700">{l.minutes_remaining}m left</strong>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Milestone Advances */}
                  <div className="space-y-2 pt-2 border-t border-stone-100">
                    <div className="flex gap-2">
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => {
                          if (l.status === "POSTED" && dispatchingId !== l.id) {
                            e.preventDefault();
                            handleWhatsAppDispatch(l);
                          }
                        }}
                        className={`flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl text-center transition-colors flex items-center justify-center gap-1.5 shadow-2xs ${
                          dispatchingId === l.id ? "opacity-50 pointer-events-none" : ""
                        }`}
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{dispatchingId === l.id ? "Dispatching..." : "1-Click WhatsApp Dispatch"}</span>
                      </a>
                      <a
                        href={smsHref}
                        className="py-2 px-3 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl text-center transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>SMS</span>
                      </a>
                    </div>

                    {/* Milestone Controls: CLAIMED -> COLLECTED -> DELIVERED */}
                    {onAdvanceStatus && (
                      <div className="flex gap-2">
                        {isClaimed && (
                          <button
                            type="button"
                            onClick={() => onAdvanceStatus(l.id, "COLLECTED")}
                            className="w-full py-2 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Mark Food Collected by Courier</span>
                          </button>
                        )}
                        {isCollected && (
                          <button
                            type="button"
                            onClick={() => onAdvanceStatus(l.id, "DELIVERED")}
                            className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-white" />
                            <span>Confirm Delivered to Shelter</span>
                          </button>
                        )}
                        {onTrackDelivery && (
                          <button
                            type="button"
                            onClick={() => onTrackDelivery(l)}
                            className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-xl transition-colors"
                            title="Open live telemetry tracker"
                          >
                            Live HUD
                          </button>
                        )}
                      </div>
                    )}
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
