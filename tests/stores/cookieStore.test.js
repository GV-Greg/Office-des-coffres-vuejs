import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCookieStore } from '../../src/stores/cookieStore'

// Mock localStorage
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: vi.fn(key => store[key] ?? null),
    setItem: vi.fn((key, value) => {
      store[key] = value.toString()
    }),
    removeItem: vi.fn(key => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    })
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

describe('Cookie Store', () => {
  let store

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useCookieStore()
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should start with empty accepted cookies', () => {
      expect(store.acceptedCookies).toEqual([])
    })

    it('should start with null cookie preferences', () => {
      expect(store.cookiePreferences).toBeNull()
    })

    it('should start with default comfort data', () => {
      expect(store.comfortData).toEqual({
        theme: 'dark',
        locale: 'fr',
        'session-declined': 'false'
      })
    })
  })

  describe('Getters', () => {
    it('should correctly identify if user has accepted cookies', () => {
      expect(store.hasAcceptedCookies).toBe(false)
      store.acceptedCookies = ['comfort']
      expect(store.hasAcceptedCookies).toBe(true)
    })

    it('should correctly identify if user has accepted comfort cookies', () => {
      expect(store.hasAcceptedComfort).toBe(false)
      store.acceptedCookies = ['comfort']
      expect(store.hasAcceptedComfort).toBe(true)
    })

    it('should correctly identify if user has accepted session cookies', () => {
      expect(store.hasAcceptedSession).toBe(false)
      store.acceptedCookies = ['session']
      expect(store.hasAcceptedSession).toBe(true)
    })

    it('should correctly identify if user can login', () => {
      expect(store.canUserLogin).toBe(false)
      store.acceptedCookies = ['session']
      expect(store.canUserLogin).toBe(true)
    })

    it('should correctly identify if user has made a choice', () => {
      expect(store.hasUserChoice).toBe(false)
      store.cookiePreferences = 'saved'
      expect(store.hasUserChoice).toBe(true)
    })
  })

  describe('Actions', () => {
    it('should initialize cookies from localStorage', () => {
      const savedPreferences = ['comfort', 'session']
      localStorageMock.setItem('cookie-comply', JSON.stringify(savedPreferences))

      store.initializeCookies()
      expect(store.acceptedCookies).toEqual(savedPreferences)
      expect(store.cookiePreferences).toBe('saved')
    })

    it('should reset cookie state', () => {
      store.acceptedCookies = ['comfort']
      store.cookiePreferences = 'saved'

      store.resetCookieState()
      expect(store.acceptedCookies).toEqual([])
      expect(store.cookiePreferences).toBeNull()
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('cookie-comply')
    })

    it('should accept all cookies', () => {
      const cookies = ['comfort', 'session']
      store.acceptAllCookies(cookies)

      expect(store.acceptedCookies).toEqual(cookies)
      expect(store.cookiePreferences).toBe('all')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('cookie-comply', JSON.stringify(cookies))
    })

    it('should decline all non-required cookies', () => {
      const requiredCookies = []
      store.declineAllCookies(requiredCookies)

      expect(store.acceptedCookies).toEqual(requiredCookies)
      expect(store.cookiePreferences).toBe('minimal')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('cookie-comply', JSON.stringify(requiredCookies))
    })

    it('should save custom preferences', () => {
      const selectedCookies = ['comfort', 'session']
      store.savePreferences(selectedCookies)

      expect(store.acceptedCookies).toEqual(selectedCookies)
      expect(store.cookiePreferences).toBe('custom')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('cookie-comply', JSON.stringify(selectedCookies))
    })
  })

  describe('Comfort data — lecture/écriture génériques', () => {
    it('getComfortData retourne la valeur en mémoire', () => {
      expect(store.getComfortData('theme')).toBe('dark')
      expect(store.getComfortData('inexistant', 'fallback')).toBe('fallback')
    })

    it('setComfortData change la valeur en mémoire même sans consentement', () => {
      store.setComfortData('theme', 'light')
      expect(store.getComfortData('theme')).toBe('light')
    })

    it('setComfortData ne persiste PAS en localStorage sans consentement "comfort"', () => {
      store.setComfortData('theme', 'light')
      expect(localStorageMock.setItem).not.toHaveBeenCalledWith('comfort-cookies', expect.anything())
    })

    it('setComfortData persiste en localStorage une fois "comfort" accepté', () => {
      store.acceptedCookies = ['comfort']
      store.setComfortData('theme', 'light')

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'comfort-cookies',
        JSON.stringify({ theme: 'light', locale: 'fr', 'session-declined': 'false' })
      )
    })

    it('accepter "comfort" persiste les changements faits en mémoire avant le consentement', () => {
      store.setComfortData('theme', 'light') // avant consentement : mémoire seulement
      store.acceptAllCookies(['comfort'])

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'comfort-cookies',
        JSON.stringify({ theme: 'light', locale: 'fr', 'session-declined': 'false' })
      )
    })

    it('refuser/retirer "comfort" purge les données de confort déjà stockées', () => {
      store.acceptedCookies = ['comfort']
      store.setComfortData('theme', 'light')
      localStorageMock.setItem.mockClear()

      store.declineAllCookies([])
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('comfort-cookies')
    })

    it('initializeCookies charge les données de confort déjà persistées', () => {
      localStorageMock.setItem('comfort-cookies', JSON.stringify({ theme: 'light', locale: 'en', 'session-declined': 'false' }))

      store.initializeCookies()
      expect(store.comfortData.theme).toBe('light')
      expect(store.comfortData.locale).toBe('en')
    })

    it('setTheme et setLocale passent par le même mécanisme de confort', () => {
      store.acceptedCookies = ['comfort']
      store.setTheme('light')
      store.setLocale('en')

      expect(store.comfortData.theme).toBe('light')
      expect(store.comfortData.locale).toBe('en')
    })
  })
})
