import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { redirectToHomeIfLoggedIn } from '../../src/router/index.js'
import { useAuthStore } from '../../src/stores/authStore'

// Mock api.js (importé par authStore.js)
vi.mock('../../src/api.js', () => ({
  http: {
    post: vi.fn(),
    get: vi.fn(),
  }
}))

vi.mock('notivue', () => ({
  push: { error: vi.fn() }
}))

import { push } from 'notivue'
import { http } from '../../src/api.js'

// Mock localStorage (authStore.js le lit/écrit directement à l'initialisation)
const localStorageMock = (() => {
  let store = {}
  return {
    getItem:    vi.fn(key => store[key] ?? null),
    setItem:    vi.fn((key, value) => { store[key] = value.toString() }),
    removeItem: vi.fn(key => { delete store[key] }),
    clear:      vi.fn(() => { store = {} }),
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('redirectToHomeIfLoggedIn', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it("laisse passer vers login/register si l'utilisateur n'est pas connecté", async () => {
    const next = vi.fn()

    await redirectToHomeIfLoggedIn(null, null, next)

    expect(push.error).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith()
  })

  it('redirige vers home si le token est valide côté serveur (déjà connecté)', async () => {
    useAuthStore().setToken('tok123')
    http.get.mockResolvedValueOnce({ data: { user: { id: 1, email: 'artifice@test.com', characters: [] } } })
    const next = vi.fn()

    await redirectToHomeIfLoggedIn(null, null, next)

    expect(push.error).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith({ name: 'home' })
  })

  it('laisse passer vers login/register si le token local est invalide côté serveur', async () => {
    useAuthStore().setToken('tok-perime')
    http.get.mockRejectedValueOnce({ response: { status: 401 } })
    const next = vi.fn()

    await redirectToHomeIfLoggedIn(null, null, next)

    expect(push.error).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith()
  })
})
