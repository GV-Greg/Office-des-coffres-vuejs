// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { shiftIso, pruneLists, rememberLists, yesterdaysList } from '../../src/modules/customsLists'

// Les listes de villageois gardées dans le navigateur : chacune avec son jour du jeu, aujourd'hui et hier seulement (Greg, 23/11/2026).

describe('shiftIso', () => {
  it('décale un jour ISO, mois et années compris', () => {
    expect(shiftIso('2026-11-23', -1)).toBe('2026-11-22')
    expect(shiftIso('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftIso('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('pruneLists — aujourd\'hui et hier, rien d\'autre', () => {
  it('efface avant-hier et tout ce qui est plus ancien, et les entrées vides', () => {
    const lists = { '2026-11-23': 'A', '2026-11-22': 'B', '2026-11-21': 'C', '2026-11-01': 'D', '2026-11-20': '  ' }
    expect(pruneLists(lists, '2026-11-23')).toEqual({ '2026-11-23': 'A', '2026-11-22': 'B' })
  })

  it('un stockage absent ou abîmé ne casse rien', () => {
    expect(pruneLists(null, '2026-11-23')).toEqual({})
    expect(pruneLists({ '2026-11-23': 42 }, '2026-11-23')).toEqual({})
  })
})

describe('rememberLists', () => {
  it('coller la liste d\'aujourd\'hui ne remplace PAS celle d\'hier', () => {
    const before = { '2026-11-22': 'HIER' }
    expect(rememberLists(before, { day: '2026-11-23', today: '2026-11-23', todayText: 'AUJOURDHUI' }))
      .toEqual({ '2026-11-22': 'HIER', '2026-11-23': 'AUJOURDHUI' })
  })

  it('une liste d\'hier collée à la main est gardée sous le jour d\'hier', () => {
    expect(rememberLists({}, { day: '2026-11-23', today: '2026-11-23', todayText: 'T', yesterdayText: 'Y' }))
      .toEqual({ '2026-11-23': 'T', '2026-11-22': 'Y' })
  })

  it('chaque écriture efface ce qui est devenu trop vieux', () => {
    expect(rememberLists({ '2026-11-21': 'VIEUX', '2026-11-22': 'HIER' }, { day: '2026-11-23', today: '2026-11-23', todayText: 'T' }))
      .toEqual({ '2026-11-22': 'HIER', '2026-11-23': 'T' })
  })

  it('un jour ancien corrigé par le prévôt ne reste pas : « aujourd\'hui » est le jour du jeu RÉEL', () => {
    expect(rememberLists({}, { day: '2026-11-18', today: '2026-11-23', todayText: 'ANCIEN' })).toEqual({})
  })
})

describe('yesterdaysList', () => {
  it('rend la liste gardée sous le jour d\'hier, null sinon', () => {
    expect(yesterdaysList({ '2026-11-22': 'HIER', '2026-11-23': 'T' }, '2026-11-23')).toBe('HIER')
    expect(yesterdaysList({ '2026-11-23': 'T' }, '2026-11-23')).toBeNull()
    expect(yesterdaysList(undefined, '2026-11-23')).toBeNull()
  })
})
