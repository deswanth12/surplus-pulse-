import { useEffect, useRef, useState, type FC } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Donor, Receiver, FoodListing } from "../../types";
import { ARTERIAL_CORRIDORS } from "../CrtRadarMap";
import { Navigation, Truck, Home, Utensils, Layers, RotateCcw } from "lucide-react";

interface RealStreetLeafletMapProps {
  donors: Donor[];
  receivers: Receiver[];
  listings: FoodListing[];
  mapStyle?: "streets" | "satellite" | "light";
  onSelectListing?: (listingId: string) => void;
}

// Bengaluru center coordinates (Koramangala - Indiranagar Corridor)
const BENGALURU_CENTER: [number, number] = [12.9516, 77.6246];

export const RealStreetLeafletMap: FC<RealStreetLeafletMapProps> = ({
  donors,
  receivers,
  listings,
  mapStyle = "streets",
  onSelectListing: _onSelectListing,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [activeLayer, setActiveLayer] = useState<"streets" | "satellite" | "light">(mapStyle);
  const [filterType, setFilterType] = useState<"all" | "donors" | "shelters" | "couriers">("all");

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    try {
      const map = L.map(mapContainerRef.current, {
        center: BENGALURU_CENTER,
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      });

      // Add Zoom Control at bottom right
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Attribution
      L.control
        .attribution({ position: "bottomleft", prefix: false })
        .addAttribution('&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>')
        .addTo(map);

      mapInstanceRef.current = map;
      layersGroupRef.current = L.layerGroup().addTo(map);
    } catch (e) {
      console.warn("Leaflet initialization fallback:", e);
    }

    return () => {
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Base Tile Layer based on activeLayer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let tileUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
    let subdomains = "abc";
    let maxZoom = 19;

    if (activeLayer === "satellite") {
      tileUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
      subdomains = "abc";
    } else if (activeLayer === "light") {
      tileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
      subdomains = "abc";
    }

    const tile = L.tileLayer(tileUrl, {
      maxZoom,
      subdomains,
      attribution: activeLayer === "satellite" ? "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community" : "",
    }).addTo(map);

    tileLayerRef.current = tile;
  }, [activeLayer]);

  // Render Real Markers, Polylines, and Thermal Radius Circles
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = layersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // 1. Render Donors
    if (filterType === "all" || filterType === "donors") {
      donors.forEach((donor, idx) => {
        const lat = donor.lat || (12.935 + (idx % 2 === 0 ? 0.03 : -0.01));
        const lng = donor.lng || (77.62 + (idx % 3) * 0.04);

        const donorIcon = L.divIcon({
          className: "custom-leaflet-marker",
          html: `
            <div class="relative group cursor-pointer">
              <div class="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg border-2 border-white ring-2 ring-emerald-500/40 hover:scale-110 transition-transform">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-6-6h12"/></svg>
              </div>
              <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-emerald-600 rotate-45 border-r border-b border-white"></div>
              <div class="hidden group-hover:block absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-stone-900 text-white text-[10px] font-bold rounded shadow-md whitespace-nowrap z-50">
                ${donor.name}
              </div>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 36],
          popupAnchor: [0, -36],
        });

        const marker = L.marker([lat, lng], { icon: donorIcon }).addTo(group);

        marker.bindPopup(`
          <div class="font-sans text-xs p-1 space-y-2 max-w-xs">
            <div class="flex items-center gap-1.5 font-bold text-emerald-800 text-sm">
              <span class="p-1 rounded bg-emerald-100 text-emerald-700">DONOR</span>
              <span>${donor.name}</span>
            </div>
            <p class="text-stone-600 text-[11px] leading-tight">${donor.address || "Bengaluru Metro Food Hub"}</p>
            <div class="p-2 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900 text-[11px] space-y-1">
              <div class="flex justify-between font-semibold">
                <span>Verified Kitchen:</span>
                <span class="text-emerald-700 font-bold">${donor.donor_type}</span>
              </div>
              <div class="flex justify-between font-semibold">
                <span>FSSAI License:</span>
                <span class="font-mono text-[10px] text-stone-600">11223344556677</span>
              </div>
            </div>
            <div class="text-[10px] text-stone-500 italic">
              ⚡ FSSAI 2019 Food Waste Rules Compliant
            </div>
          </div>
        `);
      });
    }

    // 2. Render Receivers & FSSAI Thermal Radius Circles
    if (filterType === "all" || filterType === "shelters") {
      receivers.forEach((receiver, idx) => {
        const lat = receiver.lat || (12.94 + (idx % 2 === 0 ? 0.02 : -0.02));
        const lng = receiver.lng || (77.61 + (idx % 3) * 0.03);

        // Safe Thermal Holding Radius Circle (3.5 km ~ 20 min EV radius)
        L.circle([lat, lng], {
          radius: 3000,
          color: "#059669",
          weight: 1.5,
          opacity: 0.6,
          fillColor: "#10b981",
          fillOpacity: 0.08,
          dashArray: "4, 6",
        }).addTo(group);

        const shelterIcon = L.divIcon({
          className: "custom-leaflet-marker",
          html: `
            <div class="relative group cursor-pointer">
              <div class="w-9 h-9 rounded-full bg-amber-600 text-white flex items-center justify-center shadow-lg border-2 border-white ring-2 ring-amber-500/40 hover:scale-110 transition-transform">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
              </div>
              <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-amber-600 rotate-45 border-r border-b border-white"></div>
              <div class="hidden group-hover:block absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-stone-900 text-white text-[10px] font-bold rounded shadow-md whitespace-nowrap z-50">
                ${receiver.name}
              </div>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 36],
          popupAnchor: [0, -36],
        });

        const marker = L.marker([lat, lng], { icon: shelterIcon }).addTo(group);

        marker.bindPopup(`
          <div class="font-sans text-xs p-1 space-y-2 max-w-xs">
            <div class="flex items-center gap-1.5 font-bold text-amber-900 text-sm">
              <span class="p-1 rounded bg-amber-100 text-amber-800">SHELTER</span>
              <span>${receiver.name}</span>
            </div>
            <p class="text-stone-600 text-[11px] leading-tight">${receiver.address || "Bengaluru Metro Relief Hub"}</p>
            <div class="p-2 bg-amber-50 rounded-lg border border-amber-200 text-amber-950 text-[11px] space-y-1">
              <div class="flex justify-between font-semibold">
                <span>Intake Capacity:</span>
                <span class="text-amber-800 font-bold">${receiver.capacity_meals || 150} meals</span>
              </div>
              <div class="flex justify-between font-semibold">
                <span>Contact Coordinator:</span>
                <span class="text-stone-700">${receiver.contact_name || "Relief Lead"}</span>
              </div>
            </div>
            <div class="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Ready for Immediate Intake Verification</span>
            </div>
          </div>
        `);
      });
    }

    // 3. Render Active EV Couriers and Route Polylines
    if (filterType === "all" || filterType === "couriers") {
      const activeListings = listings.filter((l) => l.status === "COLLECTED" || l.status === "CLAIMED");

      activeListings.forEach((listing, idx) => {
        const donor = donors.find((d) => d.id === listing.donor_id) || donors[0];
        const receiver = receivers[idx % receivers.length] || receivers[0];

        const startLat = donor?.lat || 12.935;
        const startLng = donor?.lng || 77.624;
        const endLat = receiver?.lat || 12.978;
        const endLng = receiver?.lng || 77.64;

        // Animated transit waypoint (simulate 40% progress along road vector)
        const progress = 0.45;
        const courierLat = startLat + (endLat - startLat) * progress;
        const courierLng = startLng + (endLng - startLng) * progress;

        // Draw Arterial Route Polyline
        const corridor = ARTERIAL_CORRIDORS[idx % ARTERIAL_CORRIDORS.length];
        const midLat1 = startLat * 0.7 + endLat * 0.3 + 0.005;
        const midLng1 = startLng * 0.7 + endLng * 0.3 - 0.005;
        const midLat2 = startLat * 0.3 + endLat * 0.7 - 0.004;
        const midLng2 = startLng * 0.3 + endLng * 0.7 + 0.006;

        const routeCoords: [number, number][] = [
          [startLat, startLng],
          [midLat1, midLng1],
          [midLat2, midLng2],
          [endLat, endLng],
        ];

        L.polyline(routeCoords, {
          color: "#059669",
          weight: 4,
          opacity: 0.85,
          dashArray: "8, 8",
        }).addTo(group);

        // Courier Marker with EV pulse
        const courierIcon = L.divIcon({
          className: "custom-leaflet-marker",
          html: `
            <div class="relative group cursor-pointer" data-courier-id="${listing.id}">
              <div class="absolute -inset-2 bg-emerald-500/25 rounded-full animate-ping pointer-events-none"></div>
              <div class="w-10 h-10 rounded-full bg-stone-900 text-emerald-400 flex items-center justify-center shadow-2xl border-2 border-emerald-400 ring-2 ring-stone-900/40 hover:scale-110 transition-transform">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              </div>
              <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-stone-900 rotate-45 border-r border-b border-emerald-400"></div>
              <div class="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-emerald-600 text-white text-[9px] font-extrabold rounded shadow-md whitespace-nowrap">
                ⚡ EV TRIKE • 28 km/h
              </div>
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 40],
          popupAnchor: [0, -40],
        });

        const marker = L.marker([courierLat, courierLng], { icon: courierIcon }).addTo(group);

        marker.bindPopup(`
          <div class="font-sans text-xs p-1 space-y-2 max-w-xs">
            <div class="flex items-center justify-between">
              <span class="font-bold text-stone-900 flex items-center gap-1.5 text-sm">
                <span>⚡ EV CARGO TRIKE</span>
              </span>
              <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                EN ROUTE
              </span>
            </div>
            <p class="text-stone-600 text-[11px]">
              Corridor: <strong class="text-stone-800">${corridor.name}</strong>
            </p>
            <div class="grid grid-cols-2 gap-1.5 p-2 bg-stone-900 text-stone-100 rounded-lg text-[11px] font-mono">
              <div>
                <span class="text-stone-400 block text-[9px]">SPEED</span>
                <span class="text-emerald-400 font-bold">28.4 km/h</span>
              </div>
              <div>
                <span class="text-stone-400 block text-[9px]">BATTERY</span>
                <span class="text-emerald-400 font-bold">88.5% (LiFePO4)</span>
              </div>
              <div>
                <span class="text-stone-400 block text-[9px]">CAMBRO TEMP</span>
                <span class="text-emerald-300 font-bold">68.2°C (HOT HOLD)</span>
              </div>
              <div>
                <span class="text-stone-400 block text-[9px]">ETA REMAINING</span>
                <span class="text-stone-200 font-bold">14 mins</span>
              </div>
            </div>
            <div class="text-[10px] text-stone-500">
              Payload: ${listing.food_name} (${listing.quantity_meals} meals)
            </div>
          </div>
        `);
      });
    }
  }, [donors, receivers, listings, filterType]);

  const handleResetCenter = () => {
    mapInstanceRef.current?.setView(BENGALURU_CENTER, 13, { animate: true });
  };

  return (
    <div className="relative w-full h-[540px] sm:h-[620px] rounded-2xl overflow-hidden border border-stone-200 shadow-lg bg-stone-100">
      {/* Top Floating Controls Bar */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Map Style Switcher (Street / Satellite / Light) */}
        <div className="pointer-events-auto bg-white/95 backdrop-blur-md p-1 rounded-xl border border-stone-200 shadow-md flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveLayer("streets")}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeLayer === "streets"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Real Streets</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer("satellite")}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeLayer === "satellite"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Satellite View</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer("light")}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeLayer === "light"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
            }`}
          >
            <span>Clean Map</span>
          </button>
        </div>

        {/* Right: Entity Filters & Re-Center Button */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          <div className="bg-white/95 backdrop-blur-md p-1 rounded-xl border border-stone-200 shadow-md flex items-center gap-1">
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                filterType === "all" ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              All Pins
            </button>
            <button
              type="button"
              onClick={() => setFilterType("donors")}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                filterType === "donors" ? "bg-emerald-600 text-white" : "text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              <Utensils className="w-3 h-3" />
              <span>Donors</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterType("shelters")}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                filterType === "shelters" ? "bg-amber-600 text-white" : "text-amber-800 hover:bg-amber-50"
              }`}
            >
              <Home className="w-3 h-3" />
              <span>Shelters</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterType("couriers")}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                filterType === "couriers" ? "bg-teal-700 text-white" : "text-teal-800 hover:bg-teal-50"
              }`}
            >
              <Truck className="w-3 h-3" />
              <span>Couriers</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleResetCenter}
            className="p-2 bg-white/95 backdrop-blur-md rounded-xl border border-stone-200 shadow-md hover:bg-stone-50 text-stone-700 transition-colors cursor-pointer"
            title="Re-Center on Bengaluru Corridor"
            aria-label="Re-Center on Bengaluru Corridor"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Real Interactive Leaflet Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" tabIndex={0} />

      {/* Bottom Floating Legend & Corridor Telemetry Ribbon */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-stone-200/90 shadow-lg flex items-center gap-4 text-xs font-label">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-600 border border-white shadow-xs"></span>
          <span className="font-semibold text-stone-700">Commercial Donors ({donors.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-600 border border-white shadow-xs"></span>
          <span className="font-semibold text-stone-700">Certified Shelters ({receivers.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-stone-900 border border-emerald-400 shadow-xs"></span>
          <span className="font-semibold text-stone-700">Active EV Courier</span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-stone-200 text-stone-500 font-mono text-[10px]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span>BENGALURU CENTRAL SECTOR (12.95°N, 77.62°E)</span>
        </div>
      </div>
    </div>
  );
};
