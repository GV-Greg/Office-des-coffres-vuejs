import { http } from '@/api.js'
import { useAuthStore } from '@/stores/authStore'
import animApi from '@/use/animApi'
import { ANIM_KINDS } from '@/modules/animKinds'

/*
  Appels de l'API de la Grille des lots (brief admin/content/brief-grille-des-lots.md). Le socle commun à toutes les activités vit dans
  `use/animApi.js` ; ce fichier n'ajoute que les gestes PROPRES à la grille. Aucune règle ici : qui peut gérer, ce qui se supprime ou se
  rouvre, les règles du slug et du mot de passe — tout vient du serveur, les refus arrivent en FR et EN (`apiMessage`).
  ⚠️ Le tirage fait passer la grille DIRECTEMENT à `confirmed` (décision de Greg, 10/11/2026 : l'étape « confirmer » ne laissait rien à
  modifier). Il n'y a donc aucun geste `confirm`.
*/
export default function useRewardsGrid() {
  const authStore = useAuthStore()
  const auth = () => ({ headers: { Authorization: `Bearer ${authStore.getToken}` } })
  const base = animApi({ key: 'rewards', api: ANIM_KINDS.rewards.api, auth })
  const { manage } = base

  const api = {
    ...base,

    /**
     * Les gestes de gestion d'UNE grille, les mêmes pour les deux modes.
     * `reopen` et `remove` n'existent pas sans compte (clôture définitive).
     */
    asOrganizer() {
      const post = async (url, body = {}) => (await http.post(url, body, auth())).data
      const patch = async (url, body = {}) => (await http.patch(url, body, auth())).data
      return {
        mode: 'private',
        // Plusieurs lots en UNE requête (une liste collée, une quantité) : une requête par lot épuiserait la limite de débit de l'API (60 par minute).
        addLots: async (g, names) => (await post(`rewards-grids/${g.id}/lots`, { names })).grid,
        removeLot: async (g, lotId) => { await http.delete(`rewards-grids/${g.id}/lots/${lotId}`, auth()) },
        draw: async g => (await post(`rewards-grids/${g.id}/draw`)).grid,
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
        addLots: async (g, names) => (await post('lots', { names })).grid,
        removeLot: async (g, lotId) => { await http.delete(`${manage(slug)}/lots/${lotId}`, { data: { password } }) },
        draw: async () => (await post('draw')).grid,
        assign: async (g, lotId, body) => (await patch(`lots/${lotId}/assign`, body)).grid,
        markTaken: async (g, lotId, body) => (await patch(`lots/${lotId}/taken`, body)).grid,
        close: async () => (await post('close')).grid,
      }
    },
  }

  return api
}
