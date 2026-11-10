import { http } from '@/api.js'
import { useAuthStore } from '@/stores/authStore'

/*
  Appels de l'API de la Grille des lots (brief admin/content/brief-grille-des-lots.md).
  Aucune règle ici : qui peut gérer, ce qui se supprime ou se rouvre, les règles du slug et du
  mot de passe — tout vient du serveur, les refus arrivent en FR et EN (`apiMessage`). Deux modes :
    - PRIVÉ (lié au personnage) : jeton Bearer, attaché à la main ;
    - SANS COMPTE : aucun jeton, le slug et le mot de passe voyagent dans le CORPS.
  ⚠️ Le mot de passe ne sort jamais de cette composition : il n'est ni stocké, ni mémorisé, ni
  placé dans une adresse.
*/
export default function useRewardsGrid() {
  const authStore = useAuthStore()
  const auth = () => ({ headers: { Authorization: `Bearer ${authStore.getToken}` } })
  const manage = slug => `anim/rewards-manage/${encodeURIComponent(slug)}`

  const api = {
    // ── Lecture publique ──────────────────────────────────────────────────────────────────────────
    /** Page publique d'une grille, par son slug. Visible uniquement depuis `drawed`. */
    async show(slug) {
      const { data } = await http.get(`anim/rewards-grids/${encodeURIComponent(slug)}`)
      return data.grid
    },
    /** Aperçu et disponibilité du slug : { proposal, slug, valid, taken, min, max }. SEULE source des règles. */
    async slug({ name, slug } = {}) {
      const params = {}
      if (name !== undefined) params.name = name
      if (slug !== undefined) params.slug = slug
      const { data } = await http.get('anim/rewards-slug', { params })
      return data
    },

    // ── Mode privé (jeton) ────────────────────────────────────────────────────────────────────────
    /** Les grilles du personnage. */
    async list(characterId) {
      const { data } = await http.get(`characters/${characterId}/rewards-grids`, auth())
      return data.grids
    },
    async create(characterId, body) {
      const { data } = await http.post(`characters/${characterId}/rewards-grids`, body, auth())
      return data.grid
    },

    // ── Mode sans compte (slug + mot de passe dans le corps) ─────────────────────────────────────
    /** Crée la grille : { grid, email_pending }. */
    async createAnonymous(body) {
      const { data } = await http.post('anim/rewards-manage', body)
      return data
    },
    /** Prouve le mot de passe et rend l'état complet de gestion. */
    async open(slug, password) {
      const { data } = await http.post(`${manage(slug)}/open`, { password })
      return data.grid
    },
    async requestReset(slug) {
      await http.post(`${manage(slug)}/reset-request`)
    },
    async completeReset(slug, { token, password, password_confirmation }) {
      await http.post(`${manage(slug)}/reset-complete`, { token, password, password_confirmation })
    },
    /** Rappelle l'API avec les paramètres du lien signé reçu par email. */
    async confirmEmail({ slug, hash, expires, signature }) {
      await http.get(
        `anim/rewards-email-confirm/${encodeURIComponent(slug)}/${encodeURIComponent(hash)}`,
        { params: { expires, signature } },
      )
    },

    /**
     * Les gestes de gestion d'UNE grille, les mêmes pour les deux modes.
     * `reopen` et `remove` n'existent pas sans compte (clôture définitive).
     */
    asOrganizer() {
      const post = async (url, body = {}) => (await http.post(url, body, auth())).data
      const patch = async (url, body = {}) => (await http.patch(url, body, auth())).data
      return {
        mode: 'private',
        addLot: async (g, body) => (await post(`rewards-grids/${g.id}/lots`, body)).grid,
        removeLot: async (g, lotId) => { await http.delete(`rewards-grids/${g.id}/lots/${lotId}`, auth()) },
        draw: async g => (await post(`rewards-grids/${g.id}/draw`)).grid,
        confirm: async g => (await post(`rewards-grids/${g.id}/confirm`)).grid,
        assign: async (g, lotId, body) => (await patch(`rewards-grids/${g.id}/lots/${lotId}/assign`, body)).grid,
        markTaken: async (g, lotId, body) => (await patch(`rewards-grids/${g.id}/lots/${lotId}/taken`, body)).grid,
        close: async g => (await post(`rewards-grids/${g.id}/close`)).grid,
        reopen: async g => (await post(`rewards-grids/${g.id}/reopen`)).grid,
        remove: async g => { await http.delete(`rewards-grids/${g.id}`, auth()) },
      }
    },
    asAnonymous(slug, password) {
      const post = async (path, body = {}) => (await http.post(`${manage(slug)}/${path}`, { password, ...body })).data
      const patch = async (path, body = {}) => (await http.patch(`${manage(slug)}/${path}`, { password, ...body })).data
      return {
        mode: 'anonymous',
        addLot: async (g, body) => (await post('lots', body)).grid,
        removeLot: async (g, lotId) => { await http.delete(`${manage(slug)}/lots/${lotId}`, { data: { password } }) },
        draw: async () => (await post('draw')).grid,
        confirm: async () => (await post('confirm')).grid,
        assign: async (g, lotId, body) => (await patch(`lots/${lotId}/assign`, body)).grid,
        markTaken: async (g, lotId, body) => (await patch(`lots/${lotId}/taken`, body)).grid,
        close: async () => (await post('close')).grid,
      }
    },
  }

  return api
}
