import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { redirectToHomeIfNotLoggedIn } from '../../src/router/index.js'
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

describe('redirectToHomeIfNotLoggedIn', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it("redirige vers login si l'utilisateur n'est pas connecté", () => {
    const next = vi.fn()

    redirectToHomeIfNotLoggedIn(null, null, next)

    expect(push.error).toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith({ name: 'login' })
  })

  it("laisse passer si l'utilisateur est connecté", () => {
    useAuthStore().setToken('tok123')
    const next = vi.fn()

    redirectToHomeIfNotLoggedIn(null, null, next)

    expect(push.error).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith()
  })
})
