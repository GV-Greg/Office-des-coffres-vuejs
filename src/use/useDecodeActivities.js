import { http } from '@/api.js'
import { useAuthStore } from '@/stores/authStore'

/*
  Appels de l'API des Coffres Scellés (brief admin/modules/animation/brief-coffres-scelles.md, lot 2).
  Aucune règle ici : qui peut gérer une activité (son organisateur seul), ce qui se supprime (une activité
  close), ce qui se rouvre, la note d'une combinaison — tout vient du serveur, les refus arrivent en FR et
  EN (`apiMessage`). Les jetons sont attachés à la main, comme partout (api.js).
  Les routes `anim/*` sont publiques : elles partent sans jeton.
*/
export default function useDecodeActivities() {
  const authStore = useAuthStore()
  const auth = () => ({ headers: { Authorization: `Bearer ${authStore.getToken}` } })

  return {
    /** Clés des types d'activité ouverts (`decode`…), pour le menu du module. */
    async types() {
      const { data } = await http.get('anim/activity-types')
      return data.types
    },
    /** Page publique d'une activité, par son nom. Jamais le code d'un coffre encore scellé. */
    async show(name) {
      const { data } = await http.get(`anim/decode-activities/${encodeURIComponent(name)}`)
      return data.activity
    },

    /** Les activités du personnage, avec le code du coffre en cours (organisateur seul). */
    async list(characterId) {
      const { data } = await http.get(`characters/${characterId}/decode-activities`, auth())
      return data.activities
    },
    async create(characterId, body) {
      const { data } = await http.post(`characters/${characterId}/decode-activities`, body, auth())
      return data.activity
    },
    async generateSecret(activityId) {
      const { data } = await http.post(`decode-activities/${activityId}/secrets`, {}, auth())
      return data.activity
    },
    /** Inscrit une proposition reçue : { score, found, proposal, activity }. */
    async propose(activityId, secretId, body) {
      const { data } = await http.post(`decode-activities/${activityId}/secrets/${secretId}/proposals`, body, auth())
      return data
    },
    async reopen(activityId) {
      const { data } = await http.post(`decode-activities/${activityId}/reopen`, {}, auth())
      return data.activity
    },
    async close(activityId) {
      const { data } = await http.post(`decode-activities/${activityId}/close`, {}, auth())
      return data.activity
    },
    async remove(activityId) {
      await http.delete(`decode-activities/${activityId}`, auth())
    },
    /** BBCode français prêt à coller sur le forum du jeu. */
    async exportRules(activityId) {
      const { data } = await http.get(`decode-activities/${activityId}/export/rules`, auth())
      return data.bbcode
    },
    async exportResults(activityId) {
      const { data } = await http.get(`decode-activities/${activityId}/export/results`, auth())
      return data.bbcode
    },
  }
}
