// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { levelHistory, mandateBilans } from '../../src/modules/mineRegistry'

// Registre des mines — lectures calculées (PR 4c ; brief §7 ; fil registre-mines R4).

const state = (niveau, entretien = '1 qtx de pierre et 1 kg de fer', seuil = '9 qtx de pierre et 7 kg de fer', extra = {}) =>
  ({ number: 4, noeud: '226', label: 'Mine de fer', niveau: String(niveau), seuilRupture: seuil, entretienNormal: entretien, ...extra })
const entry = (id, date, st, mines = [], extra = {}) =>
  ({ id, reported_at: date, active: true, report: { mines, states: [st] }, prices: { FER: 20, PIERRE: 15 }, rate: 0.7, ...extra })
const ironMine = days => ({ number: 4, noeud: '226', label: 'Mine de fer', resource: 'FER', days })

describe('levelHistory — +1 crédité, −1 constaté', () => {
  it('+1 est une amélioration', () => {
    const [mine] = levelHistory([entry(1, '2026-05-01', state(9)), entry(2, '2026-05-03', state(10))])
    expect(mine.events).toEqual([{ type: 'up', date: '2026-05-03', previous: '2026-05-01', from: 9, to: 10 }])
    expect(mine).toMatchObject({ level: 10, since: '2026-05-03' })
  })

  it('−1 sans entretien depuis le relevé précédent, seuil atteint à ce relevé : un échec daté', () => {
    const [mine] = levelHistory([
      entry(1, '2026-05-01', state(10, '9 qtx de pierre et 3 kg de fer')), // 9 = 9 : atteint
      entry(2, '2026-05-03', state(9), [ironMine({ '2026-05-02': { heures: 10 }, '2026-05-03': { heures: 12 } })]),
    ])
    expect(mine.events[0]).toMatchObject({ type: 'failure', from: 10, to: 9 })
  })

  it('−1 avec un entretien relevé entre-temps : un choix assumé, pas un échec', () => {
    const [mine] = levelHistory([
      entry(1, '2026-05-01', state(10, '9 qtx de pierre et 3 kg de fer')),
      entry(2, '2026-05-03', state(9), [ironMine({ '2026-05-02': { heures: 10, pierre: 9, fer: 7 } })]),
    ])
    expect(mine.events[0].type).toBe('down')
  })

  it('−1 alors que le seuil n\'était pas atteint : un choix assumé', () => {
    const [mine] = levelHistory([entry(1, '2026-05-01', state(10)), entry(2, '2026-05-03', state(9))])
    expect(mine.events[0].type).toBe('down')
  })

  it('ignore les relevés remplacés, et suit la mine par son nœud même si son numéro glisse', () => {
    const history = levelHistory([
      entry(1, '2026-05-01', state(10)),
      entry(2, '2026-05-02', state(12), [], { active: false }),
      entry(3, '2026-05-03', state(10, undefined, undefined, { number: 3 })),
    ])
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({ number: 3, level: 10, events: [] })
  })
})

describe('mandateBilans — chacun le sien, jamais un bilan partiel', () => {
  const registry = (today, reports = []) => ({
    today, mandate: { in_office_from: '2026-05-01', mid_at: '2026-05-31', end_at: '2026-06-30' }, reports,
  })

  it('avant la date : en attente, avec le nombre de jours', () => {
    const [mid, end] = mandateBilans(registry('2026-05-21'))
    expect(mid).toMatchObject({ kind: 'mid', status: 'pending', at: '2026-05-31', inDays: 10 })
    expect(end).toMatchObject({ kind: 'end', status: 'pending', inDays: 40 })
  })

  it('à la date : le bilan de la période, aux prix et taux du dernier relevé de la période, couverture comprise', () => {
    const days = { '2026-05-01': { production: 10, pierre: 1 }, '2026-05-02': { heures: 50, production: 10 }, '2026-05-03': { heures: 40 } }
    const reports = [
      entry(1, '2026-05-02', state(10), [ironMine(days)], { prices: { FER: 10, PIERRE: 10 }, rate: 1 }),
      entry(2, '2026-05-03', state(10), [ironMine(days)], { prices: { FER: 20, PIERRE: 15 }, rate: 0.5 }),
      entry(3, '2026-06-02', state(10), [], { prices: { FER: 99 }, rate: 9 }), // après la mi-mandat : ignoré pour elle
    ]
    const [mid] = mandateBilans(registry('2026-05-31', reports))

    expect(mid.status).toBe('ready')
    expect(mid.rate).toBe(0.5)
    expect(mid.bilan.covered).toBe(2) // 01/05 et 02/05 appariés (heures du lendemain)
    expect(mid.bilan.days).toBe(30)
    expect(mid.bilan.total.valeur).toBe(400) // 20 kg × 20
    expect(mid.bilan.total.salaire).toBe(45) // 90 h × 0,5
    expect(mid.bilan.total.entretien).toBe(15) // 1 qx × 15
  })

  it('sans mandat connu : rien', () => {
    expect(mandateBilans({ today: '2026-05-10', mandate: null, reports: [] })).toEqual([])
  })
})
