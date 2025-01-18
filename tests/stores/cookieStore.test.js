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
  })

  describe('Initial State', () => {
    it('should start with empty accepted cookies', () => {
      expect(store.acceptedCookies).toEqual([])
    })

    it('should start with null cookie preferences', () => {
      expect(store.cookiePreferences).toBeNull()
    })

    it('should start with empty essential cookies', () => {
      expect(store.essentialCookies).toEqual({})
    })
  })

  describe('Getters', () => {
    it('should correctly identify if user has accepted cookies', () => {
      expect(store.hasAcceptedCookies).toBe(false)
      store.acceptedCookies = ['functional']
      expect(store.hasAcceptedCookies).toBe(true)
    })

    it('should correctly identify if user has accepted functional cookies', () => {
      expect(store.hasAcceptedFunctional).toBe(false)
      store.acceptedCookies = ['functional']
      expect(store.hasAcceptedFunctional).toBe(true)
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
      const savedPreferences = ['functional', 'session']
      localStorageMock.setItem('cookie-comply', JSON.stringify(savedPreferences))
      
      store.initializeCookies()
      expect(store.acceptedCookies).toEqual(savedPreferences)
      expect(store.cookiePreferences).toBe('saved')
    })

    it('should reset cookie state', () => {
      store.acceptedCookies = ['functional']
      store.cookiePreferences = 'saved'
      
      store.resetCookieState()
      expect(store.acceptedCookies).toEqual([])
      expect(store.cookiePreferences).toBeNull()
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('cookie-comply')
    })

    it('should handle essential cookies', () => {
      store.setEssentialCookie('testKey', 'testValue')
      expect(store.getEssentialCookie('testKey')).toBe('testValue')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('essential-cookies', JSON.stringify({ testKey: 'testValue' }))
    })

    it('should accept all cookies', () => {
      const cookies = ['functional', 'session']
      store.acceptAllCookies(cookies)
      
      expect(store.acceptedCookies).toEqual(cookies)
      expect(store.cookiePreferences).toBe('all')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('cookie-comply', JSON.stringify(cookies))
    })

    it('should decline all non-required cookies', () => {
      const requiredCookies = ['functional']
      store.declineAllCookies(requiredCookies)
      
      expect(store.acceptedCookies).toEqual(requiredCookies)
      expect(store.cookiePreferences).toBe('minimal')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('cookie-comply', JSON.stringify(requiredCookies))
    })

    it('should save custom preferences', () => {
      const selectedCookies = ['functional', 'session']
      store.savePreferences(selectedCookies)
      
      expect(store.acceptedCookies).toEqual(selectedCookies)
      expect(store.cookiePreferences).toBe('custom')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('cookie-comply', JSON.stringify(selectedCookies))
    })

    it('should throw error when checking login permission without session cookie', () => {
      expect(() => store.checkLoginPermission()).toThrow('Vous devez accepter les cookies de session pour vous connecter')
      
      store.acceptedCookies = ['session']
      expect(() => store.checkLoginPermission()).not.toThrow()
    })
  })
})
