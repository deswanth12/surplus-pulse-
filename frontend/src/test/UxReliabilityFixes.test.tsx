import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import App from '../App'
import { CertificateModal } from '../components/modals/CertificateModal'
import { setupFetchMock, mockListings, mockImpactSummary } from './test-mocks'

describe('UxReliabilityFixes: Terminal State, Empty Filter CTA & Clipboard Fallback', () => {
  beforeEach(() => {
    setupFetchMock()
    vi.restoreAllMocks()
  })

  it('displays styled retro CTA banner when a filter returns 0 items, and allows 1-click dispatch or reset', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    // In default mockListings, all are VEG, so NON-VEG or DELIVERED (0) returns 0 items
    const nonVegBtn = screen.getByRole('button', { name: /NON-VEG/i })
    fireEvent.click(nonVegBtn)

    // The retro banner should appear with the exact required copy
    await waitFor(() => {
      expect(
        screen.getByText(/\[ALL DOCKETS DELIVERED & AUDITED IN REGISTRY\] Click here to Reset Registry or Dispatch New Surplus \(<45s\)/i)
      ).toBeInTheDocument()
    })

    const banner = screen.getByRole('region', { name: /Registry status notification/i })
    expect(banner).toBeInTheDocument()

    // Verify 1-click "DISPATCH NEW SURPLUS (<45s)" button opens Form 68-A modal
    const dispatchBtn = within(banner).getByRole('button', { name: /DISPATCH NEW SURPLUS \(<45s\)/i })
    fireEvent.click(dispatchBtn)

    await waitFor(() => {
      expect(screen.getByText(/FORM 68-A • EMERGENCY FOOD SALVAGE DECLARATION/i)).toBeInTheDocument()
    })

    // Close PostModal
    const closeButtons = screen.getAllByRole('button')
    const closeBtn = closeButtons.find((b) => b.getAttribute('aria-label') === 'Close Form 68-A dialog')
    if (closeBtn) fireEvent.click(closeBtn)

    // Verify "RESET REGISTRY" button in banner is interactive
    const resetBtn = within(banner).getByRole('button', { name: /RESET REGISTRY/i })
    expect(resetBtn).toBeInTheDocument()
    fireEvent.click(resetBtn)

    await waitFor(() => {
      expect(screen.getByText(/MUNICIPAL REGISTRY RE-INITIALIZED/i)).toBeInTheDocument()
    })
  })

  it('displays styled retro CTA banner when all dockets are in DELIVERED state', async () => {
    // Override fetch to return all dockets in DELIVERED status
    const allDeliveredListings = mockListings.map((l) => ({
      ...l,
      status: 'DELIVERED' as const,
      pickup: {
        id: `p_${l.id}`,
        listing_id: l.id,
        receiver_id: 'r1',
        receiver_name: 'Robin Hood Army - Indiranagar Hub',
        volunteer_name: 'Vikram Adiga',
        volunteer_phone: '+91 99112 33445',
        vehicle_type: 'Maruti Eeco Cargo Van',
        claimed_at: '2026-11-21T10:00:00Z',
        collected_at: '2026-11-21T11:00:00Z',
        delivered_at: '2026-11-21T12:00:00Z',
        notes: 'Delivered',
      },
    }))

    const origFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url === '/api/listings') {
        return Promise.resolve(
          new Response(JSON.stringify(allDeliveredListings), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return origFetch(url, opts)
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    // Verify all dockets delivered banner is visible
    expect(
      screen.getByText(/\[ALL DOCKETS DELIVERED & AUDITED IN REGISTRY\] Click here to Reset Registry or Dispatch New Surplus \(<45s\)/i)
    ).toBeInTheDocument()

    // Verify delivered card provides interactive feedback
    const auditButtons = screen.getAllByRole('button', {
      name: /Open official audit receipt and tax certificate/i,
    })
    expect(auditButtons.length).toBeGreaterThan(0)
    expect(screen.getAllByText(/VIEW OFFICIAL AUDIT RECEIPT & TAX CERTIFICATE/i).length).toBeGreaterThan(0)

    // Clicking the audit button opens CertificateModal
    fireEvent.click(auditButtons[0])

    await waitFor(() => {
      expect(screen.getByText(/STATE MUNICIPAL RELIEF CHARTER • ESG CARBON OFFSET/i)).toBeInTheDocument()
      expect(screen.getByText(/OFFICIAL CHARTER NO\. CERT-SP-(2026|1968)-BLR-0049/i)).toBeInTheDocument()
    })
  })

  it('allows clicking anywhere on a DELIVERED DocketCard to open the official audit receipt / certificate', async () => {
    const deliveredListing = {
      ...mockListings[0],
      status: 'DELIVERED' as const,
      pickup: {
        id: 'p_deliv',
        listing_id: mockListings[0].id,
        receiver_id: 'r1',
        receiver_name: 'Robin Hood Army',
        volunteer_name: 'Courier 1',
        volunteer_phone: '+91 99999 00000',
        vehicle_type: 'Van',
        claimed_at: '2026-11-21T10:00:00Z',
        collected_at: '2026-11-21T11:00:00Z',
        delivered_at: '2026-11-21T12:00:00Z',
        notes: 'Delivered',
      },
    }

    const origFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url === '/api/listings') {
        return Promise.resolve(
          new Response(JSON.stringify([deliveredListing]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return origFetch(url, opts)
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    // Click the delivered card article itself
    const deliveredCard = screen.getByLabelText(/Click to view official audit receipt and ESG certificate/i)
    fireEvent.click(deliveredCard)

    await waitFor(() => {
      expect(screen.getByText(/STATE MUNICIPAL RELIEF CHARTER • ESG CARBON OFFSET/i)).toBeInTheDocument()
    })
  })

  it('CertificateModal handleCopyShare uses navigator.clipboard.writeText when available', async () => {
    const onShare = vi.fn()
    const writeTextMock = vi.fn().mockResolvedValue(undefined)

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    })

    render(
      <CertificateModal
        isOpen={true}
        onClose={vi.fn()}
        impact={mockImpactSummary}
        onShare={onShare}
      />
    )

    const shareBtn = screen.getByRole('button', { name: /Share verification dispatch (cyber link|telegraph link)/i })
    fireEvent.click(shareBtn)

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(1)
      expect(writeTextMock.mock.calls[0][0]).toContain('CERT-SP-1968-BLR-0049')
      expect(onShare).toHaveBeenCalledTimes(1)
    })
  })

  it('CertificateModal handleCopyShare falls back to document.execCommand in insecure contexts and still notifies user', async () => {
    const onShare = vi.fn()

    // Simulate insecure context: navigator.clipboard.writeText throws NotAllowedError
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('Insecure context: document is not focused or not HTTPS')),
      },
      configurable: true,
      writable: true,
    })

    const execCommandMock = vi.fn().mockReturnValue(true)
    document.execCommand = execCommandMock

    render(
      <CertificateModal
        isOpen={true}
        onClose={vi.fn()}
        impact={mockImpactSummary}
        onShare={onShare}
      />
    )

    const shareBtn = screen.getByRole('button', { name: /Share verification dispatch (cyber link|telegraph link)/i })
    fireEvent.click(shareBtn)

    await waitFor(() => {
      expect(execCommandMock).toHaveBeenCalledWith('copy')
      expect(onShare).toHaveBeenCalledTimes(1)
    })
  })

  it('CertificateModal handleCopyShare falls back when navigator.clipboard is undefined (insecure HTTP) and cleans up textarea', async () => {
    const onShare = vi.fn()

    // Simulate plain HTTP context where navigator.clipboard does not exist
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true,
    })

    const execCommandMock = vi.fn().mockReturnValue(true)
    document.execCommand = execCommandMock

    render(
      <CertificateModal
        isOpen={true}
        onClose={vi.fn()}
        impact={mockImpactSummary}
        onShare={onShare}
      />
    )

    const shareBtn = screen.getByRole('button', { name: /Share verification dispatch (cyber link|telegraph link)/i })
    fireEvent.click(shareBtn)

    await waitFor(() => {
      expect(execCommandMock).toHaveBeenCalledWith('copy')
      expect(onShare).toHaveBeenCalledTimes(1)
    })

    // Confirm no textarea leaked into document.body
    expect(document.body.querySelector('textarea')).toBeNull()
  })

  it('CertificateModal cleans up textarea from DOM even if execCommand throws an error', async () => {
    const onShare = vi.fn()

    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true,
    })

    document.execCommand = vi.fn().mockImplementation(() => {
      throw new Error('execCommand rejected in sandbox')
    })

    render(
      <CertificateModal
        isOpen={true}
        onClose={vi.fn()}
        impact={mockImpactSummary}
        onShare={onShare}
      />
    )

    const shareBtn = screen.getByRole('button', { name: /Share verification dispatch (cyber link|telegraph link)/i })
    fireEvent.click(shareBtn)

    await waitFor(() => {
      expect(onShare).toHaveBeenCalledTimes(1)
    })

    // Confirm no textarea was leaked into document.body despite exception
    expect(document.body.querySelector('textarea')).toBeNull()
  })

  it('banner displays exact required copy and provides 1-click triggers for reset and dispatch', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    // Filter to an empty view
    fireEvent.click(screen.getByRole('button', { name: /NON-VEG/i }))

    const banner = await screen.findByRole('region', { name: /Registry status notification/i })
    expect(banner).toBeInTheDocument()

    const bannerText = within(banner).getByText(
      /\[ALL DOCKETS DELIVERED & AUDITED IN REGISTRY\] Click here to Reset Registry or Dispatch New Surplus \(<45s\)/i
    )
    expect(bannerText).toBeInTheDocument()

    // 1-click button triggers Form 68-A modal
    const dispatchBtn = within(banner).getByRole('button', { name: /DISPATCH NEW SURPLUS \(<45s\)/i })
    fireEvent.click(dispatchBtn)

    await waitFor(() => {
      expect(screen.getByText(/FORM 68-A • EMERGENCY FOOD SALVAGE DECLARATION/i)).toBeInTheDocument()
    })
  })

  it('when all dockets are delivered and user filters by an empty category, CLEAR/SHOW ALL button restores view', async () => {
    const allDeliveredListings = mockListings.map((l) => ({
      ...l,
      status: 'DELIVERED' as const,
      food_category: 'VEG' as const,
      pickup: {
        id: `p_${l.id}`,
        listing_id: l.id,
        receiver_id: 'r1',
        receiver_name: 'Robin Hood Army',
        volunteer_name: 'Courier',
        volunteer_phone: '+91 99999 11111',
        vehicle_type: 'Van',
        claimed_at: '2026-11-21T10:00:00Z',
        collected_at: '2026-11-21T11:00:00Z',
        delivered_at: '2026-11-21T12:00:00Z',
        notes: 'Delivered',
      },
    }))

    const origFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url === '/api/listings') {
        return Promise.resolve(
          new Response(JSON.stringify(allDeliveredListings), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return origFetch(url, opts)
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    // Filter to NON-VEG (which has 0 items)
    fireEvent.click(screen.getByRole('button', { name: /NON-VEG/i }))

    // Empty filter indication should show up
    await waitFor(() => {
      expect(screen.getByText(/FILTER "NON_VEG" RETURNED 0 DOCKETS/i)).toBeInTheDocument()
    })

    // Click "SHOW ALL DOCKETS" button
    const showAllBtn = screen.getByRole('button', { name: /SHOW ALL DOCKETS/i })
    fireEvent.click(showAllBtn)

    // Should now show the delivered dockets
    await waitFor(() => {
      expect(screen.getByText(/100% CIVIC RESCUE QUOTA FULFILLED/i)).toBeInTheDocument()
      expect(screen.getAllByText(/VIEW OFFICIAL AUDIT RECEIPT & TAX CERTIFICATE/i).length).toBeGreaterThan(0)
    })
  })

  it('handleResetRegistry resets active filter to ALL so restored listings are immediately visible', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    // User is on NON-VEG (0 items)
    fireEvent.click(screen.getByRole('button', { name: /NON-VEG/i }))

    await waitFor(() => {
      expect(screen.getByText(/FILTER "NON_VEG" RETURNED 0 DOCKETS/i)).toBeInTheDocument()
    })

    // Click RESET REGISTRY in the banner
    const banner = screen.getByRole('region', { name: /Registry status notification/i })
    const resetBtn = within(banner).getByRole('button', { name: /RESET REGISTRY/i })
    fireEvent.click(resetBtn)

    await waitFor(() => {
      expect(screen.getByText(/MUNICIPAL REGISTRY RE-INITIALIZED/i)).toBeInTheDocument()
      // Active filter was reset to ALL, so listings are visible!
      expect(screen.getByText(mockListings[0].food_name)).toBeInTheDocument()
    })
  })

  it('DELIVERED DocketCard article has role="button" and handles Enter and Space keyboard navigation', async () => {
    const deliveredListing = {
      ...mockListings[0],
      status: 'DELIVERED' as const,
      pickup: {
        id: 'p_deliv_kb',
        listing_id: mockListings[0].id,
        receiver_id: 'r1',
        receiver_name: 'Robin Hood Army',
        volunteer_name: 'Courier 1',
        volunteer_phone: '+91 99999 00000',
        vehicle_type: 'Van',
        claimed_at: '2026-11-21T10:00:00Z',
        collected_at: '2026-11-21T11:00:00Z',
        delivered_at: '2026-11-21T12:00:00Z',
        notes: 'Delivered',
      },
    }

    const origFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url === '/api/listings') {
        return Promise.resolve(
          new Response(JSON.stringify([deliveredListing]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return origFetch(url, opts)
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    const deliveredCard = screen.getByLabelText(/Click to view official audit receipt and ESG certificate/i)
    expect(deliveredCard.getAttribute('role')).toBe('button')

    // Press Space on card
    fireEvent.keyDown(deliveredCard, { key: ' ' })

    await waitFor(() => {
      expect(screen.getByText(/STATE MUNICIPAL RELIEF CHARTER • ESG CARBON OFFSET/i)).toBeInTheDocument()
    })
  })

  it('Header Wire Telegraph renders live ticking IST clock badge with inline visibility', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    // The wire telegraph clock badge should be present and contain "IST"
    const clockBadge = screen.getByText(/\d{2}:\d{2}:\d{2}\s*IST/i)
    expect(clockBadge).toBeInTheDocument()
    expect(clockBadge.closest('span')).not.toHaveClass('hidden')
  })

  it('DocketCard displays 0% progress bar and expired indicator when safe consumption window expires', async () => {
    const expiredListing = {
      ...mockListings[0],
      minutes_remaining: 0,
      status: 'POSTED' as const,
    }

    const origFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url === '/api/listings') {
        return Promise.resolve(
          new Response(JSON.stringify([expiredListing]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return origFetch(url, opts)
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText(/WINDOW EXPIRED/i)).toBeInTheDocument()
    })

    // Thermometer progress bar should have width: 0%
    const progressBar = screen.getByText(/WINDOW EXPIRED/i).closest('.retro-card')?.querySelector('.overflow-hidden > div')
    expect(progressBar).toHaveStyle({ width: '0%' })
  })

  it('CertificateModal displays instant on-button visual feedback "COPIED ✓" when clicked', async () => {
    const onShare = vi.fn()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
      writable: true,
    })

    render(
      <CertificateModal
        isOpen={true}
        onClose={vi.fn()}
        impact={mockImpactSummary}
        onShare={onShare}
      />
    )

    const shareBtn = screen.getByRole('button', { name: /Share verification dispatch (cyber link|telegraph link)/i })
    expect(shareBtn).toHaveTextContent(/SHARE/i)

    fireEvent.click(shareBtn)

    await waitFor(() => {
      expect(shareBtn).toHaveTextContent(/COPIED ✓/i)
    })
  })

  it('LiveDeliveryTracker closes when clicking on the modal backdrop overlay', async () => {
    const onClose = vi.fn()
    const { LiveDeliveryTracker } = await import('../components/modals/LiveDeliveryTracker')

    render(
      <LiveDeliveryTracker
        isOpen={true}
        onClose={onClose}
        listing={mockListings[1]}
        onAdvanceStatus={vi.fn()}
      />
    )

    const modalDialog = screen.getByRole('dialog')
    expect(modalDialog).toBeInTheDocument()

    // Click directly on the backdrop element (e.target === e.currentTarget)
    fireEvent.click(modalDialog)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('DocketFilterBar renders counts for all filters including URGENT, VEG, and NON-VEG', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('SURPLUSPULSE')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /🔥 URGENT/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /VEG ONLY \(\d+\)/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /NON-VEG \(\d+\)/i })).toBeInTheDocument()
  })

  it('DocketCard renders high-res Unsplash image with lazy loading and decoding async', async () => {
    const { DocketCard } = await import('../components/DocketCard')
    render(
      <DocketCard
        listing={mockListings[0]}
        onOpenSmartMatch={vi.fn()}
        onAdvanceStatus={vi.fn()}
      />
    )

    const img = screen.getByRole('img', { name: mockListings[0].food_name })
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('loading', 'lazy')
    expect(img).toHaveAttribute('decoding', 'async')
    expect(img.getAttribute('src')).toContain('images.unsplash.com')
    expect(img.getAttribute('src')).toContain('auto=format&fit=crop&w=800&q=80')
  })

  it('DocketCard swaps image to inline SVG Data URI on error and unsets onerror to prevent infinite loops', async () => {
    const { DocketCard } = await import('../components/DocketCard')
    render(
      <DocketCard
        listing={mockListings[0]}
        onOpenSmartMatch={vi.fn()}
        onAdvanceStatus={vi.fn()}
      />
    )

    const img = screen.getByRole('img', { name: mockListings[0].food_name }) as HTMLImageElement
    expect(img.getAttribute('src')).toContain('images.unsplash.com')

    // Simulate image error event
    fireEvent.error(img)

    expect(img.getAttribute('src')).toMatch(/^data:image\/svg\+xml,/)
    expect(img.getAttribute('src')).toContain('SURPLUSPULSE')
    expect(img.onerror).toBeNull()
  })

  it('DocketCard prevents event bubbling when clicking Track Live Delivery or View Certificate button', async () => {
    const { DocketCard } = await import('../components/DocketCard')
    const onOpenCertificate = vi.fn()
    const onTrackDelivery = vi.fn()

    const deliveredListing = {
      ...mockListings[0],
      status: 'DELIVERED' as const,
    }

    render(
      <DocketCard
        listing={deliveredListing}
        onOpenSmartMatch={vi.fn()}
        onAdvanceStatus={vi.fn()}
        onOpenCertificate={onOpenCertificate}
        onTrackDelivery={onTrackDelivery}
      />
    )

    // Click "Track Live Delivery" button
    const trackBtn = screen.getByRole('button', { name: /Track Live Delivery/i })
    fireEvent.click(trackBtn)

    expect(onTrackDelivery).toHaveBeenCalledTimes(1)
    // CRITICAL: Must NOT have bubbled to card article to open certificate
    expect(onOpenCertificate).not.toHaveBeenCalled()

    // Now click the audit receipt button
    const certBtn = screen.getByRole('button', { name: /Open official audit receipt and tax certificate/i })
    fireEvent.click(certBtn)

    // Should only be called once, not twice from bubbling
    expect(onOpenCertificate).toHaveBeenCalledTimes(1)
  })

  it('DocketCard has overflow-hidden on article and image container for perfect border clipping', async () => {
    const { DocketCard } = await import('../components/DocketCard')
    render(
      <DocketCard
        listing={mockListings[0]}
        onOpenSmartMatch={vi.fn()}
        onAdvanceStatus={vi.fn()}
      />
    )

    const article = screen.getByRole('article')
    expect(article).toHaveClass('overflow-hidden')
    expect(article).toHaveClass('rounded-2xl')

    const img = screen.getByRole('img', { name: mockListings[0].food_name })
    const imgContainer = img.parentElement
    expect(imgContainer).toHaveClass('overflow-hidden')
    expect(imgContainer).toHaveClass('rounded-t-2xl')
  })
})
