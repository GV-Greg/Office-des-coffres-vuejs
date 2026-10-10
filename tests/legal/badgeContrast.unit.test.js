// @vitest-environment node
import { describe, it, expect } from 'vitest'
import colors from 'tailwindcss/colors'
import { ACCESS_LEVELS, BADGE_CLASSES } from '../../src/modules/dataPageSections'

/*
  Garde-fou — le texte des badges d'accès de « Vos données » se lit à 4,5:1 au moins sur le fond du
  badge, en thème clair ET en thème sombre (WCAG 1.4.3 ; fil pages-donnees-joueur, 07-badges et 11
  §2 : une mesure faite une fois à la main ne protège pas le prochain qui touche aux couleurs).

  Les classes sont lues telles quelles dans BADGE_CLASSES et résolues dans la palette Tailwind : jsdom
  ne calcule pas les styles, et le badge n'a pas d'autre fond que le sien.
*/

const MIN_RATIO = 4.5

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Couleur d'une utilité (`text`, `bg`) pour un thème, lue dans une chaîne de classes Tailwind. */
function resolve(classes, utility, dark) {
  const pattern = new RegExp(`(?:^|\\s)${dark ? 'dark:' : ''}${utility}-([a-z]+)-(\\d+)(?=\\s|$)`)
  const match = classes.match(pattern)
  if (!match) throw new Error(`${dark ? 'dark:' : ''}${utility}-* absente de « ${classes} »`)
  const hex = colors[match[1]]?.[match[2]]
  if (!hex) throw new Error(`${match[1]}-${match[2]} absente de la palette Tailwind`)
  return hex
}

const badgeRatio = (classes, dark) => ratio(resolve(classes, 'text', dark), resolve(classes, 'bg', dark))

describe('Badges d’accès de « Vos données » — contraste du texte', () => {
  it('chaque niveau d’accès a sa couleur de badge', () => {
    expect(Object.keys(BADGE_CLASSES).sort()).toEqual([...ACCESS_LEVELS].sort())
  })

  it.each(ACCESS_LEVELS.flatMap(level => [[level, 'clair', false], [level, 'sombre', true]]))(
    '%s, thème %s : texte ≥ 4,5:1 sur le fond du badge',
    (level, _theme, dark) => {
      expect(badgeRatio(BADGE_CLASSES[level], dark)).toBeGreaterThanOrEqual(MIN_RATIO)
    },
  )

  // Contrôle positif : sans lui, on ne saurait pas que la mesure mesure quelque chose.
  it('fait bien échouer un badge pâle (contrôle positif)', () => {
    const pale = 'bg-green-100 text-green-400 dark:bg-green-950 dark:text-green-800'
    expect(badgeRatio(pale, false)).toBeLessThan(MIN_RATIO)
    expect(badgeRatio(pale, true)).toBeLessThan(MIN_RATIO)
  })

  it('signale une classe manquante plutôt que de la deviner', () => {
    expect(() => badgeRatio('bg-green-100', false)).toThrow(/text-\* absente/)
  })
})
