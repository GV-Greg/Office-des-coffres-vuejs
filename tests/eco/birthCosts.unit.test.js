// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { SPECIES, BATCH_SIZES, ingredientsOf, birthCost } from '../../src/modules/birthCosts'

// Les coûts du jeu (wiki « Animaux ») : ce qu'il faut prévoir pour 1 à 4 naissances, arrondi au supérieur, et ce qui se perd.
const EXPECTED = {
  cow: { maize: [12, 23, 34, 45], wheat: [3, 6, 9, 12] },
  goat: { maize: [12, 23, 34, 45], wheat: [3, 6, 9, 12] },
  sheep: { maize: [9, 18, 27, 35], wheat: [3, 5, 7, 10] },
  ewe: { maize: [9, 18, 27, 35], wheat: [3, 5, 7, 10] },
  pig: { maize: [7, 13, 19, 25], wheat: [2, 4, 5, 7] },
  bees: { marjoram: [69, 138, 207, 276], elderberry: [22, 44, 66, 88] },
}

describe('Le Livre des naissances — les coûts', () => {
  it('six espèces, sans poule, chacune avec ses deux ingrédients', () => {
    expect(SPECIES.map(s => s.key)).toEqual(['cow', 'goat', 'sheep', 'ewe', 'pig', 'bees'])
    for (const s of SPECIES) expect(ingredientsOf(s.key)).toEqual(Object.keys(EXPECTED[s.key]))
  })

  for (const [species, ingredients] of Object.entries(EXPECTED)) {
    for (const [ingredient, amounts] of Object.entries(ingredients)) {
      it(`${species} / ${ingredient} : ${amounts.join(', ')}`, () => {
        expect(BATCH_SIZES.map(n => birthCost(species, ingredient, n).real)).toEqual(amounts)
      })
    }
  }

  it('calcule en fractions : 3 cochons au blé font 5 sacs sans perte, jamais 6', () => {
    expect(birthCost('pig', 'wheat', 3)).toEqual({ theoretical: 5, real: 5, waste: 0 })
    expect(birthCost('sheep', 'wheat', 3)).toEqual({ theoretical: 7, real: 7, waste: 0 })
  })

  it('dit ce qui se perd', () => {
    expect(birthCost('cow', 'maize', 1).waste).toBe(0.75)
    expect(birthCost('pig', 'wheat', 4).waste).toBeCloseTo(1 / 3)
    expect(birthCost('sheep', 'wheat', 1).waste).toBeCloseTo(2 / 3)
  })

  it('les prix payés par l\'éleveur', () => {
    expect(Object.fromEntries(SPECIES.map(s => [s.key, s.price]))).toEqual({ cow: 45, goat: 45, sheep: 35, ewe: 35, pig: 25, bees: 45 })
  })

  it('refuse ce que le jeu ne propose pas', () => {
    expect(birthCost('cow', 'marjoram', 1)).toBeNull()
    expect(birthCost('hen', 'wheat', 1)).toBeNull()
    for (const quantity of [0, 5, 1.5]) expect(birthCost('cow', 'wheat', quantity)).toBeNull()
  })
})
