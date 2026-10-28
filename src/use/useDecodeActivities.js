import { http } from '@/api.js'
import { useAuthStore } from '@/stores/authStore'

/*
  Appels de l'API de « Décode le code » (brief admin/modules/animation/brief-coffres-scelles.md ; spécification à jour : tour 12 du
  fil admin/echanges/animation-coffres-scelles). Aucune règle ici : qui peut gérer une activité, ce qui se supprime ou se rouvre,
  la note d'une combinaison, les règles du slug et du mot de passe — tout vient du serveur, les refus arrivent en FR et EN
  (`apiMessage`). Deux modes :
    - PRIVÉ (lié au personnage) : jeton Bearer, attaché à la main comme partout (api.js) ;
    - SANS COMPTE : aucun jeton, le slug (public) et le mot de passe voyagent dans le CORPS de chaque appel de gestion.
  Les routes `anim/*` de lecture sont publiques : elles partent sans jeton.
  ⚠️ Le mot de passe ne sort jamais de cette composition : il n'est ni stocké, ni mémorisé (D4), ni placé dans une adresse.
*/
export default function useDecodeActivities() {
  const authStore = useAuthStore()
  const auth = () => ({ headers: { Authorization: `Bearer ${authStore.getToken}` } })
  const manage = slug => `anim/decode-manage/${encodeURIComponent(slug)}`

  const api = {
    // ── Lecture publique (les deux modes) ─────────────────────────────────────────────────────────
    /** Clés des types d'activité ouverts (`decode`…), pour le menu du module. */
    async types() {
      const { data } = await http.get('anim/activity-types')
      return data.types
    },
    /** Page publique d'une activité, par son slug. Jamais le code d'un coffre encore scellé. */
    async show(slug) {
      const { data } = await http.get(`anim/decode-activities/${encodeURIComponent(slug)}`)
      return data.activity
    },
    /** Aperçu et disponibilité du slug : { proposal, slug, valid, taken, min, max }. SEULE source des règles. */
    async slug({ name, slug } = {}) {
      const params = {}
      if (name !== undefined) params.name = name
      if (slug !== undefined) params.slug = slug
      const { data } = await http.get('anim/decode-slug', { params })
      return data
    },

    // ── Mode privé (jeton) ────────────────────────────────────────────────────────────────────────
    /** Les activités du personnage, avec le code du coffre en cours (organisateur seul). */
    async list(characterId) {
      const { data } = await http.get(`characters/${characterId}/decode-activities`, auth())
      return data.activities
    },
    async create(characterId, body) {
      const { data } = await http.post(`characters/${characterId}/decode-activities`, body, auth())
      return data.activity
    },

    // ── Mode sans compte (slug + mot de passe dans le corps) ──────────────────────────────────────────
    /** Crée l'activité : { activity, email_pending }. */
    async createAnonymous(body) {
      const { data } = await http.post('anim/decode-manage', body)
      return data
    },
    /** Prouve le mot de passe et rend l'état complet de gestion. */
    async open(slug, password) {
      const { data } = await http.post(`${manage(slug)}/open`, { password })
      return data.activity
    },
    /** Demande un lien de réinitialisation (par email s'il est confirmé, sinon la demande est notée pour l'administrateur du site) : la réponse est la même quoi qu'il arrive (le serveur ne révèle rien). */
    async requestReset(slug) {
      await http.post(`${manage(slug)}/reset-request`)
    },
    async completeReset(slug, { token, password, password_confirmation }) {
      await http.post(`${manage(slug)}/reset-complete`, { token, password, password_confirmation })
    },
    /** Rappelle l'API avec les paramètres du lien signé reçu par email. */
    async confirmEmail({ slug, hash, expires, signature }) {
      await http.get(`anim/decode-email-confirm/${encodeURIComponent(slug)}/${encodeURIComponent(hash)}`, { params: { expires, signature } })
    },

    /**
     * Les gestes de gestion d'UNE activité, les mêmes pour les deux modes — la carte d'activité ne sait pas dans lequel elle est.
     * `reopen` et `remove` n'existent pas sans compte (clôture définitive, D19 ; l'auteur ne supprime pas, D13).
     */
    asOrganizer() {
      const post = async (url, body = {}) => (await http.post(url, body, auth())).data
      return {
        mode: 'private',
        generateSecret: async a => (await post(`decode-activities/${a.id}/secrets`)).activity,
        propose: (a, secretId, body) => post(`decode-activities/${a.id}/secrets/${secretId}/proposals`, body),
        reopen: async a => (await post(`decode-activities/${a.id}/reopen`)).activity,
        close: async a => (await post(`decode-activities/${a.id}/close`)).activity,
        remove: async a => { await http.delete(`decode-activities/${a.id}`, auth()) },
        exportRules: async a => (await http.get(`decode-activities/${a.id}/export/rules`, auth())).data.bbcode,
        exportResults: async a => (await http.get(`decode-activities/${a.id}/export/results`, auth())).data.bbcode,
      }
    },
    asAnonymous(slug, password) {
      const post = async (path, body = {}) => (await http.post(`${manage(slug)}/${path}`, { password, ...body })).data
      return {
        mode: 'anonymous',
        generateSecret: async () => (await post('secrets')).activity,
        propose: (a, secretId, body) => post(`secrets/${secretId}/proposals`, body),
        close: async () => (await post('close')).activity,
        exportRules: async () => (await post('export/rules')).bbcode,
        exportResults: async () => (await post('export/results')).bbcode,
      }
    },
  }

  return api
}
