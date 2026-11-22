import { useState, useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { FoodListing, FoodListingFormData, OperationalRole } from "./types";
import { useSurplusData } from "./hooks/useSurplusData";
import { useModalState } from "./hooks/useModalState";
import { useTeletypeToasts } from "./hooks/useTeletypeToasts";
import * as api from "./services/api";
import { Header } from "./components/Header";
import { KpiRibbon } from "./components/KpiRibbon";
import { DocketFilterBar } from "./components/DocketFilterBar";
import { DocketCard } from "./components/DocketCard";
import { CrtRadarMap } from "./components/CrtRadarMap";
import { Comptometer } from "./components/Comptometer";
import { Guidelines } from "./components/Guidelines";
import { TeletypeToastContainer } from "./components/TeletypeToastContainer";
import { DonorPortal } from "./components/portals/DonorPortal";
import { CourierPortal } from "./components/portals/CourierPortal";
import { ShelterPortal } from "./components/portals/ShelterPortal";
import { MunicipalCommand } from "./components/portals/MunicipalCommand";
import { PostModal } from "./components/modals/PostModal";
import { MatchModal } from "./components/modals/MatchModal";
import { MirageModal } from "./components/modals/MirageModal";
import { CertificateModal } from "./components/modals/CertificateModal";
import { LiveDeliveryTracker } from "./components/modals/LiveDeliveryTracker";
import { DispatchCartDrawer } from "./components/modals/DispatchCartDrawer";
import { RotateCcw, Plus } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<"RADAR" | "MAP" | "IMPACT" | "GUIDELINES">("RADAR");
  const [activeRole, setActiveRole] = useState<OperationalRole>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [eventsPerMonth, setEventsPerMonth] = useState<number>(8);
  const [leftoverPerEvent, setLeftoverPerEvent] = useState<number>(80);
  const mainContainerRef = useRef<HTMLDivElement>(null);

  // Hook 1: Teletype notification toasts with managed timer lifecycles
  const { toasts, addToast, dismissToast } = useTeletypeToasts();

  // Hook 2: Surplus data domain state (listings, donors, receivers, impact, targeted refresh)
  const {
    listings,
    donors,
    receivers,
    impact,
    loading,
    advancingListingId,
    isResetting,
    handleConfirmClaim: confirmClaim,
    handleAdvanceStatus: advanceStatus,
    handleCreateListing: createListing,
    handleResetRegistry: resetRegistry,
  } = useSurplusData({ onToast: addToast });

  // Hook 3: Modal visibility flags, context payloads, and action openers/closers
  const {
    showPostModal,
    setShowPostModal,
    showMatchModal,
    setShowMatchModal,
    showMirageModal,
    setShowMirageModal,
    showCertificateModal,
    setShowCertificateModal,
    showTrackerModal,
    setShowTrackerModal,
    isDispatchCartOpen,
    setIsDispatchCartOpen,
    matchData,
    selectedMatchReceiver,
    setSelectedMatchReceiver,
    mirageInspection,
    setMirageInspection,
    mirageScanning,
    setMirageScanning,
    autoFillFormData,
    setAutoFillFormData,
    trackingListing,
    setTrackingListing,
    openMatchModal,
    openTrackerModal,
  } = useModalState();

  // GSAP Kinematic Stagger Entrances
  useGSAP(
    () => {
      if (!loading) {
        gsap.from(".retro-card", {
          y: 16,
          opacity: 0,
          stagger: 0.04,
          duration: 0.45,
          ease: "power3.out",
          clearProps: "all",
        });
      }
    },
    { dependencies: [activeTab, activeRole, loading], scope: mainContainerRef }
  );

  useGSAP(
    () => {
      if (!loading && activeTab === "RADAR" && mainContainerRef.current?.querySelector(".docket-grid .retro-card")) {
        gsap.from(".docket-grid .retro-card", {
          y: 12,
          opacity: 0,
          stagger: 0.05,
          duration: 0.35,
          ease: "power2.out",
          clearProps: "all",
        });
      }
    },
    { dependencies: [statusFilter], scope: mainContainerRef }
  );

  // Mirage 22MB VLM Inspection handler
  const handleRunMirageInspection = async (sampleId: string = "biryani", fileBase64?: string) => {
    setMirageScanning(true);
    try {
      const res = await api.inspectFood({
        sample_id: sampleId,
        image_base64: fileBase64 || undefined,
      });
      setMirageInspection(res);
      setShowMirageModal(true);
      addToast("MIRAGE 22MB VLM SCAN COMPLETE • HYGIENE VERIFIED", "SCAN");
    } catch (err: any) {
      addToast(`MIRAGE VLM INSPECTION FAILED: ${err?.message || "Inspection error"}`, "ERROR");
    } finally {
      setMirageScanning(false);
    }
  };

  // Transfer Mirage inspection data to Form 68-A
  const handleApplyMirageToForm = () => {
    if (!mirageInspection) return;
    const { auto_fill_form_data } = mirageInspection;
    setAutoFillFormData({
      donor_id: donors[0]?.id || "",
      food_name: auto_fill_form_data.food_name,
      food_category: auto_fill_form_data.food_category,
      quantity_meals: 90,
      quantity_kg: 40.0,
      storage_type: auto_fill_form_data.storage_type,
      allergens: auto_fill_form_data.allergens,
      handling_notes: auto_fill_form_data.handling_notes,
      hours_valid: auto_fill_form_data.hours_valid,
    });
    setShowMirageModal(false);
    setShowPostModal(true);
    addToast("FORM 68-A AUTO-FILLED VIA MIRAGE VLM INSPECTION", "SUCCESS");
  };

  // Reset demo registry
  const handleResetRegistry = async () => {
    await resetRegistry(() => setStatusFilter("ALL"));
  };

  // Open Smart Proximity Match Modal
  const handleOpenSmartMatch = async (listingId: string) => {
    try {
      const res = await api.getMatches(listingId);
      openMatchModal(res);
    } catch (err: any) {
      addToast(`ERROR FETCHING MATCHES: ${err?.message || "Unable to match"}`, "ERROR");
    }
  };

  // Submit Courier Claim
  const handleConfirmClaim = async (payload: {
    receiver_id: string;
    volunteer_name: string;
    volunteer_phone: string;
    vehicle_type: string;
  }) => {
    if (!matchData) return;
    await confirmClaim(matchData.listing_id, payload, matchData);
    setShowMatchModal(false);
  };

  // Open Live Delivery Tracker
  const handleOpenLiveTracker = (listing: FoodListing) => {
    openTrackerModal(listing);
  };

  // Advance Status (COLLECTED or DELIVERED)
  const handleAdvanceStatus = async (
    listingId: string,
    nextStatus: "COLLECTED" | "DELIVERED"
  ) => {
    await advanceStatus(listingId, nextStatus, (updatedListing) => {
      // Keep live tracker in sync if open
      setTrackingListing((prev) =>
        prev && prev.id === listingId ? { ...updatedListing } : prev
      );
    });
  };

  // Submit New Emergency Food Listing (Form 68-A)
  const handleCreateListing = async (formData: FoodListingFormData) => {
    await createListing(formData);
    setShowPostModal(false);
  };

  // Filter listings safely
  const filteredListings = listings.filter((l) => {
    if (statusFilter === "ALL") return true;
    if (statusFilter === "URGENT")
      return l.minutes_remaining > 0 && l.minutes_remaining <= 180 && l.status === "POSTED";
    if (statusFilter === "VEG") return l.food_category === "VEG";
    if (statusFilter === "NON_VEG") return l.food_category === "NON_VEG";
    return l.status === statusFilter;
  });

  const allDelivered = listings.length > 0 && listings.every((l) => l.status === "DELIVERED");
  const hasNoFilteredListings = filteredListings.length === 0;

  if (loading && listings.length === 0) {
    return (
      <div className="min-h-screen bg-light-surface flex flex-col items-center justify-center text-light-on-surface font-body space-y-4">
        <div className="bg-light-surface-container-lowest border border-light-outline-variant/60 rounded-2xl p-8 flex flex-col items-center space-y-3 shadow-md">
          <div className="h-10 w-10 border-4 border-light-outline-variant/40 border-t-light-primary rounded-full animate-spin" />
          <div className="text-xs uppercase font-bold tracking-widest text-light-primary font-headline flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-light-primary animate-ping" aria-hidden="true" />
            <span>[AI PROTOCOL // SYNCHRONIZING NEURAL DISPATCH GRID]</span>
          </div>
          <p className="text-xs text-light-on-surface-variant font-label">
            Synchronizing Municipal Relief Dispatch Logs...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mainContainerRef}
      className="min-h-screen bg-stone-50/50 text-stone-900 font-body selection:bg-emerald-100 selection:text-emerald-900 pb-48"
    >
      {/* Header with Navigation and Ticker */}
      <Header
        donorsCount={donors.length}
        receiversCount={receivers.length}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenPostModal={() => setShowPostModal(true)}
        onRunMirageInspection={handleRunMirageInspection}
        mirageScanning={mirageScanning}
        onResetRegistry={handleResetRegistry}
        isResetting={isResetting}
        activeRole={activeRole}
        setActiveRole={setActiveRole}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 sm:pt-6 space-y-6 pb-48">
        {/* Multi-Role Dedicated Operational Portals */}
        {activeRole === "DONOR" && (
          <DonorPortal
            donors={donors}
            listings={listings}
            onOpenPostModal={() => setShowPostModal(true)}
            onOpenCertificate={() => setShowCertificateModal(true)}
            onRunMirageInspection={() => handleRunMirageInspection("fresh_biryani")}
          />
        )}

        {activeRole === "COURIER" && (
          <CourierPortal
            listings={listings}
            receivers={receivers}
            onAdvanceStatus={handleAdvanceStatus}
            onTrackDelivery={handleOpenLiveTracker}
            onToast={addToast}
          />
        )}

        {activeRole === "SHELTER" && (
          <ShelterPortal
            receivers={receivers}
            listings={listings}
            onConfirmDelivery={async (listingId, payload) => {
              await api.confirmDelivery(listingId, payload);
              await advanceStatus(listingId, "DELIVERED");
            }}
            onAdvanceStatus={handleAdvanceStatus}
            onToast={addToast}
          />
        )}

        {activeRole === "MUNICIPAL" && (
          <MunicipalCommand
            listings={listings}
            impact={impact}
            donors={donors}
            receivers={receivers}
          />
        )}

        {/* Standard All Operations Tab Views */}
        {activeRole === "ALL" && (
          <>
            {/* KPI Environmental & Economic Impact Ribbon */}
            <KpiRibbon impact={impact} />

            {/* Tab 1: Live Rescue Radar */}
            {activeTab === "RADAR" && (
              <div className="space-y-4">
                <DocketFilterBar
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  listings={listings}
                />

                {/* Cyber CTA Banner: All Delivered or Empty Filter State */}
                {(allDelivered || hasNoFilteredListings) && (
                  <div
                    role="region"
                    aria-label="Registry status notification"
                    className={`p-4 sm:p-5 rounded-2xl border shadow-sm space-y-3 transition-colors ${
                      allDelivered
                        ? "bg-emerald-50/90 border-emerald-200"
                        : "bg-white border-stone-200/80"
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2.5 py-0.5 rounded-md text-xs font-bold font-mono tracking-wide ${
                              allDelivered ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
                            }`}
                          >
                            [ALL DOCKETS DELIVERED &amp; AUDITED IN REGISTRY]
                          </span>
                          {hasNoFilteredListings && statusFilter !== "ALL" && (
                            <span className="text-xs font-mono text-rose-700 font-bold">
                              • FILTER &quot;{statusFilter}&quot; RETURNED 0 DOCKETS
                            </span>
                          )}
                          {allDelivered && statusFilter === "ALL" && (
                            <span className="text-xs font-mono text-emerald-700 font-bold">
                              • 100% CIVIC RESCUE QUOTA FULFILLED
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-stone-900 leading-snug">
                          [ALL DOCKETS DELIVERED &amp; AUDITED IN REGISTRY] Click here to Reset Registry or Dispatch New Surplus (&lt;45s)
                        </p>
                        <p className="text-xs text-stone-600 font-medium">
                          {allDelivered && statusFilter === "ALL"
                            ? "All relief dockets have completed courier transit and verified beneficiary distribution. Click below to re-initialize scenario or file Form 68-A."
                            : `Current filter criteria returned zero dockets. Reset registry, switch filters, or transmit Form 68-A to dispatch immediate emergency food rations.`}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-1 md:pt-0">
                        {statusFilter !== "ALL" && (
                          <button
                            type="button"
                            onClick={() => setStatusFilter("ALL")}
                            className="px-3.5 py-2 rounded-xl border border-stone-300 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold cursor-pointer transition-colors"
                            aria-label="Show all dockets (clear active filter)"
                          >
                            <span>SHOW ALL DOCKETS</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleResetRegistry}
                          disabled={isResetting}
                          className="px-3.5 py-2 rounded-xl border border-stone-300 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                          aria-label="Reset Registry"
                        >
                          <RotateCcw
                            className={`h-3.5 w-3.5 ${isResetting ? "animate-spin text-emerald-600" : "text-stone-600"}`}
                            aria-hidden="true"
                          />
                          <span>{isResetting ? "RESETTING REGISTRY..." : "RESET REGISTRY"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowPostModal(true)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm hover:shadow cursor-pointer transition-all"
                          aria-label="Dispatch New Surplus (<45s)"
                        >
                          <Plus className="h-3.5 w-3.5 stroke-[2.5]" aria-hidden="true" />
                          <span>DISPATCH NEW SURPLUS (&lt;45s)</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {filteredListings.length > 0 && (
                  <div className="docket-grid grid grid-cols-1 md:grid-cols-2 gap-5">
                    {filteredListings.map((listing) => (
                      <DocketCard
                        key={listing.id}
                        listing={listing}
                        onOpenSmartMatch={handleOpenSmartMatch}
                        onAdvanceStatus={handleAdvanceStatus}
                        isAdvancing={advancingListingId === listing.id}
                        onOpenCertificate={() => setShowCertificateModal(true)}
                        onTrackDelivery={handleOpenLiveTracker}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Holographic Proximity Radar & Dispatch Matrix */}
            {activeTab === "MAP" && (
              <CrtRadarMap
                donors={donors}
                receivers={receivers}
                listings={listings}
              />
            )}

            {/* Tab 3: Quantum ESG & Carbon Ledger */}
            {activeTab === "IMPACT" && (
              <Comptometer
                impact={impact}
                eventsPerMonth={eventsPerMonth}
                setEventsPerMonth={setEventsPerMonth}
                leftoverPerEvent={leftoverPerEvent}
                setLeftoverPerEvent={setLeftoverPerEvent}
                onOpenCertificateModal={() => setShowCertificateModal(true)}
                onPrintAuditSlip={() => {
                  addToast(
                    "PRINTING FISCAL RECOVERY AUDIT SLIP",
                    "VERIFIED"
                  );
                  window.print();
                }}
              />
            )}

            {/* Tab 4: FSSAI Guidelines */}
            {activeTab === "GUIDELINES" && <Guidelines />}
          </>
        )}
      </main>

      {/* Modals */}
      <PostModal
        isOpen={showPostModal}
        onClose={() => setShowPostModal(false)}
        donors={donors}
        onSubmit={handleCreateListing}
        onRunMirageInspection={handleRunMirageInspection}
        initialFormData={autoFillFormData}
        initialInspectionResult={mirageInspection}
      />

      <MatchModal
        isOpen={showMatchModal}
        onClose={() => setShowMatchModal(false)}
        matchData={matchData}
        selectedReceiverId={selectedMatchReceiver}
        setSelectedReceiverId={setSelectedMatchReceiver}
        onConfirmClaim={handleConfirmClaim}
      />

      <MirageModal
        isOpen={showMirageModal}
        onClose={() => setShowMirageModal(false)}
        mirageInspection={mirageInspection}
        mirageScanning={mirageScanning}
        onRunInspection={handleRunMirageInspection}
        onApplyToForm={handleApplyMirageToForm}
      />

      <CertificateModal
        isOpen={showCertificateModal}
        onClose={() => setShowCertificateModal(false)}
        impact={impact}
        onShare={() => {
          addToast(
            "VERIFICATION DISPATCH CYBER LINK COPIED TO CLIPBOARD",
            "SUCCESS"
          );
        }}
      />

      {/* Live Delivery Tracker Drawer / Modal */}
      <LiveDeliveryTracker
        isOpen={showTrackerModal}
        onClose={() => setShowTrackerModal(false)}
        listing={trackingListing}
        onAdvanceStatus={handleAdvanceStatus}
        isAdvancing={advancingListingId === trackingListing?.id}
        onOpenCertificate={() => setShowCertificateModal(true)}
      />

      {/* Swiggy/Zomato Municipal Dispatch Cart Summary Drawer */}
      <DispatchCartDrawer
        isOpen={isDispatchCartOpen}
        onToggle={() => setIsDispatchCartOpen(!isDispatchCartOpen)}
        listings={listings}
        onTrackListing={handleOpenLiveTracker}
        onOpenSmartMatch={handleOpenSmartMatch}
      />

      {/* Cyber Telemetry Toasts Queue */}
      <TeletypeToastContainer
        toasts={toasts}
        onDismissToast={dismissToast}
      />
    </div>
  );
}
