// @vitest-environment node
// Logique pure (lecture de fichiers), aucun DOM à monter.
//
// Garde-fou de admin/suivi/performance.md #4 : le safelist Tailwind a été réduit aux seules
// classes que le JIT ne peut pas détecter, c'est-à-dire celles que `NavMenu.vue` construit
// dynamiquement à partir de la couleur de chaque entrée de menu (`btn-${page.color}` et
// `text-${page.color}-100`).
//
// Ce test existe parce que la régression a réellement eu lieu pendant la livraison de #4 : le
// pattern `btn-*` avait été retiré au motif que les classes `.btn-<couleur>` sont définies dans
// `assets/style.css`. C'est faux — une règle d'un `@layer components` est purgée si la classe
// n'est détectée nulle part dans `content` — et les 5 pastilles du menu circulaire sont sorties
// uniformément bleues au build de prod. Tailwind émet au contraire un avertissement trompeur sur
// ce pattern (« doesn't match any Tailwind CSS classes ») : il parle de la génération
// d'utilitaires, pas de la préservation des classes composant. Ne pas le suivre.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const navMenu = fs.readFileSync(path.join(root, 'src/components/NavMenu.vue'), 'utf-8')
const tailwindConfig = fs.readFileSync(path.join(root, 'tailwind.config.js'), 'utf-8')

// Couleurs réellement déclarées dans le tableau `pages` de NavMenu.vue
const menuColors = [...navMenu.matchAll(/color:\s*["']([a-z]+)["']/g)].map((m) => m[1])

// Patterns du safelist, sous la forme de vraies RegExp
const safelistPatterns = [...tailwindConfig.matchAll(/pattern:\s*(\/(?:[^/\\]|\\.)+\/)/g)].map(
  (m) => new RegExp(m[1].slice(1, -1)),
)

describe('safelist Tailwind vs couleurs du menu circulaire', () => {
  it('NavMenu déclare bien des couleurs (sinon ce garde-fou ne teste rien)', () => {
    expect(menuColors.length).toBeGreaterThan(0)
  })

  it('le safelist couvre la classe composant `btn-<couleur>` de chaque entrée de menu', () => {
    for (const color of menuColors) {
      const cls = `btn-${color}`
      expect(
        safelistPatterns.some((p) => p.test(cls)),
        `${cls} n'est couverte par aucun pattern du safelist : la pastille correspondante du menu perdra sa couleur au build de prod`,
      ).toBe(true)
    }
  })

  it("le safelist couvre l'utilitaire `text-<couleur>-100` de chaque entrée de menu", () => {
    for (const color of menuColors) {
      const cls = `text-${color}-100`
      expect(
        safelistPatterns.some((p) => p.test(cls)),
        `${cls} n'est couverte par aucun pattern du safelist : l'icône correspondante perdra sa teinte au build de prod`,
      ).toBe(true)
    }
  })

  it('le safelist reste étroit — pas de retour à un pattern générique toutes couleurs', () => {
    // Un safelist qui accepterait une couleur absente du menu signale un pattern trop large
    // (c'est l'état d'avant #4 : 782 classes de base, ~92 % du poids du CSS).
    for (const cls of ['text-fuchsia-900', 'bg-indigo-500', 'ring-offset-lime-200', 'btn-gray']) {
      expect(
        safelistPatterns.some((p) => p.test(cls)),
        `${cls} est safelistée alors qu'aucun code ne la construit — le safelist s'est re-élargi`,
      ).toBe(false)
    }
  })
})
