// Registre des mines — lectures calculées sur les relevés inscrits (PR 4c ; brief
// admin/content/brief-registre-mines.md §7 ; fil admin/echanges/registre-mines, R4). Logique pure,
// testée sans DOM. Le serveur sert les faits ; ces lectures les interprètent avec le parseur qui les a
// produits — jamais une règle de mandat (dates, autorisations) : celles-là arrivent de l'API.

import { thresholdAlert, mergeMinesData, computePeriodBilan, periodDates } from './mineParser'

/** Clé d'une mine — même règle que mineKey du parseur : le nœud, le numéro en repli. */
const keyOf = mine => (mine?.noeud ? `noeud:${mine.noeud}` : `numero:${mine?.number}`)

/** Relevés EN VIGUEUR, du plus ancien au plus récent. */
export function activeAscending(reports) {
  return (reports || []).filter(r => r.active).slice().sort((a, b) => (a.reported_at < b.reported_at ? -1 : a.reported_at > b.reported_at ? 1 : a.id - b.id))
}

/** Une mine a-t-elle été entretenue (pierre ou fer consommés) entre `after` exclu et `upTo` inclus ? */
function maintainedBetween(mine, after, upTo) {
  return Object.entries(mine?.days ?? {}).some(([day, v]) => day > after && day <= upTo && ((v?.pierre ?? 0) > 0 || (v?.fer ?? 0) > 0))
}

/**
 * Historique des niveaux, par mine (brief §7) :
 *  - 'up'      : +1 (ou plus) — une amélioration délibérée, l'entretien automatique n'améliore jamais ;
 *  - 'failure' : −1 SANS entretien relevé depuis le relevé précédent, ALORS QUE le cumul avait atteint
 *                le seuil à ce relevé précédent — un échec daté, énoncé comme un FAIT ;
 *  - 'down'    : −1 dans tous les autres cas — un choix assumé.
 * ⚠️ Tant que la rupture n'a pas été observée une fois, 'failure' reste un constat, jamais une
 * conclusion : l'écran l'écrit comme tel.
 *
 * @returns {Array<{ key, number, label, level, since, events: Array<{ type, date, previous, from, to }> }>}
 */
export function levelHistory(reports) {
  const byMine = new Map()
  for (const r of activeAscending(reports)) {
    const minesByKey = new Map((r.report?.mines ?? []).map(m => [keyOf(m), m]))
    for (const state of r.report?.states ?? []) {
      const level = parseInt(state.niveau, 10)
      if (Number.isNaN(level)) continue
      const key = keyOf(state)
      const entry = byMine.get(key) ?? { key, number: state.number, label: state.label, level, since: r.reported_at, events: [], last: null }
      const last = entry.last
      if (last && level !== last.level) {
        const type = level > last.level
          ? 'up'
          : (!maintainedBetween(minesByKey.get(key), last.date, r.reported_at) && last.reached ? 'failure' : 'down')
        entry.events.push({ type, date: r.reported_at, previous: last.date, from: last.level, to: level })
        entry.since = r.reported_at
      }
      entry.level = level
      entry.number = state.number
      entry.label = state.label ?? entry.label
      entry.last = { level, date: r.reported_at, reached: thresholdAlert(state)?.level === 'reached' }
      byMine.set(key, entry)
    }
  }
  // `last` est l'état de travail du parcours : on ne le rend pas.
  return [...byMine.values()].map(entry => { const { last, ...rest } = entry; void last; return rest }).sort((a, b) => a.number - b.number)
}

/**
 * Bilans de mi-mandat et de fin de mandat (fil R4) : du jour d'entrée en fonction DU LECTEUR à
 * `mid_at` / `end_at` exclus, sur les relevés inscrits fusionnés. Avant la date : 'pending' — l'écran
 * dit « dans N jours », il n'affiche JAMAIS un bilan partiel sous ce titre (même règle que le §2.4 du
 * Bilan public). Prix et taux : ceux du dernier relevé inscrit dans la période — des valeurs datées.
 */
export function mandateBilans(registry) {
  const mandate = registry?.mandate
  if (!mandate?.in_office_from) return []
  const reports = activeAscending(registry.reports)
  const merged = reports.reduce((acc, r) => mergeMinesData(acc, r.report?.mines ?? []), [])
  const daysUntil = to => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${registry.today}T00:00:00Z`)) / 86400000)

  return [['mid', mandate.mid_at], ['end', mandate.end_at]].map(([kind, at]) => {
    if (registry.today < at) return { kind, status: 'pending', from: mandate.in_office_from, at, inDays: daysUntil(at) }
    const inPeriod = reports.filter(r => r.reported_at < at)
    const reference = inPeriod[inPeriod.length - 1] ?? null
    return {
      kind, status: 'ready', from: mandate.in_office_from, at,
      prices: reference?.prices ?? null, rate: reference?.rate ?? null,
      bilan: computePeriodBilan(merged, reference?.prices ?? {}, reference?.rate ?? 0, periodDates(mandate.in_office_from, at)),
    }
  })
}
