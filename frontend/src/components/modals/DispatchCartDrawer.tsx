import type { FC } from "react";
import {
  Truck,
  ChevronUp,
  X,
  Navigation,
  Leaf,
  Droplets,
  Plus,
  Users,
  MessageSquare,
} from "lucide-react";
import { FoodListing } from "../../types";
import * as api from "../../services/api";

interface DispatchCartDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
  listings: FoodListing[];
  onTrackListing: (listing: FoodListing) => void;
  onOpenSmartMatch: (listingId: string) => void;
}

export const DispatchCartDrawer: FC<DispatchCartDrawerProps> = ({
  isOpen,
  onToggle,
  listings,
  onTrackListing,
  onOpenSmartMatch,
}) => {
  const activeMissions = listings.filter(
    (l) => l.status === "CLAIMED" || l.status === "COLLECTED"
  );
  const urgentPosted = listings.filter(
    (l) => l.status === "POSTED" && l.minutes_remaining <= 180
  );

  const totalMealsInTransit = activeMissions.reduce(
    (acc, l) => acc + l.quantity_meals,
    0
  );
  const totalKgInTransit = activeMissions.reduce(
    (acc, l) => acc + l.quantity_kg,
    0
  );
  const co2OffsetKg = (totalKgInTransit * 2.5).toFixed(1);
  const waterSavedLiters = Math.round(totalKgInTransit * 800);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 font-body">
      {/* Floating Bottom Action Strip (Always visible) */}
      <div className="bg-light-surface-container-lowest/98 border-t border-light-outline-variant/70 shadow-[0_-4px_24px_rgba(31,27,23,0.08)] backdrop-blur-md text-light-on-surface px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-light-primary text-light-on-primary rounded-lg shadow-sm flex items-center justify-center shrink-0">
            <Truck className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-headline font-bold text-xs sm:text-sm text-light-on-surface tracking-wide">
                MUNICIPAL RESCUE DISPATCH CORPS
              </span>
              <span className="px-2 py-0.5 rounded-full bg-light-primary-container text-light-on-primary-container text-[10px] font-label font-bold uppercase">
                SWIGGY/ZOMATO CORRIDOR
              </span>
            </div>
            <p className="text-[11px] text-light-on-surface-variant font-label mt-0.5">
              {activeMissions.length > 0
                ? `${activeMissions.length} ACTIVE RESCUE MISSIONS • ${totalMealsInTransit} MEALS CLAIMED • ${totalMealsInTransit} BENEFICIARIES FED • ${co2OffsetKg} KG CO₂ OFFSET • FLEET: TVS KING CARGO EV`
                : `${urgentPosted.length} SURPLUS RATIONS PENDING CLAIM IN BENGALURU SECTORS`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeMissions.length > 0 && (
            <button
              type="button"
              onClick={() => onTrackListing(activeMissions[0])}
              className="px-3 py-1.5 text-xs font-label font-bold flex items-center gap-1.5 cursor-pointer rounded-md bg-light-secondary text-light-on-secondary hover:opacity-90 shadow-sm transition-opacity"
              aria-label="Track primary active delivery"
            >
              <Navigation className="h-3 w-3" />
              <span>TRACK LIVE DELIVERY</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggle}
            className="px-3 py-1.5 text-xs font-label font-bold flex items-center gap-1.5 cursor-pointer rounded-md bg-light-surface-container-low text-light-on-surface border border-light-outline-variant hover:bg-light-surface-container shadow-sm transition-colors"
            aria-label={isOpen ? "Collapse dispatch summary" : "Expand dispatch summary"}
          >
            <span>{isOpen ? "COLLAPSE" : "DISPATCH SUMMARY"}</span>
            <ChevronUp
              className={`h-3.5 w-3.5 transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Expanded Swiggy/Zomato-Style Cart Drawer */}
      {isOpen && (
        <div className="drawer-slide-up bg-light-surface-container-lowest border-t border-light-outline-variant shadow-[0_-12px_32px_rgba(31,27,23,0.12)] backdrop-blur-xl max-h-[70vh] overflow-y-auto p-4 sm:p-5 space-y-4 text-light-on-surface">
          <div className="flex justify-between items-center border-b border-light-outline-variant/50 pb-2.5">
            <div>
              <h3 className="text-base font-bold font-headline text-light-on-surface flex items-center gap-2">
                <span>HYPERLOCAL RELIEF DISPATCH FLEET TELEMETRY</span>
                <span className="px-2 py-0.5 rounded-full bg-light-primary-container text-light-on-primary-container text-xs font-label font-bold">
                  {activeMissions.length} ACTIVE IN TRANSIT
                </span>
              </h3>
              <p className="text-xs text-light-on-surface-variant font-label mt-0.5">
                Live monitoring of all volunteer courier dispatches across Bangalore sectors
              </p>
            </div>
            <button
              type="button"
              onClick={onToggle}
              className="text-light-on-surface-variant hover:text-light-on-surface p-1.5 rounded-md hover:bg-light-surface-container transition-colors cursor-pointer"
              aria-label="Close dispatch drawer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Hyperlocal Dispatch Telemetry KPI Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs font-label">
            <div className="p-3 bg-light-surface-container-low rounded-lg border border-light-outline-variant/60 shadow-sm">
              <div className="text-[10px] text-light-on-surface-variant font-medium">MEALS IN CORRIDOR (TOTAL CLAIMED)</div>
              <div className="text-base sm:text-lg font-bold text-light-primary mt-0.5 font-headline tabular-nums">
                {totalMealsInTransit} MEALS
              </div>
            </div>
            <div className="p-3 bg-light-surface-container-low rounded-lg border border-light-outline-variant/60 shadow-sm">
              <div className="text-[10px] text-light-on-surface-variant flex items-center gap-1 font-bold">
                <Users className="h-3 w-3 text-light-primary" />
                <span>BENEFICIARY COUNT</span>
              </div>
              <div className="text-base sm:text-lg font-bold text-light-primary mt-0.5 font-headline tabular-nums">
                {totalMealsInTransit} CITIZENS FED
              </div>
            </div>
            <div className="p-3 bg-light-surface-container-low rounded-lg border border-light-outline-variant/60 shadow-sm">
              <div className="text-[10px] font-bold flex items-center gap-1 text-light-on-surface-variant">
                <Leaf className="h-3 w-3 text-light-success" />
                <span>CARBON OFFSET (CO₂ EMISSIONS DIVERTED)</span>
              </div>
              <div className="text-base sm:text-lg font-bold text-light-success mt-0.5 font-headline tabular-nums">
                {co2OffsetKg} KG CO₂e
              </div>
            </div>
            <div className="p-3 bg-light-surface-container-low rounded-lg border border-light-outline-variant/60 shadow-sm">
              <div className="text-[10px] text-light-on-surface-variant flex items-center gap-1 font-medium">
                <Droplets className="h-3 w-3 text-light-tertiary" />
                <span>CULINARY WATER SAVED</span>
              </div>
              <div className="text-base sm:text-lg font-bold text-light-tertiary mt-0.5 font-headline tabular-nums">
                {waterSavedLiters} L
              </div>
            </div>
            <div className="p-3 bg-light-surface-container-low rounded-lg border border-light-outline-variant/60 shadow-sm">
              <div className="text-[10px] text-light-on-surface-variant flex items-center gap-1 font-medium">
                <Truck className="h-3 w-3 text-light-secondary" />
                <span>DELIVERY VEHICLE</span>
              </div>
              <div className="text-xs font-bold mt-1 text-light-on-surface">
                TVS KING CARGO EV FLEET
              </div>
            </div>
          </div>

          {/* Active Missions List */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-light-on-surface font-headline uppercase tracking-wide">
              ACTIVE IN-TRANSIT MISSIONS ({activeMissions.length}):
            </h4>

            {activeMissions.length === 0 ? (
              <div className="p-6 bg-light-surface-container-low rounded-lg border border-dashed border-light-outline-variant/70 text-center text-xs text-light-on-surface-variant space-y-2">
                <p>No active courier missions in transit right now.</p>
                {urgentPosted.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onOpenSmartMatch(urgentPosted[0].id)}
                    className="px-3 py-1.5 text-xs font-label font-bold inline-flex items-center gap-1.5 cursor-pointer rounded-md bg-light-secondary text-light-on-secondary hover:opacity-90 shadow-sm transition-opacity"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>CLAIM URGENT SURPLUS ({urgentPosted[0].food_name})</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeMissions.map((listing) => (
                  <div
                    key={listing.id}
                    className="p-3.5 bg-light-surface-container-lowest rounded-lg border border-light-outline-variant/60 space-y-2 hover:border-light-primary/50 transition-colors shadow-sm"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-[10px] font-bold font-label text-light-on-surface-variant uppercase">
                          DOCKET #{listing.id.toUpperCase()} • {listing.food_category}
                        </div>
                        <div className="text-sm font-bold font-headline text-light-on-surface">
                          {listing.food_name}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-label font-bold bg-light-warning-container text-light-on-warning-container">
                        {listing.status === "CLAIMED" ? "COURIER EN ROUTE" : "IN TRANSIT"}
                      </span>
                    </div>

                    <div className="text-xs text-light-on-surface-variant font-label">
                      {listing.donor_name} →{" "}
                      <strong className="text-light-on-surface font-semibold">{listing.pickup?.receiver_name || "Relief Shelter"}</strong>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-light-outline-variant/40 flex-wrap gap-1 text-xs font-label">
                      <div>
                        <div>Courier: <strong className="text-light-on-surface font-semibold">{listing.pickup?.volunteer_name || "Rescue Volunteer"}</strong></div>
                        <div className="text-[11px] text-light-on-surface-variant">Vehicle: {listing.pickup?.vehicle_type || "TVS King Cargo Auto EV"} • Feeds {listing.quantity_meals}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <a
                          href={api.formatWhatsAppDispatchLink(
                            listing.pickup?.volunteer_phone || "+91 99112 33445",
                            api.generateDispatchBriefText({
                              listingId: listing.id,
                              foodName: listing.food_name,
                              quantityKg: listing.quantity_kg,
                              quantityMeals: listing.quantity_meals,
                              donorName: listing.donor_name,
                              donorAddress: listing.donor_address,
                              donorPhone: listing.donor_phone,
                              shelterName: listing.pickup?.receiver_name || "Relief Shelter Hub",
                              shelterAddress: "Bengaluru Relief Corridor",
                              shelterPhone: "+91 98200 44556",
                              scwMinutesRemaining: listing.minutes_remaining,
                              vehicleType: listing.pickup?.vehicle_type || "TVS King Cargo Auto EV",
                            })
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`WhatsApp courier for ${listing.food_name}`}
                          title="Send corridor dispatch brief to courier"
                          className="px-2.5 py-1 text-xs font-label font-bold flex items-center gap-1 cursor-pointer rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-colors no-underline"
                        >
                          <MessageSquare className="h-3 w-3" />
                          <span>WHATSAPP</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => onTrackListing(listing)}
                          className="px-3 py-1 text-xs font-label font-bold flex items-center gap-1 cursor-pointer rounded-md bg-light-primary text-light-on-primary hover:bg-light-primary-container shadow-sm transition-colors"
                          aria-label={`Track live delivery for ${listing.food_name}`}
                        >
                          <Navigation className="h-3 w-3" />
                          <span>TRACK LIVE</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
