import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../App'
import { setupFetchMock, clearMockErrors } from './test-mocks'

describe('Swiggy / Zomato Style Live Delivery Tracking Journey', () => {
  beforeEach(() => {
    clearMockErrors()
    setupFetchMock()
  })

  it('opens Live Delivery Tracker modal with 5-step status progression bar and courier telemetry', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    // Listing l2 is CLAIMED in mockListings; find its TRACK LIVE DELIVERY button
    const trackBtns = screen.getAllByText(/TRACK LIVE DELIVERY/i)
    expect(trackBtns.length).toBeGreaterThanOrEqual(1)
    fireEvent.click(trackBtns[0])

    // Verify modal header is open
    await waitFor(() => {
      expect(screen.getByText(/LIVE RESCUE DISPATCH TRACKER/i)).toBeInTheDocument()
    })

    // Verify 5-step status progression bar elements
    expect(screen.getByText(/Surplus Inspected & Verified/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Courier Assigned/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Food Collected from Kitchen/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Courier in Transit \(Live ETA\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Delivered to Shelter/i)).toBeInTheDocument()

    // Verify assigned courier telemetry
    expect(screen.getByText(/ASSIGNED COURIER TELEMETRY/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Vikram Adiga/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Maruti Eeco Cargo Van/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/CALL COURIER/i)).toBeInTheDocument()

    // Verify thermal vessel and battery readouts
    expect(screen.getByText(/THERMAL VESSEL/i)).toBeInTheDocument()
    expect(screen.getByText(/VEHICLE BATTERY/i)).toBeInTheDocument()
    expect(screen.getByText(/ESTIMATED ARRIVAL/i)).toBeInTheDocument()
    expect(screen.getByText(/ETA:\s*\d+\s*mins\s*•\s*[\d.]+\s*km away/i)).toBeInTheDocument()
  })

  it('allows advancing status directly inside Live Delivery Tracker from CLAIMED to COLLECTED', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    // Open tracker on claimed listing
    const trackBtns = screen.getAllByText(/TRACK LIVE DELIVERY/i)
    fireEvent.click(trackBtns[0])

    await waitFor(() => {
      expect(screen.getByText(/LIVE RESCUE DISPATCH TRACKER/i)).toBeInTheDocument()
    })

    // Advance to COLLECTED
    const collectBtn = screen.getByText(/CONFIRM FOOD COLLECTED FROM KITCHEN/i)
    fireEvent.click(collectBtn)

    // Verify teletype notification is triggered
    await waitFor(() => {
      expect(screen.getByText(/FOOD RATION COLLECTED • THERMAL PRESERVATION PROTOCOL ACTIVE/i)).toBeInTheDocument()
    })
  })

  it('displays Swiggy/Zomato dispatch summary cart drawer with active missions and KPI telemetry', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    // Bottom strip contains MUNICIPAL RESCUE DISPATCH CORPS
    expect(screen.getByText(/MUNICIPAL RESCUE DISPATCH CORPS/i)).toBeInTheDocument()

    // Click "DISPATCH SUMMARY" to expand drawer
    const summaryBtn = screen.getByText(/DISPATCH SUMMARY/i)
    fireEvent.click(summaryBtn)

    // Verify drawer contents
    await waitFor(() => {
      expect(screen.getByText(/HYPERLOCAL RELIEF DISPATCH FLEET TELEMETRY/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/MEALS IN CORRIDOR/i)).toBeInTheDocument()
    expect(screen.getByText(/BENEFICIARY COUNT/i)).toBeInTheDocument()
    expect(screen.getByText(/DELIVERY VEHICLE/i)).toBeInTheDocument()
    expect(screen.getByText(/CO₂ EMISSIONS DIVERTED/i)).toBeInTheDocument()
    expect(screen.getByText(/CULINARY WATER SAVED/i)).toBeInTheDocument()
  })
})
