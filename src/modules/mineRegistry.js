// Registre des mines — lectures calculées sur les relevés inscrits (PR 4c ; brief
// admin/content/brief-registre-mines.md §7 ; fil admin/echanges/registre-mines, R4). Logique pure,
// testée sans DOM. Le serveur sert les faits ; ces lectures les interprètent avec le parseur qui les a
// produits — jamais une règle de mandat (dates, autorisations) : celles-là arrivent de l'API.

import { thresholdAlert, mergeMinesData, computePeriodBilan, periodDates, detectResource } from './mineParser'

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

/**
 * Jours SANS DONNÉES depuis l'entrée en fonction du lecteur, jusqu'à hier (Greg, 09/10/2026) : un
 * collage porte les 7 derniers jours du jeu, donc un jour sans collage n'est pas forcément perdu. Un
 * jour est couvert dès qu'un relevé en vigueur contient une donnée de ce jour, pour une mine au moins
 * (production, heures ou consommation). C'est ce qui est réellement perdu — pas l'assiduité.
 *
 * @returns {string[]|null} null sans mandat connu
 */
export function daysWithoutData(registry) {
  const start = registry?.mandate?.in_office_from
  if (!start) return null
  const covered = new Set()
  for (const r of activeAscending(registry.reports)) {
    for (const mine of r.report?.mines ?? []) {
      for (const [day, values] of Object.entries(mine.days ?? {})) {
        if (Object.values(values ?? {}).some(v => v !== null && v !== undefined)) covered.add(day)
      }
    }
  }
  return periodDates(start, registry.today).filter(day => !covered.has(day))
}

/**
 * Mines de tous les relevés en vigueur, fusionnées du plus ancien au plus récent (clé : le nœud).
 * Libellé et ressource manquants (relevés inscrits avant back #58, où Laravel les retirait) : repris
 * de l'ÉTAT de la mine dans les relevés (même nœud), qui les a toujours gardés — sinon la valeur
 * tomberait à 0 faute de savoir ce que la mine produit.
 */
function mergedMines(registry) {
  const reports = activeAscending(registry.reports)
  const labels = new Map(reports.flatMap(r => (r.report?.states ?? []).map(s => [keyOf(s), s.label])).filter(([, l]) => l))
  return reports
    .reduce((acc, r) => mergeMinesData(acc, r.report?.mines ?? []), [])
    .map((m) => {
      const label = m.label ?? labels.get(keyOf(m)) ?? null
      return { ...m, label, resource: m.resource ?? detectResource(label) }
    })
}
/**
 * Bilan EN COURS du mois de mandat (Greg, 09/10/2026 — remplace l'état des seuils en tête du registre) :
 * 1er mois = de l'entrée en fonction à hier ; 2e mois = de la mi-mandat à hier. PROVISOIRE par nature :
 * l'écran le titre « en cours » et dit sa couverture — jamais « bilan de mi-mandat » avant la date (R4).
 * Prix et taux : ceux du dernier relevé en vigueur. Niveau : celui du dernier relevé, par mine.
 *
 * @returns {{ month: 1|2, from: string, to: string, bilan, levels: Map<string, string> }|null}
 *   null sans mandat, avant le premier jour complet, ou une fois le mandat terminé
 */
export function currentPeriodBilan(registry) {
  const mandate = registry?.mandate
  if (!mandate?.in_office_from || registry.today >= mandate.end_at) return null
  const month = registry.today < mandate.mid_at ? 1 : 2
  const from = month === 1 ? mandate.in_office_from : mandate.mid_at
  const days = periodDates(from, registry.today)
  if (days.length === 0) return null

  const reports = activeAscending(registry.reports)
  const latest = reports[reports.length - 1] ?? null
  const levels = new Map((latest?.report?.states ?? []).map(s => [keyOf(s), s.niveau]))

  return {
    month, from, to: days[days.length - 1],
    prices: latest?.prices ?? null, rate: latest?.rate ?? null,
    bilan: computePeriodBilan(mergedMines(registry), latest?.prices ?? {}, latest?.rate ?? 0, days),
    levels,
  }
}

/** Clé d'une ligne de bilan, pour retrouver son niveau. */
export const lineKey = keyOf
