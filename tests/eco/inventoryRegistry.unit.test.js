// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { addDays, daysBetween, departure, mandateBilans, predecessorEntries, emptyPeriods, ascending } from '../../src/modules/inventoryRegistry'

/*
  Lectures du Registre des stocks (PR 3b ; réponses de Cowork 12). Un inventaire est un instantané : le bilan d'un mandat est l'évolution entre
  deux photos. Départ = dernière inscription au plus tard le jour d'entrée en fonction (l'inventaire hérité), à défaut la première du mandat ;
  arrivée = dernière inscription STRICTEMENT avant la date du bilan. Jamais un bilan partiel.
*/
// Mandat de maire : entré en fonction le 01/05, mi-mandat le 16/05, fin le 31/05 ; fenêtre « prédécesseurs » dès le 01/04.
const MANDATE = { in_office_from: '2026-05-01', mid_at: '2026-05-16', end_at: '2026-05-31', predecessor_from: '2026-04-01' }
const snap = (id, taken_on, raw, by_me = true) => ({ id, taken_on, raw, by_me, replaced: null })
const inv = (pain, ecus) => `#NomEnc.Actions possibles${ecus},00 écus\n${pain}Miches de pain${pain * 5}`

describe('dates pures', () => {
  it('addDays et daysBetween ne dépendent d\'aucune heure ni d\'aucun changement d\'heure', () => {
    expect(addDays('2026-03-28', 3)).toBe('2026-03-31') // le passage à l'heure d'été (29/03) ne décale rien
    expect(addDays('2026-05-01', -1)).toBe('2026-04-30')
    expect(daysBetween('2026-05-10', '2026-05-12')).toBe(2)
    expect(daysBetween('2026-05-12', '2026-05-10')).toBe(-2)
  })
  it('ascending trie du plus ancien au plus récent, sans toucher l\'original', () => {
    const list = [snap(2, '2026-05-10', 'x'), snap(1, '2026-05-02', 'x')]
    expect(ascending(list).map(s => s.id)).toEqual([1, 2])
    expect(list.map(s => s.id)).toEqual([2, 1])
  })
})

describe('departure — l\'inventaire HÉRITÉ', () => {
  it('la dernière inscription datée au plus tard le jour d\'entrée en fonction', () => {
    const list = [snap(1, '2026-04-10', 'a', false), snap(2, '2026-05-01', 'b', false), snap(3, '2026-05-03', 'c')]
    expect(departure(list, MANDATE).id).toBe(2) // le jour J lui-même compte
  })
  it('à défaut, la première inscription du mandat', () => {
    expect(departure([snap(3, '2026-05-03', 'c'), snap(4, '2026-05-09', 'd')], MANDATE).id).toBe(3)
  })
  it('aucune inscription, ou aucun repère de mandat : null', () => {
    expect(departure([], MANDATE)).toBeNull()
    expect(departure([snap(1, '2026-05-03', 'c')], null)).toBeNull()
  })
})

describe('mandateBilans — mi-mandat et fin de mandat', () => {
  const list = [snap(1, '2026-04-28', inv(100, 1000), false), snap(2, '2026-05-10', inv(160, 1500)), snap(3, '2026-05-20', inv(130, 2000)), snap(4, '2026-05-30', inv(200, 2600))]

  it('avant la date : « disponible le JJ/MM, dans N jours », jamais un bilan partiel', () => {
    const [mid, end] = mandateBilans(list, MANDATE, '2026-05-10')
    expect(mid).toMatchObject({ kind: 'mid', at: '2026-05-16', status: 'pending', inDays: 6 })
    expect(end).toMatchObject({ kind: 'end', at: '2026-05-31', status: 'pending', inDays: 21 })
    expect(mid.result).toBeUndefined()
  })

  it('mi-mandat : de l\'inventaire hérité (28/04) à la dernière inscription STRICTEMENT avant le 16/05 (le 10/05)', () => {
    const [mid] = mandateBilans(list, MANDATE, '2026-05-16')
    expect(mid.status).toBe('ready')
    expect(mid.start.id).toBe(1)
    expect(mid.end.id).toBe(2)
    expect(mid.result.counts).toMatchObject({ up: 1, down: 0, new: 0, disappeared: 0 })
    expect(mid.result.ecus).toEqual({ before: 1000, after: 1500, diff: 500 })
  })

  it('fin de mandat : jusqu\'au 30/05 ; une inscription DATÉE du jour du bilan n\'y entre pas (strict)', () => {
    const withDayOf = [...list, snap(5, '2026-05-31', inv(999, 9999))]
    const [, end] = mandateBilans(withDayOf, MANDATE, '2026-05-31')
    expect(end.status).toBe('ready')
    expect(end.end.id).toBe(4)
    expect(end.result.ecus.after).toBe(2600)
  })

  it('une baisse, une nouveauté et un disparu se comptent comme à la Balance', () => {
    const a = snap(1, '2026-04-30', '#NomEnc.Actions possibles10,00 écus\n5Poissons10\n7Sel14', false)
    const b = snap(2, '2026-05-10', '#NomEnc.Actions possibles20,00 écus\n2Poissons4\n3Argile9')
    const [mid] = mandateBilans([a, b], MANDATE, '2026-05-16')
    expect(mid.result.counts).toMatchObject({ up: 0, down: 1, new: 1, disappeared: 1 })
  })

  it('pas assez d\'inscriptions : on dit laquelle manque (départ, arrivée, ou les deux)', () => {
    expect(mandateBilans([], MANDATE, '2026-06-01')[0]).toMatchObject({ status: 'insufficient', missing: ['start', 'end'] })
    // une seule inscription : elle est le départ, rien après
    expect(mandateBilans([snap(1, '2026-05-03', inv(1, 1))], MANDATE, '2026-06-01')[0]).toMatchObject({ status: 'insufficient', missing: ['end'] })
    // l'arrivée doit être APRÈS le départ : une inscription antérieure ne fait pas une arrivée
    expect(mandateBilans([snap(1, '2026-05-03', inv(1, 1)), snap(2, '2026-05-20', inv(2, 2))], MANDATE, '2026-05-16')[0]).toMatchObject({ status: 'insufficient', missing: ['end'] })
  })

  it('sans repères de mandat : aucun bilan', () => {
    expect(mandateBilans(list, null, '2026-05-10')).toEqual([])
    expect(mandateBilans(list, MANDATE, null)).toEqual([])
  })
})

describe('predecessorEntries — ce que d\'AUTRES ont inscrit dans la fenêtre avant l\'entrée en fonction', () => {
  const list = [
    snap(1, '2026-03-30', 'trop ancien', false),
    snap(2, '2026-04-01', 'début de fenêtre', false),
    snap(3, '2026-04-20', 'predecesseur', false),
    snap(4, '2026-04-25', 'la mienne, rétro-datée', true),
    snap(5, '2026-05-01', 'jour J : pendant le mandat', false),
  ]
  it('du plus récent au plus ancien, borne de début comprise, jour d\'entrée en fonction exclu, mes propres inscriptions exclues', () => {
    expect(predecessorEntries(list, MANDATE).map(s => s.id)).toEqual([3, 2])
  })
  it('sans fenêtre du serveur ou sans mandat : rien (aucune règle côté site)', () => {
    expect(predecessorEntries(list, { ...MANDATE, predecessor_from: undefined })).toEqual([])
    expect(predecessorEntries(list, null)).toEqual([])
  })
})

describe('emptyPeriods — les jours sans inscription, en périodes', () => {
  it('du début du mandat à hier : intervalles entre deux inscriptions, début → première, dernière → hier', () => {
    const list = [snap(1, '2026-05-03', 'a'), snap(2, '2026-05-04', 'b'), snap(3, '2026-05-08', 'c')]
    const result = emptyPeriods(list, MANDATE, '2026-05-11') // hier = 10/05
    expect(result.periods).toEqual([
      { from: '2026-05-01', to: '2026-05-02', days: 2 },
      { from: '2026-05-05', to: '2026-05-07', days: 3 },
      { from: '2026-05-09', to: '2026-05-10', days: 2 },
    ])
    expect(result.days).toBe(7)
  })
  it('aujourd\'hui n\'est pas un trou (il peut encore s\'inscrire) ; une inscription du jour même ne change rien', () => {
    expect(emptyPeriods([], MANDATE, '2026-05-01')).toEqual({ days: 0, periods: [] })
    expect(emptyPeriods([snap(1, '2026-05-02', 'a')], MANDATE, '2026-05-02')).toEqual({ days: 1, periods: [{ from: '2026-05-01', to: '2026-05-01', days: 1 }] })
  })
  it('une inscription avant le mandat ne couvre aucun jour du mandat', () => {
    expect(emptyPeriods([snap(1, '2026-04-20', 'a', false)], MANDATE, '2026-05-03').days).toBe(2)
  })
  it('tous les jours couverts : aucune période', () => {
    const list = ['2026-05-01', '2026-05-02', '2026-05-03'].map((d, i) => snap(i + 1, d, 'x'))
    expect(emptyPeriods(list, MANDATE, '2026-05-04')).toEqual({ days: 0, periods: [] })
  })
  it('sans mandat : null', () => {
    expect(emptyPeriods([], null, '2026-05-04')).toBeNull()
  })
})
