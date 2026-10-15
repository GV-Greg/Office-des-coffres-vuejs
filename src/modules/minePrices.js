// Prix des mines par période — logique pure, testée sans DOM (brief admin/content/brief-prix-registre.md,
// lot 2 ; décisions de Greg des 14-15/10/2026). Le serveur sert les jeux de prix (GET provinces/{id}/mine-prices) ;
// ici, seulement leur lecture : quel jeu est en vigueur CE jour-là, et quoi faire quand aucun ne l'est.
// ⚠️ Aucune règle d'autorisation : qui peut écrire ou corriger vient de l'API (`editable`, `access.prices`).

import { weekDates, shiftWeek, getWeekBounds } from './mineParser'

export const RESOURCES = ['OR', 'FER', 'PIERRE', 'ARGILE', 'SEL']

// L'or n'a pas de prix : sa production EST sa valeur en écus (Greg, 15/10/2026 : « l'or ne sert à rien dans
// la grille »). Il n'apparaît donc ni au formulaire ni dans la liste ; l'API exige encore la colonne, on y envoie 1.
export const PRICED_RESOURCES = RESOURCES.filter(r => r !== 'OR')
export const GOLD_PRICE = 1

/** Jeu de prix tel que l'attend computePeriodBilan : `{ prices, rate }`. */
export const asPriceSet = set => ({ prices: { ...set.prices }, rate: set.hourly_rate })

/** Jeu en vigueur à un jour (le plus récent `effective_from` ≤ jour), ou null. */
export function setForDay(priceSets, day) {
  let found = null
  for (const set of priceSets || []) {
    if (set.effective_from <= day && (!found || set.effective_from > found.effective_from)) found = set
  }
  return found
}

/**
 * Repli (brief « Fallback ») : sans jeu en base pour un jour, les prix du relevé inscrit LE PLUS PROCHE
 * qui en porte — c'est le comportement d'avant la gestion des prix, qui garde les données déjà saisies lisibles.
 */
export function nearestReportPrices(reports, day) {
  const dayMs = Date.parse(`${day}T00:00:00Z`)
  let best = null
  let bestGap = Infinity
  for (const r of reports || []) {
    if (!r.active || !r.prices || r.rate === null || r.rate === undefined) continue
    const gap = Math.abs(Date.parse(`${r.reported_at}T00:00:00Z`) - dayMs)
    // À égalité d'éloignement, le plus récent.
    if (gap < bestGap || (gap === bestGap && r.reported_at > best.reported_at)) { best = r; bestGap = gap }
  }
  return best ? { prices: best.prices, rate: best.rate } : null
}

/**
 * Fonction de prix pour computePeriodBilan : la table des prix d'abord (jeu en vigueur CE jour-là), puis
 * le repli — soit un jeu `{ prices, rate }` unique (bilans du mois et de mandat : le dernier relevé de la
 * période, comme avant la gestion des prix), soit une fonction `jour => jeu` (bilan d'une semaine :
 * nearestReportPrices), soit rien (null : le jour est dit « sans prix »).
 */
export function priceResolver(priceSets, fallback = null) {
  return day => {
    const set = setForDay(priceSets, day)
    if (set) return asPriceSet(set)
    return typeof fallback === 'function' ? fallback(day) : fallback
  }
}

/** Prix d'un relevé inscrit sous la forme d'un jeu, ou null s'il n'en porte pas. */
export const reportPriceSet = report => (report?.prices && report.rate !== null && report.rate !== undefined
  ? { prices: report.prices, rate: report.rate }
  : null)

/** Les lundis des semaines qui touchent la période [from, toExclusive[ — pour la navigation et l'alerte. */
export function mondaysBetween(from, toExclusive) {
  const out = []
  for (let monday = getWeekBounds(from).monday; monday < toExclusive; monday = shiftWeek(monday, 1)) out.push(monday)
  return out
}

/**
 * Semaines du mandat dont au moins un jour n'a AUCUN jeu de prix en vigueur (alerte discrète de la page
 * des prix : outil de suivi du gestionnaire, jamais un blocage). Jusqu'à hier : aujourd'hui n'est pas fini.
 */
export function uncoveredWeeks(priceSets, from, today) {
  if (!from) return []
  return mondaysBetween(from, today).filter(monday =>
    weekDates(monday).some(day => day >= from && day < today && !setForDay(priceSets, day)))
}

/** Valeurs d'un formulaire de prix depuis un jeu (ou vides), sous forme de chaînes éditables. */
export function formFromSet(set, date) {
  return {
    effective_from: date,
    prices: Object.fromEntries(PRICED_RESOURCES.map(r => [r, set ? String(set.prices[r]) : ''])),
    hourly_rate: set ? String(set.hourly_rate) : '',
  }
}

/** Corps de la requête : les nombres, deux décimales au plus (le serveur refuse davantage). */
export function bodyFromForm(form) {
  const num = v => Number(String(v).replace(',', '.'))
  return {
    effective_from: form.effective_from,
    prices: { OR: GOLD_PRICE, ...Object.fromEntries(PRICED_RESOURCES.map(r => [r, num(form.prices[r])])) },
    hourly_rate: num(form.hourly_rate),
  }
}

/** Le formulaire diffère-t-il de ce qui est affiché ? (« Mettre à jour » n'apparaît qu'alors.) */
export function isDirty(form, original) {
  if (form.effective_from !== original.effective_from) return true
  if (String(form.hourly_rate) !== String(original.hourly_rate)) return true
  return PRICED_RESOURCES.some(r => String(form.prices[r]) !== String(original.prices[r]))
}

/** Tous les champs sont remplis par des nombres ≥ 0 à deux décimales au plus. */
export function isComplete(form) {
  const ok = v => /^\d+([.,]\d{1,2})?$/.test(String(v).trim())
  return PRICED_RESOURCES.every(r => ok(form.prices[r])) && ok(form.hourly_rate) && !!form.effective_from
}

/**
 * Derniers prix saisis dans le Bilan public (confort : `economy_mines_settings`, `{ prices, rate }`), sous la
 * forme d'un jeu de départ pour le formulaire — seulement quand la province n'a AUCUN jeu en base. L'or ne
 * s'y trouve jamais (voir GOLD_PRICE). Null si
 * le confort est absent, illisible ou incomplet : le formulaire reste alors vide.
 */
export function setFromComfort(raw) {
  let saved
  try { saved = typeof raw === 'string' ? JSON.parse(raw) : raw } catch { return null }
  const prices = saved?.prices
  const rate = Number(saved?.rate)
  if (!prices || !Number.isFinite(rate)) return null
  const known = ['FER', 'PIERRE', 'ARGILE', 'SEL'].every(r => Number.isFinite(Number(prices[r])))
  if (!known) return null
  return {
    effective_from: null,
    prices: { OR: GOLD_PRICE, FER: Number(prices.FER), PIERRE: Number(prices.PIERRE), ARGILE: Number(prices.ARGILE), SEL: Number(prices.SEL) },
    hourly_rate: rate,
  }
}
