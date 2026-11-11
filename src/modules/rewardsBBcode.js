/**
 * Export BBCode de la Grille des lots (brief admin/content/brief-grille-des-lots.md).
 * Le BBCode est TOUJOURS en français fixe, indépendant de la langue de l'interface
 * (contenu de forum francophone, comme SecurityGuet et EconomyMines).
 */

/** Formatte le nom du lieu selon son type. */
function placeLine(place) {
  if (!place) return null
  if (place.kind === 'kingdom') return `Royaume de ${place.name}`
  if (place.kind === 'province') return `Comté de ${place.name}`
  return `Ville de ${place.name}`
}

/**
 * Résultats : les lots ATTRIBUÉS seulement. 🔴 Jamais le contenu d'une case non réclamée, quel que soit l'état de la grille (décision de Greg,
 * 10/11/2026) : le suspense est le jeu, et un export posté sur le forum le détruirait. (La page publique ne le montre pas non plus avant la clôture.)
 * @param {Object} grid  { name, place, lots, slug }
 * @param {string} baseUrl  ex. 'https://officedescoffres.creacube.be'
 */
export function exportResults(grid, baseUrl) {
  const { name, place, lots, slug } = grid

  const claimed = (lots ?? []).filter(l => l.player && l.place != null)

  claimed.sort((a, b) => a.place - b.place)

  const lines = []
  lines.push(`[color=darkcyan][size=18][b]Grille « ${name} »[/b][/size][/color]`)
  const pl = placeLine(place)
  if (pl) lines.push(`[size=12]${pl}[/size]`)
  lines.push('')

  if (claimed.length) {
    lines.push('[b]Lots attribués :[/b]')
    lines.push('[list]')
    for (const l of claimed) {
      lines.push(`[*] [b]Case ${l.place}[/b] — ${l.name ?? '?'} → ${l.player}`)
    }
    lines.push('[/list]')
    lines.push('')
  }

  if (slug && baseUrl) {
    lines.push(`[size=10][url=${baseUrl}/public/activite/grille/${slug}]Voir la grille complète[/url][/size]`)
  }

  return lines.join('\n')
}

/**
 * Règles : présentation de la grille et de son fonctionnement.
 * @param {Object} grid  { name, place, width, height, slug }
 * @param {string} baseUrl
 */
export function exportRules(grid, baseUrl) {
  const { name, place, width, height, slug } = grid
  const total = (width ?? 0) * (height ?? 0)

  const lines = []
  lines.push(`[color=darkcyan][size=18][b]Grille des lots « ${name} »[/b][/size][/color]`)
  const pl = placeLine(place)
  if (pl) lines.push(`[size=12]${pl}[/size]`)
  lines.push('')
  lines.push(`[b]Grille ${width} × ${height} = ${total} cases[/b]`)
  lines.push('')
  lines.push('[b]Comment participer :[/b]')
  lines.push('[list]')
  lines.push('[*] Choisissez un numéro de case (de 1 à ' + total + ')')
  lines.push('[*] Communiquez-le à l\'organisateur (forum, gazette ou en jeu)')
  lines.push('[*] L\'organisateur révèle ce que contient votre case')
  lines.push('[*] Si votre case contient un lot, vous le remportez !')
  lines.push('[/list]')
  lines.push('')
  if (slug && baseUrl) {
    lines.push(`[size=10][url=${baseUrl}/public/activite/grille/${slug}]Voir la grille en ligne[/url][/size]`)
  }

  return lines.join('\n')
}
