// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseReleve, collectPseudos, hasContent, buildLocalReport, localGameDay } from '../../src/modules/customsLocalReport.js'

/*
  Relevé unique (PR 3-2) : de cinq types de collage à UN bilan local, dans la forme du serveur. Collages RÉELS (fixtures du Registre de douane).
  Sans compte : aucune couleur, différentiel à la liste d'hier. Avec un rôle : couleurs et dernier bilan de la ville donnés par le serveur.
*/
const fixtures = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures/customs')
const read = name => readFileSync(resolve(fixtures, `collage-${name}.txt`), 'utf-8')
const guetFr = read('guet-fr')
const visionsFr = read('visions-fr')
const armiesFr = `${read('armees-fr')}\n\n${read('groupes-fr')}\n\n${read('controle-zone-fr')}`

describe('Relevé unique — le bilan local', () => {
  it('cinq types, trois zones : guet, visions, armées/groupes/contrôle de la zone donnent un bilan dans la forme du serveur', () => {
    const parsed = parseReleve({ guet: guetFr, visions: visionsFr, armiesGroups: armiesFr })
    const report = buildLocalReport(parsed, { day: '2026-11-21' })

    expect(report.sections_present).toEqual(['guet', 'visions', 'armies_groups'])
    expect(report.sections.guet.read_total).toBe(45)
    expect(report.sections.guet.total_matches).toBe(true)
    expect(report.sections.visions.entries.length).toBeGreaterThan(0)
    expect(report.sections.armies_groups.groups.length).toBe(11)
    expect(report.sections.armies_groups.zone).toBeTruthy()
    expect(report.reported_on).toBe('2026-11-21')
  })

  it('sans compte : AUCUNE couleur, le guet reste complet', () => {
    const report = buildLocalReport(parseReleve({ guet: guetFr }), { day: '2026-11-21' })

    expect(report.sections.guet.villagers.every(v => v.colour === null)).toBe(true)
  })

  it('les visions : sans jour donné, le plus récent du collage ; avec le jour du serveur, seulement ce jour-là (les autres comptés)', () => {
    const latest = parseReleve({ visions: visionsFr })
    expect(latest.visions.day).toBe('2026-11-21')
    expect(latest.visions.kept.length).toBeGreaterThan(0)
    expect(latest.visions.otherDays).toBe(11) // 12 lignes, une du 21/11

    const picked = parseReleve({ visions: visionsFr }, '2026-10-27')
    expect(picked.visions.day).toBe('2026-10-27')
    expect(picked.visions.kept).toHaveLength(2) // deux lignes le même jour dans le collage réel
    expect(picked.visions.otherDays).toBe(10)
  })

  it('le différentiel : à la liste d\'hier collée (sans date), comparaison sans tenir compte de la casse', () => {
    const yesterday = "Liste des villageois (2)\nGREGOR.\t255PR\nPartie\t12PR"
    const today = "Liste des villageois (2)\nGregor.\t255PR\nNouvelle\t10PR"
    const report = buildLocalReport(parseReleve({ guet: today, yesterday }), { day: '2026-11-21' })

    expect(report.sections.guet.diff.compared_to).toBeNull()
    expect(report.sections.guet.diff.arrivals.map(p => p.pseudo)).toEqual(['Nouvelle'])
    expect(report.sections.guet.diff.departures.map(p => p.pseudo)).toEqual(['Partie'])
  })

  it('avec le dernier bilan de la ville (Registre) : il PRIME sur la liste d\'hier collée, et dit lequel', () => {
    const today = "Liste des villageois (2)\nAlpha\t1PR\nBeta\t1PR"
    const report = buildLocalReport(parseReleve({ guet: today, yesterday: "Liste des villageois (1)\nZed\t1PR" }), {
      day: '2026-11-21', previous: { compared_to: '2026-11-20', pseudos: ['alpha', 'Gamma'] },
    })

    expect(report.sections.guet.diff.compared_to).toBe('2026-11-20')
    expect(report.sections.guet.diff.arrivals.map(p => p.pseudo)).toEqual(['Beta'])
    expect(report.sections.guet.diff.departures.map(p => p.pseudo)).toEqual(['Gamma'])
  })

  it('sans bilan antérieur ni liste d\'hier : aucun différentiel inventé', () => {
    expect(buildLocalReport(parseReleve({ guet: guetFr }), { day: '2026-11-21' }).sections.guet.diff).toBeNull()
  })

  it('les couleurs données par le serveur se posent partout : habitants, arrivées, visions, armées, groupes ; seul le type « groupe » alerte', () => {
    // « Gregor » sans point final : la phrase des visions retire UN point final (règle des collages réels), un pseudo en « . » y perdrait le sien.
    const parsed = parseReleve({ guet: 'Liste des villageois (1)\nGregor\t1PR', visions: "Le 21 Novembre 1474\nAujourd'hui, en chemin, vous avez croisé Gregor.", armiesGroups: 'Armées présentes ici :\nArmée "Legio" commandée par Gregor\nGroupes présents ici :\nGroupe de Gregor\nAdmission libre' })
    const report = buildLocalReport(parsed, { day: '2026-11-21', colours: [{ pseudo: 'Gregor', colour: 'red' }] })

    expect(report.sections.guet.villagers[0].colour).toBe('red')
    expect(report.sections.visions.entries[0].singles[0].colour).toBe('red')
    expect(report.sections.armies_groups.armies[0].commander.colour).toBe('red')
    expect(report.sections.armies_groups.groups[0]).toMatchObject({ type: 'groupe', alert: true })
    expect(report.sections.armies_groups.groups[0].members[0].colour).toBe('red')
  })

  it('collectPseudos : tous les pseudos, uniques, tels que collés — et RIEN d\'autre (jamais un texte)', () => {
    const pseudos = collectPseudos(parseReleve({ guet: guetFr, visions: visionsFr, armiesGroups: armiesFr }))

    expect(new Set(pseudos).size).toBe(pseudos.length)
    expect(pseudos.length).toBeGreaterThan(45)
    expect(pseudos.every(p => typeof p === 'string' && !/\s/.test(p))).toBe(true)
  })

  it('hasContent : faux pour des collages vides ou illisibles', () => {
    expect(hasContent(parseReleve({}))).toBe(false)
    expect(hasContent(parseReleve({ guet: 'du texte sans tableau' }))).toBe(false)
    expect(hasContent(parseReleve({ guet: guetFr }))).toBe(true)
  })

  it('localGameDay : le jour du jeu bascule à 04:00 de Paris', () => {
    expect(localGameDay(new Date('2026-11-22T02:30:00Z'))).toBe('2026-11-21') // 03:30 à Paris : encore la veille
    expect(localGameDay(new Date('2026-11-22T03:30:00Z'))).toBe('2026-11-22') // 04:30 à Paris
  })
})
