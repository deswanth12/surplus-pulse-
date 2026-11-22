import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../App'
import { setupFetchMock } from './test-mocks'

describe('ESG Comptometer ROI Calculator Journey', () => {
  beforeEach(() => {
    setupFetchMock()
  })

  it('renders ESG impact ledger and 1968 Comptometer on IMPACT tab', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    // Click "[3] QUANTUM ESG & CARBON LEDGER" tab
    const impactTab = screen.getByRole('button', { name: /\[3\] QUANTUM ESG & (CARBON LEDGER|COMPTOMETER)/i })
    fireEvent.click(impactTab)

    // Verify Ledger header
    expect(screen.getByText(/COMMERCIAL CATERER ROI (AND|&|COMPTOMETER)/i)).toBeInTheDocument()

    // Default calculations: 8 events * 80 plates = 640 meals
    expect(screen.getByText(/640 MEALS/i)).toBeInTheDocument()
    expect(screen.getByText(/₹41,600/i)).toBeInTheDocument()
    expect(screen.getByText(/\+₹40,101/i)).toBeInTheDocument()
    expect(screen.getByText(/0.72 TONS/i)).toBeInTheDocument()
  })

  it('recalculates rescued meals, kitchen savings, and carbon credits when sliders are moved', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /\[3\] QUANTUM ESG & (CARBON LEDGER|COMPTOMETER)/i }))

    // Find sliders
    const sliders = screen.getAllByRole('slider')
    expect(sliders.length).toBeGreaterThanOrEqual(2)

    const eventsSlider = sliders[0]
    const platesSlider = sliders[1]

    // Set events to 10 and plates to 100
    // Expected meals = 10 * 100 = 1000 meals
    // Expected kg = 1000 * 0.45 = 450 kg
    // Expected savings = 1000 * 65 = ₹65,000
    // Expected net = 65000 - 1499 = ₹63,501
    // Expected carbon = 450 * 2.5 / 1000 = 1.13 tons
    fireEvent.change(eventsSlider, { target: { value: '10' } })
    fireEvent.change(platesSlider, { target: { value: '100' } })

    expect(screen.getByText(/1000 MEALS/i)).toBeInTheDocument()
    expect(screen.getByText(/₹65,000/i)).toBeInTheDocument()
    expect(screen.getByText(/\+₹63,501/i)).toBeInTheDocument()
    expect(screen.getByText(/1.13 TONS/i)).toBeInTheDocument()
  })

  it('triggers fiscal recovery audit slip printing toast', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /\[3\] QUANTUM ESG & (CARBON LEDGER|COMPTOMETER)/i }))

    const printBtn = screen.getByText(/PRINT ACCOUNTING AUDIT SLIP/i)
    fireEvent.click(printBtn)

    await waitFor(() => {
      expect(screen.getByText(/PRINTING FISCAL RECOVERY AUDIT SLIP/i)).toBeInTheDocument()
    })
  })
})
