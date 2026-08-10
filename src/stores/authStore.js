import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { http } from '@/api.js'
import { useCookieStore } from '@/stores/cookieStore'
import i18n from '@/i18n/index'
import { push } from 'notivue'

const { t } = i18n.global

// Dédie une seule requête de refresh en vol à la fois : évite que plusieurs 401 simultanés
// (plusieurs appels API en parallèle après expiration de l'access token) ne déclenchent chacun
// leur propre appel à auth/refresh, ce qui ferait tourner Passport (rotation du refresh token à
// chaque appel) et invaliderait les tentatives concurrentes. Au niveau du module, pas du store :
// un seul intercepteur est enregistré (voir plus bas), donc une seule promesse à partager.
let refreshPromise = null

export const useAuthStore = defineStore('auth', () => {
  const cookieStore = useCookieStore()

  // State
  // auth_user/auth_token (localStorage) et auth_refresh_token/auth_remember_me
  // (localStorage si "Rester connecté", sessionStorage sinon) : strictement nécessaire au
  // service demandé (rester connecté), exempté du consentement cookies — voir
  // admin/strategies/cookies.md §2/§4/#6. Le couple access+refresh token vient de Passport
  // (migration Sanctum → Passport du 09/08/2026, voir backend/docs/DECISIONS.md) : l'access
  // token est court (15 min), le refresh token long (30 j si "Rester connecté", 12h sinon) —
  // stockage choisi en cohérence (sessionStorage s'efface à la fermeture de l'onglet).
  // Whitelisté explicitement dans tests/enforcement/storage-usage.unit.test.js.
  const user  = ref(JSON.parse(localStorage.getItem('auth_user') || 'null'))
  const token = ref(localStorage.getItem('auth_token') || null)
  const initialRememberMe = localStorage.getItem('auth_remember_me') === 'true'
  const rememberMe   = ref(initialRememberMe)
  const refreshToken = ref(
    (initialRememberMe ? localStorage.getItem('auth_refresh_token') : sessionStorage.getItem('auth_refresh_token')) || null
  )
  // Personnage par défaut : choix persistant (Profil), utilisé pour initialiser le
  // personnage actif à chaque connexion.
  const defaultCharacterId = ref(cookieStore.getComfortData('default_character_id', null))
  // Personnage actif : contexte en cours (Douane, Économie privée...), modifiable librement
  // en session via le sélecteur de la barre de nav sans toucher au choix par défaut.
  const activeCharacterId = ref(defaultCharacterId.value)

  // Getters
  const isLoggedIn  = computed(() => !!token.value)
  const getUser     = computed(() => user.value)
  const getToken    = computed(() => token.value)
  const getCharacters = computed(() => user.value?.characters ?? [])
  const hasCharacters = computed(() => getCharacters.value.length > 0)
  const isAdmin = computed(() => user.value?.is_admin ?? false)
  // Se rabat sur le premier personnage si aucune sélection n'est mémorisée ou si elle ne
  // correspond plus à un personnage existant (ex. sélection faite sur un autre compte).
  const findCharacterOrFirst = (characterId) => {
    const characters = getCharacters.value
    if (!characters.length) return null
    return characters.find(c => c.id === characterId) ?? characters[0]
  }
  const activeCharacter  = computed(() => findCharacterOrFirst(activeCharacterId.value))
  const defaultCharacter = computed(() => findCharacterOrFirst(defaultCharacterId.value))

  // Persistance locale
  const setToken = (newToken) => {
    token.value = newToken
    if (newToken) {
      localStorage.setItem('auth_token', newToken)
    } else {
      localStorage.removeItem('auth_token')
    }
  }

  const setUser = (userData) => {
    user.value = userData
    if (userData) {
      localStorage.setItem('auth_user', JSON.stringify(userData))
    } else {
      localStorage.removeItem('auth_user')
    }
  }

  // localStorage si "Rester connecté" (persiste 30j), sessionStorage sinon (effacé à la
  // fermeture de l'onglet, cohérent avec l'expiration courte de 12h) — toujours nettoyer les
  // deux pour éviter qu'un refresh token périmé traîne dans l'autre storage.
  const setRefreshToken = (newRefreshToken, remember) => {
    localStorage.removeItem('auth_refresh_token')
    sessionStorage.removeItem('auth_refresh_token')

    refreshToken.value = newRefreshToken
    rememberMe.value = remember

    if (newRefreshToken) {
      const storage = remember ? localStorage : sessionStorage
      storage.setItem('auth_refresh_token', newRefreshToken)
      localStorage.setItem('auth_remember_me', remember ? 'true' : 'false')
    } else {
      localStorage.removeItem('auth_remember_me')
    }
  }

  // Point d'entrée commun à login() et refreshAccessToken() pour stocker le couple de tokens —
  // remember_me omis (refresh) reconduit le choix fait à la connexion.
  const setSession = ({ access_token, refresh_token, remember_me }) => {
    setToken(access_token)
    setRefreshToken(refresh_token, remember_me ?? rememberMe.value)
  }

  // Bascule en session en cours (sélecteur barre de nav) — ne modifie pas le choix "à la connexion".
  const setActiveCharacter = (characterId) => {
    activeCharacterId.value = characterId
  }

  // Choix persistant utilisé automatiquement à chaque connexion — uniquement depuis le Profil.
  const setDefaultCharacter = (characterId) => {
    defaultCharacterId.value = characterId
    cookieStore.setComfortData('default_character_id', characterId)
    activeCharacterId.value = characterId
  }

  // Actions
  const register = async (userData) => {
    const response = await http.post('auth/register', {
      email:        userData.email,
      password:     userData.password,
      confirmation: userData.confirmation,
    })
    return response.data
  }

  const resendVerification = async (email) => {
    const response = await http.post('auth/resend-verification', { email })
    return response.data
  }

  const login = async (credentials) => {
    const rememberMeChoice = !!credentials.remember_me
    const response = await http.post('auth/login', {
      email:        credentials.email,
      password:     credentials.password,
      remember_me:  rememberMeChoice,
    })
    setSession({ ...response.data, remember_me: rememberMeChoice })
    setUser(response.data.user)
    // Mémorise la préférence "Rester connecté" + l'email pour pré-remplir LoginView à la
    // prochaine visite (comfort data générique : persistance conditionnée au consentement
    // Préférences, dégradation gracieuse sinon — voir cookieStore.setComfortData). Ne
    // s'efface jamais à la déconnexion (logout() ne touche pas comfortData), uniquement au
    // retrait du consentement (_syncComfortPersistence).
    cookieStore.setComfortData('remember_me_preference', rememberMeChoice)
    cookieStore.setComfortData('last_login_email', credentials.email)
    // À chaque connexion, le personnage actif repart du choix par défaut défini en Profil.
    activeCharacterId.value = defaultCharacterId.value
    return response.data
  }

  const refreshAccessToken = async () => {
    const response = await http.post('auth/refresh', {
      refresh_token: refreshToken.value,
      remember_me:   rememberMe.value,
    })
    setSession(response.data)
    return response.data.access_token
  }

  const logout = async () => {
    try {
      await http.post('auth/logout', {}, {
        headers: { Authorization: `Bearer ${token.value}` },
      })
    } finally {
      setToken(null)
      setUser(null)
      setRefreshToken(null, false)
      activeCharacterId.value = defaultCharacterId.value
    }
  }

  const checkAuth = async () => {
    if (!token.value) return false

    try {
      const response = await http.get('auth/me', {
        headers: { Authorization: `Bearer ${token.value}` },
      })
      setUser(response.data.user)
      return true
    } catch {
      setToken(null)
      setUser(null)
      setRefreshToken(null, false)
      return false
    }
  }

  const createCharacter = async ({ pseudo, city_id }) => {
    const response = await http.post('characters', { pseudo, city_id }, {
      headers: { Authorization: `Bearer ${token.value}` },
    })
    await checkAuth() // resynchronise user.characters avec le nouveau personnage
    return response.data
  }

  const updateCharacterCity = async (characterId, city_id) => {
    const response = await http.patch(`characters/${characterId}`, { city_id }, {
      headers: { Authorization: `Bearer ${token.value}` },
    })
    await checkAuth() // resynchronise user.characters avec la nouvelle résidence
    return response.data
  }

  // Intercepteur 401 avec mutex : un access token expiré déclenche un unique appel à
  // auth/refresh même si plusieurs requêtes échouent en parallèle (voir refreshPromise,
  // partagée au niveau module). auth/login et auth/refresh sont exclus pour ne pas boucler —
  // un 401 sur ces deux routes est une vraie erreur d'identifiants/de session, pas un access
  // token à renouveler. Enregistré une seule fois : le corps de ce store ne s'exécute qu'à la
  // première création (store Pinia singleton), comme l'hydratation ci-dessous.
  // `http.interceptors` peut être absent dans les tests qui mockent `api.js` sans répliquer la
  // forme complète d'axios (mocks ciblés sur post/get) — rien à enregistrer dans ce cas.
  http.interceptors?.response?.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config
      const isAuthEndpoint = originalRequest?.url === 'auth/login' || originalRequest?.url === 'auth/refresh'

      if (error.response?.status !== 401 || isAuthEndpoint || !refreshToken.value || originalRequest._retried) {
        return Promise.reject(error)
      }

      originalRequest._retried = true

      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null })
        }
        const newAccessToken = await refreshPromise

        originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${newAccessToken}` }
        return http.request(originalRequest)
      } catch (refreshError) {
        setToken(null)
        setUser(null)
        setRefreshToken(null, false)
        push.error(t('Auth.Errors.SessionExpired'))
        return Promise.reject(refreshError)
      }
    }
  )

  // Hydratation au démarrage
  if (token.value) {
    checkAuth()
  }

  return {
    user,
    token,
    rememberMe,
    isLoggedIn,
    getUser,
    getToken,
    getCharacters,
    hasCharacters,
    isAdmin,
    activeCharacter,
    setActiveCharacter,
    defaultCharacter,
    setDefaultCharacter,
    login,
    register,
    resendVerification,
    logout,
    checkAuth,
    refreshAccessToken,
    createCharacter,
    updateCharacterCity,
    setToken,
    setUser,
  }
})
