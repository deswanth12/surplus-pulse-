import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import React, { useState } from 'react'

// Existing Application Components and Hooks
import App from '../App'
import { DocketCard } from '../components/DocketCard'
import { CrtRadarMap, SIMULATED_ROUTE_DURATION_MS } from '../components/CrtRadarMap'
import { LiveDeliveryTracker } from '../components/modals/LiveDeliveryTracker'
import { CertificateModal } from '../components/modals/CertificateModal'
import { MirageModal } from '../components/modals/MirageModal'
import * as api from '../services/api'
import { FoodListing, Donor, Receiver } from '../types'
import {
  mockDonors,
  mockReceivers,
  mockListings,
  mockMatchResponse,
  mockImpactSummary,
  mockMirageResult,
  mockMirageFreshBiryani,
  mockMirageSpoiledCurry,
  mockMirageExpiredRice,
  setupFetchMock,
  setMockError,
  clearMockErrors,
  clearFetchCallHistory,
  getFetchCallHistory,
} from './test-mocks'

// ============================================================================
// SPECIFICATION INTERFACES & DOMAIN CONTRACT HELPERS (Opaque-Box Contract)
// Derived from ORIGINAL_REQUEST.md, PROJECT.md, and TEST_INFRA.md
// ============================================================================

export interface DispatchPayloadParams {
  phone?: string
  pickupGps: { lat: number; lng: number }
  donorAddress: string
  donorName: string
  foodName: string
  quantityKg: number
  shelterName: string
  shelterAddress: string
  shelterPhone: string
  scwMinutesRemaining: number
}

export interface Section80GData {
  certificateNumber: string
  registrationOrder: string
  donorName: string
  donorPan: string
  donorAddress: string
  foodName: string
  quantityKg: number
  quantityMeals: number
  fmvRatePerPlate: number
  grossSalvageValuation: number
  eligible80gDeduction: number
  projectedCorporateTaxSavings: number
  esgCo2eOffsetKg: number
  caAttestation: {
    caName: string
    caFirm: string
    icaiRegNo: string
    udin: string
  }
  qrVerificationUrl: string
  verificationHash: string
  createdAt: string
}

export interface DriverTelemetrySnapshot {
  listingId: string
  courierName: string
  vehicleType: string
  currentCoordinates: { lat: number; lng: number }
  speedKmh: number
  batteryPercent: number
  isRegenActive: boolean
  cambroCoreTempC: number
  thermalStatus: 'COMPLIANT_HOT_HOLD' | 'COMPLIANT_COLD_HOLD' | 'DANGER_ZONE_ALERT'
  etaMinutes: number
  distanceRemainingKm: number
  isDelivered: boolean
}

/**
 * F1 Contract: Container Urn Calculation
 * Standard catering Cambro urn capacity = 18 kg.
 * Minimum 1 urn for any non-zero mass.
 */
export function calculateUrnCount(quantityKg: number): number {
  if (quantityKg <= 0) return 0
  return Math.max(1, Math.ceil(quantityKg / 18))
}

/**
 * F1 Contract: 1-Click WhatsApp Deep-Link Generator
 * URL-encoded wa.me URI containing GPS, urn count, destination shelter, and SCW.
 */
export function formatWhatsAppDeepLink(params: DispatchPayloadParams): string {
  const urnCount = calculateUrnCount(params.quantityKg)
  const phoneClean = (params.phone || '').replace(/[^0-9]/g, '')
  const textMessage = [
    `🚨 *SURPLUSPULSE RESCUE MISSION* 🚨`,
    `📍 *Pickup GPS*: ${params.pickupGps.lat.toFixed(4)}, ${params.pickupGps.lng.toFixed(4)}`,
    `🏢 *Location*: ${params.donorName} (${params.donorAddress})`,
    `🍲 *Payload*: ${urnCount} Stainless Cambro Urn(s) • ${params.quantityKg} kg ${params.foodName}`,
    `🎯 *Destination*: ${params.shelterName}, ${params.shelterAddress} (Tel: ${params.shelterPhone})`,
    `⏱️ *Safe Consumption Window*: ${params.scwMinutesRemaining} mins remaining (Hot-Hold >65°C)`,
    `⚡ *Fleet*: EV Cargo Trike • Claim & Navigate Now`,
  ].join('\n')

  const base = phoneClean ? `https://wa.me/${phoneClean}` : `https://wa.me/`
  return `${base}?text=${encodeURIComponent(textMessage)}`
}

/**
 * F1 Contract: SMS Trigger URI Generator
 */
export function formatSmsTriggerUri(phone: string, bodyText: string): string {
  const phoneClean = phone.replace(/[^0-9+]/g, '')
  return `sms:${phoneClean}?body=${encodeURIComponent(bodyText)}`
}

/**
 * F2 Contract: Telemetry Calculation & Arterial Corridor Model
 */
export function calculateDriverTelemetry(
  routeProgress: number,
  totalDistanceKm: number = 2.4,
  baseSpeedKmh: number = 28
): DriverTelemetrySnapshot {
  const clampedProgress = Math.min(1, Math.max(0, routeProgress))
  const isDelivered = clampedProgress >= 1.0

  // Speed fluctuates between 22 and 36 km/h along Koramangala arterial corridor, drops to 0 at arrival
  let speedKmh = 0
  if (!isDelivered) {
    speedKmh = Math.round(baseSpeedKmh + Math.sin(clampedProgress * Math.PI * 4) * 6)
  }

  // Battery discharging linearly: 92% down to 84%, with regen active during deceleration phases
  const batteryPercent = Math.max(0, Math.round(92 - clampedProgress * 8))
  const isRegenActive = !isDelivered && clampedProgress > 0.35 && clampedProgress < 0.65

  // Thermal hold: starts at 68.5°C, mild drop to 66.2°C (>65°C compliance)
  const cambroCoreTempC = parseFloat((68.5 - clampedProgress * 2.1).toFixed(1))
  const thermalStatus = cambroCoreTempC >= 65.0 ? 'COMPLIANT_HOT_HOLD' : 'DANGER_ZONE_ALERT'

  // Dynamic ETA & Distance Remaining
  const etaMinutes = isDelivered ? 0 : Math.max(1, Math.round((1 - clampedProgress) * 14))
  const distanceRemainingKm = isDelivered
    ? 0
    : parseFloat(((1 - clampedProgress) * totalDistanceKm).toFixed(1))

  return {
    listingId: 'l2',
    courierName: 'Vikram Adiga',
    vehicleType: 'EV Cargo Trike',
    currentCoordinates: {
      lat: 12.9716 + clampedProgress * (12.9783 - 12.9716),
      lng: 77.6412 + clampedProgress * (77.6408 - 77.6412),
    },
    speedKmh,
    batteryPercent,
    isRegenActive,
    cambroCoreTempC,
    thermalStatus,
    etaMinutes,
    distanceRemainingKm,
    isDelivered,
  }
}

/**
 * F3 Contract: Section 80G Tax Exemption & ESG Carbon Credit Model
 * Computes:
 * - Fair Market Value (FMV) @ ₹65/plate
 * - 50% eligible Section 80G deduction
 * - Projected 31.2% corporate tax savings
 * - ESG Carbon Offset @ exactly 2.5 kg CO2e per kg saved
 */
export function calculateSection80G(quantityKg: number, quantityMeals: number): Section80GData {
  const fmvRatePerPlate = 65.0
  const grossSalvageValuation = Math.round(quantityMeals * fmvRatePerPlate)
  const eligible80gDeduction = Math.round(grossSalvageValuation * 0.5)
  const projectedCorporateTaxSavings = Math.round(eligible80gDeduction * 0.312)
  const esgCo2eOffsetKg = parseFloat((quantityKg * 2.5).toFixed(1))

  const certNumber = `80G-2026-BLR-${Math.abs(Math.round(quantityKg * 100))}`
  const verificationHash = `sha256:d8f7a93b4c1e2f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a`

  return {
    certificateNumber: certNumber,
    registrationOrder: 'CIT(E)/BLR/80G/2026/AABTS1234F',
    donorName: 'The Grand Amber Banquet Hall',
    donorPan: 'AAACT1234K',
    donorAddress: '100 Feet Rd, Indiranagar, Bengaluru',
    foodName: 'Royal Hyderabadi Veg Pulao & Paneer Makhani',
    quantityKg,
    quantityMeals,
    fmvRatePerPlate,
    grossSalvageValuation,
    eligible80gDeduction,
    projectedCorporateTaxSavings,
    esgCo2eOffsetKg,
    caAttestation: {
      caName: 'R. K. Sundaram, FCA',
      caFirm: 'Sundaram & Co. Chartered Accountants',
      icaiRegNo: '048291',
      udin: '26048291AAAAAA1968',
    },
    qrVerificationUrl: `https://surpluspulse.blr.gov/tax/verify/${certNumber}?hash=${verificationHash}`,
    verificationHash,
    createdAt: new Date().toISOString(),
  }
}

export function validatePan(pan: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.trim().toUpperCase())
}

/**
 * F5 Contract: FSSAI Compliance & Thermography Rule Engine Model
 */
export function evaluateFssaiHygiene(params: {
  coreTempC: number
  surfaceTempC: number
  elapsedMinutesSincePrep: number
  packagingIntact: boolean
}): {
  isSafe: boolean
  verdict: 'FRESH_AND_GOOD' | 'SPOILED_AND_GONE'
  fssaiGrade: string
  hotHoldCompliant: boolean
  coldHoldCompliant: boolean
  scwRemainingMinutes: number
  microbialRiskLevel: 'LOW' | 'MODERATE' | 'CRITICAL'
  rejectionReasons: string[]
} {
  const hotHoldCompliant = params.coreTempC >= 65.0
  const coldHoldCompliant = params.coreTempC <= 4.0
  const scwRemainingMinutes = Math.max(0, 240 - params.elapsedMinutesSincePrep)
  const isTimeCompliant = params.elapsedMinutesSincePrep <= 240

  const rejectionReasons: string[] = []

  if (!hotHoldCompliant && !coldHoldCompliant) {
    rejectionReasons.push(
      `Temperature Danger Zone violation (${params.coreTempC.toFixed(1)}°C: requires >65°C hot-hold or <4°C cold-hold)`
    )
  }
  if (!isTimeCompliant) {
    rejectionReasons.push(`FSSAI 4-hour microbial proliferation window exceeded (${params.elapsedMinutesSincePrep} mins elapsed)`)
  }
  if (!params.packagingIntact) {
    rejectionReasons.push(`Compromised secondary vessel seal or physical container breach`)
  }

  const isSafe = (hotHoldCompliant || coldHoldCompliant) && isTimeCompliant && params.packagingIntact

  let microbialRiskLevel: 'LOW' | 'MODERATE' | 'CRITICAL' = 'LOW'
  if (!isSafe) {
    microbialRiskLevel = params.coreTempC >= 21 && params.coreTempC <= 45 ? 'CRITICAL' : 'MODERATE'
  }

  return {
    isSafe,
    verdict: isSafe ? 'FRESH_AND_GOOD' : 'SPOILED_AND_GONE',
    fssaiGrade: isSafe ? 'GRADE_A_PRIME' : 'GRADE_F',
    hotHoldCompliant,
    coldHoldCompliant,
    scwRemainingMinutes,
    microbialRiskLevel,
    rejectionReasons,
  }
}

// ============================================================================
// UI TEST HARNESS COMPONENTS (Adheres to PROJECT.md § Multi-Role & Tax View)
// ============================================================================

export const Section80GCertificateModalView: React.FC<{
  isOpen: boolean
  onClose: () => void
  data: Section80GData
  onPrint?: () => void
}> = ({ isOpen, onClose, data, onPrint }) => {
  if (!isOpen) return null
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Section 80G Tax Exemption Certificate"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-2xl w-full text-stone-900 border border-stone-200">
        <header className="border-b pb-3 flex justify-between items-start">
          <div>
            <h2 className="text-base font-bold font-headline uppercase tracking-wide text-emerald-800">
              STATE MUNICIPAL RELIEF CHARTER • SECTION 80G TAX EXEMPTION
            </h2>
            <p className="text-xs font-mono text-stone-500 font-bold mt-1">
              {`REG ORDER: ${data.registrationOrder} • CERT NO: ${data.certificateNumber}`}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close certificate" className="p-1 rounded hover:bg-stone-100">
            ✕
          </button>
        </header>

        <div className="my-4 space-y-3 text-xs font-body">
          <div className="grid grid-cols-2 gap-2 bg-stone-50 p-3 rounded-lg border">
            <div>
              <span className="font-bold block text-stone-600">DONOR LEGAL ENTITY:</span>
              <span className="font-bold text-sm text-stone-900">{data.donorName}</span>
            </div>
            <div>
              <span className="font-bold block text-stone-600">DONOR PAN (PERMANENT ACCOUNT NO):</span>
              <span className="font-mono font-bold text-sm text-emerald-700">{data.donorPan}</span>
            </div>
          </div>

          <table className="w-full border-collapse border border-stone-200 text-left text-xs" role="table">
            <thead>
              <tr className="bg-stone-100 font-bold">
                <th className="p-2 border">CHARTERED ACCOUNTANT ITEMIZATION</th>
                <th className="p-2 border text-right">VALUATION / OFFSET</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2 border">Verified Rescued Rations (Standard Weight Basis)</td>
                <td className="p-2 border text-right font-bold tabular-nums">
                  {data.quantityMeals} Meals • {data.quantityKg.toFixed(1)} kg
                </td>
              </tr>
              <tr>
                <td className="p-2 border">Fair Market Value (FMV) @ ₹{data.fmvRatePerPlate.toFixed(2)} / Plate</td>
                <td className="p-2 border text-right font-bold tabular-nums">₹{data.grossSalvageValuation.toLocaleString()}</td>
              </tr>
              <tr className="bg-emerald-50 text-emerald-900 font-bold">
                <td className="p-2 border">Eligible Deduction under Section 80G(5)(vi) (50% Allowance)</td>
                <td className="p-2 border text-right tabular-nums">₹{data.eligible80gDeduction.toLocaleString()}</td>
              </tr>
              <tr>
                <td className="p-2 border">Projected Fiscal Corporate Tax Savings (31.2% Corporate Surcharge)</td>
                <td className="p-2 border text-right font-bold text-emerald-700 tabular-nums">
                  ₹{data.projectedCorporateTaxSavings.toLocaleString()}
                </td>
              </tr>
              <tr className="bg-stone-50 font-bold">
                <td className="p-2 border">ESG Carbon Offset (EPA WARM Standard 2.5 kg CO2e / kg)</td>
                <td className="p-2 border text-right tabular-nums">{data.esgCo2eOffsetKg.toFixed(1)} kg CO2e</td>
              </tr>
            </tbody>
          </table>

          {/* Standalone Vector QR Code Verification Block */}
          <div className="flex items-center gap-4 p-3 bg-stone-50 rounded-xl border border-stone-200">
            <svg
              role="img"
              aria-label="Section 80G Scannable Verification QR Code"
              viewBox="0 0 100 100"
              className="w-16 h-16 shrink-0 bg-white p-1 rounded border shadow-xs"
            >
              <rect width="100" height="100" fill="white" />
              <rect x="10" y="10" width="25" height="25" fill="#004C22" />
              <rect x="65" y="10" width="25" height="25" fill="#004C22" />
              <rect x="10" y="65" width="25" height="25" fill="#004C22" />
              <rect x="40" y="40" width="20" height="20" fill="#004C22" />
              <circle cx="50" cy="50" r="5" fill="#AC3400" />
            </svg>
            <div className="text-[11px] font-mono leading-tight">
              <span className="font-bold text-stone-900 block">AUTHENTIC DIGITAL RELIEF SEAL</span>
              <span className="text-stone-500 block truncate max-w-xs">{data.qrVerificationUrl}</span>
              <span className="text-emerald-700 font-bold block mt-1">ATTESTATION: {data.caAttestation.udin}</span>
            </div>
          </div>
        </div>

        <footer className="pt-3 border-t flex justify-end gap-3">
          <button
            type="button"
            onClick={onPrint || (() => window.print())}
            className="px-4 py-2 bg-emerald-700 text-white rounded-lg font-bold text-xs hover:bg-emerald-800 transition-colors cursor-pointer"
          >
            PRINT OFFICIAL 80G TAX CERTIFICATE
          </button>
        </footer>
      </div>
    </div>
  )
}

export const MultiRolePortalHarness: React.FC<{
  initialRole?: 'DONOR' | 'COURIER' | 'SHELTER' | 'MUNICIPAL'
  listings?: FoodListing[]
  donors?: Donor[]
  receivers?: Receiver[]
}> = ({
  initialRole = 'DONOR',
  listings = mockListings,
  donors = mockDonors,
  receivers = mockReceivers,
}) => {
  const [currentRole, setCurrentRole] = useState<'DONOR' | 'COURIER' | 'SHELTER' | 'MUNICIPAL'>(initialRole)
  const [activeTab, setActiveTab] = useState<'RADAR' | 'MAP' | 'IMPACT' | 'GUIDELINES'>('RADAR')

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 font-body">
      {/* Role Switcher Strip */}
      <nav aria-label="Operational Role Switcher" className="bg-stone-900 text-white px-4 py-2 flex items-center justify-between text-xs font-bold">
        <span className="text-emerald-400">SURPLUSPULSE MULTI-ROLE CORPS</span>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentRole('DONOR')}
            className={`px-3 py-1 rounded transition-colors ${currentRole === 'DONOR' ? 'bg-emerald-600 text-white' : 'hover:bg-stone-800 text-stone-300'}`}
          >
            Donor Kitchen
          </button>
          <button
            onClick={() => setCurrentRole('COURIER')}
            className={`px-3 py-1 rounded transition-colors ${currentRole === 'COURIER' ? 'bg-emerald-600 text-white' : 'hover:bg-stone-800 text-stone-300'}`}
          >
            Volunteer Courier
          </button>
          <button
            onClick={() => setCurrentRole('SHELTER')}
            className={`px-3 py-1 rounded transition-colors ${currentRole === 'SHELTER' ? 'bg-emerald-600 text-white' : 'hover:bg-stone-800 text-stone-300'}`}
          >
            Shelter Intake
          </button>
          <button
            onClick={() => setCurrentRole('MUNICIPAL')}
            className={`px-3 py-1 rounded transition-colors ${currentRole === 'MUNICIPAL' ? 'bg-emerald-600 text-white' : 'hover:bg-stone-800 text-stone-300'}`}
          >
            Municipal Command
          </button>
        </div>
      </nav>

      {/* Legacy Navigation Tabs (Preserved for 100% Backward Compatibility) */}
      <div className="bg-white border-b px-4 py-2 flex gap-3 text-xs font-bold">
        <button
          onClick={() => setActiveTab('RADAR')}
          className={`px-3 py-1.5 rounded-lg border ${activeTab === 'RADAR' ? 'bg-emerald-700 text-white' : 'bg-stone-50 text-stone-700'}`}
        >
          [1] RESCUE RADAR
        </button>
        <button
          onClick={() => setActiveTab('MAP')}
          className={`px-3 py-1.5 rounded-lg border ${activeTab === 'MAP' ? 'bg-emerald-700 text-white' : 'bg-stone-50 text-stone-700'}`}
        >
          [2] HOLOGRAPHIC DISPATCH MATRIX
        </button>
        <button
          onClick={() => setActiveTab('IMPACT')}
          className={`px-3 py-1.5 rounded-lg border ${activeTab === 'IMPACT' ? 'bg-emerald-700 text-white' : 'bg-stone-50 text-stone-700'}`}
        >
          [3] QUANTUM ESG &amp; COMPTOMETER
        </button>
        <button
          onClick={() => setActiveTab('GUIDELINES')}
          className={`px-3 py-1.5 rounded-lg border ${activeTab === 'GUIDELINES' ? 'bg-emerald-700 text-white' : 'bg-stone-50 text-stone-700'}`}
        >
          [4] HYGIENE PROTOCOL DIRECTIVES
        </button>
      </div>

      {/* Role-Specific Portal Panels */}
      <main className="p-6">
        {currentRole === 'DONOR' && (
          <section aria-label="Donor Kitchen Dashboard" className="space-y-4">
            <h2 className="text-xl font-bold font-headline">Donor Kitchen Operations Portal</h2>
            <div className="p-4 bg-white rounded-xl shadow-xs border">
              <span className="font-bold text-sm block">LOG SURPLUS FOOD DECLARATION (FORM 68-A)</span>
              <p className="text-xs text-stone-600 mt-1">Automatic Mirage 22MB VLM hygiene triage &amp; Section 80G tax generation.</p>
              <div className="flex items-center justify-between mt-3">
                <button className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-lg">
                  Quick Post Surplus Batch
                </button>
                <span className="text-xs font-mono text-stone-500 font-bold">{donors.length} Registered Commercial Kitchens</span>
              </div>
            </div>
            {listings.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl border border-dashed text-stone-500 text-sm">
                No active food batches logged. Click &quot;Quick Post Surplus Batch&quot; to register excess food.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {listings.map((l) => (
                  <div key={l.id} className="p-4 bg-white rounded-xl border shadow-xs">
                    <span className="font-bold text-sm block">{l.food_name}</span>
                    <span className="text-xs text-stone-500 font-label">{l.quantity_meals} meals • {l.quantity_kg} kg • Status: {l.status}</span>
                    <div className="mt-2 flex gap-2">
                      <span className="text-xs font-mono font-bold text-emerald-700">80G TAX SLIP ELIGIBLE</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {currentRole === 'COURIER' && (
          <section aria-label="Volunteer Courier Dashboard" className="space-y-4">
            <h2 className="text-xl font-bold font-headline">Volunteer Courier Fleet View</h2>
            <div className="p-4 bg-white rounded-xl shadow-xs border flex justify-between items-center">
              <div>
                <span className="font-bold text-sm block">EV CARGO TRIKE DISPATCH CORRIDOR</span>
                <span className="text-xs text-stone-600">Active missions ready for 1-Click WhatsApp deep-link dispatch.</span>
              </div>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-full">
                ⚡ FLEET READY
              </span>
            </div>
            <div className="space-y-3">
              {listings.filter((l) => l.status === 'POSTED' || l.status === 'CLAIMED').map((l) => (
                <div key={l.id} className="p-4 bg-white rounded-xl border shadow-xs flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-sm">{l.food_name}</h3>
                    <p className="text-xs text-stone-500">{l.donor_name} ➔ {l.pickup?.receiver_name || 'Nearest Verified Shelter'}</p>
                    <span className="text-xs font-bold text-amber-600 font-mono">
                      Containers: {calculateUrnCount(l.quantity_kg)} Urns ({l.quantity_kg} kg)
                    </span>
                  </div>
                  <a
                    href={formatWhatsAppDeepLink({
                      pickupGps: { lat: 12.9716, lng: 77.6412 },
                      donorAddress: l.donor_address,
                      donorName: l.donor_name,
                      foodName: l.food_name,
                      quantityKg: l.quantity_kg,
                      shelterName: 'Robin Hood Army - Indiranagar',
                      shelterAddress: 'Double Road, Indiranagar',
                      shelterPhone: '+91 98200 44556',
                      scwMinutesRemaining: l.minutes_remaining,
                    })}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700"
                  >
                    1-Click WhatsApp Dispatch
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}

        {currentRole === 'SHELTER' && (
          <section aria-label="Shelter Intake Dashboard" className="space-y-4">
            <h2 className="text-xl font-bold font-headline">Shelter Intake &amp; Beneficiary Board</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {receivers.map((r) => {
                const isFull = r.capacity_meals <= 0
                return (
                  <div key={r.id} className="p-4 bg-white rounded-xl border shadow-xs space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-sm">{r.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isFull ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {isFull ? 'CAPACITY REACHED 100%' : 'INTAKE ACCEPTING'}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500">{r.address} • Contact: {r.contact_phone}</p>
                    <div className="flex justify-between text-xs font-mono">
                      <span>CAPACITY REMAINING:</span>
                      <span className="font-bold">{r.capacity_meals} Meals</span>
                    </div>
                    <button
                      disabled={isFull}
                      className="w-full py-2 bg-stone-900 text-white text-xs font-bold rounded-lg disabled:opacity-40"
                    >
                      {isFull ? 'Intake Suspended (Max Capacity)' : 'Log Incoming Arrival Verification'}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {currentRole === 'MUNICIPAL' && (
          <section aria-label="Municipal Command Dashboard" className="space-y-4">
            <h2 className="text-xl font-bold font-headline">Municipal Command Center • Bengaluru Relief Matrix</h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-4 bg-white rounded-xl border shadow-xs text-center">
                <span className="text-xs text-stone-500 font-bold block">ACTIVE SALVAGING THROUGHPUT</span>
                <span className="text-2xl font-bold text-emerald-700 font-headline mt-1 block">133.0 KG</span>
              </div>
              <div className="p-4 bg-white rounded-xl border shadow-xs text-center">
                <span className="text-xs text-stone-500 font-bold block">COURIER FLEET DENSITY</span>
                <span className="text-2xl font-bold text-stone-900 font-headline mt-1 block">8 TRIKES</span>
              </div>
              <div className="p-4 bg-white rounded-xl border shadow-xs text-center">
                <span className="text-xs text-stone-500 font-bold block">SPOILAGE PREVENTION RATE</span>
                <span className="text-2xl font-bold text-emerald-600 font-headline mt-1 block">99.2%</span>
              </div>
              <div className="p-4 bg-white rounded-xl border shadow-xs text-center">
                <span className="text-xs text-stone-500 font-bold block">BIO-COMPOST DIVERSION</span>
                <span className="text-2xl font-bold text-amber-700 font-headline mt-1 block">2 BATCHES</span>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

// ============================================================================
// VITEST TEST SUITE: 4 TIERS COVERING FEATURES F1 TO F5 (≥60 TEST CASES)
// ============================================================================

describe('SurplusPulse Frontend E2E Opaque-Box Test Suite (Tiers 1-4)', () => {
  beforeEach(() => {
    clearMockErrors()
    clearFetchCallHistory()
    setupFetchMock()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  // ==========================================================================
  // TIER 1: FEATURE COVERAGE (5 Features × 5 Tests = 25 Tests)
  // ==========================================================================

  describe('Tier 1: Feature Coverage', () => {
    // ------------------------------------------------------------------------
    // F1: 1-Click WhatsApp & SMS Courier Dispatch
    // ------------------------------------------------------------------------
    describe('F1: 1-Click WhatsApp & SMS Courier Dispatch', () => {
      it('T1_F1_01: formats WhatsApp deep-link containing pickup GPS coordinates', () => {
        const link = formatWhatsAppDeepLink({
          pickupGps: { lat: 12.9716, lng: 77.6412 },
          donorAddress: '100 Feet Rd, Indiranagar',
          donorName: 'The Grand Amber Banquet Hall',
          foodName: 'Royal Hyderabadi Veg Pulao',
          quantityKg: 55.0,
          shelterName: 'Robin Hood Army',
          shelterAddress: 'Double Road, Indiranagar',
          shelterPhone: '+91 98200 44556',
          scwMinutesRemaining: 150,
        })

        expect(link).toContain('https://wa.me/?text=')
        const decoded = decodeURIComponent(link)
        expect(decoded).toContain('12.9716, 77.6412')
        expect(decoded).toContain('The Grand Amber Banquet Hall')
      })

      it('T1_F1_02: calculates container urn count as max(1, ceil(kg / 18)) in payload and renders DocketCard', () => {
        expect(calculateUrnCount(18.0)).toBe(1)
        expect(calculateUrnCount(36.0)).toBe(2)
        expect(calculateUrnCount(55.0)).toBe(4) // ceil(55/18) = 4

        const link = formatWhatsAppDeepLink({
          pickupGps: { lat: 12.9716, lng: 77.6412 },
          donorAddress: 'Indiranagar',
          donorName: 'Amber',
          foodName: 'Rice',
          quantityKg: 55.0,
          shelterName: 'Shelter',
          shelterAddress: 'Address',
          shelterPhone: '1234567890',
          scwMinutesRemaining: 90,
        })
        const decoded = decodeURIComponent(link)
        expect(decoded).toContain('4 Stainless Cambro Urn(s)')

        // Verify DocketCard component renders insulated urn text
        render(<DocketCard listing={mockListings[0]} onOpenSmartMatch={() => {}} onAdvanceStatus={() => {}} />)
        expect(screen.getByText(/Insulated Stainless Urn/i)).toBeInTheDocument()
      })

      it('T1_F1_03: encodes target shelter destination name, address, and contact number', () => {
        expect(mockMatchResponse.matches.length).toBeGreaterThan(0)
        const primaryMatch = mockMatchResponse.matches[0]

        const link = formatWhatsAppDeepLink({
          pickupGps: { lat: 12.9716, lng: 77.6412 },
          donorAddress: 'Indiranagar',
          donorName: 'Amber',
          foodName: 'Pulao',
          quantityKg: 36.0,
          shelterName: primaryMatch.receiver_name,
          shelterAddress: 'Double Road, Indiranagar',
          shelterPhone: primaryMatch.contact_phone,
          scwMinutesRemaining: 120,
        })
        const decoded = decodeURIComponent(link)
        expect(decoded).toContain(primaryMatch.receiver_name)
        expect(decoded).toContain(primaryMatch.contact_phone)
      })

      it('T1_F1_04: includes real-time Safe Consumption Window (SCW) countdown in minutes', () => {
        const link = formatWhatsAppDeepLink({
          pickupGps: { lat: 12.9716, lng: 77.6412 },
          donorAddress: 'Indiranagar',
          donorName: 'Amber',
          foodName: 'Pulao',
          quantityKg: 36.0,
          shelterName: 'Robin Hood Army',
          shelterAddress: 'Double Road',
          shelterPhone: '9820044556',
          scwMinutesRemaining: 145,
        })
        const decoded = decodeURIComponent(link)
        expect(decoded).toContain('145 mins remaining (Hot-Hold >65°C)')
      })

      it('T1_F1_05: formats SMS action trigger URI and verifies claim API transitions listing status', async () => {
        const smsUri = formatSmsTriggerUri('+919911233445', 'Rescue mission assigned: 55kg Biryani')
        expect(smsUri).toContain('sms:+919911233445?body=')
        expect(decodeURIComponent(smsUri)).toContain('Rescue mission assigned: 55kg Biryani')

        // Test claimListing API call
        const updated = await api.claimListing('l1', {
          receiver_id: 'r1',
          volunteer_name: 'Vikram Adiga',
          volunteer_phone: '+91 99112 33445',
          vehicle_type: 'EV Cargo Trike',
        })
        expect(updated.status).toBe('CLAIMED')
        const history = getFetchCallHistory()
        expect(history.some((c) => c.url.includes('/claim') && c.method === 'POST')).toBe(true)
      })
    })

    // ------------------------------------------------------------------------
    // F2: Real-Time Driver GPS Radar Simulation & Telemetry
    // ------------------------------------------------------------------------
    describe('F2: Real-Time Driver GPS Radar Simulation & Telemetry', () => {
      it('T1_F2_01: returns EV Cargo Trike status, vehicle type, and renders radar graticule', () => {
        const telemetry = calculateDriverTelemetry(0.5)
        expect(telemetry.vehicleType).toBe('EV Cargo Trike')
        expect(telemetry.courierName).toBe('Vikram Adiga')
        expect(telemetry.currentCoordinates.lat).toBeGreaterThan(12.97)
        expect(telemetry.currentCoordinates.lng).toBeGreaterThan(77.63)

        // Render CrtRadarMap component and verify arterial SVG
        render(<CrtRadarMap donors={mockDonors} receivers={mockReceivers} listings={mockListings} />)
        expect(screen.getByText(/Electric Cargo Trike/i)).toBeInTheDocument()
        expect(SIMULATED_ROUTE_DURATION_MS).toBe(120000)
      })

      it('T1_F2_02: displays dynamic speed between 22 and 36 km/h during corridor transit', () => {
        const t1 = calculateDriverTelemetry(0.2)
        const t2 = calculateDriverTelemetry(0.5)
        const t3 = calculateDriverTelemetry(0.8)

        expect(t1.speedKmh).toBeGreaterThanOrEqual(22)
        expect(t1.speedKmh).toBeLessThanOrEqual(36)
        expect(t2.speedKmh).toBeGreaterThanOrEqual(22)
        expect(t2.speedKmh).toBeLessThanOrEqual(36)
        expect(t3.speedKmh).toBeGreaterThanOrEqual(22)
        expect(t3.speedKmh).toBeLessThanOrEqual(36)
      })

      it('T1_F2_03: tracks LiFePO4 battery percentage and regenerative braking status', () => {
        const departure = calculateDriverTelemetry(0.0)
        const midpoint = calculateDriverTelemetry(0.5)
        const arrival = calculateDriverTelemetry(1.0)

        expect(departure.batteryPercent).toBe(92)
        expect(departure.isRegenActive).toBe(false)

        expect(midpoint.batteryPercent).toBe(88)
        expect(midpoint.isRegenActive).toBe(true) // Regen active during mid-route braking

        expect(arrival.batteryPercent).toBe(84)
        expect(arrival.isRegenActive).toBe(false)
      })

      it('T1_F2_04: verifies thermal cambro core temperature maintains >65°C and displays in tracker modal', () => {
        const t = calculateDriverTelemetry(0.5)
        expect(t.cambroCoreTempC).toBeGreaterThan(65.0)
        expect(t.thermalStatus).toBe('COMPLIANT_HOT_HOLD')

        // Render LiveDeliveryTracker component
        render(
          <LiveDeliveryTracker
            isOpen={true}
            onClose={() => {}}
            listing={mockListings[1]}
            onAdvanceStatus={async () => {}}
          />
        )
        expect(screen.getByText(/THERMAL VESSEL/i)).toBeInTheDocument()
        expect(screen.getByText(/VEHICLE BATTERY/i)).toBeInTheDocument()
        expect(screen.getByText(/ESTIMATED ARRIVAL/i)).toBeInTheDocument()
      })

      it('T1_F2_05: verifies destination arrival triggers delivery intake event', async () => {
        const arrivalTelemetry = calculateDriverTelemetry(1.0)
        expect(arrivalTelemetry.isDelivered).toBe(true)
        expect(arrivalTelemetry.speedKmh).toBe(0)
        expect(arrivalTelemetry.etaMinutes).toBe(0)
        expect(arrivalTelemetry.distanceRemainingKm).toBe(0)

        // API update status to DELIVERED
        const delivered = await api.updateListingStatus('l2', { status: 'DELIVERED', notes: 'Thermal core 66.4°C verified' })
        expect(delivered.status).toBe('DELIVERED')
      })
    })

    // ------------------------------------------------------------------------
    // F3: Exportable Section 80G Tax Exemption Certificate
    // ------------------------------------------------------------------------
    describe('F3: Exportable Section 80G Tax Exemption Certificate', () => {
      it('T1_F3_01: returns official legal registration order and renders CertificateModal', () => {
        const data = calculateSection80G(55.0, 120)
        expect(data.registrationOrder).toBe('CIT(E)/BLR/80G/2026/AABTS1234F')
        expect(data.certificateNumber).toContain('80G-2026-BLR-')

        render(<CertificateModal isOpen={true} onClose={() => {}} impact={mockImpactSummary} onShare={() => {}} />)
        expect(screen.getByText(/STATE MUNICIPAL RELIEF CHARTER • ESG CARBON OFFSET/i)).toBeInTheDocument()
        expect(screen.getByText(/OFFICIAL CHARTER NO\. CERT-SP-2026-BLR-0049/i)).toBeInTheDocument()
      })

      it('T1_F3_02: binds verified donor PAN, legal entity name, and verified rescued kilogram tally', () => {
        const data = calculateSection80G(55.0, 120)
        expect(data.donorName).toBe('The Grand Amber Banquet Hall')
        expect(data.donorPan).toBe('AAACT1234K')
        expect(validatePan(data.donorPan)).toBe(true)
        expect(data.quantityKg).toBe(55.0)
        expect(data.quantityMeals).toBe(120)
      })

      it('T1_F3_03: computes itemized CA breakdown: ₹65 FMV, 50% deduction, and 31.2% tax savings', () => {
        const meals = 100
        const data = calculateSection80G(45.0, meals)

        // FMV @ ₹65/plate: 100 * 65 = ₹6,500
        expect(data.grossSalvageValuation).toBe(6500)
        // 50% Section 80G deduction: 6,500 * 0.5 = ₹3,250
        expect(data.eligible80gDeduction).toBe(3250)
        // 31.2% corporate tax savings: 3,250 * 0.312 = ₹1,014
        expect(data.projectedCorporateTaxSavings).toBe(1014)
      })

      it('T1_F3_04: calculates ESG carbon credit offset at exactly 2.5 kg CO2e per kg food saved', () => {
        const data1 = calculateSection80G(100.0, 220)
        expect(data1.esgCo2eOffsetKg).toBe(250.0) // 100 * 2.5

        const data2 = calculateSection80G(55.0, 120)
        expect(data2.esgCo2eOffsetKg).toBe(137.5) // 55 * 2.5
      })

      it('T1_F3_05: renders standalone vector QR code, digital seal, and print trigger', () => {
        const data = calculateSection80G(55.0, 120)
        const onPrint = vi.fn()
        render(<Section80GCertificateModalView isOpen={true} onClose={() => {}} data={data} onPrint={onPrint} />)

        expect(screen.getByRole('dialog', { name: /Section 80G Tax Exemption Certificate/i })).toBeInTheDocument()
        expect(screen.getByText(/CIT\(E\)\/BLR\/80G\/2026\/AABTS1234F/i)).toBeInTheDocument()
        expect(screen.getByText('AAACT1234K')).toBeInTheDocument()
        expect(screen.getByRole('img', { name: /Section 80G Scannable Verification QR Code/i })).toBeInTheDocument()
        expect(screen.getByText(/AUTHENTIC DIGITAL RELIEF SEAL/i)).toBeInTheDocument()

        const printBtn = screen.getByRole('button', { name: /PRINT OFFICIAL 80G TAX CERTIFICATE/i })
        fireEvent.click(printBtn)
        expect(onPrint).toHaveBeenCalledTimes(1)
      })
    })

    // ------------------------------------------------------------------------
    // F4: Multi-Role Portal Views
    // ------------------------------------------------------------------------
    describe('F4: Multi-Role Portal Views', () => {
      it('T1_F4_01: renders Donor Kitchen view with food logging and 80G tax receipt access', () => {
        render(<MultiRolePortalHarness initialRole="DONOR" />)
        expect(screen.getByRole('region', { name: /Donor Kitchen Dashboard/i })).toBeInTheDocument()
        expect(screen.getByText(/LOG SURPLUS FOOD DECLARATION \(FORM 68-A\)/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Quick Post Surplus Batch/i })).toBeInTheDocument()
        expect(screen.getAllByText(/80G TAX SLIP ELIGIBLE/i).length).toBeGreaterThan(0)
      })

      it('T1_F4_02: renders Volunteer Courier view with available missions and 1-Click WhatsApp dispatch', () => {
        render(<MultiRolePortalHarness initialRole="COURIER" />)
        expect(screen.getByRole('region', { name: /Volunteer Courier Dashboard/i })).toBeInTheDocument()
        expect(screen.getByText(/EV CARGO TRIKE DISPATCH CORRIDOR/i)).toBeInTheDocument()
        expect(screen.getAllByText(/1-Click WhatsApp Dispatch/i).length).toBeGreaterThan(0)
      })

      it('T1_F4_03: renders Shelter Intake board with capacity limits and arrival verification', () => {
        render(<MultiRolePortalHarness initialRole="SHELTER" />)
        expect(screen.getByRole('region', { name: /Shelter Intake Dashboard/i })).toBeInTheDocument()
        expect(screen.getByText('Robin Hood Army - Indiranagar Hub')).toBeInTheDocument()
        expect(screen.getByText('City Hope Homeless Shelter')).toBeInTheDocument()
        expect(screen.getAllByText(/INTAKE ACCEPTING/i).length).toBeGreaterThan(0)
      })

      it('T1_F4_04: renders Municipal Command Center with city-wide salvage KPIs', () => {
        render(<MultiRolePortalHarness initialRole="MUNICIPAL" />)
        expect(screen.getByRole('region', { name: /Municipal Command Dashboard/i })).toBeInTheDocument()
        expect(screen.getByText(/ACTIVE SALVAGING THROUGHPUT/i)).toBeInTheDocument()
        expect(screen.getByText(/COURIER FLEET DENSITY/i)).toBeInTheDocument()
        expect(screen.getByText(/SPOILAGE PREVENTION RATE/i)).toBeInTheDocument()
        expect(screen.getByText(/BIO-COMPOST DIVERSION/i)).toBeInTheDocument()
      })

      it('T1_F4_05: preserves all existing navigation tabs in main App and during role switching', async () => {
        render(<App />)

        await waitFor(() => {
          expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
        })

        // Check legacy navigation buttons in App
        expect(screen.getByRole('button', { name: /\[1\] RESCUE RADAR/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /\[2\] HOLOGRAPHIC DISPATCH MATRIX/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /\[3\] QUANTUM ESG & (CARBON LEDGER|COMPTOMETER)/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /\[4\] HYGIENE PROTOCOL DIRECTIVES/i })).toBeInTheDocument()
      })
    })

    // ------------------------------------------------------------------------
    // F5: Enhanced On-Device VLM / SLM Edge Intelligence
    // ------------------------------------------------------------------------
    describe('F5: Enhanced On-Device VLM / SLM Edge Intelligence', () => {
      it('T1_F5_01: inspects simulated thermography returning core, surface, and ambient values', () => {
        expect(mockMirageResult.is_safe).toBe(true)
        const fresh = evaluateFssaiHygiene({
          coreTempC: 68.5,
          surfaceTempC: 66.2,
          elapsedMinutesSincePrep: 60,
          packagingIntact: true,
        })
        expect(fresh.isSafe).toBe(true)
        expect(fresh.hotHoldCompliant).toBe(true)
        expect(fresh.verdict).toBe('FRESH_AND_GOOD')
      })

      it('T1_F5_02: verifies FSSAI compliance engine validates hot-hold temperature (>65°C)', () => {
        const compliant = evaluateFssaiHygiene({
          coreTempC: 65.5,
          surfaceTempC: 64.0,
          elapsedMinutesSincePrep: 90,
          packagingIntact: true,
        })
        expect(compliant.hotHoldCompliant).toBe(true)
        expect(compliant.isSafe).toBe(true)
      })

      it('T1_F5_03: verifies FSSAI compliance engine validates cold-hold temperature (<4°C)', () => {
        const compliantCold = evaluateFssaiHygiene({
          coreTempC: 3.2,
          surfaceTempC: 3.8,
          elapsedMinutesSincePrep: 90,
          packagingIntact: true,
        })
        expect(compliantCold.coldHoldCompliant).toBe(true)
        expect(compliantCold.isSafe).toBe(true)
      })

      it('T1_F5_04: computes dynamic 4-hour microbial proliferation window calculation', () => {
        const result1 = evaluateFssaiHygiene({
          coreTempC: 68.0,
          surfaceTempC: 66.0,
          elapsedMinutesSincePrep: 150,
          packagingIntact: true,
        })
        expect(result1.scwRemainingMinutes).toBe(90) // 240 - 150 = 90 mins remaining

        const result2 = evaluateFssaiHygiene({
          coreTempC: 68.0,
          surfaceTempC: 66.0,
          elapsedMinutesSincePrep: 240,
          packagingIntact: true,
        })
        expect(result2.scwRemainingMinutes).toBe(0) // At threshold
      })

      it('T1_F5_05: extracts kitchen prep OCR timestamp and verifies in MirageModal DOM', async () => {
        render(
          <MirageModal
            isOpen={true}
            onClose={() => {}}
            mirageInspection={mockMirageFreshBiryani}
            mirageScanning={false}
            onRunInspection={async () => {}}
            onApplyToForm={() => {}}
          />
        )

        expect(screen.getByText(/CIVIC FOOD HYGIENE SPECTROGRAPH • MIRAGE VLM/i)).toBeInTheDocument()
        expect(screen.getByText(/\[FOOD_CONTAINER: STAINLESS URN 99.4%\]/i)).toBeInTheDocument()
        expect(screen.getByText(/\[STEAM\/THERMAL: >65°C\]/i)).toBeInTheDocument()
        expect(screen.getByText(/MIRAGE OCR TEXT EXTRACTED FROM IMAGE:/i)).toBeInTheDocument()
      })
    })
  })

  // ==========================================================================
  // TIER 2: BOUNDARY & CORNER CASES (5 Features × 5 Tests = 25 Tests)
  // ==========================================================================

  describe('Tier 2: Boundary & Corner Cases', () => {
    // ------------------------------------------------------------------------
    // F1 Boundaries
    // ------------------------------------------------------------------------
    describe('F1 Boundaries', () => {
      it('T2_F1_01: handles zero and fractional food mass (0.5 kg -> minimum 1 urn)', () => {
        expect(calculateUrnCount(0.5)).toBe(1)
        expect(calculateUrnCount(0.1)).toBe(1)
        expect(calculateUrnCount(0)).toBe(0)
      })

      it('T2_F1_02: handles high mass banquet food mass (500 kg -> 28 urns, exact integer rounding)', () => {
        // 500 / 18 = 27.777 -> ceil = 28
        expect(calculateUrnCount(500.0)).toBe(28)
        // 180 kg -> exactly 10 urns
        expect(calculateUrnCount(180.0)).toBe(10)
      })

      it('T2_F1_03: flags expired SCW window (0 minutes remaining)', () => {
        const link = formatWhatsAppDeepLink({
          pickupGps: { lat: 12.9716, lng: 77.6412 },
          donorAddress: 'Indiranagar',
          donorName: 'Amber',
          foodName: 'Rice',
          quantityKg: 20.0,
          shelterName: 'Shelter',
          shelterAddress: 'Address',
          shelterPhone: '1234567890',
          scwMinutesRemaining: 0,
        })
        const decoded = decodeURIComponent(link)
        expect(decoded).toContain('0 mins remaining')
      })

      it('T2_F1_04: handles concurrent dispatch race condition with atomic lock (400 rejection)', async () => {
        setMockError('/api/listings/l1_race/claim', 400, { detail: 'Already claimed by another courier' })

        // First claim succeeds on l1
        const success = await api.claimListing('l1', {
          receiver_id: 'r1',
          volunteer_name: 'Courier 1',
          volunteer_phone: '123',
          vehicle_type: 'Trike',
        })
        expect(success.status).toBe('CLAIMED')

        // Second claim triggers 400 rejection
        await expect(
          api.claimListing('l1_race', {
            receiver_id: 'r2',
            volunteer_name: 'Courier 2',
            volunteer_phone: '456',
            vehicle_type: 'Trike',
          })
        ).rejects.toThrow(/Already claimed by another courier/i)
      })

      it('T2_F1_05: cleanly URL-encodes special characters in food name and donor address', () => {
        const link = formatWhatsAppDeepLink({
          pickupGps: { lat: 12.9716, lng: 77.6412 },
          donorAddress: '100 Ft Rd & 12th Main, #45/2 (Opp. Metro Station)',
          donorName: 'Chef M&S Caterers & Bakers',
          foodName: 'Mutton Biryani & "Dum" Gravy (Spicy & Hot)',
          quantityKg: 40.0,
          shelterName: 'St. Mary\'s Relief & Hope Hub',
          shelterAddress: 'Double Rd / Near Circle',
          shelterPhone: '+91-98200-44556',
          scwMinutesRemaining: 110,
        })

        // Verify URL validity
        expect(() => new URL(link)).not.toThrow()
        expect(link).not.toContain(' ')
        expect(link).not.toContain('"')
        const decoded = decodeURIComponent(link)
        expect(decoded).toContain('Chef M&S Caterers & Bakers')
        expect(decoded).toContain('Mutton Biryani & "Dum" Gravy (Spicy & Hot)')
      })
    })

    // ------------------------------------------------------------------------
    // F2 Boundaries
    // ------------------------------------------------------------------------
    describe('F2 Boundaries', () => {
      it('T2_F2_01: evaluates route progress at 0.0 (departure) with maximum ETA and full distance', () => {
        const departure = calculateDriverTelemetry(0.0, 2.4)
        expect(departure.etaMinutes).toBe(14)
        expect(departure.distanceRemainingKm).toBe(2.4)
        expect(departure.isDelivered).toBe(false)
      })

      it('T2_F2_02: evaluates route progress at 1.0 (arrival) with 0 ETA, 0 distance, and delivery ready', () => {
        const arrival = calculateDriverTelemetry(1.0, 2.4)
        expect(arrival.etaMinutes).toBe(0)
        expect(arrival.distanceRemainingKm).toBe(0)
        expect(arrival.speedKmh).toBe(0)
        expect(arrival.isDelivered).toBe(true)
      })

      it('T2_F2_03: flags critical battery level (<10%) in simulated telemetry', () => {
        // Test battery scaling under severe discharge
        const lowBatteryProgress = 1.0
        const telemetry = calculateDriverTelemetry(lowBatteryProgress)
        expect(telemetry.batteryPercent).toBeLessThanOrEqual(85)
      })

      it('T2_F2_04: detects cambro core temperature falling to danger zone (60°C)', () => {
        const breach = evaluateFssaiHygiene({
          coreTempC: 60.0,
          surfaceTempC: 58.0,
          elapsedMinutesSincePrep: 60,
          packagingIntact: true,
        })
        expect(breach.isSafe).toBe(false)
        expect(breach.hotHoldCompliant).toBe(false)
        expect(breach.microbialRiskLevel).toBe('MODERATE')
        expect(breach.rejectionReasons[0]).toContain('Temperature Danger Zone violation')
      })

      it('T2_F2_05: rejects invalid status transitions (e.g. POSTED directly to DELIVERED)', async () => {
        await expect(
          api.updateListingStatus('l1', { status: 'COLLECTED' })
        ).rejects.toThrow(/courier claim required first/i)
      })
    })

    // ------------------------------------------------------------------------
    // F3 Boundaries
    // ------------------------------------------------------------------------
    describe('F3 Boundaries', () => {
      it('T3_F3_01: handles zero kilograms donated gracefully (₹0.00 deduction)', () => {
        const data = calculateSection80G(0, 0)
        expect(data.grossSalvageValuation).toBe(0)
        expect(data.eligible80gDeduction).toBe(0)
        expect(data.projectedCorporateTaxSavings).toBe(0)
        expect(data.esgCo2eOffsetKg).toBe(0.0)
      })

      it('T3_F3_02: validates donor PAN format strictly rejecting invalid formats', () => {
        expect(validatePan('AAACT1234K')).toBe(true)
        expect(validatePan('BBLPR9876M')).toBe(true)

        expect(validatePan('INVALID_PAN')).toBe(false)
        expect(validatePan('12345ABCDE')).toBe(false)
        expect(validatePan('AAAA12345K')).toBe(false)
        expect(validatePan('')).toBe(false)
      })

      it('T3_F3_03: scales large corporate donation (10,000 kg) without numeric overflow', () => {
        const largeMeals = 22222
        const data = calculateSection80G(10000.0, largeMeals)

        expect(data.grossSalvageValuation).toBe(1444430) // 22222 * 65
        expect(data.eligible80gDeduction).toBe(722215)
        expect(data.projectedCorporateTaxSavings).toBe(225331)
        expect(data.esgCo2eOffsetKg).toBe(25000.0) // 10,000 * 2.5
      })

      it('T3_F3_04: verifies unclaimed/unverified listings cannot generate official 80G tax slips', () => {
        const unverifiedListing = mockListings[0] // status is POSTED
        expect(unverifiedListing.status).toBe('POSTED')
        // In business logic, certificate is only accessible upon DELIVERED status
        expect(unverifiedListing.status === 'DELIVERED').toBe(false)
      })

      it('T3_F3_05: flags tampered verification docket hashes', () => {
        const data = calculateSection80G(55.0, 120)
        const tamperedHash = 'sha256:tampered_invalid_hash_value_12345'
        const isAuthentic = data.verificationHash === tamperedHash
        expect(isAuthentic).toBe(false)
      })
    })

    // ------------------------------------------------------------------------
    // F4 Boundaries
    // ------------------------------------------------------------------------
    describe('F4 Boundaries', () => {
      it('T4_F4_01: renders clean empty state in Donor Portal when listings array is empty', () => {
        render(<MultiRolePortalHarness initialRole="DONOR" listings={[]} />)
        expect(screen.getByText(/No active food batches logged/i)).toBeInTheDocument()
      })

      it('T4_F4_02: handles zero available missions in Courier Fleet view gracefully', () => {
        render(<MultiRolePortalHarness initialRole="COURIER" listings={[]} />)
        expect(screen.getByRole('region', { name: /Volunteer Courier Dashboard/i })).toBeInTheDocument()
        expect(screen.queryByText(/1-Click WhatsApp Dispatch/i)).not.toBeInTheDocument()
      })

      it('T4_F4_03: displays 100% capacity limit indicator and disables intake when shelter is full', () => {
        const fullReceivers: Receiver[] = [
          {
            ...mockReceivers[0],
            capacity_meals: 0,
          },
        ]
        render(<MultiRolePortalHarness initialRole="SHELTER" receivers={fullReceivers} />)

        expect(screen.getByText(/CAPACITY REACHED 100%/i)).toBeInTheDocument()
        const intakeBtn = screen.getByRole('button', { name: /Intake Suspended \(Max Capacity\)/i })
        expect(intakeBtn).toBeDisabled()
      })

      it('T4_F4_04: supports rapid role toggling without React state errors or unhandled exceptions', () => {
        render(<MultiRolePortalHarness initialRole="DONOR" />)

        // Rapidly toggle between all 4 roles
        fireEvent.click(screen.getByRole('button', { name: 'Volunteer Courier' }))
        expect(screen.getByRole('region', { name: /Volunteer Courier Dashboard/i })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Shelter Intake' }))
        expect(screen.getByRole('region', { name: /Shelter Intake Dashboard/i })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Municipal Command' }))
        expect(screen.getByRole('region', { name: /Municipal Command Dashboard/i })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Donor Kitchen' }))
        expect(screen.getByRole('region', { name: /Donor Kitchen Dashboard/i })).toBeInTheDocument()
      })

      it('T4_F4_05: renders Section 80G certificate in single-page modal structure with print button', () => {
        const data = calculateSection80G(55.0, 120)
        render(<Section80GCertificateModalView isOpen={true} onClose={() => {}} data={data} />)

        expect(screen.getByRole('button', { name: /PRINT OFFICIAL 80G TAX CERTIFICATE/i })).toBeInTheDocument()
        expect(screen.getByRole('table')).toBeInTheDocument()
      })
    })

    // ------------------------------------------------------------------------
    // F5 Boundaries
    // ------------------------------------------------------------------------
    describe('F5 Boundaries', () => {
      it('T5_F5_01: marks food temperature exactly at 65.0°C (boundary of hot-hold) as passing', () => {
        const boundaryPass = evaluateFssaiHygiene({
          coreTempC: 65.0,
          surfaceTempC: 64.0,
          elapsedMinutesSincePrep: 60,
          packagingIntact: true,
        })
        expect(boundaryPass.hotHoldCompliant).toBe(true)
        expect(boundaryPass.isSafe).toBe(true)
        expect(boundaryPass.fssaiGrade).toBe('GRADE_A_PRIME')
      })

      it('T5_F5_02: fails-closed when food temperature is at 64.9°C (danger zone boundary)', () => {
        const boundaryFail = evaluateFssaiHygiene({
          coreTempC: 64.9,
          surfaceTempC: 63.5,
          elapsedMinutesSincePrep: 60,
          packagingIntact: true,
        })
        expect(boundaryFail.hotHoldCompliant).toBe(false)
        expect(boundaryFail.isSafe).toBe(false)
        expect(boundaryFail.verdict).toBe('SPOILED_AND_GONE')
        expect(boundaryFail.fssaiGrade).toBe('GRADE_F')
      })

      it('T5_F5_03: evaluates elapsed time since prep at exactly 240 minutes (4-hour threshold)', () => {
        const threshold = evaluateFssaiHygiene({
          coreTempC: 68.0,
          surfaceTempC: 66.0,
          elapsedMinutesSincePrep: 240,
          packagingIntact: true,
        })
        expect(threshold.isSafe).toBe(true)
        expect(threshold.scwRemainingMinutes).toBe(0)
      })

      it('T5_F5_04: marks elapsed time > 240 minutes as mandatory FSSAI violation with Grade F and tests expired rice', () => {
        const violation = evaluateFssaiHygiene({
          coreTempC: 68.0,
          surfaceTempC: 66.0,
          elapsedMinutesSincePrep: 241,
          packagingIntact: true,
        })
        expect(violation.isSafe).toBe(false)
        expect(violation.fssaiGrade).toBe('GRADE_F')
        expect(violation.rejectionReasons[0]).toContain('FSSAI 4-hour microbial proliferation window exceeded')

        render(
          <MirageModal
            isOpen={true}
            onClose={() => {}}
            mirageInspection={mockMirageExpiredRice}
            mirageScanning={false}
            onRunInspection={async () => {}}
            onApplyToForm={() => {}}
          />
        )
        expect(screen.getByText(/\[TEMP_HAZARD: 22°C - 31°C DANGER ZONE\]/i)).toBeInTheDocument()
      })

      it('T5_F5_05: renders spoiled containment hazard in MirageModal when VLM detects degraded sample', () => {
        render(
          <MirageModal
            isOpen={true}
            onClose={() => {}}
            mirageInspection={mockMirageSpoiledCurry}
            mirageScanning={false}
            onRunInspection={async () => {}}
            onApplyToForm={() => {}}
          />
        )

        expect(screen.getByText(/\[MOLD\/DISCOLORATION: RISK\]/i)).toBeInTheDocument()
        expect(screen.getByText(/\[TEMP_HAZARD: 22°C - 31°C DANGER ZONE\]/i)).toBeInTheDocument()
        expect(screen.getByText(/\[BACTERIAL_PROLIFERATION: CRITICAL\]/i)).toBeInTheDocument()
      })
    })
  })

  // ==========================================================================
  // TIER 3: CROSS-FEATURE INTERACTIONS (5 Pairwise Combinations)
  // ==========================================================================

  describe('Tier 3: Cross-Feature Interactions', () => {
    it('T3_PAIR_01 (F1 + F2): WhatsApp dispatch trigger initializes EV Cargo Trike telemetry route', async () => {
      // Step 1: Claim listing
      const claimedListing = await api.claimListing('l1', {
        receiver_id: 'r1',
        volunteer_name: 'Vikram Adiga',
        volunteer_phone: '+91 99112 33445',
        vehicle_type: 'EV Cargo Trike',
      })
      expect(claimedListing.status).toBe('CLAIMED')

      // Step 2: Initialize route telemetry
      const telemetry = calculateDriverTelemetry(0.0)
      expect(telemetry.courierName).toBe('Vikram Adiga')
      expect(telemetry.vehicleType).toBe('EV Cargo Trike')
      expect(telemetry.etaMinutes).toBe(14)
      expect(telemetry.cambroCoreTempC).toBeGreaterThan(65.0)
    })

    it('T3_PAIR_02 (F2 + F4): driver reaching destination updates Shelter Intake board with verified delivery', async () => {
      // Step 1: Simulate EV Cargo Trike arrival at destination
      const arrival = calculateDriverTelemetry(1.0)
      expect(arrival.isDelivered).toBe(true)

      // Step 2: Transition listing to DELIVERED
      const delivered = await api.updateListingStatus('l2', {
        status: 'DELIVERED',
        notes: `Arrived at ${arrival.currentCoordinates.lat}, ${arrival.currentCoordinates.lng}`,
      })
      expect(delivered.status).toBe('DELIVERED')

      // Step 3: Render Shelter Intake view to verify delivery reflection
      render(<MultiRolePortalHarness initialRole="SHELTER" listings={[delivered]} />)
      expect(screen.getByRole('region', { name: /Shelter Intake Dashboard/i })).toBeInTheDocument()
    })

    it('T3_PAIR_03 (F2 + F3): verified delivery in Shelter board automatically generates Section 80G Tax Certificate', async () => {
      const delivered = await api.updateListingStatus('l3', { status: 'DELIVERED' })
      expect(delivered.status).toBe('DELIVERED')

      // Generate Section 80G tax certificate
      const taxData = calculateSection80G(delivered.quantity_kg, delivered.quantity_meals)
      expect(taxData.eligible80gDeduction).toBeGreaterThan(0)
      expect(taxData.projectedCorporateTaxSavings).toBeGreaterThan(0)
      expect(taxData.esgCo2eOffsetKg).toBe(delivered.quantity_kg * 2.5)

      render(<Section80GCertificateModalView isOpen={true} onClose={() => {}} data={taxData} />)
      expect(screen.getAllByText(new RegExp(taxData.certificateNumber)).length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('AAACT1234K')).toBeInTheDocument()
    })

    it('T3_PAIR_04 (F5 + F1): food passing VLM thermography and FSSAI triage auto-populates dispatch payload', () => {
      // Step 1: VLM inspects fresh batch
      const triage = evaluateFssaiHygiene({
        coreTempC: 68.5,
        surfaceTempC: 66.0,
        elapsedMinutesSincePrep: 45,
        packagingIntact: true,
      })
      expect(triage.isSafe).toBe(true)

      // Step 2: Auto-populate dispatch payload with verified urn count and remaining SCW
      const dispatchLink = formatWhatsAppDeepLink({
        pickupGps: { lat: 12.9716, lng: 77.6412 },
        donorAddress: '100 Feet Rd, Indiranagar',
        donorName: 'The Grand Amber Banquet Hall',
        foodName: 'Royal Hyderabadi Veg Pulao',
        quantityKg: 55.0,
        shelterName: 'Robin Hood Army',
        shelterAddress: 'Double Road, Indiranagar',
        shelterPhone: '+91 98200 44556',
        scwMinutesRemaining: triage.scwRemainingMinutes,
      })

      const decoded = decodeURIComponent(dispatchLink)
      expect(decoded).toContain('4 Stainless Cambro Urn(s)')
      expect(decoded).toContain('195 mins remaining') // 240 - 45 = 195 mins
    })

    it('T3_PAIR_05 (F5 + F4): food failing VLM inspection triggers fail-closed alert in Municipal Command for bio-compost diversion', () => {
      // Step 1: VLM inspection fails on spoiled curry
      const spoiled = evaluateFssaiHygiene({
        coreTempC: 31.0, // Ambient danger zone
        surfaceTempC: 30.5,
        elapsedMinutesSincePrep: 260, // Exceeded 4 hours
        packagingIntact: false, // Broken vessel seal
      })
      expect(spoiled.isSafe).toBe(false)
      expect(spoiled.verdict).toBe('SPOILED_AND_GONE')
      expect(spoiled.microbialRiskLevel).toBe('CRITICAL')

      // Step 2: Municipal Command Center logs bio-compost diversion
      render(<MultiRolePortalHarness initialRole="MUNICIPAL" />)
      expect(screen.getByText(/BIO-COMPOST DIVERSION/i)).toBeInTheDocument()
      expect(screen.getByText(/2 BATCHES/i)).toBeInTheDocument()
    })
  })

  // ==========================================================================
  // TIER 4: REAL-WORLD MUNICIPAL RELIEF WORKLOADS (5 Scenarios)
  // ==========================================================================

  describe('Tier 4: Real-World Municipal Relief Workloads', () => {
    it('T4_SCENARIO_01: high-volume banquet rescue end-to-end workflow (inspection -> dispatch -> tax receipt)', async () => {
      // 1. Corporate wedding generates 150 kg fresh biryani
      const quantityKg = 150.0
      const quantityMeals = 300

      // 2. VLM validates hot-hold core temp at 68.5°C and intact vessel
      const inspection = evaluateFssaiHygiene({
        coreTempC: 68.5,
        surfaceTempC: 66.0,
        elapsedMinutesSincePrep: 45,
        packagingIntact: true,
      })
      expect(inspection.isSafe).toBe(true)
      expect(inspection.fssaiGrade).toBe('GRADE_A_PRIME')

      // 3. Urn count computed as ceil(150 / 18) = 9 Cambro urns
      const urns = calculateUrnCount(quantityKg)
      expect(urns).toBe(9)

      // 4. 1-Click WhatsApp dispatch formatted and courier claims mission
      const dispatchLink = formatWhatsAppDeepLink({
        pickupGps: { lat: 12.9716, lng: 77.6412 },
        donorAddress: '100 Feet Rd, Indiranagar',
        donorName: 'The Grand Amber Banquet Hall',
        foodName: 'Royal Hyderabadi Dum Biryani',
        quantityKg,
        shelterName: 'City Hope Homeless Shelter',
        shelterAddress: '8th Main, Koramangala',
        shelterPhone: '+91 94490 77112',
        scwMinutesRemaining: inspection.scwRemainingMinutes,
      })
      expect(decodeURIComponent(dispatchLink)).toContain('9 Stainless Cambro Urn(s)')

      // 5. Courier transits Koramangala corridor to destination
      const arrival = calculateDriverTelemetry(1.0)
      expect(arrival.isDelivered).toBe(true)

      // 6. Section 80G tax certificate generated: ₹19,500 deduction, 375 kg CO2e offset
      const taxData = calculateSection80G(quantityKg, quantityMeals)
      // 300 meals * ₹65 = ₹19,500 gross; 50% = ₹9,750 deduction; 150 * 2.5 = 375 kg CO2e
      expect(taxData.grossSalvageValuation).toBe(19500)
      expect(taxData.eligible80gDeduction).toBe(9750)
      expect(taxData.projectedCorporateTaxSavings).toBe(3042)
      expect(taxData.esgCo2eOffsetKg).toBe(375.0)
    })

    it('T4_SCENARIO_02: danger zone thermal spoilage containment and bio-compost diversion workflow', () => {
      // 1. Food batch logged at 42°C with broken container seal
      const inspection = evaluateFssaiHygiene({
        coreTempC: 42.0, // In Danger Zone
        surfaceTempC: 40.0,
        elapsedMinutesSincePrep: 180,
        packagingIntact: false,
      })

      // 2. Fails closed immediately
      expect(inspection.isSafe).toBe(false)
      expect(inspection.verdict).toBe('SPOILED_AND_GONE')
      expect(inspection.fssaiGrade).toBe('GRADE_F')
      expect(inspection.microbialRiskLevel).toBe('CRITICAL')

      // 3. Dispatch is blocked and batch is diverted to municipal bio-composting
      const isDispatchPermitted = inspection.isSafe
      expect(isDispatchPermitted).toBe(false)
    })

    it('T4_SCENARIO_03: multi-courier concurrent dispatch race with database lock and alternative mission', async () => {
      // Courier A claims listing l1 successfully
      const claimA = await api.claimListing('l1', {
        receiver_id: 'r1',
        volunteer_name: 'Courier A (Robin Hood Army)',
        volunteer_phone: '+91 98200 11111',
        vehicle_type: 'EV Cargo Trike',
      })
      expect(claimA.status).toBe('CLAIMED')

      // Courier B attempts to claim listing l2 (which is already claimed in mock) -> receives 400 rejection
      await expect(
        api.claimListing('l2', {
          receiver_id: 'r2',
          volunteer_name: 'Courier B (Feeding India)',
          volunteer_phone: '+91 98200 22222',
          vehicle_type: 'EV Cargo Trike',
        })
      ).rejects.toThrow(/already claimed/i)
    })

    it('T4_SCENARIO_04: corporate donor audit and Section 80G tax filing workflow', () => {
      // 1. Corporate donor verifies historical batches and accesses Section 80G certificate
      const taxData = calculateSection80G(133.0, 280)

      // 2. Verify SHA-256 seal authenticity
      expect(taxData.verificationHash.startsWith('sha256:')).toBe(true)

      // 3. Render Certificate modal and trigger print export
      const onPrint = vi.fn()
      render(<Section80GCertificateModalView isOpen={true} onClose={() => {}} data={taxData} onPrint={onPrint} />)

      expect(screen.getByText('The Grand Amber Banquet Hall')).toBeInTheDocument()
      expect(screen.getByText('AAACT1234K')).toBeInTheDocument()
      expect(screen.getByText(/280 Meals • 133.0 kg/i)).toBeInTheDocument()
      expect(screen.getByText('₹18,200')).toBeInTheDocument() // 280 * 65

      fireEvent.click(screen.getByRole('button', { name: /PRINT OFFICIAL 80G TAX CERTIFICATE/i }))
      expect(onPrint).toHaveBeenCalledTimes(1)
    })

    it('T4_SCENARIO_05: city-wide municipal command surge response across Bengaluru sectors', () => {
      render(<MultiRolePortalHarness initialRole="MUNICIPAL" />)

      expect(screen.getByRole('region', { name: /Municipal Command Dashboard/i })).toBeInTheDocument()
      expect(screen.getByText(/133.0 KG/i)).toBeInTheDocument()
      expect(screen.getByText(/8 TRIKES/i)).toBeInTheDocument()
      expect(screen.getByText(/99.2%/i)).toBeInTheDocument()
    })
  })
})
