import { defineStore } from 'pinia'

// Rien n'est stocké en cookie HTTP sur ce site : tout passe par le localStorage.
// Le vocabulaire "cookie" survit dans les noms de clés historiques uniquement.
// Source de vérité de la stratégie : ODC-strategie-cookies.md, à la racine du projet.

const CONSENT_KEY = 'cookie-consent'
// Ancien format : liste plate ['comfort', 'session']. Migré puis supprimé au chargement.
const LEGACY_CONSENT_KEY = 'cookie-comply'
const COMFORT_DATA_KEY = 'comfort-cookies'

// Seuls préfixes que clearConsentedStorage() a le droit de purger. Le jeton d'auth
// (auth_token/auth_user) est un moyen strictement nécessaire au service demandé par
// l'utilisateur : il ne relève pas du consentement et ne doit jamais être emporté ici.
const CONSENTED_PREFIXES = ['cookie-', 'comfort-']

// Recommandation CNIL : resolliciter le consentement au bout de six mois environ.
const RENEWAL_AFTER_MS = 183 * 24 * 60 * 60 * 1000

const DEFAULT_COMFORT_DATA = {
  theme: 'dark',
  locale: 'fr',
}

// choiceMadeAt à null = l'utilisateur n'a pas encore répondu (la bannière doit s'afficher).
const NO_CONSENT = { preferences: false, choiceMadeAt: null }

/**
 * Valide le consentement lu en localStorage plutôt que de l'étaler tel quel dans l'état :
 * une valeur bricolée à la main ou un reliquat d'un format futur ne doit pas pouvoir
 * injecter des clés inconnues ni faire passer `preferences` pour accepté.
 * Renvoie null si la valeur est inexploitable — l'appelant repart alors de NO_CONSENT.
 */
function parseConsent(raw) {
  if (!raw) return null
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  if (typeof parsed.preferences !== 'boolean') return null

  const choiceMadeAt = Number.isFinite(parsed.choiceMadeAt) ? parsed.choiceMadeAt : null
  if (choiceMadeAt === null) return null

  // Allowlist stricte : on ne conserve que les deux clés du modèle.
  return { preferences: parsed.preferences, choiceMadeAt }
}

/**
 * Migration de l'ancien format (liste plate) vers le modèle nommé. 'comfort' était la
 * seule catégorie à couvrir un traitement réel ; 'session' n'a jamais rien conditionné
 * (son unique lecteur était un computed mort), donc elle disparaît sans contrepartie.
 * Le périmètre couvert étant identique, on ne resollicite pas l'utilisateur.
 */
function migrateLegacyConsent(raw) {
  if (!raw) return null
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!Array.isArray(parsed)) return null
  return { preferences: parsed.includes('comfort'), choiceMadeAt: Date.now() }
}

/**
 * Les données de confort sont un sac générique, extensible par module (clés ajoutées
 * librement : liste du Guet, relevés de mines par semaine, personnage par défaut...).
 * On valide donc la forme, pas la liste des clés — contrairement au consentement.
 */
function parseComfortData(raw) {
  if (!raw) return null
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  return parsed
}

export const useCookieStore = defineStore('cookie', {
  state: () => ({
    // Modèle nommé et extensible : ajouter une clé ici si un futur module public
    // nécessite un consentement dédié, sans migration de format (§5 de la stratégie).
    consent: { ...NO_CONSENT },
    // Préférences UI (thème, langue) + données saisies dans les outils, pour éviter à
    // l'utilisateur de tout ressaisir. Seule leur PERSISTANCE dépend du consentement :
    // en mémoire, elles fonctionnent toujours (dégradation gracieuse).
    comfortData: { ...DEFAULT_COMFORT_DATA },
  }),

  getters: {
    hasUserChoice: (state) => state.consent.choiceMadeAt !== null,
    hasAcceptedPreferences: (state) => state.consent.preferences === true,
  },

  actions: {
    /**
     * Vrai si le choix date de plus de six mois : la bannière peut être réaffichée.
     *
     * Action et non getter : un getter Pinia est un computed, mis en cache tant que
     * l'état dont il dépend ne change pas. Comme il ne dépend que de `choiceMadeAt`,
     * il ne se réévaluerait jamais au fil du temps — il renverrait la même valeur
     * pendant toute la session, même six mois plus tard sur un onglet resté ouvert.
     */
    needsRenewal() {
      if (this.consent.choiceMadeAt === null) return false
      return Date.now() - this.consent.choiceMadeAt > RENEWAL_AFTER_MS
    },

    initializeCookies() {
      const storedComfort = parseComfortData(localStorage.getItem(COMFORT_DATA_KEY))
      if (storedComfort) {
        this.comfortData = { ...this.comfortData, ...storedComfort }
      }

      const stored = parseConsent(localStorage.getItem(CONSENT_KEY))
      if (stored) {
        this.consent = stored
        return
      }

      const migrated = migrateLegacyConsent(localStorage.getItem(LEGACY_CONSENT_KEY))
      if (migrated) {
        this.consent = migrated
        this._saveConsent()
      }
      // L'ancienne clé part dans tous les cas : illisible, elle n'a plus rien à dire.
      localStorage.removeItem(LEGACY_CONSENT_KEY)
    },

    // Lecture : toujours possible, ne fait que refléter l'état en mémoire.
    getComfortData(key, fallback = null) {
      return this.comfortData[key] ?? fallback
    },

    // Écriture : la valeur change toujours en mémoire (la page/session en cours
    // fonctionne), mais n'est persistée que si les préférences sont acceptées.
    setComfortData(key, value) {
      this.comfortData[key] = value
      if (this.hasAcceptedPreferences) {
        this._saveComfortData()
      }
    },

    setTheme(theme) {
      this.setComfortData('theme', theme)
    },

    setLocale(locale) {
      this.setComfortData('locale', locale)
    },

    acceptPreferences() {
      this.setConsent(true)
    },

    declinePreferences() {
      this.setConsent(false)
    },

    setConsent(preferences) {
      this.consent = { preferences, choiceMadeAt: Date.now() }
      this._saveConsent()
      this._syncComfortPersistence()
    },

    resetConsent() {
      this.consent = { ...NO_CONSENT }
      localStorage.removeItem(CONSENT_KEY)
    },

    /**
     * Purge ce qui a été stocké sur la base d'un consentement, et rien d'autre.
     * Remplace un ancien clearCookies() qui faisait localStorage.clear() : il aurait
     * déconnecté l'utilisateur en emportant auth_token/auth_user au passage.
     */
    clearConsentedStorage() {
      // API standard length/key(i) plutôt qu'Object.keys : on collecte avant de
      // supprimer, retirer une clé en cours d'itération décale les index suivants.
      const doomed = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && CONSENTED_PREFIXES.some((prefix) => key.startsWith(prefix))) {
          doomed.push(key)
        }
      }
      for (const key of doomed) {
        localStorage.removeItem(key)
      }
    },

    _saveConsent() {
      try {
        localStorage.setItem(CONSENT_KEY, JSON.stringify(this.consent))
      } catch (e) {
        console.error('Error saving consent:', e)
      }
    },

    _saveComfortData() {
      try {
        localStorage.setItem(COMFORT_DATA_KEY, JSON.stringify(this.comfortData))
      } catch (e) {
        console.error('Error saving comfort data:', e)
      }
    },

    // Acceptation : persiste ce qui avait été changé en mémoire avant la réponse
    // (ex. thème basculé avant d'avoir répondu à la bannière).
    // Refus ou retrait : purge ce qui avait déjà été stocké.
    _syncComfortPersistence() {
      if (this.hasAcceptedPreferences) {
        this._saveComfortData()
      } else {
        localStorage.removeItem(COMFORT_DATA_KEY)
      }
    },
  },
})
