// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseVisions, visionsForDay, parseArmiesGroups, ALERT_GROUP_TYPES, PARSER_VERSION } from '../../src/modules/customsParsers.js'
import { parseGuet } from '../../src/modules/guetParser.js'

/*
  Parseurs des collages du Registre de douane sur les COLLAGES RÉELS fournis par Greg le 22/11/2026 (tests/fixtures/customs/, copies de
  admin/exemples/collage-*.txt, FR et EN). Brief admin/content/brief-module-securite.md §6, corrigé par admin/echanges/module-securite/
  07-cc-analyse-collages.md et 08-greg-reponses-collages.md. Un seul parseur, au frontend, comme les mines (décision de Greg, fil 11).
*/

const fixture = name => readFileSync(resolve(process.cwd(), `tests/fixtures/customs/collage-${name}.txt`), 'utf8')

describe('guet — collages réels FR et EN', () => {
  it.each(['fr', 'en'])('%s : 45 villageois lus sur 45 annoncés (en-tête « Liste des villageois » ou « Presently in town »)', (lang) => {
    const guet = parseGuet(fixture(`guet-${lang}`))
    expect(guet.villagers).toHaveLength(45)
    expect(guet.declaredTotal).toBe(45)
    expect(guet.totalMatches).toBe(true)
  })

  it('le titre long d\'un noble garde ses virgules internes mais perd sa virgule de tête ; aucun pseudo ne contient d\'espace', () => {
    const { villagers } = parseGuet(fixture('guet-fr'))
    const aurelia = villagers.find(v => v.pseudo === 'Aurelia.')
    expect(aurelia.noblesse).toBe('Edle von Araja-Irissarri, Duchess of the Eichsfeld & Princess of Blankenburg')
    expect(villagers.find(v => v.pseudo === 'Brennos')).toMatchObject({ noblesse: 'de Lapin', reputation: 255 })
    expect(villagers.map(v => v.pseudo)).toEqual(expect.arrayContaining(['Emmie....', 'William._', 'Pepito.felino']))
    expect(villagers.some(v => /\s/.test(v.pseudo))).toBe(false)
  })
})

describe('visions en chemin — collage sans ligne de date', () => {
  it('sans AUCUNE date : les lignes sont gardées (date null) et supposées du jour du relevé', () => {
    const r = parseVisions("Visions\nAujourd'hui, en chemin, vous avez croisé Elyas.")
    expect(r.entries).toEqual([{ date: null, singles: ['Elyas'], groups: [] }])
    expect(r.undatedAssumed).toBe(true)
    expect(visionsForDay(r.entries, '2026-11-23').kept).toHaveLength(1)
  })

  it('avec une date, les lignes qui la précèdent restent ignorées', () => {
    const r = parseVisions("Aujourd'hui, en chemin, vous avez croisé Elyas.\nLe 21 Novembre 1474\nAujourd'hui, en chemin, vous avez croisé Agathe..")
    expect(r.entries).toHaveLength(1)
    expect(r.entries[0].date).not.toBeNull()
    expect(r.undatedAssumed).toBe(false)
    expect(r.ignoredLines).toBeGreaterThan(0)
  })
})

describe('visions en chemin — journal multi-jours à dates de jeu explicites', () => {
  it('douze lignes sur dix jours, résultats IDENTIQUES en français et en anglais', () => {
    const fr = parseVisions(fixture('visions-fr'))
    const en = parseVisions(fixture('visions-en'))
    expect(fr.entries).toHaveLength(12)
    expect(fr.ignoredLines).toBe(0)
    expect(en).toEqual(fr)
    expect(new Set(fr.entries.map(e => e.date)).size).toBe(10)
  })

  it('dates de jeu 1474 converties en dates réelles 2026, mois lus en FR et en EN', () => {
    const { entries } = parseVisions(fixture('visions-fr'))
    expect(entries[0].date).toBe('2026-11-21')
    expect(entries[1].date).toBe('2026-11-17')
    expect(entries.at(-1).date).toBe('2026-10-25')
  })

  it('un seul point final retiré : les points du pseudo restent, groupes et pseudos seuls sont séparés', () => {
    const { entries } = parseVisions(fixture('visions-fr'))
    expect(entries[0]).toMatchObject({ singles: ['Elyas'], groups: [] })
    // « un groupe composé de Othilie.prepenche et de Agathe.., un groupe composé de Juliette... et de Brayan_delval. »
    expect(entries[1]).toMatchObject({ singles: [], groups: [['Othilie.prepenche', 'Agathe..'], ['Juliette...', 'Brayan_delval']] })
    // « Morrigan..., Elyas. »
    expect(entries[2]).toMatchObject({ singles: ['Morrigan...', 'Elyas'], groups: [] })
    expect(entries[3].groups[0]).toEqual(['Alix_du_vivier', 'Anagor', 'Kem', 'Ursulin', 'Izaure', 'Somath', 'Theodoricus_martinus'])
  })

  it('le bilan du jour J ne garde que les visions de l\'en-tête J (nuit J-1 → J) ; les autres jours sont comptés', () => {
    const { entries } = parseVisions(fixture('visions-en'))
    const day = visionsForDay(entries, '2026-10-27')
    expect(day.kept).toHaveLength(2)
    expect(day.otherDays).toBe(10)
    expect(day.kept[0].groups).toEqual([['Qao', 'Zorah']])
    expect(day.kept[1].singles).toEqual(['Matt_hurst'])
    expect(visionsForDay(entries, '2026-11-22')).toEqual({ kept: [], otherDays: 12 })
  })

  it('une ligne sans date, ou sous un mois inconnu, est ignorée et comptée — jamais devinée', () => {
    const raw = [
      "Aujourd'hui, en chemin, vous avez croisé Orpheline.",
      'Le 12 Brumaire 1474',
      "Aujourd'hui, en chemin, vous avez croisé Perdue.",
      'Le 12 Mars 1474',
      "Aujourd'hui, en chemin, vous avez croisé Trouvee.",
    ].join('\n')
    const parsed = parseVisions(raw)
    expect(parsed.ignoredLines).toBe(2)
    expect(parsed.entries).toEqual([{ date: '2026-03-12', singles: ['Trouvee'], groups: [] }])
  })
})

describe('armées, groupes et contrôle de la zone', () => {
  it.each(['fr', 'en'])('%s : armées — nom avec guillemets (FR) ou sans (EN), émojis gardés, statut brut', (lang) => {
    const { armies } = parseArmiesGroups(fixture(`armees-${lang}`))
    expect(armies).toHaveLength(2)
    expect(armies[0]).toMatchObject({ name: '👑🦁 Legio Aurea ⚔️', commander: 'Lucas_' })
    expect(armies[1]).toMatchObject({ name: 'Furor arma ministrat', commander: 'Leonin' })
    expect(armies[0].status).toContain('\n')
    // Le détail des groupes (« Fermé », « Admission libre · Adhérer »…) n'est pas gardé (Greg, 23/11/2026).
    expect(parseArmiesGroups(fixture('groupes-fr')).groups.every(g => g.status === '')).toBe(true)
  })

  it('groupes : tous les membres sont sur la ligne de nom, séparés par des virgules (une armée n\'a qu\'un commandant), cinq types, mêmes résultats en FR et en EN', () => {
    const fr = parseArmiesGroups(fixture('groupes-fr')).groups
    const en = parseArmiesGroups(fixture('groupes-en')).groups
    expect(fr).toHaveLength(11)
    expect(en.map(g => g.type)).toEqual(fr.map(g => g.type))
    expect(en.map(g => g.members)).toEqual(fr.map(g => g.members))
    expect([...new Set(fr.map(g => g.type))].sort()).toEqual(['corps_armes', 'groupe', 'lance', 'marechaux', 'milice'])
    expect(fr[3]).toMatchObject({ type: 'corps_armes', members: ['Damonkael', 'Thymotee_bilal'] })
    expect(fr[6]).toMatchObject({ type: 'marechaux', members: ['Calimera'] })
    expect(fr[9]).toMatchObject({ type: 'groupe', members: ['Sefrian'] })
    expect(fr[10]).toMatchObject({ type: 'milice', members: [] })
  })

  it('seul « Groupe de PSEUDO » alerte (groupe à surveiller) ; la milice et les autres types jamais', () => {
    const alerts = parseArmiesGroups(fixture('groupes-fr')).groups.filter(g => ALERT_GROUP_TYPES.includes(g.type))
    expect(alerts.map(g => g.members)).toEqual([['Sefrian']])
  })

  it('le contrôle de la zone est du texte brut ; les trois sections d\'un même collage se lisent ensemble, dans n\'importe quel sous-ensemble', () => {
    expect(parseArmiesGroups(fixture('controle-zone-fr')).zone).toBe('La mairie est maîtresse du statu quo sur ce noeud.')
    expect(parseArmiesGroups(fixture('controle-zone-en')).zone).toBe('The town hall is maintaining the status quo on this node.')

    const all = parseArmiesGroups(`${fixture('armees-fr')}\n\n${fixture('groupes-fr')}\n\n${fixture('controle-zone-fr')}`)
    expect(all.armies).toHaveLength(2)
    expect(all.groups).toHaveLength(11)
    expect(all.zone).not.toBeNull()
    expect(parseArmiesGroups(fixture('controle-zone-fr')).armies).toEqual([])
    expect(parseArmiesGroups('').zone).toBeNull()
  })
})

describe('version du parseur', () => {
  it('PARSER_VERSION est un entier à incrémenter quand une règle de lecture change (tamponné sur chaque bilan)', () => {
    expect(Number.isInteger(PARSER_VERSION)).toBe(true)
    expect(PARSER_VERSION).toBeGreaterThanOrEqual(1)
  })
})

describe('ce que l\'Office garde comme brut (Greg, 22/11/2026)', () => {
  it('le guet : l\'en-tête et le tableau, sans le préambule ni le bloc de noblesse', async () => {
    const { extractGuetRaw } = await import('../../src/modules/guetParser.js')
    const raw = extractGuetRaw(fixture('guet-fr')).split('\n')

    expect(raw).toHaveLength(46)
    expect(raw[0]).toBe('Liste des villageois (45)')
    expect(raw.slice(1).every(line => line.includes('\t'))).toBe(true)
    expect(raw.join('\n')).not.toContain('Le maire est')
    expect(extractGuetRaw(fixture('guet-en')).split('\n')[0]).toBe('Presently in town (45)')
  })

  it('les visions : l\'en-tête du jour et ses lignes, rien des autres jours', async () => {
    const { extractVisionsRaw } = await import('../../src/modules/customsParsers.js')

    expect(extractVisionsRaw(fixture('visions-fr'), '2026-10-27').split('\n')).toEqual([
      'Le 27 Octobre 1474',
      "Aujourd'hui, en chemin, vous avez croisé un groupe composé de Qao et de Zorah.",
      "Aujourd'hui, en chemin, vous avez croisé Matt_hurst.",
    ])
    expect(extractVisionsRaw(fixture('visions-en'), '2026-10-27').split('\n')[0]).toBe('On 1474 October 27')
    expect(extractVisionsRaw(fixture('visions-fr'), '2026-11-22')).toBe('')
  })
})

describe('parseArmiesGroups — un collage sans en-tête (Greg, 24/11/2026)', () => {
  it('la liste des groupes copiée SANS « Groupes présents ici : » est lue comme des groupes ; le détail qui suit n\'est pas gardé', () => {
    const result = parseArmiesGroups("Corps d'armes de Lynne\nFermé    \nGroupe de maréchaux de Buldo\nembauches éventuelles à la mairie ou à la caserne    \n")

    expect(result.groups.map(g => [g.type, g.members])).toEqual([['corps_armes', ['Lynne']], ['marechaux', ['Buldo']]])
    expect(result.armies).toEqual([])
    expect(JSON.stringify(result)).not.toMatch(/Fermé|embauches/)
  })

  it('avec un en-tête, le texte avant le premier reste ignoré (comportement inchangé)', () => {
    const result = parseArmiesGroups("Corps d'armes de Perdu\nGroupes présents ici :\nLance de Sheliss, Yohanna.\n")

    expect(result.groups.map(g => g.type)).toEqual(['lance'])
  })
})
