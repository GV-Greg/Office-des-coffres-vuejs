import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/*
  Garde-fou — parité des clés FR / EN.

  Ce test est la contrepartie du chargement à la demande des locales (src/i18n/index.js).
  Tant que les deux fichiers partaient dans le bundle, `fallbackLocale: 'fr'` rattrapait
  silencieusement une clé absente de `en.json`. Charger une seule langue supprime ce filet :
  une clé manquante s'afficherait telle quelle à l'écran, en anglais comme en français.

  Rétablir le fallback coûterait de charger les deux fichiers, soit exactement ce que le
  découpage évite. La parité vérifiée remplace donc le fallback — c'est elle qui rend le
  retrait sûr, et non l'espoir que personne n'oublie une traduction.

  ⚠️ Lecture par `fs`, jamais par `import` : le plugin @intlify précompile les .json en
  fonctions de rendu, et un import statique ne rendrait pas l'objet attendu ici.
*/

const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales')

const read = (name) => JSON.parse(readFileSync(resolve(localesDir, name), 'utf-8'))

// Aplatit en chemins « A.B.C », pour qu'un écart désigne la clé exacte et pas un objet.
const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return value && typeof value === 'object' && !Array.isArray(value)
      ? flatten(value, path)
      : [path]
  })

describe('Parité des locales FR / EN', () => {
  const fr = flatten(read('fr.json'))
  const en = flatten(read('en.json'))

  it('ne laisse aucune clé française sans équivalent anglais', () => {
    const manquantes = fr.filter((k) => !en.includes(k))
    expect(manquantes, `Clés absentes de en.json : ${manquantes.join(', ')}`).toEqual([])
  })

  it('ne laisse aucune clé anglaise sans équivalent français', () => {
    const manquantes = en.filter((k) => !fr.includes(k))
    expect(manquantes, `Clés absentes de fr.json : ${manquantes.join(', ')}`).toEqual([])
  })

  it('ne contient aucune valeur vide, qui afficherait du blanc à la place du texte', () => {
    const vides = []
    for (const [nom, fichier] of [['fr.json', read('fr.json')], ['en.json', read('en.json')]]) {
      const parcourir = (obj, prefix = '') => {
        for (const [key, value] of Object.entries(obj)) {
          const path = prefix ? `${prefix}.${key}` : key
          if (value && typeof value === 'object') parcourir(value, path)
          else if (typeof value === 'string' && value.trim() === '') vides.push(`${nom} → ${path}`)
        }
      }
      parcourir(fichier)
    }
    expect(vides, `Valeurs vides : ${vides.join(', ')}`).toEqual([])
  })
})
