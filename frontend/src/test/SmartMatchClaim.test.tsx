import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../App'
import { setupFetchMock, fetchCallHistory, setMockError, clearMockErrors } from './test-mocks'

describe('Proximity Smart Match & Courier Dispatch Journey', () => {
  beforeEach(() => {
    clearMockErrors()
    setupFetchMock()
  })

  it('opens Smart Proximity Match modal with ranked receivers and fit badges', async () => {
    render(<App />)

    // Click "SMART MATCH NGO" on the posted listing once loaded
    const matchBtn = await screen.findByText(/SMART MATCH NGO/i)
    fireEvent.click(matchBtn)

    // Wait for match modal to open
    await waitFor(() => {
      expect(screen.getByText(/HAVERSINE PROXIMITY SMART DISPATCH ORDER/i)).toBeInTheDocument()
    })

    // Assert ranked receivers telemetry
    expect(screen.getByText(/RANKED NEARBY CERTIFIED SHELTERS/i)).toBeInTheDocument()
    const receiverMatches = screen.getAllByText(/Robin Hood Army - Indiranagar Hub/i)
    expect(receiverMatches.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/EXCELLENT FIT/i)).toBeInTheDocument()
    expect(screen.getByText(/0.8 km away/i)).toBeInTheDocument()
  })

  it('selects receiver, updates courier details, and transmits claim', async () => {
    render(<App />)

    const matchBtn = await screen.findByText(/SMART MATCH NGO/i)
    fireEvent.click(matchBtn)

    await waitFor(() => {
      expect(screen.getByText(/HAVERSINE PROXIMITY SMART DISPATCH ORDER/i)).toBeInTheDocument()
    })

    // Update courier name
    const courierInputs = screen.getAllByRole('textbox')
    const nameInput = courierInputs.find((i) => (i as HTMLInputElement).value === 'Vikram Adiga')
    if (nameInput) {
      fireEvent.change(nameInput, { target: { value: 'Siddharth Rao' } })
      expect((nameInput as HTMLInputElement).value).toBe('Siddharth Rao')
    }

    // Click "TRANSMIT DISPATCH & CLAIM FOOD RATION"
    const claimBtn = screen.getByText(/TRANSMIT DISPATCH & CLAIM FOOD RATION/i)
    fireEvent.click(claimBtn)

    // Verify confirmation teletype toast is triggered
    await waitFor(() => {
      expect(screen.getByText(/COURIER ASSIGNED • DISPATCH ROUTE ACTIVE TO INDIRANAGAR/i)).toBeInTheDocument()
    })

    // Modal closes
    expect(screen.queryByText(/HAVERSINE PROXIMITY SMART DISPATCH ORDER/i)).not.toBeInTheDocument()
  })

  it('rejects claim collision when listing is already claimed (HTTP 400 Bad Request)', async () => {
    // Direct API verification: listing l2 is already in CLAIMED status
    const collisionRes = await fetch('/api/listings/l2/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receiver_id: 'r1',
        volunteer_name: 'Courier Collision',
        volunteer_phone: '+91 99999 00000',
        vehicle_type: 'Cargo Van',
      }),
    })
    expect(collisionRes.status).toBe(400)
    expect(collisionRes.ok).toBe(false)
    const errData = await collisionRes.json()
    expect(errData.detail).toContain('already claimed')

    // UI simulation: simulate duplicate claim race condition on l1
    setMockError('/api/listings/l1/claim', 400, { detail: 'Cannot claim listing in status CLAIMED: already claimed by another courier' }, 'POST')

    render(<App />)
    const matchBtn = await screen.findByText(/SMART MATCH NGO/i)
    fireEvent.click(matchBtn)
    await waitFor(() => {
      expect(screen.getByText(/HAVERSINE PROXIMITY SMART DISPATCH ORDER/i)).toBeInTheDocument()
    })

    const claimBtn = screen.getByText(/TRANSMIT DISPATCH & CLAIM FOOD RATION/i)
    fireEvent.click(claimBtn)

    await waitFor(() => {
      const claimCall = fetchCallHistory.find((c) => c.url.includes('/claim') && c.method === 'POST')
      expect(claimCall).toBeDefined()
      expect(claimCall?.response.status).toBe(400)
      expect(claimCall?.response.ok).toBe(false)
      expect(claimCall?.response.data.detail).toContain('already claimed')
    })
  })

  it('rejects claim attempt on expired food listing (HTTP 400 Bad Request)', async () => {
    // Direct API verification: claiming an expired listing
    const expiredRes = await fetch('/api/listings/l_expired/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receiver_id: 'r1',
        volunteer_name: 'Late Volunteer',
        volunteer_phone: '+91 98888 22222',
      }),
    })
    expect(expiredRes.status).toBe(400)
    expect(expiredRes.ok).toBe(false)
    const errData = await expiredRes.json()
    expect(errData.detail).toBe('Cannot claim expired food listing')

    // UI simulation: simulate expired listing claim failure
    setMockError('/api/listings/l1/claim', 400, { detail: 'Cannot claim expired food listing' }, 'POST')

    render(<App />)
    const matchBtn = await screen.findByText(/SMART MATCH NGO/i)
    fireEvent.click(matchBtn)
    await waitFor(() => {
      expect(screen.getByText(/HAVERSINE PROXIMITY SMART DISPATCH ORDER/i)).toBeInTheDocument()
    })

    const claimBtn = screen.getByText(/TRANSMIT DISPATCH & CLAIM FOOD RATION/i)
    fireEvent.click(claimBtn)

    await waitFor(() => {
      const expiredCall = fetchCallHistory.find((c) => c.url.includes('/claim') && c.method === 'POST')
      expect(expiredCall).toBeDefined()
      expect(expiredCall?.response.status).toBe(400)
      expect(expiredCall?.response.ok).toBe(false)
      expect(expiredCall?.response.data.detail).toBe('Cannot claim expired food listing')
    })
  })
})
