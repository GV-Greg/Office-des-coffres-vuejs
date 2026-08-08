// @vitest-environment node
// Logique pure, aucun DOM à monter — voir docs/TESTS.md.
import { describe, it, expect } from 'vitest'
import { gameYear, toGameDateIso, YEAR_ANCHORS } from '../../src/modules/gameCalendar'

describe('gameYear', () => {
  it('renvoie les années du jeu constatées', () => {
    // 2025 : lu sur les relevés réels du Commissaire aux Mines (« Semaine du 20 au
    // 26 octobre 1473 » pour la semaine réelle du 20/10/2025).
    expect(gameYear(2025)).toBe(1473)
    // 2026 : confirmé par Greg.
    expect(gameYear(2026)).toBe(1474)
  })

  it("prolonge l'écart constaté pour une année non ancrée", () => {
    expect(gameYear(2027)).toBe(1475)
    expect(gameYear(2030)).toBe(1478)
    expect(gameYear(2024)).toBe(1472)
  })

  it('reste cohérent avec la table déclarée', () => {
    for (const { real, game } of YEAR_ANCHORS) {
      expect(gameYear(real)).toBe(game)
    }
  })
})

describe('toGameDateIso', () => {
  it("ne change que l'année, jamais le jour ni le mois", () => {
    expect(toGameDateIso('2026-08-08')).toBe('1474-08-08')
    expect(toGameDateIso('2025-11-10')).toBe('1473-11-10')
    // Le 29 février d'une année bissextile reste tel quel : on ne recalcule aucune date,
    // on substitue l'année, donc aucun risque de décaler un jour.
    expect(toGameDateIso('2028-02-29')).toBe('1476-02-29')
  })

  it('laisse passer une valeur qui ne ressemble pas à une date', () => {
    expect(toGameDateIso('')).toBe('')
    expect(toGameDateIso(null)).toBe(null)
  })

  it('est idempotente : une date déjà en année de jeu est laissée telle quelle', () => {
    // Sans cette garde, une seconde application retrancherait un second écart de 552 ans
    // (1474 → 922) : la date resterait plausible à l'œil, donc le bug passerait inaperçu.
    const once = toGameDateIso('2026-08-08')
    expect(toGameDateIso(once)).toBe(once)
    expect(toGameDateIso('1474-08-08')).toBe('1474-08-08')
  })
})
