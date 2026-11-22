import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../App'
import { setupFetchMock, fetchCallHistory, setMockError, clearMockErrors } from './test-mocks'

describe('Form 68-A Emergency Salvage Declaration Journey', () => {
  beforeEach(() => {
    clearMockErrors()
    setupFetchMock()
  })

  it('opens Form 68-A modal when Quick Post button is clicked', async () => {
    render(<App />)

    // Wait for initial data load
    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    // Click "Dispatch Surplus (<45s)"
    const quickPostBtn = screen.getByText(/Dispatch Surplus/i)
    fireEvent.click(quickPostBtn)

    // Verify modal header is visible
    expect(screen.getByText(/FORM 68-A • EMERGENCY FOOD SALVAGE DECLARATION/i)).toBeInTheDocument()
    expect(screen.getByText(/DONOR VENUE \/ KITCHEN/i)).toBeInTheDocument()
    expect(screen.getByText(/FOOD RATION DESCRIPTION/i)).toBeInTheDocument()
    expect(screen.getByText(/MEAL COUNT/i)).toBeInTheDocument()
    expect(screen.getByText(/MASS \(KG\)/i)).toBeInTheDocument()
  })

  it('allows user input updates in Form 68-A fields', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText(/Dispatch Surplus/i))

    // Find and update food description input
    const foodInputs = screen.getAllByRole('textbox')
    const descInput = foodInputs.find((input) => (input as HTMLInputElement).value?.includes('Biryani'))
    expect(descInput).toBeDefined()
    if (descInput) {
      fireEvent.change(descInput, { target: { value: 'Fresh Mysore Masala Dosa' } })
      expect((descInput as HTMLInputElement).value).toBe('Fresh Mysore Masala Dosa')
    }

    // Find meal count spinbutton
    const mealInput = screen.getByDisplayValue('90')
    fireEvent.change(mealInput, { target: { value: '150' } })
    expect((mealInput as HTMLInputElement).value).toBe('150')
  })

  it('submits Form 68-A and displays animated teletype wire toast', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText(/Dispatch Surplus/i))

    // Submit form via submit button
    const submitBtn = screen.getByText(/★ TRANSMIT EMERGENCY SALVAGE (DISPATCH|TELEGRAM) ★/i)
    fireEvent.click(submitBtn)

    // Verify teletype toast notification appeared
    await waitFor(() => {
      expect(screen.getByText(/FORM 68-A TRANSMITTED • SURPLUS BROADCAST TO METRO DISPATCH SECTOR/i)).toBeInTheDocument()
    })

    // Modal should close on submission
    expect(screen.queryByText(/FORM 68-A • EMERGENCY FOOD SALVAGE DECLARATION/i)).not.toBeInTheDocument()
  })

  it('rejects negative meal count with HTTP 422 Unprocessable Entity and res.ok false', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText(/Dispatch Surplus/i))

    // Set meal count to negative value
    const mealInput = screen.getByDisplayValue('90')
    fireEvent.change(mealInput, { target: { value: '-10' } })
    expect((mealInput as HTMLInputElement).value).toBe('-10')

    // Submit form
    const submitBtn = screen.getByText(/★ TRANSMIT EMERGENCY SALVAGE (DISPATCH|TELEGRAM) ★/i)
    fireEvent.submit(submitBtn.closest('form')!)

    // Verify API rejected with 422 and res.ok === false
    await waitFor(() => {
      const postCall = fetchCallHistory.find((c) => c.url === '/api/listings' && c.method === 'POST')
      expect(postCall).toBeDefined()
      expect(postCall?.body.quantity_meals).toBe(-10)
      expect(postCall?.response.status).toBe(422)
      expect(postCall?.response.ok).toBe(false)
      expect(postCall?.response.data.detail[0].msg).toContain('quantity_meals must be greater than 0')
    })
  })

  it('rejects out-of-bounds holding hours and negative mass with server 422 error rejection', async () => {
    // Direct API validation checks for boundary constraints
    const invalidHoursRes = await fetch('/api/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        donor_id: 'd1',
        food_name: 'Stale Curry',
        quantity_meals: 50,
        quantity_kg: 20.0,
        hours_valid: 0.1,
      }),
    })
    expect(invalidHoursRes.status).toBe(422)
    expect(invalidHoursRes.ok).toBe(false)
    const hoursErr = await invalidHoursRes.json()
    expect(hoursErr.detail[0].msg).toContain('hours_valid')

    const negativeKgRes = await fetch('/api/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        donor_id: 'd1',
        food_name: 'Invalid Mass Item',
        quantity_meals: 50,
        quantity_kg: -5.0,
        hours_valid: 3.0,
      }),
    })
    expect(negativeKgRes.status).toBe(422)
    expect(negativeKgRes.ok).toBe(false)
    const kgErr = await negativeKgRes.json()
    expect(kgErr.detail[0].msg).toContain('quantity_kg must be greater than 0')
  })

  it('handles simulated server 422 validation rejection with res.ok false', async () => {
    // Configure simulated mock error response
    setMockError('/api/listings', 422, { detail: 'Validation failed: Mandatory hygiene certificate missing' }, 'POST')

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText(/Dispatch Surplus/i))
    const submitBtn = screen.getByText(/★ TRANSMIT EMERGENCY SALVAGE (DISPATCH|TELEGRAM) ★/i)
    fireEvent.submit(submitBtn.closest('form')!)

    await waitFor(() => {
      const failedCall = fetchCallHistory.find((c) => c.url === '/api/listings' && c.method === 'POST')
      expect(failedCall).toBeDefined()
      expect(failedCall?.response.status).toBe(422)
      expect(failedCall?.response.ok).toBe(false)
      expect(failedCall?.response.data.detail).toContain('Mandatory hygiene certificate missing')
    })
  })
})
