// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { customsReportToBBCode, CUSTOMS_EXPORT_DEFAULTS, CUSTOMS_COLORS } from '../../src/modules/customsBBcode.js'

/*
  Export BBCode d'un bilan de défense (brief §7). Français fixe, dates en année du jeu, le SIGNE porte l'information (la couleur n'est qu'un repère),
  « groupe à surveiller » jamais « brigand », l'auteur jamais nommé, aucun crochet libre ne peut ouvrir une balise.
*/
const REPORT = {
  id: 5, city_id: 1, reported_on: '2026-11-22', by_me: true,
  sections: {
    guet: {
      villagers: [{ pseudo: 'Gregor.', noblesse: '', reputation: 255, colour: 'red' }, { pseudo: 'Artifice', noblesse: 'de Dole', reputation: 255, colour: 'green' }, { pseudo: 'Emmie....', noblesse: '', reputation: 1, colour: null }],
      declared_total: 3, read_total: 3, total_matches: true,
      diff: { compared_to: '2026-11-21', comparedLabel: '21/11/1474', arrivals: [{ pseudo: 'Nouveau', colour: null }, { pseudo: 'Brigand_x', colour: 'red' }], departures: [{ pseudo: 'Parti', colour: 'green' }] },
    },
    visions: { entries: [{ singles: [{ pseudo: 'Elyas', colour: null }, { pseudo: 'Gregor.', colour: 'red' }], groups: [[{ pseudo: 'Qao', colour: null }, { pseudo: 'Zorah', colour: null }]] }], other_days: 3 },
    armies_groups: {
      armies: [{ name: 'Legio Aurea', commander: { pseudo: 'Lucas_', colour: null }, status: "L'armée est aux portes\nNe recrute pas" }],
      groups: [
        { type: 'groupe', alert: true, members: [{ pseudo: 'Sefrian', colour: null }], status: 'Admission libre\tAdhérer' },
        { type: 'corps_armes', alert: false, members: [{ pseudo: 'Damonkael', colour: null }, { pseudo: 'Thymotee_bilal', colour: null }], status: 'Fermé' },
        { type: 'milice', alert: false, members: [], status: 'embauches éventuelles' },
      ],
      zone: 'La mairie est maîtresse du statu quo.',
    },
  },
}
const ctx = (options) => ({ cityName: 'Arras', dayLabel: '22/11/1474', nightFromLabel: '21/11/1474', options })
const bb = options => customsReportToBBCode(REPORT, ctx(options))

describe('export BBCode d\'un bilan', () => {
  it('le titre dit le jour en année du jeu et la ville, en français fixe', () => {
    expect(bb().split('\n')[0]).toBe('[b][size=20]Relevé de défense de la nuit du 21/11/1474 au 22/11/1474 - Ville : Arras[/size][/b]')
  })

  it('le différentiel : arrivées et départs, avec le bilan auquel il se compare', () => {
    const text = bb()
    expect(text).toContain('[i]Comparé au bilan du 21/11/1474.[/i]')
    expect(text).toContain('Arrivées (2)')
    expect(text).toContain('Départs (1)')
    expect(text).toContain('[char]Nouveau[/char]')
  })

  it('le SIGNE porte la couleur : ⚠ pour la liste rouge, ✔ pour la verte, la couleur n\'est qu\'un repère', () => {
    const text = bb()
    expect(text).toContain(`[color=${CUSTOMS_COLORS.red}]⚠ [char]Brigand_x[/char][/color]`)
    expect(text).toContain(`[color=${CUSTOMS_COLORS.green}]✔ [char]Parti[/char][/color]`)
    expect(text).toContain('Elyas')
  })

  it('sans les marques, aucun signe ni couleur : des pseudos nus', () => {
    const text = bb({ colours: false })
    expect(text).not.toContain('⚠ [char]')
    expect(text).not.toContain('✔')
    expect(text).not.toContain(CUSTOMS_COLORS.green)
    expect(text).toContain('[char]Brigand_x[/char]')
  })

  it('la liste complète des habitants n\'est donnée que sur demande ; le total figure toujours', () => {
    expect(bb()).toContain('Habitants (3)')
    expect(bb()).not.toContain('Emmie....')
    expect(bb({ villagers: true })).toContain('[quote][color=#dc2626]⚠ [char]Gregor.[/char][/color]')
    expect(bb({ villagers: true })).toContain('[char]Emmie....[/char]')
  })

  it('les visions : pseudos et groupes sur une ligne, colorés', () => {
    expect(bb()).toContain('Visions en chemin (la nuit précédente)')
    expect(bb()).toContain('[char]Elyas[/char], [color=#dc2626]⚠ [char]Gregor.[/char][/color], un groupe : [char]Qao[/char], [char]Zorah[/char]')
    expect(bb({ visions: false })).not.toContain('Visions en chemin')
  })

  it('armées (un chef), groupes (tous les membres), seul « Groupe à surveiller » alerte, la milice n\'a aucun pseudo', () => {
    const text = bb()
    expect(text).toContain("[b]Legio Aurea[/b] — chef d'armée : [char]Lucas_[/char] — L'armée est aux portes — Ne recrute pas")
    expect(text).toContain('⚠ Groupe à surveiller')
    expect(text.match(/Groupe à surveiller/g)).toHaveLength(1)
    // Le détail d'un groupe n'est PAS exporté (Greg, 23/11/2026), même quand un ancien bilan le porte.
    expect(text).toMatch(/\[b\]Corps d'armes\[\/b\] : \[char\]Damonkael\[\/char\], \[char\]Thymotee_bilal\[\/char\]\n/)
    expect(text).not.toContain('Fermé')
    expect(text).not.toContain('embauches éventuelles')
    expect(text).not.toContain('Admission libre')
    expect(text).toContain('[b]Milice[/b]')
    expect(text).not.toMatch(/brigand(?!_x)/i)
  })

  it('le contrôle de la zone suit les armées et groupes ; sans eux, rien', () => {
    expect(bb()).toContain('Contrôle de la zone[/i][/color][/size]\nLa mairie est maîtresse du statu quo.')
    const text = bb({ armiesGroups: false })
    expect(text).not.toContain('Armées')
    expect(text).not.toContain('Contrôle de la zone')
  })

  it('un collage tronqué est dit ; sans bilan antérieur, l\'export le dit aussi', () => {
    const truncated = JSON.parse(JSON.stringify(REPORT))
    truncated.sections.guet = { ...truncated.sections.guet, declared_total: 45, read_total: 44, total_matches: false, diff: null }
    const text = customsReportToBBCode(truncated, ctx())
    expect(text).toContain('Le collage annonçait 45 villageois, 44 ont été lus')
    expect(text).toContain('Aucun bilan antérieur : pas de comparaison.')
  })

  it('aucun crochet d\'un texte libre ne peut ouvrir une balise du forum', () => {
    const hostile = JSON.parse(JSON.stringify(REPORT))
    hostile.sections.armies_groups.armies[0].name = '[url=http://x]piège[/url]'
    hostile.sections.guet.diff.arrivals[0].pseudo = 'Mal[b]in'
    const text = customsReportToBBCode(hostile, ctx({ villagers: true }))
    expect(text).not.toContain('[url=')
    expect(text).toContain('(url=http://x)piège(/url)')
    expect(text).toContain('[char]Mal(b)in[/char]')
  })

  it('jamais l\'auteur ni le brut : le texte ne contient rien du bilan servi que ses sections', () => {
    const text = bb({ villagers: true })
    expect(text).not.toMatch(/by_me|author|auteur|raw/i)
  })

  it('par défaut : sans la liste des habitants, avec les marques et toutes les sections', () => {
    expect(CUSTOMS_EXPORT_DEFAULTS).toEqual({ villagers: false, colours: true, visions: true, armiesGroups: true })
  })

  it('un bilan sans section ne donne que son titre', () => {
    expect(customsReportToBBCode({ sections: {} }, ctx())).toBe('[b][size=20]Relevé de défense de la nuit du 21/11/1474 au 22/11/1474 - Ville : Arras[/size][/b]')
  })

  // Relevé unique (PR 3-2) : le relevé d'un joueur SANS titre de sécurité n'a ni ville ni bilan antérieur.
  it('sans ville : le titre ne dit pas « Ville : »', () => {
    const text = customsReportToBBCode({ sections: {} }, { cityName: '', dayLabel: '22/11/1474', nightFromLabel: '21/11/1474', options: {} })

    expect(text).toBe('[b][size=20]Relevé de défense de la nuit du 21/11/1474 au 22/11/1474[/size][/b]')
  })

  it('un différentiel fait à la liste d\'hier collée le dit, sans date inventée', () => {
    const local = JSON.parse(JSON.stringify(REPORT))
    local.sections.guet.diff.compared_to = null
    delete local.sections.guet.diff.comparedLabel
    const text = customsReportToBBCode(local, ctx())

    expect(text).toContain('Comparé à la liste d\'hier.')
    expect(text).not.toContain('Comparé au bilan du')
  })
})
