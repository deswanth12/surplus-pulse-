import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../App'
import { setupFetchMock, fetchCallHistory, setMockError, clearMockErrors } from './test-mocks'

describe('Status Lifecycle Progression & Teletype Toasts', () => {
  beforeEach(() => {
    clearMockErrors()
    setupFetchMock()
  })

  it('advances status to COLLECTED and displays thermal preservation toast', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    // Listing l2 is in CLAIMED status and shows "[2] CONFIRM FOOD COLLECTED BY COURIER"
    const collectBtn = screen.getByText(/\[2\] CONFIRM FOOD COLLECTED BY COURIER/i)
    fireEvent.click(collectBtn)

    // Verify teletype toast appears
    await waitFor(() => {
      expect(screen.getByText(/FOOD RATION COLLECTED • THERMAL PRESERVATION PROTOCOL ACTIVE/i)).toBeInTheDocument()
    })
  })

  it('advances status to DELIVERED and displays delivery audit toast', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    // Listing l3 is in COLLECTED status and shows "[3] CONFIRM DELIVERED TO BENEFICIARIES"
    const deliverBtn = screen.getByText(/\[3\] CONFIRM DELIVERED TO BENEFICIARIES/i)
    fireEvent.click(deliverBtn)

    // Verify delivery completion toast appears
    await waitFor(() => {
      expect(screen.getByText(/RELIEF DELIVERED TO SHELTER BENEFICIARIES • CIVIC AUDIT COMPLETED/i)).toBeInTheDocument()
    })
  })

  it('filters listings by status pills', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    // Click "IN TRANSIT" filter button
    const inTransitBtn = screen.getByRole('button', { name: /IN TRANSIT/i })
    fireEvent.click(inTransitBtn)

    // Should display claimed listing
    expect(screen.getByText(/Wholesome Roti, Dal Tadka/i)).toBeInTheDocument()

    // Click "VEG ONLY" filter button
    const vegBtn = screen.getByRole('button', { name: /VEG ONLY/i })
    fireEvent.click(vegBtn)

    expect(screen.getByText(/Royal Hyderabadi Veg Pulao/i)).toBeInTheDocument()
  })

  it('rejects invalid status transition from POSTED directly to COLLECTED (HTTP 400 Bad Request)', async () => {
    // Direct API verification: listing l1 is in POSTED status and cannot be COLLECTED without claim
    const invalidTransRes = await fetch('/api/listings/l1/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'COLLECTED' }),
    })
    expect(invalidTransRes.status).toBe(400)
    expect(invalidTransRes.ok).toBe(false)
    const errData = await invalidTransRes.json()
    expect(errData.detail).toContain('courier claim required first')
  })

  it('rejects unsupported or malformed status transition values (HTTP 400 Bad Request)', async () => {
    const malformedRes = await fetch('/api/listings/l2/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'UNSUPPORTED_STATUS_ENUM' }),
    })
    expect(malformedRes.status).toBe(400)
    expect(malformedRes.ok).toBe(false)
    const errData = await malformedRes.json()
    expect(errData.detail).toContain('Invalid status transition')
  })

  it('handles simulated server 400 rejection during status progression in UI', async () => {
    // Configure simulated mock error on status update
    setMockError('/api/listings/l2/status', 400, { detail: 'Transition rejected: thermal seal compromised during transit' }, 'POST')

    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    const collectBtn = screen.getByText(/\[2\] CONFIRM FOOD COLLECTED BY COURIER/i)
    fireEvent.click(collectBtn)

    await waitFor(() => {
      const statusCall = fetchCallHistory.find((c) => c.url.includes('/status') && c.method === 'POST')
      expect(statusCall).toBeDefined()
      expect(statusCall?.response.status).toBe(400)
      expect(statusCall?.response.ok).toBe(false)
      expect(statusCall?.response.data.detail).toContain('thermal seal compromised')
    })
  })
})
