import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../App'
import { setupFetchMock } from './test-mocks'

describe('SurplusPulse Main Dashboard & Navigation', () => {
  beforeEach(() => {
    setupFetchMock()
  })

  it('renders masthead, live telemetry indicators, and navigation tabs', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    expect(screen.getByText(/EST\. 2026/i)).toBeInTheDocument()
    expect(screen.getByText(/HYPERLOCAL FOOD RESCUE & AI DISPATCH CORPS/i)).toBeInTheDocument()
    expect(screen.getByText(/ACTIVE DONORS/i)).toBeInTheDocument()
    expect(screen.getByText(/CERTIFIED SHELTERS/i)).toBeInTheDocument()

    // Check navigation buttons
    expect(screen.getByRole('button', { name: /\[1\] RESCUE RADAR/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /\[2\] HOLOGRAPHIC DISPATCH MATRIX/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /\[3\] QUANTUM ESG & (CARBON LEDGER|COMPTOMETER)/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /\[4\] HYGIENE PROTOCOL DIRECTIVES/i })).toBeInTheDocument()
  })

  it('switches between dashboard tabs', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    // Switch to MAP tab
    fireEvent.click(screen.getByRole('button', { name: /\[2\] HOLOGRAPHIC DISPATCH MATRIX/i }))
    expect(screen.getByText(/HOLOGRAPHIC PROXIMITY RADAR • BENGALURU DISPATCH MATRIX/i)).toBeInTheDocument()

    // Switch to GUIDELINES tab
    fireEvent.click(screen.getByRole('button', { name: /\[4\] HYGIENE PROTOCOL DIRECTIVES/i }))
    expect(screen.getByText(/MUNICIPAL FOOD CODE & SAFE HOLDING DIRECTIVE \(FSSAI DIVISION\)/i)).toBeInTheDocument()
    expect(screen.getByText(/\[1\] THERMAL HOLDING MANDATE/i)).toBeInTheDocument()
    expect(screen.getByText(/\[2\] THE 4-HOUR CONSUMPTION WINDOW/i)).toBeInTheDocument()
  })

  it('opens and closes Mirage 22MB VLM Optical Inspector modal', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    // Click "Mirage VLM (22MB)"
    const mirageBtn = screen.getByRole('button', { name: /Mirage VLM \(22MB\)/i })
    fireEvent.click(mirageBtn)

    await waitFor(() => {
      expect(screen.getByText(/CIVIC FOOD HYGIENE SPECTROGRAPH • MIRAGE VLM/i)).toBeInTheDocument()
    })

    // Close button
    const closeButtons = screen.getAllByRole('button')
    const closeBtn = closeButtons.find((b) => b.querySelector('svg.lucide-x'))
    if (closeBtn) {
      fireEvent.click(closeBtn)
      expect(screen.queryByText(/CIVIC FOOD HYGIENE SPECTROGRAPH • MIRAGE VLM/i)).not.toBeInTheDocument()
    }
  })
})
