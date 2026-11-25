// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseGuet, guetPseudos, diffGuet } from '../../src/modules/guetParser'

const fixture = readFileSync(resolve(process.cwd(), 'tests/fixtures/Bug_ExportSorties.txt'), 'utf8')
function block(startTag, endTag) {
  const start = fixture.indexOf(startTag) + startTag.length
  return fixture.slice(start, fixture.indexOf(endTag)).replace(/^\n/, '').replace(/\n$/, '')
}
const hier = block('--- HIER_DEBUT ---', '--- HIER_FIN ---')
const aujourdhui = block('--- AUJOURDHUI_DEBUT ---', '--- AUJOURDHUI_FIN ---')

describe('guetParser — collage réel', () => {
  it("lit l'en-tête « Liste des villageois (N) » et le confronte au nombre de lignes lues", () => {
    const guet = parseGuet(hier)
    expect(guet.declaredTotal).toBe(39)
    expect(guet.villagers).toHaveLength(39)
    expect(guet.totalMatches).toBe(true)

    const today = parseGuet(aujourdhui)
    expect(today.declaredTotal).toBe(36)
    expect(today.totalMatches).toBe(true)
  })

  it('sépare le pseudo (premier mot) de la noblesse, jamais le préambule', () => {
    const { villagers } = parseGuet(hier)
    const brennos = villagers.find(v => v.pseudo === 'Brennos')
    expect(brennos).toMatchObject({ noblesse: 'de Lapin', reputation: 255 })
    expect(villagers.find(v => v.pseudo === 'Wouchi').noblesse).toBe('du Bois Hardent')
    expect(villagers.map(v => v.pseudo)).not.toContain('Le')
    expect(villagers.map(v => v.pseudo)).not.toContain('Liste')
  })
})

describe('guetParser — cas du brief', () => {
  const sample = [
    'Liste des villageois (4)',
    'Gregor.\t140PR\t',
    'Emmie....\t5PR\t',
    'William._\t85PR\t',
    'Lucienne, Baronne\t200PR\t'
  ].join('\n')

  it('garde intacts les points, soulignés et tirets du pseudo', () => {
    expect(guetPseudos(sample)).toEqual(['Gregor.', 'Emmie....', 'William._', 'Lucienne'])
  })

  it('tolère la noblesse après une virgule (repli) sans garder la virgule', () => {
    const lucienne = parseGuet(sample).villagers[3]
    expect(lucienne).toEqual({ pseudo: 'Lucienne', noblesse: 'Baronne', reputation: 200 })
  })

  it('lit la réputation « XXXPR » et la laisse nulle si le suffixe manque', () => {
    expect(parseGuet('Alice\t12PR').villagers[0].reputation).toBe(12)
    expect(parseGuet('Alice\t12').villagers[0].reputation).toBeNull()
  })

  it('signale un collage tronqué : total annoncé ≠ lignes lues', () => {
    const tronque = 'Liste des villageois (3)\nA\t1PR\nB\t2PR'
    const guet = parseGuet(tronque)
    expect(guet.declaredTotal).toBe(3)
    expect(guet.totalMatches).toBe(false)
  })

  it("ne conclut rien sans en-tête (totalMatches nul) et tolère l'absence de texte", () => {
    expect(parseGuet('A\t1PR').totalMatches).toBeNull()
    expect(parseGuet(undefined)).toEqual({ villagers: [], declaredTotal: null, totalMatches: null })
  })

  it('accepte les fins de ligne Windows', () => {
    expect(guetPseudos('A\t1PR\r\nB\t2PR\r\n')).toEqual(['A', 'B'])
  })
})

describe('guetParser — arrivées et départs', () => {
  it('diffe hier → aujourd’hui', () => {
    const diff = diffGuet('A\t1PR\nB\t1PR', 'B\t1PR\nC\t1PR')
    expect(diff.inputs).toEqual(['C'])
    expect(diff.outputs).toEqual(['A'])
    expect(diff.today).toEqual(['B', 'C'])
  })
})
