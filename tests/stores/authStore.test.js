import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../../src/stores/authStore'

// Mock api.js
vi.mock('../../src/api.js', () => ({
  http: {
    post: vi.fn(),
    get:  vi.fn(),
  }
}))

import { http } from '../../src/api.js'

// Mock localStorage
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

const mockUser = { id: 1, email: 'test@test.com', pseudo: 'Artifice', is_validated: false }

describe('Auth Store', () => {
  let store

  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    setActivePinia(createPinia())
    store = useAuthStore()
  })

  describe('État initial', () => {
    it('token est null par défaut', () => {
      expect(store.token).toBeNull()
    })

    it('user est null par défaut', () => {
      expect(store.user).toBeNull()
    })

    it('isLoggedIn est false par défaut', () => {
      expect(store.isLoggedIn).toBe(false)
    })
  })

  describe('register()', () => {
    it('stocke token et user après inscription réussie', async () => {
      http.post.mockResolvedValueOnce({ data: { success: true, token: 'tok123', user: mockUser } })

      const result = await store.register({
        username: 'Artifice', email: 'test@test.com', password: 'pass1234', confirmation: 'pass1234'
      })

      expect(result.success).toBe(true)
      expect(store.token).toBe('tok123')
      expect(store.user).toEqual(mockUser)
      expect(store.isLoggedIn).toBe(true)
      expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_token', 'tok123')
    })

    it('propage l\'erreur en cas d\'échec', async () => {
      http.post.mockRejectedValueOnce({ response: { data: { message: 'Pseudo déjà pris.' } } })

      await expect(store.register({
        username: 'Pris', email: 'x@x.com', password: 'pass1234', confirmation: 'pass1234'
      })).rejects.toBeDefined()
    })
  })

  describe('login()', () => {
    it('stocke token et user après connexion réussie', async () => {
      http.post.mockResolvedValueOnce({ data: { success: true, token: 'tok456', user: mockUser } })

      const result = await store.login({ username: 'Artifice', password: 'pass1234' })

      expect(result.success).toBe(true)
      expect(store.token).toBe('tok456')
      expect(store.user).toEqual(mockUser)
      expect(store.isLoggedIn).toBe(true)
    })

    it('propage l\'erreur en cas de mauvais identifiants', async () => {
      http.post.mockRejectedValueOnce({ response: { data: { message: 'Identifiants incorrects.' } } })

      await expect(store.login({ username: 'Artifice', password: 'mauvais' })).rejects.toBeDefined()
    })
  })

  describe('logout()', () => {
    it('efface token et user après déconnexion', async () => {
      store.setToken('tok789')
      store.setUser(mockUser)
      http.post.mockResolvedValueOnce({ data: { success: true } })

      await store.logout()

      expect(store.token).toBeNull()
      expect(store.user).toBeNull()
      expect(store.isLoggedIn).toBe(false)
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token')
    })

    it('efface le state même si l\'API échoue', async () => {
      store.setToken('tok789')
      store.setUser(mockUser)
      http.post.mockRejectedValueOnce(new Error('Network error'))

      await expect(store.logout()).rejects.toThrow('Network error')

      // Le finally garantit que le state local est nettoyé même en cas d'erreur API
      expect(store.token).toBeNull()
      expect(store.user).toBeNull()
    })
  })

  describe('checkAuth()', () => {
    it('retourne false si pas de token', async () => {
      const result = await store.checkAuth()
      expect(result).toBe(false)
    })

    it('hydrate user si token valide', async () => {
      store.setToken('tok_valide')
      http.get.mockResolvedValueOnce({ data: { success: true, user: mockUser } })

      const result = await store.checkAuth()

      expect(result).toBe(true)
      expect(store.user).toEqual(mockUser)
    })

    it('efface le token si la réponse est 401', async () => {
      store.setToken('tok_expire')
      http.get.mockRejectedValueOnce(new Error('Unauthorized'))

      const result = await store.checkAuth()

      expect(result).toBe(false)
      expect(store.token).toBeNull()
    })
  })

  describe('Getters', () => {
    it('getPseudo retourne le pseudo du user', () => {
      store.setUser(mockUser)
      expect(store.getPseudo).toBe('Artifice')
    })

    it('getPseudo retourne null si pas de user', () => {
      expect(store.getPseudo).toBeNull()
    })

    it('getIsValidated retourne false si compte non validé', () => {
      store.setUser(mockUser)
      expect(store.getIsValidated).toBe(false)
    })

    it('getIsValidated retourne true si compte validé', () => {
      store.setUser({ ...mockUser, is_validated: true })
      expect(store.getIsValidated).toBe(true)
    })
  })
})
