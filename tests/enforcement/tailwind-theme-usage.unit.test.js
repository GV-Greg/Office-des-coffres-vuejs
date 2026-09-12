// @vitest-environment node
// Logique pure (parcours de fichiers), aucun DOM à monter.
//
// Garde-fou : ce projet restreint le thème Tailwind par rapport aux valeurs par défaut, et une
// classe qui sort de ce thème ne produit **aucun CSS** — sans erreur, sans avertissement, sans
// rien de visible avant le rendu réel. Deux restrictions, deux familles de bugs déjà rencontrées :
//
//   - `theme.colors` ne liste que 16 couleurs. `text-amber-600`, `bg-purple-100` ou
//     `text-salmon-600` ne sortent donc rien. Le badge « Membres » et le dégradé du Registre des
//     Réparations sont restés sans couleur pendant un mois pour cette raison.
//   - `theme.screens` est redéfini en `tablet`/`laptop`/`desktop`, ce qui **supprime** les
//     breakpoints par défaut : `sm:`, `md:`, `lg:`, `xl:`, `2xl:` et les `max-w-screen-<défaut>`
//     ne génèrent rien (7 fichiers étaient concernés en août 2026, plus `max-w-screen-lg` trouvé
//     en septembre).
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const config = fs.readFileSync(path.join(root, 'tailwind.config.js'), 'utf-8')

function themeKeys(section) {
  const start = config.indexOf(`${section}: {`)
  const body = config.slice(start, config.indexOf('\n    },', start))
  return [...body.matchAll(/^\s*'?([a-zA-Z][\w-]*)'?:/gm)].map((m) => m[1]).filter((k) => k !== section)
}

const COLORS = themeKeys('colors')
const SCREENS = themeKeys('screens')
// Préfixes d'utilitaires Tailwind qui prennent une couleur du thème.
const COLOR_PREFIXES = ['text', 'bg', 'border', 'ring', 'ring-offset', 'from', 'via', 'to',
  'divide', 'placeholder', 'accent', 'caret', 'fill', 'stroke', 'decoration', 'outline', 'shadow']
// Segments qui suivent les mêmes préfixes sans désigner une couleur (`bg-opacity-50`…).
const NOT_COLORS = ['opacity']

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) return walk(full)
    return /\.(vue|js)$/.test(e.name) ? [full] : []
  })
}

const files = walk(path.join(root, 'src'))
const colorRe = new RegExp(`\\b(?:[a-z]+:)*(${COLOR_PREFIXES.join('|')})-([a-z]+)-(\\d{2,3})\\b`, 'g')

describe('usages Tailwind vs thème restreint du projet', () => {
  it('le thème est bien lu depuis tailwind.config.js', () => {
    expect(COLORS).toContain('slate')
    expect(SCREENS).toEqual(['tablet', 'laptop', 'desktop'])
  })

  it('aucune classe de couleur ne sort de theme.colors', () => {
    const offenders = []
    for (const file of files) {
      for (const m of fs.readFileSync(file, 'utf-8').matchAll(colorRe)) {
        if (!COLORS.includes(m[2]) && !NOT_COLORS.includes(m[2])) {
          offenders.push(`${path.relative(root, file)} : ${m[0]} (couleur « ${m[2]} » absente du thème)`)
        }
      }
    }
    expect(offenders, `Ces classes ne produisent aucun CSS :\n${offenders.join('\n')}`).toEqual([])
  })

  it('aucun breakpoint par défaut de Tailwind (supprimés par theme.screens)', () => {
    const removed = ['sm', 'md', 'lg', 'xl', '2xl']
    const re = new RegExp(`\\b(?:(${removed.join('|')}):|max-w-screen-(${removed.join('|')})\\b)`, 'g')
    const offenders = []
    for (const file of files) {
      for (const m of fs.readFileSync(file, 'utf-8').matchAll(re)) {
        offenders.push(`${path.relative(root, file)} : ${m[0]} — utiliser tablet/laptop/desktop`)
      }
    }
    expect(offenders, `Ces classes ne produisent aucun CSS :\n${offenders.join('\n')}`).toEqual([])
  })
})
