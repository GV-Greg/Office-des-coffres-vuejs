// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { levelHistory, mandateBilans, daysWithoutData, currentPeriodBilan } from '../../src/modules/mineRegistry'

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

describe('daysWithoutData — ce qui est réellement perdu, pas l\'assiduité', () => {
  const base = (reports) => ({ today: '2026-10-09', mandate: { in_office_from: '2026-09-23' }, reports })

  it('un collage couvre ses 7 jours : seuls les jours absents de tout relevé restent', () => {
    const days = Object.fromEntries(['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']
      .map(d => [d, { heures: 10 }]))
    const gaps = daysWithoutData(base([entry(1, '2026-10-08', state(10), [ironMine(days)])]))
    expect(gaps).toEqual(['2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29'])
  })

  it('un relevé remplacé ne couvre rien ; aujourd\'hui n\'est jamais compté', () => {
    const gaps = daysWithoutData(base([entry(1, '2026-10-08', state(10), [ironMine({ '2026-10-08': { heures: 3 } })], { active: false })]))
    expect(gaps).toHaveLength(16) // du 23/09 au 08/10
    expect(gaps).not.toContain('2026-10-09')
  })

  it('sans mandat connu : null', () => {
    expect(daysWithoutData({ today: '2026-10-09', mandate: null, reports: [] })).toBeNull()
  })
})

describe('currentPeriodBilan — le bilan en cours du mois de mandat', () => {
  const mandate = { in_office_from: '2026-09-23', mid_at: '2026-10-23', end_at: '2026-11-22' }
  const days = { '2026-10-01': { production: 10, pierre: 1 }, '2026-10-02': { heures: 50, production: 10 }, '2026-10-03': { heures: 40 } }
  const reports = [entry(1, '2026-10-03', state(10), [ironMine(days)], { prices: { FER: 20, PIERRE: 15 }, rate: 0.5 })]

  it('1er mois : de l\'entrée en fonction à hier, aux prix et taux du dernier relevé, niveau compris', () => {
    const current = currentPeriodBilan({ today: '2026-10-09', mandate, reports })
    expect(current).toMatchObject({ month: 1, from: '2026-09-23', to: '2026-10-08', rate: 0.5 })
    expect(current.bilan.days).toBe(16)
    expect(current.bilan.covered).toBe(2)
    expect(current.bilan.total.valeur).toBe(400)
    expect(current.levels.get('noeud:226')).toBe('10')
  })

  it('2e mois : repart de la mi-mandat', () => {
    expect(currentPeriodBilan({ today: '2026-10-30', mandate, reports })).toMatchObject({ month: 2, from: '2026-10-23', to: '2026-10-29' })
  })

  it('rien le jour d\'entrée en fonction, ni une fois le mandat terminé', () => {
    expect(currentPeriodBilan({ today: '2026-09-23', mandate, reports })).toBeNull()
    expect(currentPeriodBilan({ today: '2026-11-22', mandate, reports })).toBeNull()
  })

  it('une mine sans ressource enregistrée la retrouve par son libellé', () => {
    const legacy = [entry(1, '2026-10-03', state(10), [{ number: 4, noeud: '226', label: 'Mine de fer', days }], { prices: { FER: 20 }, rate: 0 })]
    expect(currentPeriodBilan({ today: '2026-10-09', mandate, reports: legacy }).bilan.total.valeur).toBe(400)
  })
})

describe('relevés inscrits avant back #58 (sans libellé ni ressource dans les mines)', () => {
  it('reprend libellé et ressource de l\'état de la mine, par son nœud — la valeur n\'est plus nulle', () => {
    const mandate = { in_office_from: '2026-09-23', mid_at: '2026-10-23', end_at: '2026-11-22' }
    const days = { '2026-10-01': { production: 10 }, '2026-10-02': { heures: 50 } }
    const legacy = [entry(1, '2026-10-03', state(10), [{ number: 4, noeud: '226', days }], { prices: { FER: 20 }, rate: 0 })]
    const current = currentPeriodBilan({ today: '2026-10-09', mandate, reports: legacy })
    expect(current.bilan.lines[0]).toMatchObject({ label: 'Mine de fer', resource: 'FER', valeur: 200 })
  })
})
