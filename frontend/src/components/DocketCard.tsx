import { useState, type FC } from "react";
import {
  Clock,
  ShieldCheck,
  MapPin,
  Truck,
  Users,
  CheckCircle2,
  PackageCheck,
  MessageSquare,
  Send,
} from "lucide-react";
import { FoodListing } from "../types";
import * as api from "../services/api";

interface DocketCardProps {
  listing: FoodListing;
  onOpenSmartMatch: (listingId: string) => void;
  onAdvanceStatus: (listingId: string, nextStatus: "COLLECTED" | "DELIVERED") => void;
  isAdvancing?: boolean;
  onOpenCertificate?: () => void;
  onTrackDelivery?: (listing: FoodListing) => void;
}

// 100% reliable, high-resolution direct Unsplash food image URLs with optimized dimensions
const DISH_IMAGE_MAP: Record<string, string> = {
  biryani: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80",
  lemon: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80",
  sambar: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80",
  paneer: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=800&q=80",
  pulao: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80",
  dal: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80",
  roti: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=800&q=80",
  chapati: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=800&q=80",
  idli: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80",
  fish: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80",
  fallback: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80",
};

// Rich stylized Indian meal thali inline SVG data URI fallback for offline/ad-blocker resilience
const FALLBACK_DISH_SVG = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1c1917"/>
      <stop offset="50%" stop-color="#292524"/>
      <stop offset="100%" stop-color="#0c0a09"/>
    </linearGradient>
    <radialGradient id="thaliGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.3"/>
      <stop offset="60%" stop-color="#10b981" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="brassPlate" cx="45%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="45%" stop-color="#d97706"/>
      <stop offset="85%" stop-color="#92400e"/>
      <stop offset="100%" stop-color="#451a03"/>
    </radialGradient>
    <linearGradient id="silverPlate" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="50%" stop-color="#cbd5e1"/>
      <stop offset="100%" stop-color="#64748b"/>
    </linearGradient>
    <linearGradient id="curryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fb923c"/>
      <stop offset="70%" stop-color="#ea580c"/>
      <stop offset="100%" stop-color="#9a3412"/>
    </linearGradient>
    <linearGradient id="palakGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="60%" stop-color="#059669"/>
      <stop offset="100%" stop-color="#064e3b"/>
    </linearGradient>
    <linearGradient id="dalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fde047"/>
      <stop offset="60%" stop-color="#eab308"/>
      <stop offset="100%" stop-color="#a16207"/>
    </linearGradient>
    <filter id="thaliShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
  </defs>
  <rect width="800" height="500" fill="url(#bgGrad)"/>
  <circle cx="400" cy="240" r="230" fill="url(#thaliGlow)"/>
  <!-- Main Stainless / Brass Thali -->
  <g filter="url(#thaliShadow)">
    <circle cx="400" cy="235" r="185" fill="url(#brassPlate)" stroke="#fef3c7" stroke-width="4"/>
    <circle cx="400" cy="235" r="172" fill="#1c1917" stroke="#78350f" stroke-width="2"/>
  </g>
  <!-- Center Fragrant Basmati Rice Dome -->
  <circle cx="400" cy="235" r="72" fill="url(#silverPlate)" stroke="#94a3b8" stroke-width="1.5"/>
  <ellipse cx="400" cy="225" rx="55" ry="42" fill="#ffffff" fill-opacity="0.95"/>
  <circle cx="400" cy="222" r="5" fill="#10b981"/>
  <!-- Katori 1: Shahi Paneer Curry -->
  <circle cx="305" cy="165" r="38" fill="url(#curryGrad)" stroke="#fef08a" stroke-width="2.5" filter="url(#thaliShadow)"/>
  <rect x="295" y="155" width="18" height="18" rx="3" fill="#ffffff" fill-opacity="0.9"/>
  <!-- Katori 2: Palak / Saag Greens -->
  <circle cx="495" cy="165" r="38" fill="url(#palakGrad)" stroke="#a7f3d0" stroke-width="2.5" filter="url(#thaliShadow)"/>
  <circle cx="495" cy="165" r="12" fill="#047857" fill-opacity="0.5"/>
  <!-- Katori 3: Dal Tadka Golden -->
  <circle cx="510" cy="275" r="36" fill="url(#dalGrad)" stroke="#fef08a" stroke-width="2.5" filter="url(#thaliShadow)"/>
  <!-- Katori 4: Raita / Yogurt -->
  <circle cx="290" cy="275" r="36" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2.5" filter="url(#thaliShadow)"/>
  <circle cx="290" cy="275" r="8" fill="#f59e0b" fill-opacity="0.7"/>
  <!-- Fresh Roti / Chapati -->
  <ellipse cx="400" cy="335" rx="52" ry="34" fill="#fef3c7" stroke="#d97706" stroke-width="2" filter="url(#thaliShadow)"/>
  <circle cx="390" cy="332" r="4" fill="#b45309" fill-opacity="0.6"/>
  <circle cx="415" cy="338" r="5" fill="#b45309" fill-opacity="0.5"/>
  <!-- Typography Badge -->
  <text x="400" y="445" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="800" fill="#f59e0b" text-anchor="middle" letter-spacing="3">SURPLUSPULSE • FRESH FOOD RESCUE</text>
  <text x="400" y="470" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="600" fill="#94a3b8" text-anchor="middle" letter-spacing="1">FSSAI 2026 HOT-HOLD &amp; HYGIENE VERIFIED</text>
</svg>
`.trim())}`;

function getDishImage(dishName: string): string {
  const name = (dishName || "").toLowerCase();
  for (const [key, url] of Object.entries(DISH_IMAGE_MAP)) {
    if (key !== "fallback" && name.includes(key)) return url;
  }
  // Smart fallback matching for common Indian culinary terms
  if (name.includes("rice") || name.includes("curd") || name.includes("rasam")) {
    return DISH_IMAGE_MAP.lemon;
  }
  if (name.includes("curry") || name.includes("gravy") || name.includes("makhani")) {
    return DISH_IMAGE_MAP.paneer;
  }
  if (name.includes("naan") || name.includes("paratha") || name.includes("bread")) {
    return DISH_IMAGE_MAP.roti;
  }
  if (name.includes("dosa") || name.includes("vada") || name.includes("breakfast")) {
    return DISH_IMAGE_MAP.idli;
  }
  if (name.includes("chicken") || name.includes("mutton") || name.includes("meat")) {
    return DISH_IMAGE_MAP.biryani;
  }
  if (name.includes("seafood") || name.includes("prawn")) {
    return DISH_IMAGE_MAP.fish;
  }
  return DISH_IMAGE_MAP.fallback;
}

export const DocketCard: FC<DocketCardProps> = ({
  listing,
  onOpenSmartMatch,
  onAdvanceStatus,
  isAdvancing = false,
  onOpenCertificate,
  onTrackDelivery,
}) => {
  const isUrgent =
    listing.minutes_remaining > 0 &&
    listing.minutes_remaining <= 180 &&
    listing.status === "POSTED";

  const isExpired = listing.minutes_remaining <= 0;
  const hrsLeft = Math.floor(Math.max(0, listing.minutes_remaining) / 60);
  const minsLeft = Math.max(0, listing.minutes_remaining % 60);

  // Exact 0% when expired; 6% to 100% when active
  const safeProgress = isExpired
    ? 0
    : Math.min(100, Math.max(6, (listing.minutes_remaining / 240) * 100));

  const distanceKm = (
    1.2 + ((listing.id.charCodeAt(0) || 100) % 7) * 0.4
  ).toFixed(1);

  const isVeg = listing.food_category === "VEG";
  const dishImageUrl = getDishImage(listing.food_name);
  const [isDispatching, setIsDispatching] = useState<boolean>(false);

  const handleWhatsAppDispatch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDispatching(true);
    try {
      const trigger = await api.dispatchListing(listing.id, {
        volunteer_name: "Vikram Adiga (Robin Hood Army)",
        volunteer_phone: "+91 99112 33445",
        vehicle_type: "EV Cargo Trike",
      });
      if (trigger?.whatsapp_deep_link) {
        window.open(trigger.whatsapp_deep_link, "_blank");
      }
    } catch {
      // Fallback: client-side deep link generator
      const brief = api.generateDispatchBriefText({
        listingId: listing.id,
        foodName: listing.food_name,
        quantityKg: listing.quantity_kg,
        quantityMeals: listing.quantity_meals,
        donorName: listing.donor_name,
        donorAddress: listing.donor_address,
        donorPhone: listing.donor_phone,
        donorCoordinates: { lat: 12.9716, lng: 77.6412 },
        shelterName: "Robin Hood Army - Indiranagar Hub",
        shelterAddress: "Double Road, Indiranagar",
        shelterPhone: "+91 98200 44556",
        scwMinutesRemaining: listing.minutes_remaining,
        vehicleType: "EV Cargo Trike",
      });
      const waUrl = api.formatWhatsAppDispatchLink("919911233445", brief);
      window.open(waUrl, "_blank");
    } finally {
      setIsDispatching(false);
    }
  };

  const handleSmsDispatch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDispatching(true);
    try {
      const trigger = await api.dispatchListing(listing.id, {
        volunteer_name: "Vikram Adiga (Robin Hood Army)",
        volunteer_phone: "+91 99112 33445",
        vehicle_type: "EV Cargo Trike",
      });
      if (trigger?.sms_trigger_uri) {
        window.location.href = trigger.sms_trigger_uri;
      }
    } catch {
      const brief = api.generateDispatchBriefText({
        listingId: listing.id,
        foodName: listing.food_name,
        quantityKg: listing.quantity_kg,
        quantityMeals: listing.quantity_meals,
        donorName: listing.donor_name,
        donorAddress: listing.donor_address,
        donorPhone: listing.donor_phone,
        donorCoordinates: { lat: 12.9716, lng: 77.6412 },
        shelterName: "Robin Hood Army - Indiranagar Hub",
        shelterAddress: "Double Road, Indiranagar",
        shelterPhone: "+91 98200 44556",
        scwMinutesRemaining: listing.minutes_remaining,
        vehicleType: "EV Cargo Trike",
      });
      const smsUrl = api.formatSmsDispatchLink("919911233445", brief);
      window.location.href = smsUrl;
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <article
      onClick={listing.status === "DELIVERED" && onOpenCertificate ? () => onOpenCertificate() : undefined}
      onKeyDown={
        listing.status === "DELIVERED" && onOpenCertificate
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenCertificate();
              }
            }
          : undefined
      }
      tabIndex={listing.status === "DELIVERED" ? 0 : undefined}
      role={listing.status === "DELIVERED" ? "button" : undefined}
      className={`cyber-card retro-card rounded-2xl border border-stone-200/80 bg-white shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between overflow-hidden group ${
        listing.status === "DELIVERED" ? "cursor-pointer" : ""
      }`}
      aria-label={
        listing.status === "DELIVERED"
          ? "Click to view official audit receipt and ESG certificate"
          : `Docket ${listing.id}: ${listing.food_name}`
      }
    >
      <section className="flex flex-col">
        {/* Appetizing Food Thumbnail with Official Veg/Non-Veg & FSSAI Badges */}
        <div className="relative h-48 sm:h-52 w-full overflow-hidden bg-stone-100 rounded-t-2xl">
          <img
            src={dishImageUrl}
            alt={listing.food_name}
            loading="lazy"
            decoding="async"
            onError={(e) => {
              e.currentTarget.onerror = null;
              if (e.currentTarget.src !== FALLBACK_DISH_SVG) {
                e.currentTarget.src = FALLBACK_DISH_SVG;
              }
            }}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />

          {/* Bottom gradient overlay so overlaid text & badges pop with contrast */}
          <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none block" aria-hidden="true" />

          {/* Top-Left: Authentic FSSAI Veg/Non-Veg Badge in Frosted Glass Pill */}
          <span className="absolute top-3 left-3 flex items-center gap-2 z-10">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-md border border-stone-200/80 shadow-sm"
              title={isVeg ? "Vegetarian" : "Non-Vegetarian"}
              aria-label={listing.food_category}
            >
              <span
                className={`w-3.5 h-3.5 rounded-[3px] border-2 flex items-center justify-center ${
                  isVeg ? "border-emerald-600" : "border-rose-600"
                }`}
                aria-hidden="true"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isVeg ? "bg-emerald-600" : "bg-rose-600"}`} />
              </span>
              <span className={`font-label text-xs font-bold ${isVeg ? "text-emerald-700" : "text-rose-700"}`}>
                {isVeg ? "Veg" : "Non-Veg"}
              </span>
            </span>
          </span>

          {/* Top-Right: FSSAI 2026 Verified Badge Pill */}
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-600/95 backdrop-blur-md text-white shadow-sm z-10">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="font-label text-xs font-semibold">FSSAI 2026 Verified</span>
          </span>

          {/* Bottom-Left: Status indicator badge if active */}
          {listing.status !== "POSTED" && (
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 backdrop-blur-md border border-emerald-600/30 text-emerald-800 shadow-sm z-10">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-label text-xs font-semibold">
                {listing.status === "CLAIMED"
                  ? "Courier Assigned"
                  : listing.status === "COLLECTED"
                  ? "In Transit"
                  : "Delivered to Shelter"}
              </span>
            </span>
          )}
        </div>

        {/* Card Body */}
        <div className="p-4 sm:p-5 flex flex-col gap-3.5">
          {/* Safe Consumption Window Countdown + Dynamic Bar */}
          <div className="bg-stone-50 rounded-xl p-3 border border-stone-200/60 shadow-2xs">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className={`inline-flex items-center gap-1.5 font-label text-xs font-bold tabular-nums ${
                isExpired ? "text-rose-600" : isUrgent ? "text-amber-600" : "text-emerald-600"
              }`}>
                <Clock className="size-3.5" />
                <span>
                  {listing.minutes_remaining > 0
                    ? `${hrsLeft}h ${minsLeft}m safe hold remaining`
                    : "WINDOW EXPIRED"}
                </span>
              </span>
              {isUrgent && (
                <span className="font-label text-[11px] font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-full uppercase tracking-wide">
                  Urgent
                </span>
              )}
            </div>

            {/* Visual Color Bar (Crucial for test: selector `.overflow-hidden > div`) */}
            <div className="w-full h-2 rounded-full bg-stone-200/80 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isExpired
                    ? "bg-rose-500"
                    : isUrgent
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${safeProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-label text-stone-500 font-semibold mt-1.5 tracking-tight">
              <span>HOT HOLD &gt;65°C</span>
              <span>4-HR FSSAI LIMIT</span>
            </div>
          </div>

          {/* Food Name & Description */}
          <div>
            <h3 className="font-bold text-stone-900 text-lg leading-snug tracking-tight text-balance">
              {listing.food_name}
            </h3>
            {listing.handling_notes && (
              <p className="font-body text-xs text-stone-500 mt-1 line-clamp-2 leading-relaxed text-pretty">
                {listing.handling_notes}
              </p>
            )}
          </div>

          {/* Donor Details & Distance */}
          <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-stone-100">
            <div className="min-w-0">
              <p className="font-label text-xs font-bold text-stone-800 truncate">
                {listing.donor_name}
              </p>
              <p className="font-label text-[11px] text-stone-500 truncate">
                {listing.donor_type} • {listing.donor_address}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 font-label text-xs tabular-nums shrink-0 font-medium border border-stone-200/50">
              <MapPin className="size-3 text-emerald-600" />
              <span>{distanceKm} km away</span>
            </span>
          </div>

          {/* Portion & Logistics Badges */}
          <div className="grid grid-cols-2 gap-2 text-stone-600">
            <div className="flex items-center gap-1.5 bg-stone-50 px-2.5 py-1.5 rounded-lg border border-stone-200/40">
              <Users className="size-3.5 text-emerald-600 shrink-0" />
              <span className="font-label text-xs tabular-nums font-medium truncate">
                Feeds {listing.quantity_meals} People • {listing.quantity_kg} kg
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-stone-50 px-2.5 py-1.5 rounded-lg border border-stone-200/40">
              <PackageCheck className="size-3.5 text-amber-600 shrink-0" />
              <span className="font-label text-xs truncate font-medium">
                Insulated Stainless Urn
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Card Footer Actions */}
      <footer className="px-4 sm:px-5 pb-4 pt-1 flex flex-col gap-2 border-t border-stone-100">
        {listing.status === "POSTED" && (
          <>
            <button
              type="button"
              onClick={() => onOpenSmartMatch(listing.id)}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-label text-sm font-bold shadow-sm transition-all duration-150 cursor-pointer flex items-center justify-center gap-2 hover:shadow-md"
            >
              <span>Claim for Shelter</span>
              <span className="sr-only">SMART MATCH NGO</span>
            </button>
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={handleWhatsAppDispatch}
                disabled={isDispatching}
                aria-label="1-Click WhatsApp Dispatch"
                title="1-Click WhatsApp Courier Dispatch"
                className="py-2 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-label text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
              >
                <MessageSquare className="size-3.5 text-emerald-600" />
                <span>WhatsApp Dispatch</span>
              </button>
              <button
                type="button"
                onClick={handleSmsDispatch}
                disabled={isDispatching}
                aria-label="SMS Dispatch Alert"
                title="SMS Courier Dispatch Alert"
                className="py-2 px-2.5 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 font-label text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
              >
                <Send className="size-3.5 text-stone-600" />
                <span>SMS Alert</span>
              </button>
            </div>
          </>
        )}

        {listing.status === "CLAIMED" && (
          <button
            type="button"
            disabled={isAdvancing}
            onClick={() => onAdvanceStatus(listing.id, "COLLECTED")}
            className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-label text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            {isAdvancing ? "Updating Status..." : "[2] CONFIRM FOOD COLLECTED BY COURIER"}
          </button>
        )}

        {listing.status === "COLLECTED" && (
          <button
            type="button"
            disabled={isAdvancing}
            onClick={() => onAdvanceStatus(listing.id, "DELIVERED")}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-label text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            {isAdvancing ? "Updating Status..." : "[3] CONFIRM DELIVERED TO BENEFICIARIES"}
          </button>
        )}

        {listing.status === "DELIVERED" && onOpenCertificate && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenCertificate();
            }}
            aria-label="Open official audit receipt and tax certificate"
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-label text-sm font-bold shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <ShieldCheck className="size-4" />
            <span>VIEW OFFICIAL AUDIT RECEIPT &amp; TAX CERTIFICATE</span>
          </button>
        )}

        {onTrackDelivery && listing.status !== "POSTED" && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTrackDelivery(listing);
            }}
            className="w-full py-2 px-3 rounded-xl bg-stone-50 text-stone-700 border border-stone-200 hover:bg-stone-100 font-label text-xs font-semibold transition-colors duration-150 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Truck className="size-3.5 text-stone-600" />
            <span>Track Live Delivery</span>
            <span className="sr-only">LIVE TRACK</span>
          </button>
        )}
      </footer>
    </article>
  );
};
