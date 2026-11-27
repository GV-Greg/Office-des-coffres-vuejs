import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { signBBcode, SIGNATURES, ACTIVITY_SIGNATURE } from '@/modules/bbcodeSignature'
import { bilanToBBcode } from '@/modules/mineBBcode'
import { exportInventoryToBBCode } from '@/modules/inventoryBBcode'
import { exportBalanceToBBCode } from '@/modules/inventoryBalanceBBcode'
import { customsReportToBBCode } from '@/modules/customsBBcode'
import { provinceHistoryToBBcode } from '@/modules/provinceBBcode'
import { exportResults, exportRules } from '@/modules/rewardsBBcode'

// La fin des exports BBCode : le collage reconnu replié en spoiler, puis la signature (« Organisé » pour l'Animation).
const categories = { categoryKeys: ['divers'], getCategoryLabel: () => 'Divers' }
const bilan = {
  lines: [], rate: 25, net: 0,
  total: { valeur: 0, salaire: 0, heures: 0, entretien: 0, pierre: 0, fer: 0 },
}

describe('signBBcode', () => {
  it('termine par la signature française, avec le badge et le lien du site', () => {
    const out = signBBcode('message')
    expect(out).toBe(`message\n\n${SIGNATURES.fr}`)
    expect(SIGNATURES.fr).toContain('[img]https://officedescoffres.creacube.be/img/odc-badge.png[/img]')
    expect(SIGNATURES.fr).toContain('[url=https://officedescoffres.creacube.be][b][color=#9a3412]Office des Coffres[/color][/b][/url]')
    // Écrite dans le jeu : ni cadre hors rôle-play, ni mention « non officiel » (Greg, 27/11/2026).
    for (const signature of Object.values(SIGNATURES)) expect(signature).not.toMatch(/\[hrp\]|officiel|official/i)
  })

  it('suit la langue demandée, le français à défaut', () => {
    expect(signBBcode('m', { locale: 'en' }).endsWith(SIGNATURES.en)).toBe(true)
    expect(signBBcode('m', { locale: 'de' }).endsWith(SIGNATURES.fr)).toBe(true)
  })

  it('replie chaque collage dans son bloc, dans l\'ordre, avant la signature ; un champ vide n\'est pas joint', () => {
    const out = signBBcode('message\n', { sources: ['  premier  ', '', null, undefined, '   ', 'second'] })
    expect(out).toBe(`message\n\n[spoiler][code]premier[/code][/spoiler]\n\n[spoiler][code]second[/code][/spoiler]\n\n${SIGNATURES.fr}`)
  })

  it('ne laisse pas un collage fermer son cadre', () => {
    const out = signBBcode('m', { sources: ['a [/code] b [/spoiler] c'] })
    expect(out).toContain('[spoiler][code]a (/code) b (/spoiler) c[/code][/spoiler]')
  })

  it('un message vide ne laisse pas de lignes en tête', () => {
    expect(signBBcode('', { sources: ['x'] }).startsWith('[spoiler]')).toBe(true)
  })

  it('le badge est un PNG de 16 × 16 pesant moins de 2 Ko', () => {
    const png = readFileSync('public/img/odc-badge.png')
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([16, 16])
    expect(png.length).toBeLessThan(2048)
  })
})

describe('chaque export est signé', () => {
  const exports = {
    'bilan des mines': sources => bilanToBBcode(bilan, { title: 'T', week: 'S', t: key => key, sources }),
    'inventaire': sources => exportInventoryToBBCode([{ name: 'Pain', quantity: 1 }], () => 'divers', { ...categories, sources }),
    'balance et registre des stocks': sources => exportBalanceToBBCode([], [], () => 'divers', { ...categories, sources }),
    'relevé de guet': sources => customsReportToBBCode({ sections: {} }, { cityName: '', dayLabel: '01/01/1474', sources }),
  }

  for (const [label, build] of Object.entries(exports)) {
    it(label, () => {
      const out = build(['collage d\'origine'])
      expect(out.endsWith(`[spoiler][code]collage d'origine[/code][/spoiler]\n\n${SIGNATURES.fr}`)).toBe(true)
      expect(build([])).not.toContain('[spoiler]')
    })
  }

  it('l\'inventaire joint le collage entier, lignes masquées comprises', () => {
    const out = exportInventoryToBBCode([{ name: 'Pain', quantity: 1 }], () => 'divers', { ...categories, sources: ['Pain 1\nSel secret 9'] })
    expect(out).toContain('Sel secret 9')
  })

  it('bilan des mines en anglais : la signature suit', () => {
    expect(bilanToBBcode(bilan, { title: 'T', week: 'S', t: key => key, locale: 'en' }).endsWith(SIGNATURES.en)).toBe(true)
  })

  it('historique des postes : signé, sans collage', () => {
    const out = provinceHistoryToBBcode({ province: { name: 'Artois' }, offices: [], mayors: [], cities_without_mandate: [] })
    expect(out.endsWith(SIGNATURES.fr)).toBe(true)
    expect(out).not.toContain('[spoiler]')
  })

  it('l\'Animation (Grille des lots) dit « Organisé », sans collage', () => {
    const grid = { name: 'G', place: null, lots: [], width: 3, height: 3, slug: 'g' }
    for (const out of [exportResults(grid, 'https://exemple.test'), exportRules(grid, 'https://exemple.test')]) {
      expect(out.endsWith(`\n\n${ACTIVITY_SIGNATURE}`)).toBe(true)
      expect(out).not.toContain('Rédigé')
      expect(out).not.toContain('[spoiler]')
    }
  })
})
