// @vitest-environment node
// Logique pure (ref + setTimeout), aucun DOM à monter — voir README, section Tests.
import { describe, it, expect, vi, afterEach } from 'vitest'
import useNavigationLoading from '../../src/use/useNavigationLoading.js'

describe('useNavigationLoading', () => {
  afterEach(() => {
    const { stopNavigationLoading } = useNavigationLoading()
    stopNavigationLoading()
    vi.useRealTimers()
  })

  it("n'affiche pas l'overlay avant le délai anti-flash (150ms)", () => {
    vi.useFakeTimers()
    const { isNavigationLoading, startNavigationLoading } = useNavigationLoading()
    startNavigationLoading('office')
    expect(isNavigationLoading.value).toBe(false)
    vi.advanceTimersByTime(149)
    expect(isNavigationLoading.value).toBe(false)
  })

  it("affiche l'overlay une fois le délai anti-flash dépassé", () => {
    vi.useFakeTimers()
    const { isNavigationLoading, startNavigationLoading } = useNavigationLoading()
    startNavigationLoading('office')
    vi.advanceTimersByTime(150)
    expect(isNavigationLoading.value).toBe(true)
  })

  it('stopNavigationLoading annule un affichage en attente (navigation déjà rapide)', () => {
    vi.useFakeTimers()
    const { isNavigationLoading, startNavigationLoading, stopNavigationLoading } = useNavigationLoading()
    startNavigationLoading('office')
    vi.advanceTimersByTime(100)
    stopNavigationLoading()
    vi.advanceTimersByTime(100)
    expect(isNavigationLoading.value).toBe(false)
  })

  it('mémorise le contexte passé à startNavigationLoading', () => {
    const { navigationContext, startNavigationLoading } = useNavigationLoading()
    startNavigationLoading('chest')
    expect(navigationContext.value).toBe('chest')
    startNavigationLoading('office')
    expect(navigationContext.value).toBe('office')
  })
})
