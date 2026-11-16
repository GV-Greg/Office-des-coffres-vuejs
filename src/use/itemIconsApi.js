import { http } from '@/api.js'
import { batchNames, cleanIcons } from '@/modules/itemIcons'

/*
  Lecture publique des icônes d'items (`GET item-icons?names[]=…`, aucun jeton : c'est une donnée de référence).
  Le serveur répond sous le nom TEL QU'ENVOYÉ (`{ success, icons: { nom: id } }`) et n'y met que les items qui ont une icône.
  Appelée au moment de l'EXPORT, jamais à l'affichage. Les réponses sont gardées pour la durée de la page (en plus du cache HTTP
  de 24 h du serveur) : un second export du même inventaire ne refait aucune requête. Un nom sans icône est gardé aussi.
*/
const known = new Map() // nom → ID, ou null (le serveur n'en a pas)

/** Vide la mémoire de la page (tests, changement de compte). */
export function clearItemIconCache() {
  known.clear()
}

/** Les icônes des noms donnés : `{ nom: ID }`, seulement pour ceux qui en ont une. Lève l'erreur réseau d'un lot qui échoue. */
export async function fetchItemIcons(names) {
  const missing = []
  for (const batch of batchNames(names)) {
    for (const name of batch) if (!known.has(name)) missing.push(name)
  }

  for (const batch of batchNames(missing)) {
    const { data } = await http.get('item-icons', { params: { names: batch } })
    const icons = cleanIcons(data?.icons)
    for (const name of batch) known.set(name, icons[name] ?? null)
  }

  const out = {}
  for (const name of names) {
    const id = known.get(name)
    if (id) out[name] = id
  }
  return out
}
