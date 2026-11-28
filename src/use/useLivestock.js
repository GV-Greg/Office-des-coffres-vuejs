import { http } from '@/api.js'
import { useAuthStore } from '@/stores/authStore'
import useSharedResource from '@/use/useSharedResource'

/*
  Le Livre des naissances côté serveur (GET characters/{id}/livestock) : droits, espèces de la province, naissances et prix.
  ⚠️ Aucune règle ici : qui lit, inscrit, retire ou fixe un prix, le serveur le dit ; ses refus arrivent en FR et EN
  (`apiMessage`). `characterId` : une ref, un getter ou une valeur ; null = sans compte (prêt tout de suite, rien à lire).
  Après un geste, `refresh()` relit sans repasser par l'état « en cours » : la page ne clignote pas.
*/
export default function useLivestock(characterId) {
  const authStore = useAuthStore()
  const auth = () => ({ headers: { Authorization: `Bearer ${authStore.getToken}` } })
  const url = (id, suffix = '') => `characters/${id}/livestock${suffix}`
  const fetch = async id => (await http.get(url(id), auth())).data

  const { data, ready } = useSharedResource('livestock', characterId, fetch)
  const current = () => (typeof characterId === 'function' ? characterId() : characterId?.value ?? characterId)

  const refresh = async () => {
    const id = current()
    if (!id) return
    const fresh = await fetch(id)
    if (current() === id) data.value = fresh
  }

  return {
    book: data,
    ready,
    refresh,
    pastMandate: async mandateId => (await http.get(url(current(), `/mandates/${mandateId}`), auth())).data,
    record: async body => (await http.post(url(current(), '/births'), body, auth())).data.birth,
    withdraw: async birthId => (await http.post(url(current(), `/births/${birthId}/withdraw`), {}, auth())).data,
    saveSpecies: async species => (await http.put(url(current(), '/species'), { species }, auth())).data.species,
    createPrice: async body => (await http.post(url(current(), '/prices'), body, auth())).data.price,
    updatePrice: async (priceId, body) => (await http.put(url(current(), `/prices/${priceId}`), body, auth())).data.price,
  }
}
