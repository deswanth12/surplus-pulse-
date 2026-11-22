import { useState, useCallback } from "react";
import {
  SmartMatchResponse,
  MirageInspectionResult,
  FoodListingFormData,
  FoodListing,
} from "../types";

export function useModalState() {
  // Modal visibility states
  const [showPostModal, setShowPostModal] = useState<boolean>(false);
  const [showMatchModal, setShowMatchModal] = useState<boolean>(false);
  const [showMirageModal, setShowMirageModal] = useState<boolean>(false);
  const [showCertificateModal, setShowCertificateModal] = useState<boolean>(false);
  const [showTrackerModal, setShowTrackerModal] = useState<boolean>(false);
  const [isDispatchCartOpen, setIsDispatchCartOpen] = useState<boolean>(false);

  // Modal payload and context states
  const [matchData, setMatchData] = useState<SmartMatchResponse | null>(null);
  const [selectedMatchReceiver, setSelectedMatchReceiver] = useState<string>("");
  const [mirageInspection, setMirageInspection] = useState<MirageInspectionResult | null>(null);
  const [mirageScanning, setMirageScanning] = useState<boolean>(false);
  const [autoFillFormData, setAutoFillFormData] = useState<FoodListingFormData | undefined>(undefined);
  const [trackingListing, setTrackingListing] = useState<FoodListing | null>(null);

  // Clean openers and closers
  const openPostModal = useCallback((initialData?: FoodListingFormData) => {
    if (initialData) {
      setAutoFillFormData(initialData);
    }
    setShowPostModal(true);
  }, []);

  const closePostModal = useCallback(() => {
    setShowPostModal(false);
  }, []);

  const openMatchModal = useCallback((data: SmartMatchResponse) => {
    setMatchData(data);
    if (data.matches?.length > 0) {
      setSelectedMatchReceiver(data.matches[0].receiver_id);
    }
    setShowMatchModal(true);
  }, []);

  const closeMatchModal = useCallback(() => {
    setShowMatchModal(false);
  }, []);

  const openMirageModal = useCallback(() => {
    setShowMirageModal(true);
  }, []);

  const closeMirageModal = useCallback(() => {
    setShowMirageModal(false);
  }, []);

  const openCertificateModal = useCallback(() => {
    setShowCertificateModal(true);
  }, []);

  const closeCertificateModal = useCallback(() => {
    setShowCertificateModal(false);
  }, []);

  const openTrackerModal = useCallback((listing: FoodListing) => {
    setTrackingListing(listing);
    setShowTrackerModal(true);
  }, []);

  const closeTrackerModal = useCallback(() => {
    setShowTrackerModal(false);
  }, []);

  const toggleDispatchCart = useCallback(() => {
    setIsDispatchCartOpen((prev) => !prev);
  }, []);

  const closeAllModals = useCallback(() => {
    setShowPostModal(false);
    setShowMatchModal(false);
    setShowMirageModal(false);
    setShowCertificateModal(false);
    setShowTrackerModal(false);
    setIsDispatchCartOpen(false);
  }, []);

  return {
    // Visibility flags & standard setters
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

    // Payloads / Context
    matchData,
    setMatchData,
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

    // Semantic action openers and closers
    openPostModal,
    closePostModal,
    openMatchModal,
    closeMatchModal,
    openMirageModal,
    closeMirageModal,
    openCertificateModal,
    closeCertificateModal,
    openTrackerModal,
    closeTrackerModal,
    toggleDispatchCart,
    closeAllModals,
  };
}
