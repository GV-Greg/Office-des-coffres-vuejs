import { describe, it, expect } from 'vitest'
import { parseInventoryText, resolveItems } from '../../src/modules/inventoryParser'
import { compareInventories, formatDiff, formatEcusDiff, STATUS } from '../../src/modules/inventoryCompare'
import { exportBalanceToBBCode, annotation, BALANCE_COLORS } from '../../src/modules/inventoryBalanceBBcode'

/*
  La Balance des stocks, logique pure (brief admin/content/brief-comparaison-inventaires.md ; fil inventaire-comparaison) :
  hausse / baisse / identique / nouveau / disparu, écart du trésor, et le BBCode annoté (flèche verte ou rouge, tiret gris ;
  « Nouveau » n'est jamais dans l'export, les disparus sont une section finale).
*/
const PREVIOUS = `Encombrement : 100

 #NomEnc.Actions possibles1000,00 écus
10Miches de pain100
5Morceaux de viande50
3Cailloux9
2Épées20`

const CURRENT = `Encombrement : 120

 #NomEnc.Actions possibles1120,50 écus
13Miches de pain130
5Morceaux de viande50
1Cailloux3
4Planches40`

const read = text => {
  const { totalEcus, items } = parseInventoryText(text)
  return { totalEcus, items: resolveItems(items) }
}

describe('compareInventories', () => {
  const result = compareInventories(read(PREVIOUS), read(CURRENT))
  const row = name => result.rows.find(r => r.name === name)

  it('marque une hausse, une baisse, un identique et un nouveau, avec l\'écart signé', () => {
    expect(row('Miches de pain')).toMatchObject({ status: STATUS.UP, diff: 3, before: 10, quantity: 13 })
    expect(row('Cailloux')).toMatchObject({ status: STATUS.DOWN, diff: -2, before: 3, quantity: 1 })
    expect(row('Morceaux de viande')).toMatchObject({ status: STATUS.SAME, diff: 0 })
    expect(row('Planches')).toMatchObject({ status: STATUS.NEW, diff: 4, before: null })
  })

  it('liste tout l\'inventaire actuel, et les disparus à part', () => {
    expect(result.rows.map(r => r.name)).toEqual(['Cailloux', 'Miches de pain', 'Morceaux de viande', 'Planches'])
    expect(result.disappeared).toEqual([{ name: 'Épées', before: 2, truncated: false }])
    expect(result.counts).toEqual({ up: 1, down: 1, same: 1, new: 1, disappeared: 1 })
    expect(result.hasChanges).toBe(true)
  })

  it('calcule l\'écart du trésor seulement si les deux inventaires en portent un', () => {
    expect(result.ecus).toEqual({ before: 1000, after: 1120.5, diff: 120.5 })
    const noEcus = compareInventories({ totalEcus: null, items: read(PREVIOUS).items }, read(CURRENT))
    expect(noEcus.ecus).toBeNull()
  })

  it('deux inventaires identiques : tout est « identique », aucun changement', () => {
    const same = compareInventories(read(CURRENT), read(CURRENT))
    expect(same.hasChanges).toBe(false)
    expect(same.rows.every(r => r.status === STATUS.SAME)).toBe(true)
    expect(same.disappeared).toEqual([])
  })

  it('un nom tronqué se compare à lui-même, jamais à un nom complet', () => {
    const a = read('4Une très longue appellation de mi....12')
    const b = read('4Une très longue appellation de mi....12')
    const r = compareInventories(a, b)
    expect(r.rows[0]).toMatchObject({ status: STATUS.SAME, truncated: true })
    expect(r.disappeared).toEqual([])
  })

  it('formate les écarts : signe explicite, virgule française pour les écus', () => {
    expect(formatDiff(3)).toBe('+3')
    expect(formatDiff(-2)).toBe('-2')
    expect(formatDiff(0)).toBe('0')
    expect(formatEcusDiff(120.5)).toBe('+120,50')
    expect(formatEcusDiff(-3)).toBe('-3,00')
  })
})

describe('exportBalanceToBBCode', () => {
  const result = compareInventories(read(PREVIOUS), read(CURRENT))
  const bb = (options = {}) => exportBalanceToBBCode(result.rows, result.disappeared, () => null, {
    categoryKeys: ['divers'],
    getCategoryLabel: () => 'Divers',
    options: { ecus: result.ecus, totalEcus: 1120.5, ...options },
  })

  it('annote chaque ligne : flèche verte, flèche rouge, et RIEN si la quantité est identique (jamais de tiret)', () => {
    const out = bb()
    expect(out).toContain(`[*][b]Miches de pain (x13)[/b] [color=${BALANCE_COLORS.up}]▲ +3[/color]`)
    expect(out).toContain(`[*][b]Cailloux (x1)[/b] [color=${BALANCE_COLORS.down}]▼ -2[/color]`)
    expect(out).toContain('[*][b]Morceaux de viande (x5)[/b]\n')
    expect(out).not.toContain('—')
  })

  it('un nouvel item n\'a que la flèche verte : jamais de badge « Nouveau » dans l\'export', () => {
    const out = bb()
    expect(out).toContain(`[*][b]Planches (x4)[/b] [color=${BALANCE_COLORS.up}]▲ +4[/color]`)
    expect(out).not.toMatch(/nouveau/i)
  })

  it('les disparus forment une section finale, flèche rouge vers 0', () => {
    const out = bb()
    expect(out).toContain('[b]Disparus[/b]')
    expect(out).toContain(`[*][b]Épées (x0)[/b] [color=${BALANCE_COLORS.down}]▼ -2[/color]`)
    expect(out.indexOf('Disparus')).toBeGreaterThan(out.indexOf('Planches'))
  })

  it('annote aussi le trésor, et respecte format de quantité, trésor masqué et enveloppe', () => {
    expect(bb()).toContain(`écus[/b] [color=${BALANCE_COLORS.up}]▲ +120,50[/color]`)
    expect(bb({ showEcus: false })).not.toContain('Trésor')
    expect(bb({ qtyFormat: 'prefix' })).toContain('[*][b]13 Miches de pain[/b]')
    expect(bb({ wrapper: 'rp' }).startsWith('[rp]')).toBe(true)
    expect(bb({ wrapper: 'quote' })).toContain('[quote][list]')
  })

  it('un trésor identique s\'écrit sans écart ni tiret', () => {
    const same = compareInventories(read(CURRENT), read(CURRENT))
    const out = exportBalanceToBBCode(same.rows, same.disappeared, () => null, {
      categoryKeys: ['divers'], getCategoryLabel: () => 'Divers', options: { ecus: same.ecus, totalEcus: 1120.5 },
    })
    expect(out).toMatch(/^\[b\]Trésor : [^\n]*écus\[\/b\]\n/)
    expect(out).not.toContain('—')
    expect(out).not.toContain('▲')
    expect(out).not.toContain('▼')
  })

  it('sans ancien trésor, le trésor actuel s\'écrit sans écart', () => {
    const out = bb({ ecus: null })
    expect(out).toMatch(/\[b\]Trésor : [^\n]*écus\[\/b\]\n/)
  })

  it('annotation() : hausse, nouveau, baisse, et vide pour un identique', () => {
    expect(annotation(STATUS.UP, 3)).toBe(`[color=${BALANCE_COLORS.up}]▲ +3[/color]`)
    expect(annotation(STATUS.NEW, 4)).toBe(`[color=${BALANCE_COLORS.up}]▲ +4[/color]`)
    expect(annotation(STATUS.DOWN, -2)).toBe(`[color=${BALANCE_COLORS.down}]▼ -2[/color]`)
    expect(annotation(STATUS.SAME, 0)).toBe('')
  })
})
