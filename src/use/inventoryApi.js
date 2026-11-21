import { http } from '@/api.js'
import { useAuthStore } from '@/stores/authStore'

/*
  Appels de l'API des inventaires (fil admin/echanges/inventaire-scopes et inventaire-bilans, 11/11/2026). Aucune règle ici :
  qui lit, écrit ou copie est décidé par le serveur, par le poste tenu MAINTENANT ; les refus arrivent en FR et EN (`apiMessage`).
  Trois niveaux : `personal` (le personnage), `city` (le maire), `province` (le commissaire au commerce, le dirigeant lit).
  Les jetons sont attachés à la main, comme partout (api.js).
*/
/** Routes du registre : la province garde sa route d'origine, la ville a la sienne. */
const registryPath = (level) => (level === 'city' ? 'inventory/city/registry' : 'inventory/province')

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
    /**
     * Le REGISTRE d'un niveau (fil admin/echanges/registre-stocks) : `province` (commissaire au commerce ; le dirigeant lit) ou `city` (le maire).
     * { province|city: { id, name }, snapshots: [{ id, taken_on, saved_at, office_key, by_me, replaced, raw }], can_write }.
     * `replaced` = le rédacteur de l'inscription que celle-ci a remplacée ({ pseudo, office_label: { fr, en }, … }) ou null ; l'auteur d'une
     * inscription en vigueur n'est jamais nommé (`by_me` seulement).
     */
    registry: (characterId, level) => http.get(`${base(characterId)}/${registryPath(level)}`, auth()).then(({ data }) => data),
    /**
     * Inscrit l'inventaire du jour au registre : { snapshot, replaced, unchanged }. Un AUTRE texte le même jour répond 409 (+ `existing`, l'auteur
     * de l'inscription à remplacer) tant que `confirmReplace` n'est pas vrai ; l'ancienne inscription reste, rien ne s'efface.
     */
    recordRegistry: (characterId, level, raw, confirmReplace = false) =>
      http.post(`${base(characterId)}/${registryPath(level)}`, confirmReplace ? { raw, confirm_replace: true } : { raw }, auth()).then(({ data }) => data),
    /** Historique et inscription de la province (alias de `registry`/`recordRegistry`). */
    provinceHistory: (characterId) => http.get(`${base(characterId)}/${registryPath('province')}`, auth()).then(({ data }) => data),
    recordProvince: (characterId, raw) => http.post(`${base(characterId)}/${registryPath('province')}`, { raw }, auth()).then(({ data }) => data),
  }
}
