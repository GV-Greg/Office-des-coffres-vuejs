import { ref, watch, unref } from 'vue'

/*
  Une ressource chargée par clé, avec un drapeau `ready`, partagée entre composants.

  - `sharedRequest(key, fetcher)` : les appels SIMULTANÉS pour une même clé partagent UNE requête. Aucun cache dans la
    durée, volontairement : un droit accordé entre-temps doit se voir au chargement suivant.
  - `useSharedResource(namespace, keySource, fetcher)` : `namespace` évite que deux ressources de même clé (un id de personnage, par exemple) partagent une requête par erreur. Suit une clé (ref, getter ou valeur ; null = rien à charger, prêt tout de suite
    et sans donnée). `ready` passe à vrai quand la réponse est connue, SUCCÈS OU ÉCHEC : une zone qui dépend de la donnée
    attend `ready` avant de choisir ce qu'elle montre (pas de contenu qui apparaît puis change). Un échec laisse `data` à
    null ; `error` garde l'exception pour qui veut la dire.
  Les clés et les appels sont ceux de l'appelant : ce fichier ne connaît aucune API.
*/
const inFlight = new Map()

export function sharedRequest(key, fetcher) {
  if (!inFlight.has(key)) {
    inFlight.set(key, Promise.resolve().then(fetcher).finally(() => inFlight.delete(key)))
  }
  return inFlight.get(key)
}

export default function useSharedResource(namespace, keySource, fetcher) {
  const data = ref(null)
  const error = ref(null)
  const ready = ref(false)
  let run = 0

  const read = () => (typeof keySource === 'function' ? keySource() : unref(keySource))

  async function load() {
    const key = read()
    const mine = ++run
    data.value = null
    error.value = null
    if (key === null || key === undefined || key === '') { ready.value = true; return }
    ready.value = false
    try {
      const result = await sharedRequest(`${namespace}:${key}`, () => fetcher(key))
      if (mine === run) data.value = result
    } catch (e) {
      if (mine === run) error.value = e
    } finally {
      if (mine === run) ready.value = true
    }
  }
  watch(read, load, { immediate: true })

  return { data, error, ready, reload: load }
}
