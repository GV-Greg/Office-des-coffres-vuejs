// Comparaison de deux inventaires (La Balance des stocks). Logique pure, sans dépendance Vue : les textes et l'affichage vivent dans
// EconomyInventoryBalance.vue, le BBCode dans inventoryBalanceBBcode.js.
//
// Entrées : deux inventaires déjà lus et fusionnés par nom (`parseInventoryText` puis `resolveItems`) :
//   { totalEcus: number|null, items: [{ quantity, name, truncated }] }
// Les noms se comparent tels quels : le jeu raccourcit toujours un même nom de la même façon, et `resolveItems` a déjà réuni les
// doublons. ⚠️ Un nom tronqué (« …. ») reste tel quel (aucune table de référence) : il se compare à lui-même, jamais à un nom complet.

/** Statuts d'une ligne : hausse, baisse, identique, nouveau (absent de l'ancien inventaire). */
export const STATUS = Object.freeze({ UP: 'up', DOWN: 'down', SAME: 'same', NEW: 'new' })

const byName = (a, b) => a.name.localeCompare(b.name, 'fr')

/**
 * @param {{ totalEcus: number|null, items: Array<{quantity: number, name: string, truncated?: boolean}> }} previous
 * @param {{ totalEcus: number|null, items: Array<{quantity: number, name: string, truncated?: boolean}> }} current
 * @returns {{
 *   rows: Array<{ name: string, quantity: number, before: number|null, diff: number, status: string, truncated: boolean }>,
 *   disappeared: Array<{ name: string, before: number, truncated: boolean }>,
 *   ecus: { before: number, after: number, diff: number }|null,
 *   hasChanges: boolean,
 *   counts: { up: number, down: number, same: number, new: number, disappeared: number },
 * }}
 */
export function compareInventories(previous, current) {
  const before = new Map((previous?.items ?? []).map(item => [item.name, item]))
  const counts = { up: 0, down: 0, same: 0, new: 0, disappeared: 0 }

  const rows = (current?.items ?? []).map(item => {
    const old = before.get(item.name)
    before.delete(item.name)
    const diff = item.quantity - (old?.quantity ?? 0)
    const status = !old ? STATUS.NEW : diff > 0 ? STATUS.UP : diff < 0 ? STATUS.DOWN : STATUS.SAME
    counts[status] += 1
    return {
      name: item.name,
      quantity: item.quantity,
      before: old ? old.quantity : null,
      diff,
      status,
      truncated: item.truncated === true,
    }
  }).sort(byName)

  // Ce qui reste dans l'ancien inventaire n'est plus dans le nouveau.
  const disappeared = [...before.values()]
    .map(item => ({ name: item.name, before: item.quantity, truncated: item.truncated === true }))
    .sort(byName)
  counts.disappeared = disappeared.length

  const hasEcus = previous?.totalEcus != null && current?.totalEcus != null
  const ecus = hasEcus
    ? { before: previous.totalEcus, after: current.totalEcus, diff: Math.round((current.totalEcus - previous.totalEcus) * 100) / 100 }
    : null

  const hasChanges = counts.up + counts.down + counts.new + counts.disappeared > 0 || (ecus !== null && ecus.diff !== 0)

  return { rows, disappeared, ecus, hasChanges, counts }
}

/** « +3 », « -2 », « 0 » : l'écart signé d'une quantité. */
export function formatDiff(diff) {
  if (diff > 0) return `+${diff}`
  if (diff < 0) return `-${Math.abs(diff)}`
  return '0'
}

/** L'écart d'écus, avec les décimales françaises : « +120,50 », « -3,00 ». */
export function formatEcusDiff(diff) {
  const abs = Math.abs(diff).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return diff > 0 ? `+${abs}` : diff < 0 ? `-${abs}` : abs
}
