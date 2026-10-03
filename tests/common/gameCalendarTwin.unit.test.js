// @vitest-environment node
// ⚠️ TEST JUMEAU. Le même test existe dans le dépôt backend (`tests/Unit/GameCalendarTwinTest.php`),
// sur `app/Support/GameCalendar.php`. Il fige la table d'ancrages ET des conversions calculées : une
// divergence de donnée OU de logique entre les deux copies échoue dans le dépôt où elle a été
// introduite (fil admin/echanges/mandats-historique, 10).
//
// Si ce test échoue parce que vous avez VOLONTAIREMENT changé le calendrier : faites le même
// changement dans le jumeau backend, et mettez à jour les deux tests ensemble.
import { describe, it, expect } from 'vitest'
import { gameYear, realYear, YEAR_ANCHORS } from '../../src/modules/gameCalendar'

const TWIN = 'Calendrier du jeu modifié : modifiez AUSSI le jumeau backend app/Support/GameCalendar.php et son test GameCalendarTwinTest.php.'

describe('calendrier du jeu — jumeau du backend', () => {
  it('la table d\'ancrages est celle du jumeau backend', () => {
    expect(YEAR_ANCHORS, TWIN).toEqual([
      { real: 2025, game: 1473 },
      { real: 2026, game: 1474 },
    ])
  })

  it('les conversions calculées sont celles du jumeau backend', () => {
    // Mêmes valeurs, dans le même ordre, que le test jumeau.
    expect([2020, 2025, 2026, 2027, 2040].map(gameYear), TWIN).toEqual([1468, 1473, 1474, 1475, 1488])
    expect([1468, 1473, 1474, 1475, 2026].map(realYear), TWIN).toEqual([2020, 2025, 2026, 2027, 2026])
  })
})
