// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  setForDay, nearestReportPrices, priceResolver, reportPriceSet, uncoveredWeeks,
  formFromSet, bodyFromForm, isDirty, isComplete,
} from '../../src/modules/minePrices'
import { computePeriodBilan, periodDates } from '../../src/modules/mineParser'
import { currentPeriodBilan, weeklyBilan, weekRange } from '../../src/modules/mineRegistry'
import { bilanToBBcode } from '../../src/modules/mineBBcode'

// Prix des mines par période — logique pure (lot 2 ; brief admin/content/brief-prix-registre.md).
// Un jeu entre en vigueur à sa date d'effet et le reste jusqu'au suivant ; le bilan se calcule JOUR PAR JOUR.

const set = (effective_from, over = {}) => ({
  id: 1, effective_from, prices: { OR: 1, FER: 10, PIERRE: 5, ARGILE: 3, SEL: 4 }, hourly_rate: 1, ...over,
})

describe('setForDay — le jeu en vigueur ce jour-là', () => {
  const sets = [set('2026-01-15', { prices: { OR: 1, FER: 2, PIERRE: 5, ARGILE: 3, SEL: 4 } }), set('2026-01-01', { id: 2 })]

  it('le plus récent jeu dont la date d\'effet précède ou égale le jour', () => {
    expect(setForDay(sets, '2026-01-10').id).toBe(2)
    expect(setForDay(sets, '2026-01-15').prices.FER).toBe(2)
    expect(setForDay(sets, '2026-03-01').prices.FER).toBe(2)
  })

  it('aucun jeu avant la date : null', () => {
    expect(setForDay(sets, '2025-12-31')).toBeNull()
    expect(setForDay([], '2026-01-10')).toBeNull()
  })
})

describe('repli sur les relevés', () => {
  const reports = [
    { reported_at: '2026-05-01', active: true, prices: { FER: 1 }, rate: 1 },
    { reported_at: '2026-05-09', active: true, prices: { FER: 9 }, rate: 9 },
    { reported_at: '2026-05-04', active: false, prices: { FER: 4 }, rate: 4 }, // remplacé : ignoré
    { reported_at: '2026-05-05', active: true, prices: null, rate: null },      // sans prix : ignoré
  ]

  it('le relevé inscrit le plus proche qui porte des prix, le plus récent à égalité', () => {
    expect(nearestReportPrices(reports, '2026-05-02')).toEqual({ prices: { FER: 1 }, rate: 1 })
    expect(nearestReportPrices(reports, '2026-05-08')).toEqual({ prices: { FER: 9 }, rate: 9 })
    expect(nearestReportPrices(reports, '2026-05-05')).toEqual({ prices: { FER: 9 }, rate: 9 }) // 4 j de 01/05, 4 j de 09/05 : à égalité, le plus récent
  })

  it('la table l\'emporte, le repli ne sert qu\'en son absence', () => {
    const resolve = priceResolver([set('2026-05-10')], reportPriceSet(reports[0]))
    expect(resolve('2026-05-12').prices.FER).toBe(10)
    expect(resolve('2026-05-02')).toEqual({ prices: { FER: 1 }, rate: 1 })
    expect(priceResolver([], null)('2026-05-02')).toBeNull()
  })
})

describe('computePeriodBilan — prix jour par jour', () => {
  // Deux jours de travail (heures du lendemain, règle A) : 01/05 et 02/05, 10 kg de fer chacun, 10 h chacun.
  const mine = { number: 4, noeud: '226', label: 'Mine de fer', resource: 'FER', days: {
    '2026-05-01': { production: 10 }, '2026-05-02': { production: 10, heures: 10 }, '2026-05-03': { heures: 10 },
  } }
  const days = ['2026-05-01', '2026-05-02']

  it('un prix qui change en cours de période valorise chaque jour au jeu en vigueur ce jour-là', () => {
    const resolve = priceResolver([set('2026-05-01', { prices: { FER: 10 }, hourly_rate: 1 }), set('2026-05-02', { id: 2, prices: { FER: 30 }, hourly_rate: 2 })])
    const b = computePeriodBilan([mine], resolve, 0, days)

    expect(b.total.valeur).toBe(10 * 10 + 10 * 30)
    expect(b.total.salaire).toBe(10 * 1 + 10 * 2)
    expect(b.rate).toBeNull() // le taux a varié : pas de taux unique
    expect(b.unpricedDays).toEqual([])
  })

  it('un jour sans prix compte pour zéro et se dit', () => {
    const b = computePeriodBilan([mine], priceResolver([set('2026-05-02', { prices: { FER: 30 }, hourly_rate: 2 })]), 0, days)
    expect(b.total.valeur).toBe(300)
    expect(b.unpricedDays).toEqual(['2026-05-01'])
  })

  it('un objet de prix unique garde le comportement du Bilan public', () => {
    const b = computePeriodBilan([mine], { FER: 10 }, 2, days)
    expect(b.total.valeur).toBe(200)
    expect(b.total.salaire).toBe(40)
    expect(b.rate).toBe(2)
    expect(b.unpricedDays).toEqual([])
  })

  it('de nouveaux prix donnent des montants différents du bilan d\'origine', () => {
    const before = computePeriodBilan([mine], priceResolver([set('2026-05-01', { prices: { FER: 10 } })]), 0, days)
    const after = computePeriodBilan([mine], priceResolver([set('2026-05-01', { prices: { FER: 12 } })]), 0, days)
    expect(after.total.valeur).not.toBe(before.total.valeur)
  })
})

describe('bilans du registre avec la table des prix', () => {
  const mine = { number: 4, noeud: '226', label: 'Mine de fer', resource: 'FER', days: {
    '2026-05-04': { production: 10 }, '2026-05-05': { production: 10, heures: 10 }, '2026-05-06': { heures: 10 },
  } }
  const reports = [{ id: 1, active: true, reported_at: '2026-05-06', report: { mines: [mine], states: [] }, prices: { FER: 1 }, rate: 1 }]
  const registry = { today: '2026-05-20', mandate: { in_office_from: '2026-05-04', mid_at: '2026-06-03', end_at: '2026-07-03' }, reports }

  it('la table l\'emporte sur les prix du relevé', () => {
    const withTable = currentPeriodBilan(registry, [set('2026-05-01', { prices: { FER: 50 }, hourly_rate: 0 })])
    const without = currentPeriodBilan(registry, [])
    expect(withTable.bilan.total.valeur).toBe(1000)
    expect(without.bilan.total.valeur).toBe(20) // repli : dernier relevé
  })

  it('weekRange : de la semaine d\'entrée en fonction à la semaine en cours', () => {
    expect(weekRange(registry)).toEqual({ first: '2026-05-04', last: '2026-05-18' })
    expect(weekRange({ today: '2026-05-20', mandate: null })).toBeNull()
  })

  it('weeklyBilan : une semaine du mandat, jours avant l\'entrée en fonction et à venir écartés', () => {
    const w = weeklyBilan(registry, [set('2026-05-01', { prices: { FER: 50 }, hourly_rate: 0 })], '2026-05-04')
    expect(w.monday).toBe('2026-05-04')
    expect(w.sunday).toBe('2026-05-10')
    expect(w.bilan.total.valeur).toBe(500 + 500)
    expect(w.complete).toBe(false) // seuls 2 jours sur 7 sont appariés
    expect(weeklyBilan(registry, [], '2026-05-18').bilan.days).toBe(2) // 18 et 19/05 : avant aujourd'hui
  })
})

describe('semaines non couvertes par un prix', () => {
  it('signale les semaines du mandat dont un jour n\'a aucun jeu en vigueur', () => {
    expect(uncoveredWeeks([], '2026-05-04', '2026-05-20')).toEqual(['2026-05-04', '2026-05-11', '2026-05-18'])
    expect(uncoveredWeeks([set('2026-05-12')], '2026-05-04', '2026-05-20')).toEqual(['2026-05-04', '2026-05-11'])
    expect(uncoveredWeeks([set('2026-05-01')], '2026-05-04', '2026-05-20')).toEqual([])
    expect(uncoveredWeeks([], null, '2026-05-20')).toEqual([])
  })
})

describe('formulaire de prix', () => {
  it('« modifié » dès qu\'un champ ou la date change, pas avant', () => {
    const original = formFromSet(set('2026-05-01'), '2026-05-10')
    const copy = JSON.parse(JSON.stringify(original))
    expect(isDirty(copy, original)).toBe(false)
    copy.prices.FER = '11'
    expect(isDirty(copy, original)).toBe(true)
    const other = JSON.parse(JSON.stringify(original))
    other.hourly_rate = '2'
    expect(isDirty(other, original)).toBe(true)
  })

  it('complet : tous les champs en nombres à deux décimales au plus', () => {
    const form = formFromSet(set('2026-05-01'), '2026-05-10')
    expect(isComplete(form)).toBe(true)
    expect(form.prices).not.toHaveProperty('OR') // pas de prix d'or
    form.prices.SEL = '4,5'
    expect(isComplete(form)).toBe(true)
    form.prices.SEL = '4,555'
    expect(isComplete(form)).toBe(false)
    form.prices.SEL = ''
    expect(isComplete(form)).toBe(false)
  })

  it('le corps de requête porte des nombres, virgule décimale comprise', () => {
    const form = formFromSet(set('2026-05-01'), '2026-05-10')
    form.hourly_rate = '0,7'
    expect(bodyFromForm(form)).toEqual({ effective_from: '2026-05-10', prices: { OR: 1, FER: 10, PIERRE: 5, ARGILE: 3, SEL: 4 }, hourly_rate: 0.7 })
  })
})

describe('export BBCode d\'un bilan', () => {
  const t = (key, params = {}) => `${key}${params.rate !== undefined ? `(${params.rate})` : ''}`
  const bilan = rate => ({ rate, net: 5, total: { valeur: 10, salaire: 3, entretien: 2, heures: 6, pierre: 1, fer: 1 }, lines: [
    { number: 1, noeud: '236', label: "Mine d'or", resource: 'OR', production: 10, valeur: 10, salaire: 3, heures: 6, entretien: 2, pierre: 1, fer: 1, solde: 5 },
  ] })

  it('un seul [quote] : titre, période, une table par mine, total et net', () => {
    const bb = bilanToBBcode(bilan(0.5), { title: 'Bilan', week: 'Semaine du 4 au 10', t })
    expect(bb).toMatch(/^\[quote\]\[center\]/)
    expect(bb).toContain('Bilan')
    expect(bb).toContain('Semaine du 4 au 10')
    expect(bb).toContain('EconomyMines.Bb.Amounts(0,5)')
    expect(bb).toContain('(6 h × 0,5)')
    expect(bb.trimEnd()).toMatch(/\[\/quote\]$/)
    expect(bb.match(/\[quote\]/g)).toHaveLength(1)
  })

  it('un taux qui a varié en cours de période ne s\'écrit pas', () => {
    const bb = bilanToBBcode(bilan(null), { title: 'Bilan', week: 'Semaine', t })
    expect(bb).not.toContain('Bb.Amounts')
    expect(bb).toContain('(6 h)')
  })
})

describe('périodes', () => {
  it('periodDates reste exclusif à droite', () => {
    expect(periodDates('2026-05-01', '2026-05-03')).toEqual(['2026-05-01', '2026-05-02'])
  })
})
