// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import { goBackOrWelcome } from '../../src/modules/goBackOrWelcome.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('goBackOrWelcome', () => {
  it('revient en arrière (router.back) si une page précédente existe dans l\'historique de l\'app', () => {
    vi.stubGlobal('window', { history: { state: { back: '/app/' } } })
    const router = { back: vi.fn(), push: vi.fn() }

    goBackOrWelcome(router)

    expect(router.back).toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
  })

  it("redirige vers welcome si aucune page précédente (arrivée directe sur l'URL)", () => {
    vi.stubGlobal('window', { history: { state: { back: null } } })
    const router = { back: vi.fn(), push: vi.fn() }

    goBackOrWelcome(router)

    expect(router.push).toHaveBeenCalledWith({ name: 'welcome' })
    expect(router.back).not.toHaveBeenCalled()
  })
})
