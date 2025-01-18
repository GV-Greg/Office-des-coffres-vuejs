import { defineStore } from 'pinia'

// Clés pour le localStorage
const COOKIE_COMPLY_KEY = 'cookie-comply'
const ESSENTIAL_COOKIES_KEY = 'essential-cookies'

export const useCookieStore = defineStore('cookie', {
  state: () => ({
    acceptedCookies: [],
    cookiePreferences: null, // null = pas de choix, 'all' = tout accepté, 'minimal' = refusé, 'custom' = personnalisé
    essentialCookies: {
      theme: 'dark',
      locale: 'fr',
      'session-declined': 'false'
    }
  }),

  getters: {
    hasAcceptedCookies: (state) => state.acceptedCookies.length > 0,
    hasAcceptedFunctional: (state) => state.acceptedCookies.includes('functional'),
    hasAcceptedSession: (state) => state.acceptedCookies.includes('session'),
    hasDeclinedSession: (state) => state.essentialCookies['session-declined'] === 'true',
    canUserLogin: (state) => state.acceptedCookies.includes('session'),
    hasUserChoice: (state) => state.cookiePreferences !== null
  },

  actions: {
    initializeCookies() {
      // Charger les cookies essentiels
      const essentialCookies = localStorage.getItem(ESSENTIAL_COOKIES_KEY)
      if (essentialCookies) {
        try {
          const parsed = JSON.parse(essentialCookies)
          this.essentialCookies = {
            ...this.essentialCookies,
            ...parsed
          }
          console.log('Loaded essential cookies:', this.essentialCookies)
        } catch (e) {
          console.error('Error parsing essential cookies:', e)
        }
      } else {
        // Sauvegarder les valeurs par défaut
        this.saveEssentialCookies()
      }

      // Charger les préférences de cookies
      const savedPreferences = localStorage.getItem(COOKIE_COMPLY_KEY)
      if (savedPreferences) {
        try {
          this.acceptedCookies = JSON.parse(savedPreferences)
          this.cookiePreferences = 'saved'
        } catch {
          this.acceptedCookies = []
          this.cookiePreferences = null
        }
      }
    },

    resetCookieState() {
      this.acceptedCookies = []
      this.cookiePreferences = null
      localStorage.removeItem(COOKIE_COMPLY_KEY)
    },

    setEssentialCookie(key, value) {
      this.essentialCookies[key] = value
      this.saveEssentialCookies()
    },

    getEssentialCookie(key) {
      return this.essentialCookies[key]
    },

    setTheme(theme) {
      console.log('Setting theme in store:', theme)
      this.essentialCookies.theme = theme
      this.saveEssentialCookies()
    },

    setLocale(locale) {
      console.log('Setting locale in store:', locale)
      this.essentialCookies.locale = locale
      this.saveEssentialCookies()
    },

    saveEssentialCookies() {
      console.log('Saving essential cookies:', this.essentialCookies)
      try {
        localStorage.setItem(ESSENTIAL_COOKIES_KEY, JSON.stringify(this.essentialCookies))
      } catch (e) {
        console.error('Error saving essential cookies:', e)
      }
    },

    acceptAllCookies(cookies) {
      this.acceptedCookies = cookies
      this.cookiePreferences = 'all'
      this._saveCookiePreferences(cookies)
    },

    declineAllCookies(requiredCookies) {
      this.acceptedCookies = requiredCookies
      this.cookiePreferences = 'minimal'
      this._saveCookiePreferences(requiredCookies)
    },

    savePreferences(selectedCookies) {
      this.acceptedCookies = selectedCookies
      this.cookiePreferences = 'custom'
      this._saveCookiePreferences(selectedCookies)
    },

    _saveCookiePreferences(cookies) {
      try {
        localStorage.setItem(COOKIE_COMPLY_KEY, JSON.stringify(cookies))
      } catch (e) {
        console.error('Error saving cookie preferences:', e)
      }
    },

    clearCookies() {
      localStorage.clear()
    }
  }
})
