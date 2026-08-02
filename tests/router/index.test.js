import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../../src/stores/authStore'
import router from '../../src/router/index.js'

// Mock api.js pour éviter tout appel réseau (checkAuth) pendant les tests de routing
vi.mock('../../src/api.js', () => ({
  http: {
    post: vi.fn(),
    get:  vi.fn(),
  }
}))

// Mock localStorage (repris du pattern authStore.test.js)
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

describe('router — guard redirectToHomeIfNotLoggedIn', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    // Pinia active fraîche : useAuthStore() dans le guard résout un store vierge
    setActivePinia(createPinia())
  })

  it('redirige vers /login si utilisateur non connecté accède à /app/profil', async () => {
    await router.push('/app/profil')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('login')
  })

  it('autorise l\'accès à /app/profil si utilisateur connecté', async () => {
    useAuthStore().setToken('tok123')

    await router.push('/app/profil')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('profil')
  })
})
