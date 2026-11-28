/*
  Le Livre des naissances : ce qu'une naissance coûte au comté. Logique pure, sans dépendance Vue.
  Les coûts et les prix sont FIXÉS PAR LE JEU (wiki, page « Animaux », lue le 27/11/2026) : rien n'est configurable ici.
  🔴 Chaque coût est une FRACTION exacte [numérateur, dénominateur] : le jeu affiche 2,33 et 1,67 pour 7/3 et 5/3, et calculer avec
  la valeur affichée ferait prendre un sac de trop (3 × 1,67 = 5,01, arrondi à 6 au lieu de 5).
  Le jeu prend un nombre ENTIER d'ingrédient, arrondi au supérieur : la différence est perdue.
*/

export const MAX_BATCH = 4
export const BATCH_SIZES = Object.freeze(Array.from({ length: MAX_BATCH }, (_, i) => i + 1))

const LARGE = { maize: [45, 4], wheat: [3, 1] }
const MEDIUM = { maize: [35, 4], wheat: [7, 3] }

/** Les six espèces, dans l'ordre d'affichage. `price` : le prix payé par l'éleveur pour un animal, en écus. */
export const SPECIES = Object.freeze([
  { key: 'cow', price: 45, costs: LARGE },
  { key: 'goat', price: 45, costs: LARGE },
  { key: 'sheep', price: 35, costs: MEDIUM },
  { key: 'ewe', price: 35, costs: MEDIUM },
  { key: 'pig', price: 25, costs: { maize: [25, 4], wheat: [5, 3] } },
  { key: 'bees', price: 45, costs: { marjoram: [69, 1], elderberry: [22, 1] } },
])

export const speciesByKey = key => SPECIES.find(species => species.key === key) ?? null

/** Les ingrédients qu'une espèce accepte (on en choisit UN). */
export const ingredientsOf = key => Object.keys(speciesByKey(key)?.costs ?? {})

/**
 * @param {string} speciesKey
 * @param {string} ingredient
 * @param {number} quantity  de 1 à MAX_BATCH
 * @returns {{ theoretical: number, real: number, waste: number }|null} null si la demande n'existe pas dans le jeu
 */
export function birthCost(speciesKey, ingredient, quantity) {
  const cost = speciesByKey(speciesKey)?.costs[ingredient]
  if (!cost || !BATCH_SIZES.includes(quantity)) return null
  const [num, den] = cost
  const total = num * quantity
  const real = Math.floor((total + den - 1) / den) // arrondi au supérieur, en entiers
  return { theoretical: total / den, real, waste: (real * den - total) / den }
}
