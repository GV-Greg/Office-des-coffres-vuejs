import { http } from '@/api.js'
import { useAuthStore } from '@/stores/authStore'

/*
  Appels de l'API des inventaires (fil admin/echanges/inventaire-scopes et inventaire-bilans, 11/11/2026). Aucune règle ici :
  qui lit, écrit ou copie est décidé par le serveur, par le poste tenu MAINTENANT ; les refus arrivent en FR et EN (`apiMessage`).
  Trois niveaux : `personal` (le personnage), `city` (le maire), `province` (le commissaire au commerce, le dirigeant lit).
  Les jetons sont attachés à la main, comme partout (api.js).
*/
export default function inventoryApi() {
  const authStore = useAuthStore()
  const auth = () => ({ headers: { Authorization: `Bearer ${authStore.getToken}` } })
  const base = (characterId) => `characters/${characterId}`

  return {
    /** Ce que le personnage peut gérer MAINTENANT : { personal, city, province } (city et province valent null sans le poste). */
    scopes: (characterId) => http.get(`${base(characterId)}/inventory-scopes`, auth()).then(({ data }) => data),
    /** Les réglages d'un niveau : { data, version, updated_at, scope } — `data` vaut null tant que rien n'est écrit (version 0). */
    getSettings: (characterId, level) => http.get(`${base(characterId)}/inventory-settings/${level}`, auth()).then(({ data }) => data.settings),
    /** Écrit les réglages : `version` = celle que le client a lue (409 + état courant sinon). */
    saveSettings: (characterId, level, data, version) =>
      http.put(`${base(characterId)}/inventory-settings/${level}`, { data, version }, auth()).then(({ data: body }) => body.settings),
    /** Copie les réglages personnels de `fromId` vers `targetId` (deux personnages du même compte). */
    copyPersonal: (targetId, fromId, confirmReplace = false) =>
      http.post(`${base(targetId)}/inventory-settings/personal/copy`, { from_character_id: fromId, confirm_replace: confirmReplace }, auth())
        .then(({ data }) => data.settings),
    /** Le dernier inventaire collé (personnel ou ville) : { raw, saved_at, scope }. */
    getText: (characterId, level) => http.get(`${base(characterId)}/inventory/${level}`, auth()).then(({ data }) => data.inventory),
    putText: (characterId, level, raw) => http.put(`${base(characterId)}/inventory/${level}`, { raw }, auth()).then(({ data }) => data.inventory),
    /** L'historique des inventaires de la province : { province, snapshots: [{ id, taken_on, raw, by_me }], can_write }. */
    provinceHistory: (characterId) => http.get(`${base(characterId)}/inventory/province`, auth()).then(({ data }) => data),
    /** Inscrit l'inventaire du jour dans l'historique : { snapshot, replaced, unchanged }. */
    recordProvince: (characterId, raw) => http.post(`${base(characterId)}/inventory/province`, { raw }, auth()).then(({ data }) => data),
  }
}
