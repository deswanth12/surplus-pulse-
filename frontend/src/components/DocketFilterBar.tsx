import type { FC } from "react";
import { FoodListing } from "../types";
import { SlidersHorizontal } from "lucide-react";

interface DocketFilterBarProps {
  statusFilter: string;
  setStatusFilter: (filter: string) => void;
  listings: FoodListing[];
}

export const DocketFilterBar: FC<DocketFilterBarProps> = ({
  statusFilter,
  setStatusFilter,
  listings,
}) => {
  const urgentCount = listings.filter(
    (l) => l.minutes_remaining > 0 && l.minutes_remaining <= 180 && l.status === "POSTED"
  ).length;
  const postedCount = listings.filter((l) => l.status === "POSTED").length;
  const transitCount = listings.filter(
    (l) => l.status === "CLAIMED" || l.status === "COLLECTED"
  ).length;
  const deliveredCount = listings.filter((l) => l.status === "DELIVERED").length;
  const vegCount = listings.filter((l) => l.food_category === "VEG").length;
  const nonVegCount = listings.filter((l) => l.food_category === "NON_VEG").length;

  const filterOptions = [
    { id: "ALL", label: "All Listings", ariaLabel: `ALL (${listings.length})`, count: listings.length, badge: "bg-emerald-100 text-emerald-800" },
    { id: "URGENT", label: "Urgent (<2h)", ariaLabel: `🔥 URGENT (${urgentCount})`, count: urgentCount, badge: "bg-amber-100 text-amber-800" },
    { id: "POSTED", label: "Available", ariaLabel: `POSTED (${postedCount})`, count: postedCount, badge: "bg-stone-200 text-stone-800" },
    { id: "CLAIMED", label: "In Transit", ariaLabel: `IN TRANSIT (${transitCount})`, count: transitCount, badge: "bg-sky-100 text-sky-800" },
    { id: "DELIVERED", label: "Delivered", ariaLabel: `DELIVERED (${deliveredCount})`, count: deliveredCount, badge: "bg-emerald-100 text-emerald-800" },
    { id: "VEG", label: "Vegetarian Only", ariaLabel: `VEG ONLY (${vegCount})`, count: vegCount, badge: "bg-emerald-100 text-emerald-800" },
    { id: "NON_VEG", label: "Non-Veg", ariaLabel: `NON-VEG (${nonVegCount})`, count: nonVegCount, badge: "bg-rose-100 text-rose-800" },
  ];

  return (
    <section
      className="bg-white border border-stone-200/80 rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3"
      role="region"
      aria-label="Docket Filter Toolbar"
    >
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 min-w-0">
        <span className="text-xs font-bold text-stone-500 uppercase shrink-0 flex items-center gap-1.5 font-label mr-1">
          <SlidersHorizontal className="size-3.5 text-emerald-600" />
          <span>Filters:</span>
        </span>
        {filterOptions.map((st) => {
          const active = statusFilter === st.id;
          return (
            <button
              key={st.id}
              type="button"
              onClick={() => setStatusFilter(st.id)}
              aria-pressed={active}
              aria-label={st.ariaLabel}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-label text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                active
                  ? "bg-emerald-600 text-white shadow-sm font-semibold hover:bg-emerald-700"
                  : "bg-stone-50 text-stone-700 border border-stone-200/80 hover:bg-stone-100 hover:border-stone-300"
              }`}
            >
              <span>{st.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-xs font-bold tabular-nums ${
                  active ? "bg-white/25 text-white" : st.badge
                }`}
              >
                {st.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="text-xs font-label text-emerald-800 font-semibold flex items-center gap-2 shrink-0 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200/70 self-start lg:self-center shadow-2xs">
        <span className="size-2 rounded-full bg-emerald-500 animate-ping" aria-hidden="true" />
        <span>Hyperlocal Proximity Dispatch Active</span>
      </div>
    </section>
  );
};
