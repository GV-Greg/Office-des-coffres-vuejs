// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import colors from 'tailwindcss/colors'

/*
  Garde-fou — contraste des boutons en dégradé à texte blanc (WCAG 1.4.3, 4,5:1).

  axe ne sait pas évaluer un texte posé sur un dégradé : il classe ces boutons « à vérifier »,
  jamais en violation. Le garde-fou axe en navigateur ne les verra donc pas. Ce test fait le
  calcul qu'axe ne fait pas, sur TOUS les arrêts de chaque dégradé — repos ET survol : le
  contraste se mesure contre l'arrêt le plus clair, jamais contre une moyenne, et un survol
  qui éclaircit repasserait sous le seuil sans que rien d'autre ne le signale.

  Planchers et raisonnement : commentaire au-dessus de `.btn-grad-blue` dans style.css.

  ⚠️ PORTÉE LIMITÉE — ce test ne lit QUE `style.css`. Un dégradé écrit directement dans une vue
  (classes `from-… to-…` dans un .vue) lui échappe : c'est ainsi que « Entrez sans compte »
  (LoginView.vue, 2,26:1) est passé le 24/09/2026. La page rendue est couverte par
  tests/browser/textContrast.mjs (dégradés mesurés arrêt par arrêt) — c'est lui qui fait foi ;
  ce test-ci n'est qu'un retour rapide sur la charte. À retirer quand textContrast passe en CI.
*/

const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../src/assets/style.css'), 'utf-8')

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
const WHITE = '#ffffff'

// Blocs `.classe { … }` dont le texte est blanc et le fond un dégradé.
const gradientRules = [...css.matchAll(/\.([\w-]+)\s*(?:,\s*\.[\w-]+\s*)*\{([^}]*)\}/g)]
  .flatMap((m) => {
    const names = m[0].slice(0, m[0].indexOf('{')).split(',').map((s) => s.trim().replace(/^\./, ''))
    return names.map((name) => ({ name, body: m[2] }))
  })
  .filter(({ body }) => /\btext-white\b/.test(body) && /\bbg-gradient-to-/.test(body))

describe('Contraste des boutons en dégradé à texte blanc', () => {
  it('trouve bien les règles à contrôler (sinon le test ne prouverait rien)', () => {
    const names = gradientRules.map((r) => r.name)
    for (const expected of ['btn-primary', 'btn-grad-red', 'btn-grad-green', 'btn-grad-slate', 'btn-grad-blue']) {
      expect(names).toContain(expected)
    }
  })

  it.each(gradientRules.map((r) => [r.name, r.body]))('.%s — chaque arrêt, repos et survol, ≥ 4,5:1', (name, body) => {
    const stops = [...body.matchAll(/(?:(hover):)?(?:from|via|to)-([a-z]+)-(\d{2,3})\b/g)]
    expect(stops.length, `.${name} : aucun arrêt de dégradé lu`).toBeGreaterThan(0)

    const failures = stops
      .map(([token, , family, shade]) => ({ token, ratio: contrast(colors[family][shade], WHITE) }))
      .filter(({ ratio }) => ratio < 4.5)
      .map(({ token, ratio }) => `${token} → ${ratio.toFixed(2)}:1`)

    expect(failures, `.${name} : texte blanc sous 4,5:1 sur ${failures.join(', ')} — voir le commentaire de contraste dans style.css (ce test ne voit que style.css, pas les dégradés écrits dans les vues)`).toEqual([])
  })
})
