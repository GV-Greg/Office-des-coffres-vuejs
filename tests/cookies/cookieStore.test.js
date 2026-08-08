import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
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
    }),
    // API standard, utilisée par clearConsentedStorage() pour balayer les clés.
    key: vi.fn(index => Object.keys(store)[index] ?? null),
    get length() {
      return Object.keys(store).length
    },
    get _raw() {
      return store
    }
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

  describe('État initial', () => {
    it("part d'un consentement vierge", () => {
      expect(store.consent).toEqual({ preferences: false, choiceMadeAt: null })
    })

    it('part des données de confort par défaut', () => {
      expect(store.comfortData).toEqual({ theme: 'dark', locale: 'fr' })
    })
  })

  describe('Getters', () => {
    it("distingue « pas encore répondu » d'un refus explicite", () => {
      expect(store.hasUserChoice).toBe(false)
      expect(store.hasAcceptedPreferences).toBe(false)

      store.declinePreferences()
      // Refus : l'utilisateur a bien répondu, la bannière ne doit plus revenir.
      expect(store.hasUserChoice).toBe(true)
      expect(store.hasAcceptedPreferences).toBe(false)
    })

    it('reconnaît un consentement accepté', () => {
      store.acceptPreferences()
      expect(store.hasUserChoice).toBe(true)
      expect(store.hasAcceptedPreferences).toBe(true)
    })

    describe('needsRenewal (rappel à 6 mois, recommandation CNIL)', () => {
      afterEach(() => {
        vi.useRealTimers()
      })

      it('est faux tant que personne n\'a répondu', () => {
        expect(store.needsRenewal()).toBe(false)
      })

      it('est faux pour un choix récent, vrai passé six mois', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
        store.acceptPreferences()
        expect(store.needsRenewal()).toBe(false)

        vi.setSystemTime(new Date('2026-04-01T00:00:00Z')) // 3 mois
        expect(store.needsRenewal()).toBe(false)

        vi.setSystemTime(new Date('2026-09-01T00:00:00Z')) // 8 mois
        expect(store.needsRenewal()).toBe(true)
      })
    })
  })

  describe('Consentement', () => {
    it('enregistre une acceptation avec sa date', () => {
      store.acceptPreferences()

      expect(store.consent.preferences).toBe(true)
      expect(store.consent.choiceMadeAt).toEqual(expect.any(Number))
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'cookie-consent',
        JSON.stringify(store.consent)
      )
    })

    it('enregistre un refus avec sa date', () => {
      store.declinePreferences()

      expect(store.consent.preferences).toBe(false)
      expect(store.consent.choiceMadeAt).toEqual(expect.any(Number))
    })

    it('recharge un consentement déjà enregistré', () => {
      localStorageMock.setItem(
        'cookie-consent',
        JSON.stringify({ preferences: true, choiceMadeAt: 1_770_000_000_000 })
      )

      store.initializeCookies()
      expect(store.consent).toEqual({ preferences: true, choiceMadeAt: 1_770_000_000_000 })
    })

    it('remet le consentement à zéro', () => {
      store.acceptPreferences()
      store.resetConsent()

      expect(store.consent).toEqual({ preferences: false, choiceMadeAt: null })
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('cookie-consent')
    })
  })

  describe('Validation de ce qui est relu depuis localStorage', () => {
    it('ignore un JSON corrompu et repart d\'un consentement vierge', () => {
      localStorageMock.setItem('cookie-consent', '{ pas du json')

      store.initializeCookies()
      expect(store.consent).toEqual({ preferences: false, choiceMadeAt: null })
    })

    it('rejette une structure qui ne correspond pas au modèle', () => {
      // preferences doit être un booléen : une chaîne "true" bricolée à la main
      // ne doit pas passer pour un consentement donné.
      localStorageMock.setItem(
        'cookie-consent',
        JSON.stringify({ preferences: 'true', choiceMadeAt: 1_770_000_000_000 })
      )

      store.initializeCookies()
      expect(store.hasAcceptedPreferences).toBe(false)
      expect(store.hasUserChoice).toBe(false)
    })

    it('ne conserve pas les clés inconnues glissées dans le consentement', () => {
      localStorageMock.setItem(
        'cookie-consent',
        JSON.stringify({ preferences: true, choiceMadeAt: 1_770_000_000_000, tracking: true })
      )

      store.initializeCookies()
      expect(store.consent).toEqual({ preferences: true, choiceMadeAt: 1_770_000_000_000 })
      expect(store.consent.tracking).toBeUndefined()
    })

    it('ignore des données de confort qui ne sont pas un objet', () => {
      localStorageMock.setItem('comfort-cookies', JSON.stringify(['pas', 'un', 'objet']))

      store.initializeCookies()
      expect(store.comfortData).toEqual({ theme: 'dark', locale: 'fr' })
    })
  })

  describe("Migration depuis l'ancien format (liste plate)", () => {
    it("reprend un ancien consentement 'comfort' sans resolliciter l'utilisateur", () => {
      localStorageMock.setItem('cookie-comply', JSON.stringify(['comfort', 'session']))

      store.initializeCookies()
      expect(store.consent.preferences).toBe(true)
      expect(store.hasUserChoice).toBe(true) // pas de bannière au prochain chargement
    })

    it("traduit un ancien refus (ou un 'session' seul) en préférences refusées", () => {
      // 'session' ne conditionnait rien : son seul lecteur était un computed mort.
      localStorageMock.setItem('cookie-comply', JSON.stringify(['session']))

      store.initializeCookies()
      expect(store.consent.preferences).toBe(false)
      expect(store.hasUserChoice).toBe(true)
    })

    it('réécrit le consentement au nouveau format et supprime l\'ancienne clé', () => {
      localStorageMock.setItem('cookie-comply', JSON.stringify(['comfort']))

      store.initializeCookies()
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'cookie-consent',
        JSON.stringify(store.consent)
      )
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('cookie-comply')
    })

    it('le nouveau format prime si les deux clés coexistent', () => {
      localStorageMock.setItem('cookie-comply', JSON.stringify(['comfort']))
      localStorageMock.setItem(
        'cookie-consent',
        JSON.stringify({ preferences: false, choiceMadeAt: 1_770_000_000_000 })
      )

      store.initializeCookies()
      expect(store.consent.preferences).toBe(false)
    })
  })

  describe('clearConsentedStorage', () => {
    it('purge les données stockées sur consentement', () => {
      localStorageMock.setItem('comfort-cookies', JSON.stringify({ theme: 'light' }))
      localStorageMock.setItem('cookie-consent', JSON.stringify({ preferences: true, choiceMadeAt: 1 }))

      store.clearConsentedStorage()
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('comfort-cookies')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('cookie-consent')
    })

    it("n'emporte jamais le jeton d'authentification", () => {
      // Régression sur l'ancien clearCookies(), qui faisait un localStorage.clear() :
      // purger le consentement déconnectait l'utilisateur au passage.
      localStorageMock.setItem('auth_token', 'un-jeton')
      localStorageMock.setItem('auth_user', '{"id":1}')
      localStorageMock.setItem('comfort-cookies', JSON.stringify({ theme: 'light' }))

      store.clearConsentedStorage()
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('auth_token')
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('auth_user')
      expect(localStorageMock._raw.auth_token).toBe('un-jeton')
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

    it('setComfortData ne persiste PAS en localStorage sans consentement', () => {
      store.setComfortData('theme', 'light')
      expect(localStorageMock.setItem).not.toHaveBeenCalledWith('comfort-cookies', expect.anything())
    })

    it('setComfortData persiste une fois les préférences acceptées', () => {
      store.acceptPreferences()
      store.setComfortData('theme', 'light')

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'comfort-cookies',
        JSON.stringify({ theme: 'light', locale: 'fr' })
      )
    })

    it('accepter persiste les changements faits en mémoire avant le consentement', () => {
      store.setComfortData('theme', 'light') // avant consentement : mémoire seulement
      store.acceptPreferences()

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'comfort-cookies',
        JSON.stringify({ theme: 'light', locale: 'fr' })
      )
    })

    it('refuser (ou retirer) purge les données de confort déjà stockées', () => {
      store.acceptPreferences()
      store.setComfortData('theme', 'light')
      localStorageMock.setItem.mockClear()

      store.declinePreferences()
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('comfort-cookies')
    })

    it('initializeCookies charge les données de confort déjà persistées', () => {
      localStorageMock.setItem('comfort-cookies', JSON.stringify({ theme: 'light', locale: 'en' }))

      store.initializeCookies()
      expect(store.comfortData.theme).toBe('light')
      expect(store.comfortData.locale).toBe('en')
    })

    it('setTheme et setLocale passent par le même mécanisme de confort', () => {
      store.acceptPreferences()
      store.setTheme('light')
      store.setLocale('en')

      expect(store.comfortData.theme).toBe('light')
      expect(store.comfortData.locale).toBe('en')
    })
  })
})
