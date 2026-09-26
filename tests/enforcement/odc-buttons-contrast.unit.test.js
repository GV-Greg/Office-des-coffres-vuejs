// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/*
  Garde-fou — contraste des boutons « relief 3D » (odc-buttons.css), jumeau de
  btn-grad-contrast.unit.test.js pour la nouvelle charte (identité visuelle du 27/09/2026).

  La face d'un bouton texte est un dégradé --b1 → --b2 ; --b1 est l'arrêt le plus clair, c'est
  contre lui que le texte se mesure (4,5:1, WCAG 1.4.3). Chaque --b1 reprend un plancher de la
  charte `.btn-grad-*`. Texte blanc, sauf `odc--dark` (crème #fef3c7).

  Le survol est gardé aussi : le fichier source appliquait `filter: brightness(1.08)` aux
  boutons texte, ce qui passait 6 couleurs sur 9 sous le seuil (rose 3,89:1). Notre copie
  l'annule — ce test échoue si un filtre éclaircissant revient sur `.odc-btn:hover`.
  Les boutons ronds (`--c1…--c3`) ne portent que des icônes : contraste non textuel, hors
  de ce test.
*/

const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../src/assets/odc-buttons.css'), 'utf-8')

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const TEXT = { dark: '#fef3c7' }
// Une classe de couleur peut apparaître dans plusieurs règles (`.odc-btn.odc--dark` ne fixe que
// la couleur du texte) : on garde la règle qui déclare les variables.
const colors = [...css.matchAll(/(?:^|\n)\.odc--([a-z]+)\s*\{([^}]*)\}/g)]
  .map(([, name, body]) => ({ name, b1: body.match(/--b1:\s*(#[0-9a-f]{6})/i)?.[1] }))

describe('Contraste des boutons odc-* (texte sur --b1)', () => {
  it('lit bien les couleurs à contrôler (sinon le test ne prouverait rien)', () => {
    const names = colors.map((c) => c.name)
    for (const expected of ['orange', 'green', 'red', 'blue', 'gold', 'teal', 'rose', 'slate', 'violet', 'dark']) {
      expect(names).toContain(expected)
    }
  })

  it.each(colors.map((c) => [c.name, c.b1]))('.odc--%s — texte ≥ 4,5:1 sur --b1 %s', (name, b1) => {
    expect(b1, `.odc--${name} : aucun --b1 lu`).toBeTruthy()
    const ratio = contrast(TEXT[name] ?? '#ffffff', b1)
    expect(ratio, `.odc--${name} : ${ratio.toFixed(2)}:1 — ne jamais éclaircir un --b1 sans refaire le calcul`).toBeGreaterThanOrEqual(4.5)
  })

  // Niveau discret : texte --q-fg sur fond --q-bg (repos) ET --q-bg-hover (survol).
  const quiet = [...css.matchAll(/\.odc-btn--quiet(?:\.odc--([a-z]+))?\s*\{([^}]*--q-fg[^}]*)\}/g)]
    .map(([, name, body]) => {
      const v = (k) => body.match(new RegExp(`--q-${k}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1]
      return [name ?? 'défaut', v('fg'), v('bg'), v('bg-hover')]
    })

  it('lit bien les couleurs du niveau discret', () => {
    expect(quiet.map(([n]) => n)).toEqual(expect.arrayContaining(['défaut', 'blue', 'red', 'orange', 'green']))
  })

  it.each(quiet)('.odc-btn--quiet (%s) — texte ≥ 4,5:1, repos et survol', (name, fg, bg, bgHover) => {
    for (const background of [bg, bgHover]) {
      expect(background, `${name} : couleur de fond non lue`).toBeTruthy()
      const ratio = contrast(fg, background)
      expect(ratio, `${name} : ${fg} sur ${background} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("le survol d'un bouton texte n'éclaircit pas sa face", () => {
    // Dernière règle `:hover` visant .odc-btn seul : c'est elle qui l'emporte (même spécificité).
    const hoverRules = [...css.matchAll(/([^{}]*\.odc-btn:hover[^{}]*)\{([^}]*)\}/g)]
    const last = hoverRules.at(-1)
    expect(last, 'aucune règle .odc-btn:hover trouvée').toBeTruthy()
    expect(last[2]).toMatch(/filter:\s*none/)
  })
})
