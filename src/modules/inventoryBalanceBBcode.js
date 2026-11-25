// Export BBCode de La Balance des stocks : l'inventaire actuel, groupé par catégorie comme celui de la Gestion des stocks
// (inventoryBBcode.js), avec l'écart annoté sur chaque ligne. Logique pure, sans dépendance Vue.
// Le contenu forum est en FRANÇAIS FIXE, indépendant de la langue de l'interface.
//
// Annotation :
//   hausse     [color=#16a34a]▲ +3[/color]
//   baisse     [color=#dc2626]▼ -2[/color]
//   identique  rien : aucun tiret (Greg, 19/11/2026)
//   nouveau    flèche verte seule : le badge « Nouveau » n'existe qu'à l'écran, jamais dans l'export
//   disparu    section finale « Disparus », flèche rouge vers 0 (▼ -quantité de l'ancien inventaire)
// Le signe et la flèche portent l'information : la couleur n'est qu'un repère.

import { itemIconUrl } from '@/modules/itemIcons'
import { EXPORT_DEFAULT_COLOR } from '@/modules/inventoryBBcode'
import { STATUS, formatDiff, formatEcusDiff } from '@/modules/inventoryCompare'

export const BALANCE_COLORS = Object.freeze({ up: '#16a34a', down: '#dc2626' })
export const BALANCE_DISAPPEARED_LABEL = 'Disparus'

const paint = (color, text) => `[color=${color}]${text}[/color]`

/** L'annotation d'une ligne : « ▲ +3 », « ▼ -2 », ou vide si la quantité est identique. */
export function annotation(status, diff) {
  if (status === STATUS.UP || status === STATUS.NEW) return paint(BALANCE_COLORS.up, `▲ ${formatDiff(diff)}`)
  if (status === STATUS.DOWN) return paint(BALANCE_COLORS.down, `▼ ${formatDiff(diff)}`)
  return '' // identique : rien du tout, pas de tiret
}

function itemText(name, quantity, qtyFormat) {
  return qtyFormat === 'prefix' ? `${quantity} ${name}` : `${name} (x${quantity})`
}

/**
 * @param {Array<{name: string, quantity: number, diff: number, status: string}>} rows  les lignes de l'inventaire actuel
 * @param {Array<{name: string, before: number}>} disappeared  ce qui n'est plus là
 * @param {function(string): string|null} getCategoryFn  (nom) → clé de catégorie ou null
 * @param {{
 *   categoryKeys: string[],
 *   getCategoryLabel: function(string): string,
 *   options?: {
 *     qtyFormat?: 'suffix'|'prefix', showEcus?: boolean, wrapper?: 'none'|'rp'|'quote', color?: string,
 *     ecus?: { after: number, diff: number }|null,   // écart du trésor, seulement si les deux inventaires en portent un
 *     totalEcus?: number|null,                      // trésor de l'inventaire actuel, sans écart (ancien inventaire sans trésor)
 *     icons?: Record<string, number>,
 *   }
 * }} opts
 * @returns {string}
 */
export function exportBalanceToBBCode(rows, disappeared, getCategoryFn, { categoryKeys, getCategoryLabel, options = {} } = {}) {
  const {
    qtyFormat = 'suffix',
    showEcus = true,
    wrapper = 'none',
    color = EXPORT_DEFAULT_COLOR,
    ecus = null,
    totalEcus = null,
    icons = {},
  } = options

  const line = (name, quantity, note) => {
    const url = itemIconUrl(icons[name])
    return `[*][b]${url ? `[img]${url}[/img] ` : ''}${itemText(name, quantity, qtyFormat)}[/b]${note ? ` ${note}` : ''}`
  }
  const block = (label, lines) => {
    const header = `[color=${color}][size=18][b]${label}[/b][/size][/color]`
    return wrapper === 'quote'
      ? `${header}\n[quote][list]${lines.join('\n')}[/list][/quote]`
      : `${header}\n[list]${lines.join('\n')}[/list]`
  }

  const groups = new Map(categoryKeys.map(k => [k, []]))
  for (const row of rows) {
    const cat = getCategoryFn(row.name) ?? 'divers'
    const bucket = groups.has(cat) ? cat : (groups.has('divers') ? 'divers' : null)
    if (bucket !== null) groups.get(bucket).push(row)
  }

  const blocks = []
  for (const [cat, catRows] of groups) {
    if (catRows.length === 0) continue
    blocks.push(block(getCategoryLabel(cat), catRows.map(r => line(r.name, r.quantity, annotation(r.status, r.diff)))))
  }

  // Les disparus : section finale, hors catégories, quantité 0 et flèche rouge vers 0.
  if (disappeared.length > 0) {
    blocks.push(block(BALANCE_DISAPPEARED_LABEL, disappeared.map(d => line(d.name, 0, annotation(STATUS.DOWN, -d.before)))))
  }

  let body = blocks.join('\n\n')

  if (showEcus && (ecus !== null || totalEcus !== null)) {
    const amount = ecus !== null ? ecus.after : totalEcus
    const formatted = amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const note = ecus === null || ecus.diff === 0
      ? '' // pas d'ancien trésor, ou trésor identique : rien à annoter
      : ` ${ecus.diff > 0 ? paint(BALANCE_COLORS.up, `▲ ${formatEcusDiff(ecus.diff)}`) : paint(BALANCE_COLORS.down, `▼ ${formatEcusDiff(ecus.diff)}`)}`
    body = `[b]Trésor : ${formatted} écus[/b]${note}\n\n${body}`
  }

  if (wrapper === 'rp') body = `[rp]${body}[/rp]`

  return body
}
