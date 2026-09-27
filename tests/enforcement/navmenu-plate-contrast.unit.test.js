// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { PLATES } from '../../src/components/navMenuPalette.js'

/*
  Garde-fou — contraste des plaques de nom du menu circulaire (WCAG 1.4.3, 4,5:1).

  Les plaques sont des dégradés : le texte se mesure contre CHAQUE arrêt, le pire décide — jamais
  contre une moyenne. Valeurs lues dans navMenuPalette.js, la source que NavMenu.vue reçoit en
  variables CSS : le test mesure ce qui est rendu.

  Historique : la plaque dorée de la page courante finissait à #b45309 sur d'anciennes planches —
  le texte #1c0a02 y tombait à 3,82:1. La version corrigée finit à #d97706 (6,03:1).
*/

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('Contraste des plaques du menu circulaire', () => {
  it('couvre bien le repos, le survol et la page courante', () => {
    expect(Object.keys(PLATES)).toEqual(expect.arrayContaining(['rest', 'hover', 'current']))
  })

  it.each(Object.entries(PLATES))('plaque « %s » — texte ≥ 4,5:1 sur chaque arrêt', (state, { stops, text }) => {
    expect(stops.length).toBeGreaterThan(0)
    const failures = stops
      .map((stop) => ({ stop, ratio: contrast(text, stop) }))
      .filter(({ ratio }) => ratio < 4.5)
      .map(({ stop, ratio }) => `${text} sur ${stop} → ${ratio.toFixed(2)}:1`)
    expect(failures, `plaque ${state} : ${failures.join(', ')}`).toEqual([])
  })

  it('la plaque dorée ne retombe pas sur #b45309 (3,82:1)', () => {
    expect(PLATES.current.stops.map((s) => s.toLowerCase())).not.toContain('#b45309')
  })
})
