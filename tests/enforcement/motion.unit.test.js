// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindConfig from '../../tailwind.config.js'

/*
  Garde-fou — mouvement (WCAG 2.2.2 « Mettre en pause, arrêter, masquer », niveau A).

  Un mouvement qui démarre seul et dure PLUS de 5 s exige un moyen de l'arrêter. L'invite
  « cliquez » de l'accueil bouclait à l'infini (`animate-bounce`), et ignorait
  `prefers-reduced-motion` : même un audit lancé « en mouvement réduit » voyait la page bouger
  (captures non déterministes, constaté le 24/09/2026).
*/

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

const vueFiles = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name)
  return statSync(path).isDirectory() ? vueFiles(path) : path.endsWith('.vue') ? [path] : []
})

const seconds = (token) => (token.endsWith('ms') ? parseFloat(token) / 1000 : parseFloat(token))

// Deux nombres, pas un. Le budget est ce que le test fait respecter ; le plafond réglementaire
// (WCAG 2.2.2 vise ce qui dure PLUS de 5 s) est ce qu'on n'approche jamais. Un garde-fou dont
// la valeur de passage serait le seuil d'échec ne pourrait que constater, jamais prévenir.
const DESIGN_BUDGET_S = 3
const WCAG_CEILING_S = 5

describe('Mouvement', () => {
  it(`les animations maison de la config Tailwind sont finies et tiennent dans le budget de ${DESIGN_BUDGET_S} s`, () => {
    const animations = tailwindConfig.theme?.extend?.animation ?? {}
    expect(Object.keys(animations), 'aucune animation maison lue — le test ne prouverait rien').toContain('bounce-hint')

    for (const [name, value] of Object.entries(animations)) {
      const parts = value.split(/\s+/)
      const duration = parts.find((p) => /^[\d.]+m?s$/.test(p))
      const iterations = parts.find((p) => p === 'infinite' || /^\d+$/.test(p)) ?? '1'
      expect(iterations, `animate-${name} boucle à l'infini : écart WCAG 2.2.2`).not.toBe('infinite')
      const total = seconds(duration) * Number(iterations)
      expect(total, `animate-${name} dure ${total} s (${duration} × ${iterations}) : budget de conception ${DESIGN_BUDGET_S} s`).toBeLessThanOrEqual(DESIGN_BUDGET_S)
      // Redondant tant que le budget est sous le plafond — il reste là pour qu'un budget relevé
      // un jour jusqu'au plafond échoue quand même : STRICTEMENT inférieur, jamais « au plus ».
      expect(total, `animate-${name} dure ${total} s : doit rester STRICTEMENT sous le plafond WCAG 2.2.2 de ${WCAG_CEILING_S} s`).toBeLessThan(WCAG_CEILING_S)
    }
  })

  it("aucune vue n'utilise une animation Tailwind infinie par défaut", () => {
    const INFINITE = /\b(?:[\w-]+:)*animate-(?:bounce|spin|ping|pulse)(?![\w-])/g // pas animate-bounce-hint
    const offenders = vueFiles(join(root, 'src')).flatMap((file) =>
      (readFileSync(file, 'utf-8').match(INFINITE) ?? []).map((cls) => `${relative(root, file)} : ${cls}`))
    expect(offenders, 'animate-bounce/spin/ping/pulse bouclent à l\'infini — utiliser une animation finie de la config (ex. animate-bounce-hint), derrière motion-safe:').toEqual([])
  })

  it('le CSS honore prefers-reduced-motion pour tout le site', () => {
    const css = readFileSync(join(root, 'src/assets/base.css'), 'utf-8')
    const block = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/)
    expect(block, 'règle globale @media (prefers-reduced-motion: reduce) absente de base.css').not.toBeNull()
    expect(block[1]).toMatch(/animation-duration:\s*0\.01ms\s*!important/)
    expect(block[1]).toMatch(/transition-duration:\s*0\.01ms\s*!important/)
  })
})
