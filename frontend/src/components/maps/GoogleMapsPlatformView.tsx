import { useState, type FC } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
} from "@vis.gl/react-google-maps";
import { GoogleMapsCircle } from "./GoogleMapsCircle";
import { Donor, Receiver, FoodListing } from "../../types";
import { Key, Truck, Utensils, Home } from "lucide-react";

interface GoogleMapsPlatformViewProps {
  donors: Donor[];
  receivers: Receiver[];
  listings: FoodListing[];
  onFallbackToStreetTiles?: () => void;
}

const BENGALURU_LAT_LNG = { lat: 12.9516, lng: 77.6246 };

export const GoogleMapsPlatformView: FC<GoogleMapsPlatformViewProps> = ({
  donors,
  receivers,
  listings,
  onFallbackToStreetTiles,
}) => {
  const [apiKey, setApiKey] = useState<string>(() => {
    return (
      (typeof localStorage !== "undefined" && localStorage.getItem("sp_google_maps_key")) ||
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_GOOGLE_MAPS_API_KEY) ||
      ""
    );
  });
  const [inputKey, setInputKey] = useState<string>("");
  const [selectedPin, setSelectedPin] = useState<{
    title: string;
    description: string;
    type: "donor" | "shelter" | "courier";
    lat: number;
    lng: number;
    data?: any;
  } | null>(null);

  const handleSaveKey = () => {
    if (inputKey.trim()) {
      localStorage.setItem("sp_google_maps_key", inputKey.trim());
      setApiKey(inputKey.trim());
    }
  };

  const handleClearKey = () => {
    localStorage.removeItem("sp_google_maps_key");
    setApiKey("");
  };

  return (
    <div className="relative w-full h-[540px] sm:h-[620px] rounded-2xl overflow-hidden border border-stone-200 shadow-lg bg-stone-100 flex flex-col">
      {/* Google Maps API Key Setup Bar (if not provided) */}
      {!apiKey && (
        <div className="p-4 bg-emerald-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-800 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-800 flex items-center justify-center text-emerald-300 shrink-0">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm font-headline flex items-center gap-2">
                <span>GOOGLE MAPS PLATFORM 101 INTEGRATION</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-800 text-emerald-300 font-mono">
                  @vis.gl/react-google-maps
                </span>
              </h4>
              <p className="text-xs text-stone-300 mt-0.5">
                Paste your Google Maps API key below, or use the Real Street Map (OpenStreetMap) with zero keys required.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="password"
              placeholder="AIzaSy..."
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-stone-900 border border-stone-700 text-white text-xs font-mono focus:border-emerald-500 focus:outline-none w-48"
            />
            <button
              type="button"
              onClick={handleSaveKey}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Connect Key
            </button>
            {apiKey && (
              <button
                type="button"
                onClick={handleClearKey}
                className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs transition-colors cursor-pointer"
              >
                Clear
              </button>
            )}
            {onFallbackToStreetTiles && (
              <button
                type="button"
                onClick={onFallbackToStreetTiles}
                className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                Use Real Streets Map
              </button>
            )}
          </div>
        </div>
      )}

      {/* Map Surface */}
      <div className="flex-1 w-full h-full relative">
        <APIProvider apiKey={apiKey || "DEMO_KEY"}>
          <Map
            style={{ width: "100%", height: "100%" }}
            defaultCenter={BENGALURU_LAT_LNG}
            defaultZoom={13}
            gestureHandling={"greedy"}
            disableDefaultUI={false}
            mapId="surpluspulse_bengaluru_dispatch"
          >
            {/* Donors: AdvancedMarker with Emerald Pins */}
            {donors.map((donor, idx) => {
              const lat = donor.lat || 12.935 + (idx % 2 === 0 ? 0.03 : -0.01);
              const lng = donor.lng || 77.62 + (idx % 3) * 0.04;
              return (
                <AdvancedMarker
                  key={donor.id}
                  position={{ lat, lng }}
                  onClick={() =>
                    setSelectedPin({
                      title: donor.name,
                      description: donor.address || "Bengaluru Metro Food Hub",
                      type: "donor",
                      lat,
                      lng,
                      data: donor,
                    })
                  }
                >
                  <Pin background={"#059669"} borderColor={"#047857"} glyphColor={"#FFFFFF"}>
                    <Utensils className="w-3.5 h-3.5 text-white" />
                  </Pin>
                </AdvancedMarker>
              );
            })}

            {/* Receivers: AdvancedMarker with Amber Pins & Thermal Safe Radius Circle */}
            {receivers.map((receiver, idx) => {
              const lat = receiver.lat || 12.94 + (idx % 2 === 0 ? 0.02 : -0.02);
              const lng = receiver.lng || 77.61 + (idx % 3) * 0.03;
              return (
                <div key={receiver.id}>
                  {/* FSSAI 4-Hour Safe Delivery Radius Circle from Codelab Component */}
                  <GoogleMapsCircle
                    center={{ lat, lng }}
                    radius={3000}
                    strokeColor="#059669"
                    strokeOpacity={0.6}
                    strokeWeight={2}
                    fillColor="#10b981"
                    fillOpacity={0.08}
                  />

                  <AdvancedMarker
                    position={{ lat, lng }}
                    onClick={() =>
                      setSelectedPin({
                        title: receiver.name,
                        description: receiver.address || "Bengaluru Relief Shelter",
                        type: "shelter",
                        lat,
                        lng,
                        data: receiver,
                      })
                    }
                  >
                    <Pin background={"#d97706"} borderColor={"#b45309"} glyphColor={"#FFFFFF"}>
                      <Home className="w-3.5 h-3.5 text-white" />
                    </Pin>
                  </AdvancedMarker>
                </div>
              );
            })}

            {/* Active Couriers */}
            {listings
              .filter((l) => l.status === "COLLECTED" || l.status === "CLAIMED")
              .map((listing, idx) => {
                const lat = 12.948 + idx * 0.01;
                const lng = 77.628 + idx * 0.01;
                return (
                  <AdvancedMarker
                    key={listing.id}
                    position={{ lat, lng }}
                    onClick={() =>
                      setSelectedPin({
                        title: "EV Cargo Trike • En Route",
                        description: `Transporting ${listing.food_name} (${listing.quantity_meals} meals)`,
                        type: "courier",
                        lat,
                        lng,
                        data: listing,
                      })
                    }
                  >
                    <Pin background={"#0f172a"} borderColor={"#10b981"} glyphColor={"#10b981"}>
                      <Truck className="w-3.5 h-3.5 text-emerald-400" />
                    </Pin>
                  </AdvancedMarker>
                );
              })}

            {/* InfoWindow */}
            {selectedPin && (
              <InfoWindow
                position={{ lat: selectedPin.lat, lng: selectedPin.lng }}
                onCloseClick={() => setSelectedPin(null)}
              >
                <div className="p-2 max-w-xs font-sans text-xs space-y-1.5 text-stone-900">
                  <div className="font-bold text-sm flex items-center gap-1.5 text-emerald-800">
                    <span>{selectedPin.title}</span>
                  </div>
                  <p className="text-stone-600 text-[11px] leading-tight">{selectedPin.description}</p>
                  <div className="p-1.5 bg-emerald-50 rounded text-[10px] text-emerald-900 font-semibold">
                    📍 Coordinates: {selectedPin.lat.toFixed(4)}°N, {selectedPin.lng.toFixed(4)}°E
                  </div>
                </div>
              </InfoWindow>
            )}
          </Map>
        </APIProvider>
      </div>
    </div>
  );
};
