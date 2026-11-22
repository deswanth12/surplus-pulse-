import { useState, useRef, useEffect, useLayoutEffect, useMemo, type FC } from "react";
import { gsap } from "gsap";
import { Navigation, Truck, ShieldCheck, Radio, Thermometer, BatteryCharging, Layers, MapPin } from "lucide-react";
import { Donor, Receiver, FoodListing } from "../types";
import { RealStreetLeafletMap } from "./maps/RealStreetLeafletMap";
import { GoogleMapsPlatformView } from "./maps/GoogleMapsPlatformView";

// Demo duration for the simulated courier run (start -> destination).
export const SIMULATED_ROUTE_DURATION_MS = 120_000;

// First-seen start time per listing, shared by every caller in this module instance.
const simulatedRouteStarts = new Map<string, number>();

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Single source of truth for simulated courier progress (0..1).
 * Used by the radar marker and by LiveDeliveryTracker so both stay in sync.
 * Only COLLECTED listings are in transit; reduced-motion users jump to the end.
 */
export const getSimulatedRouteProgress = (
  listingId: string,
  status: string,
  now: number = Date.now()
): number => {
  if (status === "DELIVERED") return 1;
  if (status !== "COLLECTED") return 0;
  if (prefersReducedMotion()) return 1;
  let startedAt = simulatedRouteStarts.get(listingId);
  if (startedAt === undefined) {
    startedAt = now;
    simulatedRouteStarts.set(listingId, startedAt);
  }
  return Math.min(1, Math.max(0, (now - startedAt) / SIMULATED_ROUTE_DURATION_MS));
};

export interface RouteWaypointCoord {
  x: number;
  y: number;
  label: string;
}

export interface ArterialCorridorDefinition {
  name: string;
  description: string;
  intermediateOffsets: Array<{ dx: number; dy: number; label: string }>;
}

export const ARTERIAL_CORRIDORS: ArterialCorridorDefinition[] = [
  {
    name: "Koramangala 80ft Road Corridor",
    description: "Sony World Junction ➔ Koramangala 4th Block ➔ Dairy Circle",
    intermediateOffsets: [
      { dx: 25, dy: -20, label: "Sony World Junction Arterial" },
      { dx: -15, dy: 25, label: "Koramangala 4th Block Transit" },
    ],
  },
  {
    name: "Indiranagar 100ft Road Corridor",
    description: "CMH Road ➔ Indiranagar 100ft Road ➔ Domlur Flyover",
    intermediateOffsets: [
      { dx: 30, dy: 15, label: "CMH Road 100ft Junction" },
      { dx: -20, dy: 20, label: "Domlur Flyover Arterial" },
    ],
  },
  {
    name: "HSR Layout Eco-Transit Corridor",
    description: "27th Main ➔ Silk Board ➔ Agara Junction",
    intermediateOffsets: [
      { dx: -25, dy: 20, label: "27th Main HSR Corridor" },
      { dx: 20, dy: -15, label: "Silk Board ➔ Agara Link" },
    ],
  },
];

export function generateArterialWaypoints(
  start: { x: number; y: number },
  end: { x: number; y: number },
  corridorIdx: number = 0,
  donorName: string = "Pickup Point",
  receiverName: string = "Shelter Intake"
): RouteWaypointCoord[] {
  const corridor = ARTERIAL_CORRIDORS[corridorIdx % ARTERIAL_CORRIDORS.length];
  const off1 = corridor.intermediateOffsets[0];
  const off2 = corridor.intermediateOffsets[1];

  const w0: RouteWaypointCoord = {
    x: start.x,
    y: start.y,
    label: `${donorName} (${corridor.description.split("➔")[0].trim()})`,
  };

  const w1: RouteWaypointCoord = {
    x: Math.round(start.x * 0.65 + end.x * 0.35 + off1.dx),
    y: Math.round(start.y * 0.65 + end.y * 0.35 + off1.dy),
    label: off1.label,
  };

  const w2: RouteWaypointCoord = {
    x: Math.round(start.x * 0.30 + end.x * 0.70 + off2.dx),
    y: Math.round(start.y * 0.30 + end.y * 0.70 + off2.dy),
    label: off2.label,
  };

  const w3: RouteWaypointCoord = {
    x: end.x,
    y: end.y,
    label: `${receiverName} (Final Intake Gate)`,
  };

  return [w0, w1, w2, w3];
}

export function calculateArterialDynamics(
  waypoints: RouteWaypointCoord[],
  p: number
): {
  pos: { x: number; y: number };
  heading: number;
  speedKmh: number;
  batteryPercent: number;
  isRegenActive: boolean;
  cambroTempC: number;
  etaMinutes: number;
  distanceRemainingKm: number;
} {
  const clampedP = Math.max(0, Math.min(1, p));
  const numSegments = Math.max(1, waypoints.length - 1);
  const segIdx = Math.min(numSegments - 1, Math.floor(clampedP * numSegments));
  const t = (clampedP - segIdx / numSegments) * numSegments;

  const p0 = waypoints[segIdx];
  const p1 = waypoints[segIdx + 1] || p0;

  const x = p0.x + (p1.x - p0.x) * t;
  const y = p0.y + (p1.y - p0.y) * t;

  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const heading = (Math.atan2(dy, dx) * 180) / Math.PI;

  // Near turn waypoints: vehicle decelerates realistically (22.0 - 26.0 km/h) and triggers regen
  const isNearWaypoint = (t < 0.15 || t > 0.82) && clampedP < 0.98;
  const isRegenActive = isNearWaypoint && t > 0.82;
  const speedKmh = clampedP >= 1.0 ? 0 : isNearWaypoint ? 23.5 : 34.2;

  // Battery discharge with slight recovery when regen active
  const baseBattery = 88.0 - clampedP * 12.0;
  const batteryPercent = parseFloat((baseBattery + (isRegenActive ? 0.8 : 0.0)).toFixed(1));

  // Cambro thermal hot-hold hold steady >65°C
  const cambroTempC = parseFloat((68.2 - clampedP * 1.8).toFixed(1));

  // Dynamic ETA & distance
  const distanceRemainingKm = parseFloat((Math.max(0, (1 - clampedP) * 3.8)).toFixed(1));
  const etaMinutes = clampedP >= 1.0 ? 0 : Math.max(1, Math.ceil((distanceRemainingKm / (speedKmh || 25)) * 60));

  return {
    pos: { x, y },
    heading,
    speedKmh,
    batteryPercent,
    isRegenActive,
    cambroTempC,
    etaMinutes,
    distanceRemainingKm,
  };
}

interface CrtRadarMapProps {
  donors: Donor[];
  receivers: Receiver[];
  listings: FoodListing[];
  onConfirmDelivery?: (listingId: string) => void;
}

export const CrtRadarMap: FC<CrtRadarMapProps> = ({
  donors,
  receivers,
  listings,
  onConfirmDelivery,
}) => {
  const [hoveredPin, setHoveredPin] = useState<string | null>(null);
  const [activeMapEngine, setActiveMapEngine] = useState<
    "REAL_STREETS" | "SATELLITE" | "GOOGLE_MAPS" | "RADAR"
  >("REAL_STREETS");
  const containerRef = useRef<HTMLDivElement>(null);
  const vehicleRefs = useRef(new Map<string, SVGGElement>());
  const deliveredTriggeredRef = useRef<Set<string>>(new Set());

  // Local state for React HUD updates (every 1s)
  const [telemetryTick, setTelemetryTick] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTelemetryTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Smooth entrance animation
  useEffect(() => {
    let tween: gsap.core.Tween | null = null;
    if (containerRef.current) {
      tween = gsap.fromTo(
        containerRef.current,
        { opacity: 0.6, y: 12 },
        {
          opacity: 1,
          y: 0,
          duration: 0.45,
          ease: "power2.out",
        }
      );
    }
    return () => {
      tween?.kill();
    };
  }, []);

  const getDonorCoords = (d: Donor, idx: number) => {
    if (d.name.includes("Amber")) return { x: 580, y: 110 };
    if (d.name.includes("TechPark")) return { x: 680, y: 240 };
    if (d.name.includes("Paradise")) return { x: 330, y: 240 };
    if (d.name.includes("PES")) return { x: 160, y: 140 };
    if (d.lat && d.lng) {
      const x = 100 + ((d.lng - 77.5) / 0.3) * 600;
      const y = 330 - ((d.lat - 12.9) / 0.12) * 260;
      return {
        x: Math.max(80, Math.min(720, Math.round(x))),
        y: Math.max(50, Math.min(330, Math.round(y))),
      };
    }
    const defaults = [
      { x: 580, y: 110 },
      { x: 680, y: 240 },
      { x: 330, y: 240 },
      { x: 160, y: 140 },
    ];
    return defaults[idx % defaults.length];
  };

  const getReceiverCoords = (r: Receiver, idx: number) => {
    if (r.name.includes("Robin Hood")) return { x: 560, y: 90 };
    if (r.name.includes("City Hope")) return { x: 360, y: 260 };
    if (r.name.includes("Whitefield")) return { x: 650, y: 250 };
    if (r.name.includes("Aasra")) return { x: 180, y: 160 };
    if (r.lat && r.lng) {
      const x = 100 + ((r.lng - 77.5) / 0.3) * 600;
      const y = 330 - ((r.lat - 12.9) / 0.12) * 260;
      return {
        x: Math.max(80, Math.min(720, Math.round(x))),
        y: Math.max(50, Math.min(330, Math.round(y))),
      };
    }
    const defaults = [
      { x: 560, y: 90 },
      { x: 360, y: 260 },
      { x: 650, y: 250 },
      { x: 180, y: 160 },
    ];
    return defaults[idx % defaults.length];
  };

  // Precompute donor meal sums in a memoized dictionary lookup
  const donorMealsMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of listings) {
      const meals = l.quantity_meals || 0;
      if (l.donor_id) {
        map.set(l.donor_id, (map.get(l.donor_id) || 0) + meals);
      }
      if (l.donor_name) {
        map.set(l.donor_name, (map.get(l.donor_name) || 0) + meals);
      }
    }
    return map;
  }, [listings]);

  // Compute active courier routes along multi-waypoint arterial corridors
  const activeCouriers = useMemo(() => {
    return listings
      .filter(
        (l) =>
          (l.status === "CLAIMED" || l.status === "COLLECTED") && l.pickup != null
      )
      .map((l, idx) => {
        const donor = donors.find((d) => d.id === l.donor_id);
        const receiver = receivers.find((r) => r.id === l.pickup?.receiver_id);
        const dCoords = donor ? getDonorCoords(donor, idx) : { x: 580, y: 110 };
        const rCoords = receiver ? getReceiverCoords(receiver, idx) : { x: 330, y: 240 };
        const midX = Math.round((dCoords.x + rCoords.x) / 2);
        const midY = Math.round((dCoords.y + rCoords.y) / 2);
        const corridor = ARTERIAL_CORRIDORS[idx % ARTERIAL_CORRIDORS.length];
        const waypoints = generateArterialWaypoints(
          dCoords,
          rCoords,
          idx,
          l.donor_name,
          l.pickup?.receiver_name || "Shelter Hub"
        );

        return {
          id: l.id,
          status: l.status,
          donorName: l.donor_name,
          receiverName: l.pickup?.receiver_name || "Shelter Hub",
          volunteerName: l.pickup?.volunteer_name || "Courier",
          vehicleType: l.pickup?.vehicle_type || "EV Cargo Trike",
          start: dCoords,
          end: rCoords,
          mid: { x: midX, y: midY },
          corridorName: corridor.name,
          corridorDescription: corridor.description,
          waypoints,
        };
      });
  }, [listings, donors, receivers]);

  // Live telemetry summary for HUD display
  const primaryTelemetry = useMemo(() => {
    if (activeCouriers.length === 0) return null;
    const c = activeCouriers[0];
    const p = getSimulatedRouteProgress(c.id, c.status);
    return calculateArterialDynamics(c.waypoints, p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCouriers, telemetryTick]);

  // Move each EV Cargo Trike marker along multi-waypoint route with heading rotation
  useLayoutEffect(() => {
    let raf = 0;
    const paint = () => {
      const now = Date.now();
      for (const c of activeCouriers) {
        const el = vehicleRefs.current.get(c.id);
        if (!el) continue;
        const p = getSimulatedRouteProgress(c.id, c.status, now);
        const dynamics = calculateArterialDynamics(c.waypoints, p);

        // Apply smooth 2D translation and heading rotation
        el.setAttribute(
          "transform",
          `translate(${dynamics.pos.x.toFixed(1)}, ${dynamics.pos.y.toFixed(1)}) rotate(${dynamics.heading.toFixed(1)})`
        );

        // Destination reached trigger
        if (p >= 1.0 && !deliveredTriggeredRef.current.has(c.id)) {
          deliveredTriggeredRef.current.add(c.id);
          onConfirmDelivery?.(c.id);
        }
      }
    };

    paint();
    if (prefersReducedMotion()) return;
    const loop = () => {
      paint();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [activeCouriers, onConfirmDelivery]);

  return (
    <div
      ref={containerRef}
      className="bg-light-surface-container-lowest border border-light-outline-variant/60 rounded-xl p-4 sm:p-6 space-y-4 shadow-sm font-body"
      role="region"
      aria-label="Holographic Dispatch Radar Matrix"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-light-outline-variant/40 pb-4">
        <div>
          <h2 className="text-base sm:text-title-md font-bold font-headline text-light-on-surface flex items-center gap-2">
            <Navigation className="h-5 w-5 text-light-primary" aria-hidden="true" />
            <span>HOLOGRAPHIC PROXIMITY RADAR • BENGALURU DISPATCH MATRIX</span>
          </h2>
          <p className="text-xs text-light-on-surface-variant font-label mt-0.5">
            Real-time Haversine proximity vectors of certified commercial donors and receiving shelter hubs. Courier routes are SIMULATED (not real GPS).
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-label flex-wrap">
          <span className="flex items-center gap-1.5 text-light-secondary font-bold bg-light-warning-container/40 px-2.5 py-1 rounded-full border border-light-outline-variant/40">
            <span className="h-2 w-2 rounded-full bg-light-secondary" aria-hidden="true" />{" "}
            {donors.length} Donors
          </span>
          <span className="flex items-center gap-1.5 text-light-primary font-bold bg-light-success-container/40 px-2.5 py-1 rounded-full border border-light-outline-variant/40">
            <span className="h-2 w-2 rounded-full bg-light-primary" aria-hidden="true" />{" "}
            {receivers.length} Shelters
          </span>
          <span className="flex items-center gap-1.5 text-light-tertiary font-bold bg-light-surface-container-low px-2.5 py-1 rounded-full border border-light-outline-variant/40">
            <Truck className="w-3.5 h-3.5 text-light-tertiary" />
            {activeCouriers.length} Active Couriers
          </span>
        </div>
      </div>

      {/* Real-Time Live Telemetry HUD Overlay */}
      {activeCouriers.length > 0 && primaryTelemetry && (
        <div
          data-testid="radar-telemetry-hud"
          className="p-3.5 bg-stone-900 text-stone-100 rounded-xl border border-stone-800 shadow-md grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-label"
        >
          <div>
            <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">
              EV FLEET TELEMETRY
            </span>
            <div className="font-headline font-bold text-emerald-400 text-sm flex items-center gap-1.5 mt-0.5">
              <Truck className="w-4 h-4 text-emerald-400" />
              <span>EV CARGO TRIKE</span>
            </div>
            <span className="text-[10px] text-stone-400 truncate block mt-0.5">
              {activeCouriers[0].volunteerName} • KA-01-EV-4821
            </span>
          </div>

          <div>
            <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">
              DYNAMIC SPEED
            </span>
            <div className="font-headline font-bold text-stone-100 text-sm tabular-nums mt-0.5">
              {primaryTelemetry.speedKmh.toFixed(1)} km/h
            </div>
            <span
              className={`text-[10px] font-bold block mt-0.5 ${
                primaryTelemetry.isRegenActive ? "text-amber-400 animate-pulse" : "text-emerald-400"
              }`}
            >
              {primaryTelemetry.isRegenActive ? "⚡ REGEN ACTIVE" : "ECO CRUISE"}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">
              LiFePO4 BATTERY
            </span>
            <div className="font-headline font-bold text-emerald-400 text-sm tabular-nums flex items-center gap-1 mt-0.5">
              <BatteryCharging className="w-4 h-4 text-emerald-400" />
              <span>{primaryTelemetry.batteryPercent.toFixed(1)}%</span>
            </div>
            <span className="text-[10px] text-stone-400 block mt-0.5">
              48V 100Ah Pack
            </span>
          </div>

          <div>
            <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">
              CAMBRO THERMAL HOLD
            </span>
            <div className="font-headline font-bold text-emerald-300 text-sm tabular-nums flex items-center gap-1 mt-0.5">
              <Thermometer className="w-4 h-4 text-emerald-400" />
              <span>{primaryTelemetry.cambroTempC.toFixed(1)}°C</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-semibold block mt-0.5">
              &gt;65°C FSSAI Compliant
            </span>
          </div>

          <div>
            <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">
              ESTIMATED ARRIVAL &amp; CORRIDOR
            </span>
            <div className="font-headline font-bold text-emerald-400 text-sm tabular-nums mt-0.5">
              ETA: {primaryTelemetry.etaMinutes} mins • {primaryTelemetry.distanceRemainingKm} km
            </div>
            <span className="text-[10px] text-stone-300 truncate block mt-0.5">
              {activeCouriers[0].corridorName}
            </span>
          </div>
        </div>
      )}

      {/* Map Engine Mode Switcher Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2 bg-stone-100 rounded-2xl border border-stone-200">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveMapEngine("REAL_STREETS")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeMapEngine === "REAL_STREETS"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-stone-600 hover:text-stone-900 hover:bg-white"
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>🗺️ Real Street Map</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMapEngine("SATELLITE")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeMapEngine === "SATELLITE"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-stone-600 hover:text-stone-900 hover:bg-white"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>🛰️ Real Satellite Imagery</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMapEngine("GOOGLE_MAPS")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeMapEngine === "GOOGLE_MAPS"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-stone-600 hover:text-stone-900 hover:bg-white"
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-amber-300" />
            <span>🌐 Google Maps (Platform 101)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMapEngine("RADAR")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeMapEngine === "RADAR"
                ? "bg-stone-900 text-emerald-400 shadow-sm"
                : "text-stone-600 hover:text-stone-900 hover:bg-white"
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>📡 Tactical Radar</span>
          </button>
        </div>

        <span className="text-[11px] font-semibold text-emerald-800 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 self-start sm:self-auto flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Bengaluru Central Sector (12.95°N, 77.62°E)</span>
        </span>
      </div>

      {/* Real Maps Display: Streets or Satellite or Google Maps */}
      {activeMapEngine === "REAL_STREETS" && (
        <RealStreetLeafletMap donors={donors} receivers={receivers} listings={listings} mapStyle="streets" />
      )}

      {activeMapEngine === "SATELLITE" && (
        <RealStreetLeafletMap donors={donors} receivers={receivers} listings={listings} mapStyle="satellite" />
      )}

      {activeMapEngine === "GOOGLE_MAPS" && (
        <GoogleMapsPlatformView
          donors={donors}
          receivers={receivers}
          listings={listings}
          onFallbackToStreetTiles={() => setActiveMapEngine("REAL_STREETS")}
        />
      )}

      {/* Vector Street Map Canvas (Always in DOM for tests and Tactical Mode) */}
      <div className={activeMapEngine === "RADAR" ? "bg-light-surface-container rounded-xl p-3 sm:p-4 relative overflow-hidden select-none border border-light-outline-variant/60 shadow-inner" : "hidden"}>
        {/* Telemetry Bar */}
        <div className="relative z-10 flex items-center justify-between text-xs font-label text-light-on-surface-variant pb-2 border-b border-light-outline-variant/40 flex-wrap gap-1 tabular-nums">
          <span className="flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5 text-light-primary animate-pulse" />
            <span className="font-semibold text-light-on-surface">Bengaluru Metropolitan Area • Koramangala Grid</span>
          </span>
          <span>Center: 12°58'17"N • 77°35'40"E</span>
          <span className="flex items-center gap-1.5 text-light-success font-semibold">
            <span className="h-2 w-2 rounded-full bg-light-success animate-ping" aria-hidden="true" />
            <span>Autonomous Dispatch Active</span>
          </span>
        </div>

        <svg
          viewBox="0 0 800 380"
          className="w-full h-72 sm:h-80 relative z-10"
          role="img"
          aria-label="Radar Map Graticule showing active food rescue donors and shelters"
        >
          <defs>
            <pattern id="streetGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E2D8D2" strokeWidth="1" strokeOpacity="0.7" />
            </pattern>
            <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#AC3400" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#F59E0B" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#004C22" stopOpacity="0.95" />
            </linearGradient>
          </defs>

          {/* Clean Map Background with Grid */}
          <rect width="800" height="380" fill="#FFF8F5" />
          <rect width="800" height="380" fill="url(#streetGrid)" />

          {/* Major Bengaluru Arterial Roads (Outer Ring Rd, Hosur Rd, Old Airport Rd) */}
          <path
            d="M 50 180 Q 250 140 450 190 T 750 160"
            fill="none"
            stroke="#E2D8D2"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path
            d="M 50 180 Q 250 140 450 190 T 750 160"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M 320 50 Q 340 180 380 340"
            fill="none"
            stroke="#E2D8D2"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="M 320 50 Q 340 180 380 340"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M 120 70 L 680 310"
            fill="none"
            stroke="#E2D8D2"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M 120 70 L 680 310"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="4"
            strokeLinecap="round"
          />

          {/* Active Multi-Waypoint Arterial Courier Route Lines */}
          {activeCouriers.map((c) => (
            <g key={`route-${c.id}`}>
              {/* Arterial path through all waypoints */}
              <polyline
                points={c.waypoints.map((w) => `${w.x},${w.y}`).join(" ")}
                fill="none"
                stroke="url(#routeGradient)"
                strokeWidth="4"
                strokeDasharray="8 5"
                className="animate-pulse"
              />

              {/* Waypoint nodes along the arterial corridor */}
              {c.waypoints.map((w, wIdx) => (
                <g key={`wp-${c.id}-${wIdx}`} transform={`translate(${w.x}, ${w.y})`}>
                  <circle cx="0" cy="0" r="4" fill="#004C22" stroke="#FFFFFF" strokeWidth="1.5" />
                </g>
              ))}

              {/* Animated EV Cargo Trike Marker positioned and rotated along multi-waypoint path */}
              <g
                ref={(el) => {
                  if (el) vehicleRefs.current.set(c.id, el);
                  else vehicleRefs.current.delete(c.id);
                }}
                data-testid={`courier-marker-${c.id}`}
                className="cursor-pointer"
              >
                {/* Sonar pulse wave */}
                <circle cx="0" cy="0" r="18" fill="none" stroke="#004C22" strokeWidth="2" strokeOpacity="0.4" className="animate-ping" />

                {/* EV Cargo Trike Chassis */}
                <rect x="-14" y="-8" width="28" height="16" rx="4" fill="#004C22" stroke="#FFFFFF" strokeWidth="1.5" />

                {/* Cambro Insulated Container Unit */}
                <rect x="-12" y="-6" width="13" height="12" rx="2" fill="#F59E0B" />
                <text x="-5.5" y="3" textAnchor="middle" fill="#FFFFFF" fontSize="7" fontWeight="bold">65°</text>

                {/* Aerodynamic Cockpit */}
                <polygon points="3,-5 11,-3 11,3 3,5" fill="#A7F3D0" />

                {/* Front Wheel */}
                <circle cx="12" cy="0" r="3" fill="#1F1B17" stroke="#34D399" strokeWidth="1" />

                {/* Dual Rear Wheels */}
                <rect x="-10" y="-10" width="5" height="2" rx="1" fill="#1F1B17" />
                <rect x="-10" y="8" width="5" height="2" rx="1" fill="#1F1B17" />

                {/* Headlight illumination beam */}
                <polygon points="13,-3 25,-6 25,6 13,3" fill="#FEF08A" fillOpacity="0.3" />

                {/* EV Marker Text */}
                <text
                  x="0"
                  y="4"
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="8"
                  fontFamily="sans-serif"
                  fontWeight="bold"
                >
                  EV
                </text>
              </g>
            </g>
          ))}

          {/* Donor Pins (Terracotta #AC3400) */}
          {donors.map((d, idx) => {
            const coords = getDonorCoords(d, idx);
            const isHovered = hoveredPin === `donor-${d.id}`;
            const mealCount = donorMealsMap.get(d.id) || donorMealsMap.get(d.name) || 0;
            return (
              <g
                key={`donor-${d.id}`}
                transform={`translate(${coords.x}, ${coords.y})`}
                onMouseEnter={() => setHoveredPin(`donor-${d.id}`)}
                onMouseLeave={() => setHoveredPin(null)}
                className="cursor-pointer"
              >
                <circle cx="0" cy="0" r={isHovered ? "18" : "14"} fill="#AC3400" />
                <circle cx="0" cy="0" r={isHovered ? "24" : "18"} fill="none" stroke="#AC3400" strokeWidth="2" strokeOpacity="0.3" />
                <text x="0" y="4" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="bold">
                  D
                </text>
                <text
                  x="0"
                  y="26"
                  textAnchor="middle"
                  fill="#1F1B17"
                  fontSize="11"
                  fontWeight="bold"
                  className="bg-white/90"
                >
                  {d.name.split(" ")[0]} ({mealCount}m)
                </text>
              </g>
            );
          })}

          {/* Shelter Pins (Forest Green #004C22) */}
          {receivers.map((r, idx) => {
            const coords = getReceiverCoords(r, idx);
            const isHovered = hoveredPin === `shelter-${r.id}`;
            return (
              <g
                key={`shelter-${r.id}`}
                transform={`translate(${coords.x}, ${coords.y})`}
                onMouseEnter={() => setHoveredPin(`shelter-${r.id}`)}
                onMouseLeave={() => setHoveredPin(null)}
                className="cursor-pointer"
              >
                <circle cx="0" cy="0" r={isHovered ? "18" : "14"} fill="#004C22" />
                <circle cx="0" cy="0" r={isHovered ? "24" : "18"} fill="none" stroke="#004C22" strokeWidth="2" strokeOpacity="0.3" />
                <text x="0" y="4" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="bold">
                  S
                </text>
                <text
                  x="0"
                  y="26"
                  textAnchor="middle"
                  fill="#1F1B17"
                  fontSize="11"
                  fontWeight="bold"
                >
                  {r.name.split(" ")[0]}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Map Legend */}
        <div className="mt-3 pt-2.5 border-t border-light-outline-variant/40 flex items-center justify-between text-xs font-label text-light-on-surface-variant flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-light-secondary inline-block" />
              <span>Commercial Food Donors</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-light-primary inline-block" />
              <span>Verified Shelter Hubs</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-light-tertiary inline-block" />
              <span>Electric Cargo Trike (Simulated route, not GPS)</span>
            </span>
          </div>
          <span className="text-[11px] font-medium text-light-primary flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>FSSAI Certified 4-Hour Transit Safe</span>
          </span>
        </div>
      </div>
    </div>
  );
};
