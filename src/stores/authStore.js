import { defineStore } from 'pinia'
import axios from 'axios'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref(null)
  const token = ref(localStorage.getItem('token') || null)
  const isLoggedIn = ref(false)

  // Getters
  const getUser = computed(() => user.value)
  const getToken = computed(() => token.value)
  const getIsLoggedIn = computed(() => isLoggedIn.value)

  // Actions
  const setToken = (newToken) => {
    token.value = newToken
    if (newToken) {
      localStorage.setItem('token', newToken)
      isLoggedIn.value = true
    } else {
      localStorage.removeItem('token')
      isLoggedIn.value = false
    }
  }

  const setUser = (userData) => {
    user.value = userData
  }

  const login = async (credentials) => {
    try {
      const response = await axios.post('/api/auth/login', credentials)
      const { token: newToken, user: userData } = response.data
      setToken(newToken)
      setUser(userData)
      return { success: true }
    } catch (error) {
      console.error('Login error:', error)
      return {
        success: false,
        error: error.response?.data?.message || 'Une erreur est survenue lors de la connexion'
      }
    }
  }

  const register = async (userData) => {
    try {
      const response = await axios.post('/api/auth/register', userData)
      const { token: newToken, user: newUser } = response.data
      setToken(newToken)
      setUser(newUser)
      return { success: true }
    } catch (error) {
      console.error('Register error:', error)
      return {
        success: false,
        error: error.response?.data?.message || 'Une erreur est survenue lors de l\'inscription'
      }
    }
  }

  const logout = () => {
    setToken(null)
    setUser(null)
  }

  const checkAuth = async () => {
    if (!token.value) {
      isLoggedIn.value = false
      return false
    }

    try {
      const response = await axios.get('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token.value}`
        }
      })
      setUser(response.data)
      isLoggedIn.value = true
      return true
    } catch (error) {
      console.error('Check auth error:', error)
      setToken(null)
      setUser(null)
      isLoggedIn.value = false
      return false
    }
  }

  // Initialisation
  if (token.value) {
    checkAuth()
  }

  return {
    // State
    user,
    token,
    isLoggedIn,
    // Getters
    getUser,
    getToken,
    getIsLoggedIn,
    // Actions
    login,
    register,
    logout,
    checkAuth,
    setToken,
    setUser
  }
})
