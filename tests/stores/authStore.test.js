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

const mockUser = {
  id: 1,
  email: 'test@test.com',
  characters: [{ id: 1, pseudo: 'Artifice', city_id: 5, is_validated: false }],
}

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
    it("n'authentifie pas l'utilisateur — le compte doit d'abord être vérifié par email", async () => {
      http.post.mockResolvedValueOnce({ data: { success: true, message: 'Compte créé.' } })

      const result = await store.register({
        email: 'test@test.com', password: 'pass1234', confirmation: 'pass1234'
      })

      expect(result.success).toBe(true)
      expect(http.post).toHaveBeenCalledWith('auth/register', {
        email: 'test@test.com', password: 'pass1234', confirmation: 'pass1234'
      })
      expect(store.token).toBeNull()
      expect(store.isLoggedIn).toBe(false)
    })

    it('propage l\'erreur en cas d\'échec', async () => {
      http.post.mockRejectedValueOnce({ response: { data: { message: 'Email déjà utilisé.' } } })

      await expect(store.register({
        email: 'x@x.com', password: 'pass1234', confirmation: 'pass1234'
      })).rejects.toBeDefined()
    })
  })

  describe('login()', () => {
    it('stocke token et user (avec ses personnages) après connexion réussie', async () => {
      http.post.mockResolvedValueOnce({ data: { success: true, token: 'tok456', user: mockUser } })

      const result = await store.login({ email: 'test@test.com', password: 'pass1234' })

      expect(result.success).toBe(true)
      expect(store.token).toBe('tok456')
      expect(store.user).toEqual(mockUser)
      expect(store.isLoggedIn).toBe(true)
      expect(http.post).toHaveBeenCalledWith('auth/login', { email: 'test@test.com', password: 'pass1234' })
    })

    it('propage l\'erreur en cas de mauvais identifiants', async () => {
      http.post.mockRejectedValueOnce({ response: { data: { message: 'Identifiants incorrects.' } } })

      await expect(store.login({ email: 'test@test.com', password: 'mauvais' })).rejects.toBeDefined()
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

  describe('createCharacter()', () => {
    it('crée un personnage et resynchronise la liste via checkAuth', async () => {
      store.setToken('tok123')
      http.post.mockResolvedValueOnce({ data: { success: true, character: { id: 2, pseudo: 'Buldo', city_id: 3, is_validated: false } } })
      http.get.mockResolvedValueOnce({ data: { success: true, user: { ...mockUser, characters: [...mockUser.characters, { id: 2, pseudo: 'Buldo' }] } } })

      await store.createCharacter({ pseudo: 'Buldo', city_id: 3 })

      expect(http.post).toHaveBeenCalledWith('characters', { pseudo: 'Buldo', city_id: 3 }, expect.anything())
      expect(store.getCharacters).toHaveLength(2)
    })
  })

  describe('Getters', () => {
    it('getCharacters retourne la liste des personnages du user', () => {
      store.setUser(mockUser)
      expect(store.getCharacters).toEqual(mockUser.characters)
    })

    it('getCharacters retourne un tableau vide si pas de user', () => {
      expect(store.getCharacters).toEqual([])
    })

    it('hasCharacters reflète si le compte a au moins un personnage', () => {
      expect(store.hasCharacters).toBe(false)
      store.setUser(mockUser)
      expect(store.hasCharacters).toBe(true)
    })
  })
})
