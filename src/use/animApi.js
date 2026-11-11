import { http } from '@/api.js'

/*
  Les appels communs à TOUTE activité d'Animation, bâtis sur les noms de routes d'un type (`ANIM_KINDS[key].api`). Chaque type (useDecodeActivities,
  useRewardsGrid) y ajoute ses gestes propres. Aucune règle ici : qui peut gérer, les règles du slug et du mot de passe, tout vient du serveur,
  ses refus arrivent en FR et EN (`apiMessage`). Deux modes :
    - PRIVÉ (lié au personnage) : jeton Bearer, attaché à la main (api.js) ;
    - SANS COMPTE : aucun jeton, le slug (public) et le mot de passe voyagent dans le CORPS de chaque appel de gestion.
  ⚠️ Le mot de passe ne sort jamais de cette composition : il n'est ni stocké, ni mémorisé, ni placé dans une adresse.
*/
export default function animApi({ key, api, auth }) {
  const slugPath = slug => encodeURIComponent(slug)
  const manage = slug => `anim/${key}-manage/${slugPath(slug)}`

  return {
    manage,

    // ── Lecture publique ──────────────────────────────────────────────────────────────────────────
    /** Page publique par slug. Jamais ce qui doit rester caché (le serveur ne l'envoie pas). */
    async show(slug) {
      const { data } = await http.get(`anim/${api.collection}/${slugPath(slug)}`)
      return data[api.item]
    },
    /** Aperçu et disponibilité du slug : { proposal, slug, valid, taken, min, max }. SEULE source des règles. */
    async slug({ name, slug } = {}) {
      const params = {}
      if (name !== undefined) params.name = name
      if (slug !== undefined) params.slug = slug
      const { data } = await http.get(`anim/${key}-slug`, { params })
      return data
    },

    // ── Mode privé (jeton) ────────────────────────────────────────────────────────────────────────
    async list(characterId) {
      const { data } = await http.get(`characters/${characterId}/${api.collection}`, auth())
      return data[api.items]
    },
    async create(characterId, body) {
      const { data } = await http.post(`characters/${characterId}/${api.collection}`, body, auth())
      return data[api.item]
    },

    // ── Mode sans compte (slug + mot de passe dans le corps) ──────────────────────────────────────
    /** Crée sans compte : { [item], email_pending }. */
    async createAnonymous(body) {
      const { data } = await http.post(`anim/${key}-manage`, body)
      return data
    },
    /** Prouve le mot de passe et rend l'état complet de gestion. */
    async open(slug, password) {
      const { data } = await http.post(`${manage(slug)}/open`, { password })
      return data[api.item]
    },
    /** Demande un lien de réinitialisation : la réponse est la même quoi qu'il arrive (le serveur ne révèle rien). */
    async requestReset(slug) {
      await http.post(`${manage(slug)}/reset-request`)
    },
    async completeReset(slug, { token, password, password_confirmation }) {
      await http.post(`${manage(slug)}/reset-complete`, { token, password, password_confirmation })
    },
    /** Rappelle l'API avec les paramètres du lien signé reçu par email. */
    async confirmEmail({ slug, hash, expires, signature }) {
      await http.get(`anim/${key}-email-confirm/${slugPath(slug)}/${encodeURIComponent(hash)}`, { params: { expires, signature } })
    },
  }
}
