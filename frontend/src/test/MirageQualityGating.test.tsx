import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../App'
import { setupFetchMock, clearMockErrors } from './test-mocks'

describe('Mirage VLM Food Quality Classifier & Quality Gating Journey', () => {
  beforeEach(() => {
    clearMockErrors()
    setupFetchMock()
  })

  it('blocks Form 68-A submission when food is inspected as spoiled/gone with high-visibility warning', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    // Open Form 68-A
    fireEvent.click(screen.getByText(/Dispatch Surplus/i))
    await waitFor(() => {
      expect(screen.getByText(/FORM 68-A • EMERGENCY FOOD SALVAGE DECLARATION/i)).toBeInTheDocument()
    })

    // Click "Curry (Spoiled)" sample button
    const spoiledBtn = screen.getByText(/Curry \(Spoiled\)/i)
    fireEvent.click(spoiledBtn)

    // Verify high-visibility warning appears
    await waitFor(() => {
      const warnings = screen.getAllByText(/CANNOT DISPATCH: FOOD FAILED FSSAI HYGIENE INSPECTION \(SPOILED\)/i)
      expect(warnings.length).toBeGreaterThanOrEqual(1)
    })

    // Verify rejection reasons and quality score
    expect(screen.getByText(/SPOILED & GONE/i)).toBeInTheDocument()
    expect(screen.getByText(/Bacterial proliferation risk detected/i)).toBeInTheDocument()

    // Verify submission is blocked / disabled
    const submitBtn = screen.getByRole('button', { name: /Transmit Emergency Salvage (Dispatch|Telegram)/i })
    expect(submitBtn).toBeDisabled()
  })

  it('auto-fills Form 68-A and shows green verification stamp when food passes inspection', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText(/Dispatch Surplus/i))
    await waitFor(() => {
      expect(screen.getByText(/FORM 68-A • EMERGENCY FOOD SALVAGE DECLARATION/i)).toBeInTheDocument()
    })

    // Click "Biryani (Fresh)" sample button
    const freshBtn = screen.getByText(/Biryani \(Fresh\)/i)
    fireEvent.click(freshBtn)

    // Verify green verification stamp appears
    await waitFor(() => {
      expect(screen.getByText(/VERIFIED SAFE • GRADE_A_PRIME/i)).toBeInTheDocument()
      expect(screen.getByText(/SAFE FOR DISPATCH/i)).toBeInTheDocument()
    })

    // Verify submit button is enabled
    const submitBtn = screen.getByRole('button', { name: /Transmit Emergency Salvage (Dispatch|Telegram)/i })
    expect(submitBtn).not.toBeDisabled()
  })

  it('displays verdict FRESH & GOOD vs SPOILED & GONE in MirageModal spectrograph', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    // Open MirageModal from Header "Mirage VLM (22MB)"
    const inspectNavBtn = screen.getByText(/Mirage VLM/i)
    fireEvent.click(inspectNavBtn)

    await waitFor(() => {
      expect(screen.getByText(/CIVIC FOOD HYGIENE SPECTROGRAPH • MIRAGE VLM/i)).toBeInTheDocument()
    })

    // Test fresh biryani: should show FRESH & GOOD verdict
    const biryaniBtn = screen.getByRole('button', { name: /Inspect Dum Biryani sample/i })
    fireEvent.click(biryaniBtn)
    await waitFor(() => {
      expect(screen.getByText(/VERDICT: FRESH & GOOD • SAFE FOR DISTRIBUTION/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/Auto-Fill Form 68-A With This Data/i)).toBeInTheDocument()

    // Test spoiled curry: should show SPOILED & GONE verdict and block auto-fill
    const curryBtn = screen.getByRole('button', { name: /Inspect Spoiled Curry sample/i })
    fireEvent.click(curryBtn)
    await waitFor(() => {
      expect(screen.getByText(/VERDICT: SPOILED & GONE • REJECTED/i)).toBeInTheDocument()
    })
    expect(screen.queryByText(/Auto-Fill Form 68-A With This Data/i)).not.toBeInTheDocument()
    expect(screen.getByText(/CANNOT DISPATCH: FOOD FAILED FSSAI HYGIENE INSPECTION \(SPOILED\)/i)).toBeInTheDocument()
  })

  it('transfers verified safe inspection result and shows green stamp in Form 68-A when applying from MirageModal', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    // Open MirageModal
    const inspectNavBtn = screen.getByText(/Mirage VLM/i)
    fireEvent.click(inspectNavBtn)

    await waitFor(() => {
      expect(screen.getByText(/CIVIC FOOD HYGIENE SPECTROGRAPH • MIRAGE VLM/i)).toBeInTheDocument()
    })

    // Select Fresh Biryani
    const biryaniBtn = screen.getByRole('button', { name: /Inspect Dum Biryani sample/i })
    fireEvent.click(biryaniBtn)

    await waitFor(() => {
      expect(screen.getByText(/VERDICT: FRESH & GOOD • SAFE FOR DISTRIBUTION/i)).toBeInTheDocument()
    })

    // Click Auto-Fill Form 68-A With This Data
    const applyBtn = screen.getByText(/Auto-Fill Form 68-A With This Data/i)
    fireEvent.click(applyBtn)

    // Form 68-A should open and display green verification stamp
    await waitFor(() => {
      expect(screen.getByText(/FORM 68-A • EMERGENCY FOOD SALVAGE DECLARATION/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/VERIFIED SAFE/i)).toBeInTheDocument()
    expect(screen.getByText(/SAFE FOR DISPATCH/i)).toBeInTheDocument()
    const submitBtn = screen.getByRole('button', { name: /Transmit Emergency Salvage (Dispatch|Telegram)/i })
    expect(submitBtn).not.toBeDisabled()
  })

  it('renders opaque elevated surface with overflow-hidden and high-tech vision bounding boxes in MirageModal', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    // Open MirageModal
    const inspectNavBtn = screen.getByText(/Mirage VLM/i)
    fireEvent.click(inspectNavBtn)

    await waitFor(() => {
      expect(screen.getByText(/CIVIC FOOD HYGIENE SPECTROGRAPH • MIRAGE VLM/i)).toBeInTheDocument()
    })

    // Backdrop overlay assertions
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('bg-black/65')
    expect(dialog.className).toContain('backdrop-blur-sm')

    // Elevated modal card surface assertions
    const modalContainer = dialog.querySelector('.bg-white')
    expect(modalContainer).not.toBeNull()
    expect(modalContainer?.className).toContain('rounded-2xl')
    expect(modalContainer?.className).toContain('shadow-2xl')
    expect(modalContainer?.className).toContain('border-stone-200')
    expect(modalContainer?.className).toContain('overflow-hidden')

    // Bounding box labels on fresh inspection
    const biryaniBtn = screen.getByRole('button', { name: /Inspect Dum Biryani sample/i })
    fireEvent.click(biryaniBtn)
    await waitFor(() => {
      expect(screen.getByText(/FOOD_CONTAINER: STAINLESS URN 99.4%/i)).toBeInTheDocument()
      expect(screen.getByText(/STEAM\/THERMAL: >65°C/i)).toBeInTheDocument()
    })

    // OCR text container
    expect(screen.getByText(/MIRAGE OCR TEXT EXTRACTED FROM IMAGE:/i)).toBeInTheDocument()

    // 4-cell Spoilage Matrix
    expect(screen.getByText(/REAL-TIME SPOILAGE MATRIX BREAKDOWN:/i)).toBeInTheDocument()
    expect(screen.getByText(/MICROBIAL RISK:/i)).toBeInTheDocument()
    expect(screen.getByText(/CORE THERMAL:/i)).toBeInTheDocument()

    // Switch to spoiled sample: check spoilage bounding box
    const curryBtn = screen.getByRole('button', { name: /Inspect Spoiled Curry sample/i })
    fireEvent.click(curryBtn)
    await waitFor(() => {
      expect(screen.getByText(/MOLD\/DISCOLORATION: RISK/i)).toBeInTheDocument()
      expect(screen.getByText(/BACTERIAL_PROLIFERATION: CRITICAL/i)).toBeInTheDocument()
      expect(screen.getByText(/Severe decomposition risk detected/i)).toBeInTheDocument()
      expect(screen.getByText(/Bacterial proliferation risk detected/i)).toBeInTheDocument()
    })
  })
})
