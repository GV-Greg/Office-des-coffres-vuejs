import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../../src/stores/authStore'

// Mock api.js — interceptors/request inclus pour pouvoir tester l'intercepteur 401 enregistré
// par authStore.js (voir describe("intercepteur 401") plus bas).
vi.mock('../../src/api.js', () => ({
  http: {
    post: vi.fn(),
    get:  vi.fn(),
    request: vi.fn(),
    interceptors: {
      response: { use: vi.fn() },
    },
  }
}))

import { http } from '../../src/api.js'

// Mock localStorage / sessionStorage
const makeStorageMock = () => {
  let store = {}
  return {
    getItem:    vi.fn(key => store[key] ?? null),
    setItem:    vi.fn((key, value) => { store[key] = value.toString() }),
    removeItem: vi.fn(key => { delete store[key] }),
    clear:      vi.fn(() => { store = {} }),
  }
}
const localStorageMock = makeStorageMock()
const sessionStorageMock = makeStorageMock()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock })

const mockUser = {
  id: 1,
  email: 'test@test.com',
  characters: [{ id: 1, pseudo: 'Artifice', city_id: 5, is_validated: false }],
}

describe('Auth Store', () => {
  let store

  beforeEach(() => {
    localStorageMock.clear()
    sessionStorageMock.clear()
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
    it('stocke access_token/refresh_token et user (avec ses personnages) après connexion réussie', async () => {
      http.post.mockResolvedValueOnce({
        data: { success: true, access_token: 'tok456', refresh_token: 'refresh456', expires_in: 900, user: mockUser },
      })

      const result = await store.login({ email: 'test@test.com', password: 'pass1234' })

      expect(result.success).toBe(true)
      expect(store.token).toBe('tok456')
      expect(store.user).toEqual(mockUser)
      expect(store.isLoggedIn).toBe(true)
      expect(http.post).toHaveBeenCalledWith('auth/login', {
        email: 'test@test.com', password: 'pass1234', remember_me: false,
      })
    })

    it('propage l\'erreur en cas de mauvais identifiants', async () => {
      http.post.mockRejectedValueOnce({ response: { data: { message: 'Identifiants incorrects.' } } })

      await expect(store.login({ email: 'test@test.com', password: 'mauvais' })).rejects.toBeDefined()
    })

    it('stocke le refresh_token en localStorage quand remember_me est coché', async () => {
      http.post.mockResolvedValueOnce({
        data: { success: true, access_token: 'tok456', refresh_token: 'refresh456', expires_in: 900, user: mockUser },
      })

      await store.login({ email: 'test@test.com', password: 'pass1234', remember_me: true })

      expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_refresh_token', 'refresh456')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_remember_me', 'true')
      expect(store.rememberMe).toBe(true)
    })

    it('stocke le refresh_token en sessionStorage quand remember_me n\'est pas coché', async () => {
      http.post.mockResolvedValueOnce({
        data: { success: true, access_token: 'tok456', refresh_token: 'refresh456', expires_in: 900, user: mockUser },
      })

      await store.login({ email: 'test@test.com', password: 'pass1234', remember_me: false })

      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('auth_refresh_token', 'refresh456')
      expect(localStorageMock.setItem).not.toHaveBeenCalledWith('auth_refresh_token', expect.anything())
      expect(store.rememberMe).toBe(false)
    })
  })

  describe('refreshAccessToken()', () => {
    it('remplace access_token et refresh_token en gardant le choix remember_me courant', async () => {
      http.post.mockResolvedValueOnce({
        data: { success: true, access_token: 'tok456', refresh_token: 'refresh456', expires_in: 900, user: mockUser },
      })
      await store.login({ email: 'test@test.com', password: 'pass1234', remember_me: true })

      http.post.mockResolvedValueOnce({
        data: { success: true, access_token: 'tok789', refresh_token: 'refresh789', expires_in: 900 },
      })
      const newAccessToken = await store.refreshAccessToken()

      expect(newAccessToken).toBe('tok789')
      expect(store.token).toBe('tok789')
      expect(http.post).toHaveBeenCalledWith('auth/refresh', { refresh_token: 'refresh456', remember_me: true })
      expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_refresh_token', 'refresh789')
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

    it('isAdmin reflète user.is_admin', () => {
      expect(store.isAdmin).toBe(false)
      store.setUser({ ...mockUser, is_admin: true })
      expect(store.isAdmin).toBe(true)
    })

    it('isAdmin vaut false si is_admin est absent de la réponse', () => {
      store.setUser(mockUser)
      expect(store.isAdmin).toBe(false)
    })
  })

  describe('Personnage actif', () => {
    const twoCharactersUser = {
      ...mockUser,
      characters: [
        { id: 1, pseudo: 'Artifice', city_id: 5, is_validated: false },
        { id: 2, pseudo: 'Buldo', city_id: 3, is_validated: true },
      ],
    }

    it('est null si le compte n\'a aucun personnage', () => {
      expect(store.activeCharacter).toBeNull()
    })

    it('se rabat sur le premier personnage tant qu\'aucun n\'est explicitement choisi', () => {
      store.setUser(twoCharactersUser)
      expect(store.activeCharacter.id).toBe(1)
    })

    it('setActiveCharacter change le personnage actif', () => {
      store.setUser(twoCharactersUser)
      store.setActiveCharacter(2)
      expect(store.activeCharacter.id).toBe(2)
    })

    it('se rabat sur le premier personnage si la sélection ne correspond plus à un personnage existant', () => {
      store.setUser(twoCharactersUser)
      store.setActiveCharacter(999)
      expect(store.activeCharacter.id).toBe(1)
    })

    it('logout() réinitialise la sélection du personnage actif', async () => {
      store.setUser(twoCharactersUser)
      store.setToken('tok789')
      store.setActiveCharacter(2)
      http.post.mockResolvedValueOnce({ data: { success: true } })

      await store.logout()
      store.setUser(twoCharactersUser)

      expect(store.activeCharacter.id).toBe(1)
    })
  })

  describe('intercepteur 401 (mutex sur le refresh)', () => {
    it('un seul appel à auth/refresh même si deux 401 arrivent en parallèle', async () => {
      http.post.mockResolvedValueOnce({
        data: { success: true, access_token: 'tok456', refresh_token: 'refresh456', expires_in: 900, user: mockUser },
      })
      await store.login({ email: 'test@test.com', password: 'pass1234' })

      // Capture le handler d'erreur enregistré par authStore.js à la création du store.
      const onRejected = http.interceptors.response.use.mock.calls[0][1]

      http.post.mockResolvedValueOnce({
        data: { success: true, access_token: 'tokNew', refresh_token: 'refreshNew', expires_in: 900 },
      })
      http.request.mockResolvedValue({ data: {} })

      const error1 = { response: { status: 401 }, config: { url: 'characters', headers: {} } }
      const error2 = { response: { status: 401 }, config: { url: 'auth/me', headers: {} } }

      await Promise.all([onRejected(error1), onRejected(error2)])

      const refreshCalls = http.post.mock.calls.filter(call => call[0] === 'auth/refresh')
      expect(refreshCalls).toHaveLength(1)
      expect(store.token).toBe('tokNew')
      expect(http.request).toHaveBeenCalledTimes(2)
    })

    it('ne tente pas de refresh sur un 401 de auth/login (évite la boucle)', async () => {
      const onRejected = http.interceptors.response.use.mock.calls[0][1]
      const error = { response: { status: 401 }, config: { url: 'auth/login', headers: {} } }

      await expect(onRejected(error)).rejects.toBe(error)
      expect(http.post).not.toHaveBeenCalledWith('auth/refresh', expect.anything())
    })

    it('déconnecte et notifie si le refresh échoue', async () => {
      http.post.mockResolvedValueOnce({
        data: { success: true, access_token: 'tok456', refresh_token: 'refresh456', expires_in: 900, user: mockUser },
      })
      await store.login({ email: 'test@test.com', password: 'pass1234' })

      const onRejected = http.interceptors.response.use.mock.calls[0][1]
      http.post.mockRejectedValueOnce(new Error('refresh token révoqué'))

      const error = { response: { status: 401 }, config: { url: 'characters', headers: {} } }
      await expect(onRejected(error)).rejects.toBeDefined()

      expect(store.token).toBeNull()
      expect(store.isLoggedIn).toBe(false)
    })
  })
})
