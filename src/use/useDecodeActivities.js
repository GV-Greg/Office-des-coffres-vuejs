import { http } from '@/api.js'
import { useAuthStore } from '@/stores/authStore'
import animApi from '@/use/animApi'
import { ANIM_KINDS } from '@/modules/animKinds'

/*
  Appels de l'API de « Décode le code » (brief admin/modules/animation/brief-coffres-scelles.md ; spécification à jour : tour 12 du
  fil admin/echanges/animation-coffres-scelles). Le socle commun à toutes les activités (lecture publique, slug, mode privé, mode sans
  compte, réinitialisation) vit dans `use/animApi.js` ; ce fichier n'ajoute que les gestes PROPRES à Décode. Aucune règle ici : qui peut
  gérer une activité, ce qui se supprime ou se rouvre, la note d'une combinaison, les règles du slug et du mot de passe — tout vient du
  serveur, les refus arrivent en FR et EN (`apiMessage`).
  Les routes `anim/*` de lecture sont publiques : elles partent sans jeton.
  ⚠️ Le mot de passe ne sort jamais de cette composition : il n'est ni stocké, ni mémorisé (D4), ni placé dans une adresse.
*/
export default function useDecodeActivities() {
  const authStore = useAuthStore()
  const auth = () => ({ headers: { Authorization: `Bearer ${authStore.getToken}` } })
  const base = animApi({ key: 'decode', api: ANIM_KINDS.decode.api, auth })
  const { manage } = base

  const api = {
    ...base,

    /** Clés des types d'activité ouverts (`decode`…), pour le menu du module. */
    async types() {
      const { data } = await http.get('anim/activity-types')
      return data.types
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
