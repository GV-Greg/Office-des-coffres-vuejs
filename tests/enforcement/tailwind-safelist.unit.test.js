// @vitest-environment node
// Logique pure (lecture de fichiers), aucun DOM à monter.
//
// Garde-fou des classes Tailwind construites à l'exécution. Le JIT ne connaît que les classes
// écrites en toutes lettres dans les fichiers de `content` : une classe composée par
// concaténation (`btn-${color}`, `text-${color}-100`) est purgée du build de prod, sans erreur.
//
// Historique : `NavMenu.vue` en était la seule source, protégée par un safelist — et ce garde-fou
// vérifiait que le safelist couvrait chaque couleur du menu, parce que la régression avait eu lieu
// (performance #4 : les 5 pastilles sorties uniformément bleues). Le 27/09/2026, le menu M1 passe
// ses couleurs en variables CSS : le safelist est supprimé, et ce test garde désormais l'état
// inverse — plus aucune classe construite dans le menu, plus de safelist à entretenir.
//
// Réintroduire une classe construite impose de rétablir un safelist ET un test qui le vérifie,
// délibérément, pas l'un sans l'autre.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const navMenu = fs.readFileSync(path.join(root, 'src/components/NavMenu.vue'), 'utf-8')
const tailwindConfig = fs.readFileSync(path.join(root, 'tailwind.config.js'), 'utf-8')

const template = navMenu.slice(navMenu.indexOf('<template>'), navMenu.lastIndexOf('</template>'))

describe('classes Tailwind construites à l’exécution', () => {
  it('le gabarit de NavMenu est bien lu (sinon ce garde-fou ne teste rien)', () => {
    expect(template).toContain('RouterLink')
  })

  it('NavMenu ne compose aucune classe par interpolation', () => {
    // `…-${…}` dans une chaîne à gabarit liée à :class
    const built = template.match(/[\w-]+-\$\{[^}]+\}/g) ?? []
    expect(built, `classes construites dans NavMenu : ${built.join(', ')} — le JIT ne les verra pas`).toEqual([])
  })

  it('les couleurs du menu passent par des variables CSS', () => {
    expect(navMenu).toMatch(/'--c1':/)
    expect(template).toMatch(/:style="paletteVars\(page\.color\)"/)
  })

  it('le safelist n’est pas réintroduit sans raison', () => {
    expect(
      /^\s*safelist\s*:/m.test(tailwindConfig),
      'tailwind.config.js déclare un safelist : aucune classe n’est plus construite dans le code — si une l’est de nouveau, ce test doit être réécrit avec elle',
    ).toBe(false)
  })
})
