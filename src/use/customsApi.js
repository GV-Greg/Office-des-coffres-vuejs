import { http } from '@/api.js'
import { useAuthStore } from '@/stores/authStore'

/*
  Appels de l'API du Registre de douane (module Sécurité, PR 3-1 ; fil admin/echanges/module-securite). Aucune règle ici : qui lit, qui écrit,
  quels jours et quelles villes, le serveur le dit (`customs-access`) ; les refus arrivent en FR et EN (`apiMessage`).
  Le serveur reçoit le JSON analysé ET le brut gardé (customsPaste.js), valide la FORME, ne re-parse jamais.
  Les jetons sont attachés à la main, comme partout (api.js).
*/
export default function customsApi() {
  const authStore = useAuthStore()
  const auth = (extra = {}) => ({ headers: { Authorization: `Bearer ${authStore.getToken}` }, ...extra })
  const base = characterId => `characters/${characterId}`

  return {
    /** Ce que le personnage peut faire MAINTENANT et où : { province, role, has_security_trio, today, earliest_day, read_*, write_*, … } ou null. */
    access: characterId => http.get(`${base(characterId)}/customs-access`, auth()).then(({ data }) => data.access),
    /** Les jours qui ont un bilan pour la ville et, si `date` est donnée, le bilan de ce jour : { days, report }. Jamais le brut ni l'auteur. */
    reports: (characterId, cityId, date) => http.get(`${base(characterId)}/customs-reports`, auth({ params: { city_id: cityId, ...(date ? { date } : {}) } })).then(({ data }) => data),
    /** Inscrit le bilan : { city_id, date?, sections: { guet?, visions?, armies_groups? } } → { mode: created|completed|corrected }. */
    saveReport: (characterId, body) => http.post(`${base(characterId)}/customs-reports`, body, auth()).then(({ data }) => data),
    /** Les douaniers (PR 2) : le statut du personnage et, s'il valide, sa province, les demandes en attente et les douaniers en vigueur. */
    officer: characterId => http.get(`${base(characterId)}/customs`, auth()).then(({ data }) => data),
    requestOfficer: (characterId, cityId) => http.post(`${base(characterId)}/customs`, { city_id: cityId }, auth()).then(({ data }) => data),
    /** Retire sa demande en attente, ou renonce à son propre accès. */
    withdrawOfficer: characterId => http.delete(`${base(characterId)}/customs`, auth()).then(({ data }) => data),
    /** Réglage de la durée d'inactivité de la province (prévôt, connétable ; en leur absence le niveau 2). */
    setInactivityDays: (characterId, days) => http.put(`${base(characterId)}/customs/settings`, { inactivity_days: days }, auth()).then(({ data }) => data),
    /** `action` : approve | reject | revoke — le serveur dit si ce personnage le peut. */
    decideOfficer: (action, officerId) => http.post(`customs-officers/${officerId}/${action}`, {}, auth()).then(({ data }) => data),
    lists: characterId => http.get(`${base(characterId)}/customs-lists`, auth()).then(({ data }) => data.entries),
    addEntry: (characterId, body) => http.post(`${base(characterId)}/customs-lists`, body, auth()).then(({ data }) => data),
    updateEntry: (characterId, entryId, body) => http.put(`${base(characterId)}/customs-lists/${entryId}`, body, auth()).then(({ data }) => data),
    removeEntry: (characterId, entryId) => http.delete(`${base(characterId)}/customs-lists/${entryId}`, auth()).then(({ data }) => data),
  }
}
