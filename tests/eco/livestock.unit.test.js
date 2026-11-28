// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { ecusChoice, feedSetForDay, feedPrice, birthValue, summarizeBirths, feedFormFrom, feedBodyFromForm } from '../../src/modules/livestock'

const set = (effective_from, prices) => ({ effective_from, prices: { maize: null, wheat: null, marjoram: null, elderberry: null, ...prices } })
const SETS = [set('2026-11-10', { wheat: 12.5 }), set('2026-11-01', { wheat: 10, maize: 3 })]
const birth = (born_on, species, ingredient, quantity, taken) => ({ born_on, species, ingredient, quantity, taken, wasted: 0 })

describe('Le Livre des naissances — prix et coûts', () => {
  it('écrit « écu » au singulier sous deux en français, pour le seul 1 en anglais', () => {
    expect([0.5, 1, 1.5, 2, 38.4].map(n => ecusChoice(n, 'fr'))).toEqual([1, 1, 1, 2, 2])
    expect([0.5, 1, 2].map(n => ecusChoice(n, 'en'))).toEqual([2, 1, 2])
  })

  it('prend le jeu en vigueur le jour de la naissance', () => {
    expect(feedSetForDay(SETS, '2026-11-09').effective_from).toBe('2026-11-01')
    expect(feedPrice(SETS, '2026-11-10', 'wheat')).toBe(12.5)
    expect(feedSetForDay(SETS, '2026-10-31')).toBeNull()
    // Un jeu postérieur sans cette nourriture : pas de prix, l'ancien n'est pas repris.
    expect(feedPrice(SETS, '2026-11-11', 'maize')).toBeNull()
  })

  it('une naissance coûte la nourriture prise au prix du jour', () => {
    expect(birthValue(birth('2026-11-02', 'cow', 'maize', 1, 12), SETS)).toBe(36)
    expect(birthValue(birth('2026-11-11', 'cow', 'maize', 1, 12), SETS)).toBeNull()
  })

  it('totalise par espèce dans leur ordre, et compte les naissances sans prix', () => {
    const summary = summarizeBirths([
      birth('2026-11-12', 'pig', 'wheat', 3, 5),
      birth('2026-11-02', 'cow', 'maize', 1, 12),
      birth('2026-11-02', 'cow', 'wheat', 2, 6),
      birth('2026-10-30', 'pig', 'wheat', 1, 2),
    ], SETS)

    expect(summary.rows.map(r => r.species)).toEqual(['cow', 'pig'])
    expect(summary.rows[0]).toMatchObject({ animals: 3, feeds: { maize: 12, wheat: 6 }, cost: 96, unpriced: 0 })
    expect(summary).toMatchObject({ animals: 7, cost: 158.5, unpriced: 1 })
  })

  it('un formulaire de prix exige une date, au moins un prix et aucun prix illisible', () => {
    const form = feedFormFrom(SETS[1], '2026-11-12')
    expect(form.prices).toEqual({ maize: '3', wheat: '10', marjoram: '', elderberry: '' })
    form.prices.wheat = '12,5'
    expect(feedBodyFromForm(form)).toEqual({ effective_from: '2026-11-12', prices: { maize: 3, wheat: 12.5, marjoram: null, elderberry: null } })

    expect(feedBodyFromForm({ ...form, prices: { ...form.prices, maize: 'douze' } })).toBeNull()
    expect(feedBodyFromForm(feedFormFrom(null, '2026-11-12'))).toBeNull()
    expect(feedBodyFromForm({ ...form, effective_from: '' })).toBeNull()
  })
})
