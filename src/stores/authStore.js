import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { http } from '@/api.js'

export const useAuthStore = defineStore('auth', () => {
  // State
  const user  = ref(JSON.parse(localStorage.getItem('auth_user') || 'null'))
  const token = ref(localStorage.getItem('auth_token') || null)

  // Getters
  const isLoggedIn  = computed(() => !!token.value)
  const getUser     = computed(() => user.value)
  const getToken    = computed(() => token.value)
  const getCharacters = computed(() => user.value?.characters ?? [])
  const hasCharacters = computed(() => getCharacters.value.length > 0)

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
