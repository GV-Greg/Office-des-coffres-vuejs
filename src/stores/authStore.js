import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { http } from '@/api.js'
import { useCookieStore } from '@/stores/cookieStore'

export const useAuthStore = defineStore('auth', () => {
  const cookieStore = useCookieStore()

  // State
  const user  = ref(JSON.parse(localStorage.getItem('auth_user') || 'null'))
  const token = ref(localStorage.getItem('auth_token') || null)
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
    const response = await http.post('auth/login', {
      email:    credentials.email,
      password: credentials.password,
    })
    setToken(response.data.token)
    setUser(response.data.user)
    // À chaque connexion, le personnage actif repart du choix par défaut défini en Profil.
    activeCharacterId.value = defaultCharacterId.value
    return response.data
  }

  const logout = async () => {
    try {
      await http.post('auth/logout', {}, {
        headers: { Authorization: `Bearer ${token.value}` },
      })
    } finally {
      setToken(null)
      setUser(null)
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

  // Hydratation au démarrage
  if (token.value) {
    checkAuth()
  }

  return {
    user,
    token,
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
    createCharacter,
    updateCharacterCity,
    setToken,
    setUser,
  }
})
