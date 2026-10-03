// @vitest-environment node
// Le calendrier appartient au champ (fil mandats-historique, 06 et 09) : une seule déclaration.
import { describe, it, expect } from 'vitest'
import { DATE_FIELDS, formatFieldDate } from '../../src/modules/playerDates'

describe('playerDates — un calendrier par champ', () => {
  it('la classification des champs est celle décidée (jeu / réel)', () => {
    expect(DATE_FIELDS).toEqual({
      declared_started_at: 'game', started_at: 'game', in_office_from: 'game', valid_until: 'game',
      holds_until: 'game', period_started_at: 'game', period_ended_at: 'game',
      history_started_at: 'game', history_ended_at: 'game',
      processed_at: 'real', revoked_at: 'real',
    })
  })

  it('un fait de jeu s\'affiche en année du jeu, un acte de l\'Office en année réelle', () => {
    expect(formatFieldDate('valid_until', '2026-11-21T23:00:00+00:00', 'fr')).toBe('22/11/1474')
    expect(formatFieldDate('processed_at', '2026-11-21T23:00:00+00:00', 'fr')).toBe('22/11/2026')
    expect(formatFieldDate('started_at', '2026-09-23', 'en')).toBe('23/09/1474')
  })

  it('un champ non classé lève une erreur au lieu de choisir une année au hasard', () => {
    expect(() => formatFieldDate('created_at', '2026-09-23', 'fr')).toThrow(/non classé/)
  })

  it('une valeur vide donne une chaîne vide', () => {
    expect(formatFieldDate('holds_until', null, 'fr')).toBe('')
  })
})
