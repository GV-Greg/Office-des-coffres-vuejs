// Lectures du Registre des stocks (PR 3b, 12). Logique PURE, sans dépendance Vue :
// l'écran lui passe la réponse du serveur ; aucune règle du jeu n'est recodée ici — les repères du mandat (`mandate` : entrée en fonction,
// mi-mandat, fin, début de la fenêtre « prédécesseurs ») viennent TOUS du serveur, ce module ne fait que des comparaisons de dates et le
// calcul d'évolution avec le moteur de La Balance (`inventoryCompare.js`).
//
// Un inventaire est un INSTANTANÉ, pas un flux : le seul calcul qui a du sens est l'évolution entre deux photos.
//   - DÉPART  = la dernière inscription datée AU PLUS TARD le jour d'entrée en fonction (l'inventaire HÉRITÉ du prédécesseur) ;
//               à défaut, la première inscription du mandat ;
//   - ARRIVÉE = la dernière inscription datée STRICTEMENT AVANT la date du bilan (comme `reported_at < at` des mines), et après le départ ;
//   - BILAN   = compareInventories(départ, arrivée). Avant la date du bilan : « disponible le JJ/MM, dans N jours », JAMAIS un bilan partiel.
// Aucun score, aucun jugement : des faits (dates, périodes sans inscription).

import { parseInventoryText, resolveItems } from '@/modules/inventoryParser'
import { compareInventories } from '@/modules/inventoryCompare'

const DAY_MS = 86400000

const toTime = iso => Date.parse(`${iso}T00:00:00Z`)

/** Nombre de jours entiers de `from` à `to` (AAAA-MM-JJ) : positif si `to` est après `from`. */
export const daysBetween = (from, to) => Math.round((toTime(to) - toTime(from)) / DAY_MS)

/** `iso` décalé de `n` jours (AAAA-MM-JJ, dates pures, sans heure). */
export function addDays(iso, n) {
  const d = new Date(toTime(iso))
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Un inventaire lu et fusionné par nom : { totalEcus, items }. */
export function inventoryOf(raw) {
  const { totalEcus, items } = parseInventoryText(raw ?? '')
  return { totalEcus, items: resolveItems(items) }
}

/** Les inscriptions du plus ancien au plus récent (la réponse du serveur va du plus récent au plus ancien). */
export const ascending = snapshots => [...(snapshots ?? [])].sort((a, b) => (a.taken_on < b.taken_on ? -1 : a.taken_on > b.taken_on ? 1 : a.id - b.id))

/** L'inscription de DÉPART d'un mandat (voir l'en-tête), ou null. */
export function departure(snapshots, mandate) {
  if (!mandate?.in_office_from) return null
  const list = ascending(snapshots)
  const inherited = list.filter(s => s.taken_on <= mandate.in_office_from).pop()
  return inherited ?? list.find(s => s.taken_on > mandate.in_office_from) ?? null
}

/**
 * Les deux bilans du mandat DU LECTEUR (mi-mandat, fin), dans cet ordre. Chacun : { kind, at, status, ... } avec `status` :
 *   'pending'      la date n'est pas arrivée : { inDays } — jamais un bilan partiel ;
 *   'insufficient' il manque une inscription : { missing: ['start'|'end', …] } ;
 *   'ready'        { start, end, result } — `result` = compareInventories(départ, arrivée).
 * @returns {Array<object>} vide sans repères de mandat
 */
export function mandateBilans(snapshots, mandate, today) {
  if (!mandate?.in_office_from || !today) return []
  const start = departure(snapshots, mandate)
  return [['mid', mandate.mid_at], ['end', mandate.end_at]].filter(([, at]) => at).map(([kind, at]) => {
    if (today < at) return { kind, at, status: 'pending', inDays: daysBetween(today, at) }
    const end = ascending(snapshots).filter(s => s.taken_on < at && (!start || s.taken_on > start.taken_on)).pop() ?? null
    if (!start || !end) return { kind, at, status: 'insufficient', missing: [...(!start ? ['start'] : []), ...(!end ? ['end'] : [])], start, end }
    return { kind, at, status: 'ready', start, end, result: compareInventories(inventoryOf(start.raw), inventoryOf(end.raw)) }
  })
}

/**
 * Les inscriptions des PRÉDÉCESSEURS : celles d'AUTRES que le lecteur (`by_me` faux), dans la fenêtre qui précède son entrée en fonction —
 * des estampilles déjà écrites, jamais « qui occupait le poste ». La fenêtre (`predecessor_from` → veille de l'entrée en fonction) vient du serveur.
 * Du plus récent au plus ancien ; personne n'est nommé.
 */
export function predecessorEntries(snapshots, mandate) {
  if (!mandate?.in_office_from || !mandate.predecessor_from) return []
  return ascending(snapshots)
    .filter(s => !s.by_me && s.taken_on >= mandate.predecessor_from && s.taken_on < mandate.in_office_from)
    .reverse()
}

/**
 * Les jours SANS inscription depuis l'entrée en fonction jusqu'à HIER (aujourd'hui peut encore s'inscrire), en périodes consécutives : les
 * intervalles entre deux inscriptions, du début du mandat à la première, et de la dernière à hier. Un fait, jamais un jugement : aucun seuil,
 * aucune couleur — une inscription est un seul jour et le registre se remplit « sur demande » (brief §3.7).
 * @returns {{ days: number, periods: Array<{ from: string, to: string, days: number }> }|null} null sans mandat connu
 */
export function emptyPeriods(snapshots, mandate, today) {
  if (!mandate?.in_office_from || !today) return null
  const last = addDays(today, -1)
  const covered = new Set((snapshots ?? []).map(s => s.taken_on))
  const periods = []
  let open = null
  for (let day = mandate.in_office_from; day <= last; day = addDays(day, 1)) {
    if (covered.has(day)) {
      if (open) { periods.push(open); open = null }
    } else if (open) {
      open.to = day
      open.days += 1
    } else {
      open = { from: day, to: day, days: 1 }
    }
  }
  if (open) periods.push(open)
  return { days: periods.reduce((sum, p) => sum + p.days, 0), periods }
}
