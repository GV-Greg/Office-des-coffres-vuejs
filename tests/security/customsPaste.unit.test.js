// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildSections } from '../../src/modules/customsPaste.js'
import { PARSER_VERSION } from '../../src/modules/customsParsers.js'

/*
  De trois collages à l'envoi : ce que le serveur recevra (JSON analysé ET brut gardé), sur les collages réels de Greg (22/11/2026).
*/
const fixture = name => readFileSync(resolve(process.cwd(), `tests/fixtures/customs/collage-${name}.txt`), 'utf8')
const all = lang => ({ guet: fixture(`guet-${lang}`), visions: fixture(`visions-${lang}`), armiesGroups: `${fixture(`armees-${lang}`)}\n\n${fixture(`groupes-${lang}`)}\n\n${fixture(`controle-zone-${lang}`)}` })

describe('buildSections', () => {
  it.each(['fr', 'en'])('%s : les trois sections sont prêtes à l\'envoi, avec leur brut gardé et la version du parseur', (lang) => {
    const { sections, summary, problems } = buildSections(all(lang), '2026-10-27')

    expect(problems).toEqual([])
    expect(Object.keys(sections)).toEqual(['guet', 'visions', 'armies_groups'])
    expect(sections.guet).toMatchObject({ parser_version: PARSER_VERSION, report: { declared_total: 45 } })
    expect(sections.guet.report.villagers).toHaveLength(45)
    expect(sections.guet.raw.split('\n')).toHaveLength(46) // sans préambule
    expect(sections.visions.report).toMatchObject({ other_days: 10 })
    expect(sections.visions.report.entries).toHaveLength(2)
    expect(sections.visions.raw.split('\n')).toHaveLength(3) // en-tête du jour + 2 lignes, rien des autres jours
    expect(sections.armies_groups.report.armies).toHaveLength(2)
    expect(sections.armies_groups.report.groups).toHaveLength(11)
    expect(sections.armies_groups.report.zone).not.toBeNull()
    expect(summary).toMatchObject({ guet: { read: 45, declared: 45, matches: true }, visions: { kept: 2, otherDays: 10 } })
  })

  it('un seul collage suffit : les autres sections sont absentes, jamais vides', () => {
    const { sections } = buildSections({ guet: fixture('guet-fr') }, '2026-10-27')
    expect(Object.keys(sections)).toEqual(['guet'])
  })

  it('des visions sans rien pour le jour du bilan : aucune section, un problème dit, les autres jours comptés', () => {
    const { sections, summary, problems } = buildSections({ guet: fixture('guet-fr'), visions: fixture('visions-fr') }, '2026-11-22')
    expect(sections.visions).toBeUndefined()
    expect(problems).toEqual(['visions_none'])
    expect(summary.visions).toMatchObject({ kept: 0, otherDays: 12 })
  })

  it('un collage illisible est signalé, pas envoyé', () => {
    const { sections, problems } = buildSections({ guet: 'rien de reconnaissable', armiesGroups: 'du texte quelconque' }, '2026-10-27')
    expect(sections).toEqual({})
    expect(problems).toEqual(['guet_empty', 'armies_groups_empty'])
  })

  it('un collage tronqué reste envoyable : le total annoncé est confronté aux lignes lues', () => {
    const { sections, summary } = buildSections({ guet: 'Liste des villageois (5)\nA\t1PR\nB\t2PR' }, '2026-10-27')
    expect(summary.guet).toMatchObject({ read: 2, declared: 5, matches: false })
    expect(sections.guet.report.declared_total).toBe(5)
  })
})
