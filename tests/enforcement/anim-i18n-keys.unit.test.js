import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Toute clé de texte écrite LITTÉRALEMENT dans le module Animation existe, en français ET en anglais. La parité fr/en est déjà gardée ailleurs
// (une clé d'un côté et pas de l'autre) ; ce garde-fou voit l'autre défaut, qu'aucun test de rendu ne voit : une clé que PERSONNE n'a écrite
// (un texte « Animation.Grid.TakenEmpty » affiché tel quel à l'écran). `kt('Section.Clé')` lit `Animation.Rewards.Section.Clé` puis, à défaut,
// `Animation.Section.Clé` (use/useAnimKind.js) : l'une des deux doit exister.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = lang => JSON.parse(fs.readFileSync(path.join(root, 'src/locales', `${lang}.json`), 'utf8'))
const LOCALES = { fr: read('fr'), en: read('en') }
const at = (obj, dotted) => dotted.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj)

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))
const files = [
  ...walk(path.join(root, 'src/components/anim')),
  ...walk(path.join(root, 'src/views/modules/animation')),
  path.join(root, 'src/use/useAnimKind.js'),
].filter(f => /\.(vue|js)$/.test(f))

const KEY = /[^\w.](t|kt)\(\s*'([A-Za-z][\w.]*)'/g

describe('clés de texte du module Animation', () => {
  for (const [lang, messages] of Object.entries(LOCALES)) {
    it(`toutes les clés littérales existent en ${lang}`, () => {
      const missing = []
      for (const file of files) {
        const src = fs.readFileSync(file, 'utf8')
        for (const [, fn, key] of src.matchAll(KEY)) {
          const found = fn === 'kt'
            ? at(messages, `Animation.Rewards.${key}`) !== undefined || at(messages, `Animation.${key}`) !== undefined
            : at(messages, key) !== undefined
          if (!found) missing.push(`${path.relative(root, file)} : ${fn}('${key}')`)
        }
      }
      expect(missing, `Clés absentes de ${lang}.json :\n${missing.join('\n')}`).toEqual([])
    })
  }

  it('le motif trouve bien des clés (contrôle positif : un garde-fou qui ne lit rien serait vert à tort)', () => {
    let count = 0
    for (const file of files) count += [...fs.readFileSync(file, 'utf8').matchAll(KEY)].length
    expect(count).toBeGreaterThan(150)
  })
})
