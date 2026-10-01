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

  describe('trackApiCall', () => {
    it("ferme l'écran à la réponse quand l'envoi ne mène à aucune navigation", async () => {
      vi.useFakeTimers()
      const { isNavigationLoading, navigationContext, trackApiCall } = useNavigationLoading()
      let resolve
      const call = trackApiCall(new Promise(r => { resolve = r }))
      expect(navigationContext.value).toBe('api')
      vi.advanceTimersByTime(150)
      expect(isNavigationLoading.value).toBe(true)
      resolve('ok')
      await expect(call).resolves.toBe('ok')
      expect(isNavigationLoading.value).toBe(false)
    })

    it("ferme l'écran sur un échec et rend l'erreur à l'appelant", async () => {
      vi.useFakeTimers()
      const { isNavigationLoading, trackApiCall } = useNavigationLoading()
      let reject
      const call = trackApiCall(new Promise((_, r) => { reject = r }), { navigates: true })
      vi.advanceTimersByTime(150)
      reject(new Error('refus'))
      await expect(call).rejects.toThrow('refus')
      expect(isNavigationLoading.value).toBe(false)
    })

    it("navigates : garde l'écran et sa phrase jusqu'à la fin de la navigation qui suit", async () => {
      vi.useFakeTimers()
      const { isNavigationLoading, navigationContext, startNavigationLoading, stopNavigationLoading, trackApiCall } = useNavigationLoading()
      await trackApiCall(Promise.resolve(), { context: 'office', navigates: true })
      // beforeEach du routeur pour un module « Coffres X » : ne remplace ni la phrase ni le délai.
      startNavigationLoading('chest')
      expect(navigationContext.value).toBe('office')
      vi.advanceTimersByTime(150)
      expect(isNavigationLoading.value).toBe(true)
      // afterEach : l'écran se ferme et le maintien est levé pour la navigation suivante.
      stopNavigationLoading()
      expect(isNavigationLoading.value).toBe(false)
      startNavigationLoading('chest')
      expect(navigationContext.value).toBe('chest')
    })
  })
})
