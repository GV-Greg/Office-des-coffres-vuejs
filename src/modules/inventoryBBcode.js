// Export BBcode d'un inventaire pour le forum Renaissance Kingdoms.
// Logique pure, sans dépendance Vue.
// Le contenu forum est en FRANÇAIS FIXE, indépendant de la langue de l'interface.
//
// Format de sortie (suffix + quote) :
//   [b]Trésor : 26 865,51 écus[/b]
//
//   [color=darkcyan][size=18][b]Alimentation[/b][/size][/color]
//   [quote][list][*][b]Miches de pain (x596)[/b]
//   [*][b]Morceaux de viande (x121)[/b][/list][/quote]

export const EXPORT_DEFAULT_COLOR = 'darkcyan'

// Palette forum RK (20 couleurs, 10 paires) — couleurs compatibles BBCode du forum.
// Les hex sont des approximations visuelles ; les `value` sont les chaînes BBCode réelles.
export const EXPORT_COLORS = [
  { value: 'red',        hex: '#cc0000' },
  { value: 'darkred',    hex: '#800000' },
  { value: 'orange',     hex: '#ff8800' },
  { value: 'darkorange', hex: '#cc5500' },
  { value: 'brown',      hex: '#996633' },
  { value: 'darkbrown',  hex: '#5c3317' },
  { value: 'green',      hex: '#009900' },
  { value: 'darkgreen',  hex: '#005500' },
  { value: 'olive',      hex: '#808000' },
  { value: 'darkolive',  hex: '#556600' },
  { value: 'cyan',       hex: '#00aaaa' },
  { value: 'darkcyan',   hex: '#007777' },
  { value: 'blue',       hex: '#0066cc' },
  { value: 'darkblue',   hex: '#003399' },
  { value: 'indigo',     hex: '#4b0082' },
  { value: 'darkindigo', hex: '#330066' },
  { value: 'violet',     hex: '#9400d3' },
  { value: 'darkviolet', hex: '#5c0a99' },
  { value: 'gray',       hex: '#808080' },
  { value: 'darkgray',   hex: '#555555' },
]

/**
 * Exporte une liste d'items en BBcode groupé par catégorie.
 *
 * @param {Array<{quantity: number, name: string}>} items
 * @param {function(string): string|null} getCategoryFn  (nom) → clé de catégorie ou null
 * @param {{
 *   categoryKeys: string[],
 *   getCategoryLabel: function(string): string,
 *   options?: {
 *     qtyFormat?: 'suffix'|'prefix',
 *     showEcus?: boolean,
 *     wrapper?: 'none'|'rp'|'quote',
 *     color?: string,
 *     totalEcus?: number|null,
 *   }
 * }} opts
 * @returns {string}
 */
export function exportInventoryToBBCode(items, getCategoryFn, { categoryKeys, getCategoryLabel, options = {} } = {}) {
  const {
    qtyFormat = 'suffix',
    showEcus = true,
    wrapper = 'none',
    color = EXPORT_DEFAULT_COLOR,
    totalEcus = null,
  } = options

  const groups = new Map(categoryKeys.map(k => [k, []]))

  for (const item of items) {
    const cat = getCategoryFn(item.name) ?? 'divers'
    const bucket = groups.has(cat) ? cat : (groups.has('divers') ? 'divers' : null)
    if (bucket !== null) groups.get(bucket).push(item)
  }

  for (const bucket of groups.values()) {
    bucket.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  }

  const categoryBlocks = []
  for (const [cat, catItems] of groups) {
    if (catItems.length === 0) continue
    const label = getCategoryLabel(cat)
    const header = `[color=${color}][size=18][b]${label}[/b][/size][/color]`

    const lines = catItems.map(item => {
      const text = qtyFormat === 'prefix'
        ? `${item.quantity} ${item.name}`
        : `${item.name} (x${item.quantity})`
      return `[*][b]${text}[/b]`
    })

    if (wrapper === 'quote') {
      categoryBlocks.push(`${header}\n[quote][list]${lines.join('\n')}[/list][/quote]`)
    } else {
      categoryBlocks.push(`${header}\n[list]${lines.join('\n')}[/list]`)
    }
  }

  let body = categoryBlocks.join('\n\n')

  if (showEcus && totalEcus !== null) {
    const formatted = totalEcus.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    body = `[b]Trésor : ${formatted} écus[/b]\n\n${body}`
  }

  if (wrapper === 'rp') {
    body = `[rp]${body}[/rp]`
  }

  return body
}
