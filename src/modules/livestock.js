/*
  Les naissances inscrites et les prix de la nourriture (Livre des naissances) : logique pure, sans dépendance Vue.
  Le serveur sert les faits ; ici, seulement leur lecture : quel prix valait le jour d'une naissance, ce qu'elle a coûté, et les
  totaux par espèce. ⚠️ Aucune règle d'autorisation : qui lit, écrit ou retire vient de l'API.
*/
import { SPECIES } from './birthCosts'

/** Les quatre nourritures du cheptel, dans l'ordre d'affichage. */
export const FEEDS = Object.freeze(['maize', 'wheat', 'marjoram', 'elderberry'])

/** Jeu de prix en vigueur à un jour (le plus récent `effective_from` ≤ jour), ou null. */
export function feedSetForDay(sets, day) {
  let found = null
  for (const set of sets || []) {
    if (set.effective_from <= day && (!found || set.effective_from > found.effective_from)) found = set
  }
  return found
}

/** Prix d'une unité de nourriture ce jour-là, ou null si aucun n'est inscrit. */
export const feedPrice = (sets, day, feed) => feedSetForDay(sets, day)?.prices?.[feed] ?? null

/** Ce qu'une naissance a coûté en écus (nourriture prise × prix du jour), ou null sans prix. */
export function birthValue(birth, sets) {
  const price = feedPrice(sets, birth.born_on, birth.ingredient)
  return price === null ? null : Math.round(birth.taken * price * 100) / 100
}

/**
 * Totaux par espèce, dans l'ordre des espèces. `cost` additionne les naissances qui ont un prix ; `unpriced` compte les
 * autres, pour qu'un total incomplet ne passe jamais pour complet.
 * @returns {{ rows: Array<object>, animals: number, cost: number, unpriced: number }}
 */
export function summarizeBirths(births, sets) {
  const bySpecies = new Map()
  for (const birth of births || []) {
    const row = bySpecies.get(birth.species)
      ?? { species: birth.species, animals: 0, feeds: {}, cost: 0, unpriced: 0 }
    const value = birthValue(birth, sets)
    row.animals += birth.quantity
    row.feeds[birth.ingredient] = (row.feeds[birth.ingredient] ?? 0) + birth.taken
    if (value === null) row.unpriced += 1
    else row.cost = Math.round((row.cost + value) * 100) / 100
    bySpecies.set(birth.species, row)
  }
  const rows = SPECIES.map(s => bySpecies.get(s.key)).filter(Boolean)
  return {
    rows,
    animals: rows.reduce((sum, r) => sum + r.animals, 0),
    cost: Math.round(rows.reduce((sum, r) => sum + r.cost, 0) * 100) / 100,
    unpriced: rows.reduce((sum, r) => sum + r.unpriced, 0),
  }
}

/** Valeurs d'un formulaire de prix depuis un jeu (ou vides), en chaînes éditables. */
export function feedFormFrom(set, date) {
  return {
    effective_from: date,
    prices: Object.fromEntries(FEEDS.map(feed => [feed, set?.prices?.[feed] == null ? '' : String(set.prices[feed])])),
  }
}

// « 12 », « 12,5 » ou « 12.50 » ; vide = pas de prix.
const toPrice = text => {
  const clean = String(text ?? '').trim().replace(',', '.')
  if (clean === '') return null
  return /^\d{1,8}(\.\d{1,2})?$/.test(clean) ? Number(clean) : NaN
}

/** Corps de la requête, ou null si le formulaire n'est pas envoyable (date, au moins un prix, aucun prix illisible). */
export function feedBodyFromForm(form) {
  const prices = Object.fromEntries(FEEDS.map(feed => [feed, toPrice(form.prices[feed])]))
  const values = Object.values(prices)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.effective_from ?? '') || values.some(Number.isNaN) || values.every(v => v === null)) return null
  return { effective_from: form.effective_from, prices }
}
