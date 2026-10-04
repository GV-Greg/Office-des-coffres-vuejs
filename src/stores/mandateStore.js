import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { http } from '@/api.js'
import { useAuthStore } from '@/stores/authStore'

/*
  Mandats de maire et de conseiller comtal (admin/content/brief-mandats.md, lot 2 ; arbitrages
  admin/echanges/mandats-lot1/ et mandats-lot2/).

  Toutes les RÈGLES vivent dans le backend : ce store ne recode ni le cumul (`requestable` arrive
  de l'API, Q6), ni le renouvellement (`renewable` par mandat), ni les libellés des postes, motifs
  et causes de fin (servis par l'API en FR et EN, Q11). Il ne porte que les appels.
*/
export const useMandateStore = defineStore('mandates', () => {
  const authStore = useAuthStore()

  const mandates = ref([])
  const characters = ref([])   // { id, pseudo, is_validated, requestable: { mayor, council } }
  const offices = ref([])      // { key, position, label: { fr, en } }
  const loaded = ref(false)

  const auth = () => ({ headers: { Authorization: `Bearer ${authStore.getToken}` } })

  const fetchAll = async () => {
    const response = await http.get('mandates', auth())
    mandates.value = response.data.mandates
    characters.value = response.data.characters
    loaded.value = true
  }

  // Référentiel public, chargé une fois.
  const fetchOffices = async () => {
    if (offices.value.length) return
    const response = await http.get('council-offices')
    offices.value = response.data.offices
  }

  const requestMandate = async (characterId, payload) => {
    await http.post(`characters/${characterId}/mandates`, payload, auth())
    await fetchAll()
  }

  const renew = async (mandate, payload) => {
    await http.post(`mandates/${mandate.level}/${mandate.id}/renew`, payload, auth())
    await fetchAll()
  }

  const cancel = async (mandate) => {
    await http.delete(`mandates/${mandate.level}/${mandate.id}`, auth())
    await fetchAll()
  }

  // « Déclarer mon poste » : officeKey null = devenir sans poste.
  const declareOffice = async (mandate, officeKey) => {
    await http.post(`mandates/council/${mandate.id}/office`, { council_office_key: officeKey }, auth())
    await fetchAll()
  }

  const hasAny = computed(() => mandates.value.length > 0)

  return {
    mandates, characters, offices, loaded, hasAny,
    fetchAll, fetchOffices, requestMandate, renew, cancel, declareOffice,
  }
})

/*
  Message d'erreur de l'API dans la langue de l'interface (fil mandats-lot2, Q9/Q10) : le backend
  envoie, pour chaque champ, `messages[champ] = { fr, en }` — et au premier niveau pour un 404 ou
  un 429. ⚠️ AUCUNE table code → texte ici : le code ne sert qu'à la logique d'écran, le texte vient
  toujours de l'API. Repli : le message brut (`errors`), puis un message réseau générique.
*/
export function apiFieldErrors(error, locale) {
  const data = error?.response?.data ?? {}
  const result = {}
  for (const [field, list] of Object.entries(data.errors ?? {})) {
    result[field] = data.messages?.[field]?.[locale] ?? list[0]
  }
  return result
}

export function apiMessage(error, locale, fallback) {
  const data = error?.response?.data ?? {}
  if (data.messages?.[locale] && typeof data.messages[locale] === 'string') return data.messages[locale]
  const fields = apiFieldErrors(error, locale)
  const first = Object.values(fields)[0]
  return first ?? data.message ?? fallback
}
