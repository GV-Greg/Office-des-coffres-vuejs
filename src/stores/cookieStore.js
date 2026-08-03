import { defineStore } from 'pinia'

// Clés pour le localStorage
const COOKIE_COMPLY_KEY = 'cookie-comply'
const COMFORT_DATA_KEY = 'comfort-cookies'

const DEFAULT_COMFORT_DATA = {
  theme: 'dark',
  locale: 'fr',
  'session-declined': 'false'
}

export const useCookieStore = defineStore('cookie', {
  state: () => ({
    acceptedCookies: [],
    cookiePreferences: null, // null = pas de choix, 'all' = tout accepté, 'minimal' = refusé, 'custom' = personnalisé
    // Données de confort : préférences UI (thème, langue) + données saisies par l'utilisateur
    // dans les différents outils (ex. dernière liste du Guet), pour lui éviter de tout ressaisir.
    // Bag générique, extensible par module — seule leur PERSISTANCE (pas leur usage en mémoire
    // pour la session en cours) dépend du consentement "comfort".
    comfortData: { ...DEFAULT_COMFORT_DATA }
  }),

  getters: {
    hasAcceptedCookies: (state) => state.acceptedCookies.length > 0,
    hasAcceptedComfort: (state) => state.acceptedCookies.includes('comfort'),
    hasAcceptedSession: (state) => state.acceptedCookies.includes('session'),
    hasDeclinedSession: (state) => state.comfortData['session-declined'] === 'true',
    canUserLogin: (state) => state.acceptedCookies.includes('session'),
    hasUserChoice: (state) => state.cookiePreferences !== null
  },

  actions: {
    initializeCookies() {
      // Charger les données de confort persistées (si le consentement avait été donné)
      const stored = localStorage.getItem(COMFORT_DATA_KEY)
      if (stored) {
        try {
          this.comfortData = { ...this.comfortData, ...JSON.parse(stored) }
        } catch (e) {
          console.error('Error parsing comfort data:', e)
        }
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

    // Lecture : toujours possible, ne fait que refléter l'état en mémoire (rien n'est écrit).
    getComfortData(key, fallback = null) {
      return this.comfortData[key] ?? fallback
    },

    // Écriture : la valeur change toujours en mémoire (fonctionne pour la page/session en
    // cours — dégradation gracieuse), mais n'est persistée en localStorage que si le
    // consentement "comfort" a été donné. Sans consentement, la valeur ne survit pas au
    // rechargement de la page.
    setComfortData(key, value) {
      this.comfortData[key] = value
      if (this.hasAcceptedComfort) {
        this._saveComfortData()
      }
    },

    setTheme(theme) {
      this.setComfortData('theme', theme)
    },

    setLocale(locale) {
      this.setComfortData('locale', locale)
    },

    _saveComfortData() {
      try {
        localStorage.setItem(COMFORT_DATA_KEY, JSON.stringify(this.comfortData))
      } catch (e) {
        console.error('Error saving comfort data:', e)
      }
    },

    // Si "comfort" vient d'être accepté : persiste les changements faits en mémoire avant
    // le consentement (ex. thème changé avant d'avoir répondu à la bannière).
    // Si "comfort" est absent (refusé/retiré) : purge toute donnée de confort déjà stockée.
    _syncComfortPersistence() {
      if (this.hasAcceptedComfort) {
        this._saveComfortData()
      } else {
        localStorage.removeItem(COMFORT_DATA_KEY)
      }
    },

    acceptAllCookies(cookies) {
      this.acceptedCookies = cookies
      this.cookiePreferences = 'all'
      this._saveCookiePreferences(cookies)
      this._syncComfortPersistence()
    },

    declineAllCookies(requiredCookies) {
      this.acceptedCookies = requiredCookies
      this.cookiePreferences = 'minimal'
      this._saveCookiePreferences(requiredCookies)
      this._syncComfortPersistence()
    },

    savePreferences(selectedCookies) {
      this.acceptedCookies = selectedCookies
      this.cookiePreferences = 'custom'
      this._saveCookiePreferences(selectedCookies)
      this._syncComfortPersistence()
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
