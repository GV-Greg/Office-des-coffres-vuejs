// Export BBCode d'un bilan de défense (Registre de douane, module Sécurité ; brief admin/content/brief-module-securite.md §7 : « BBCode comme les
// autres modules, avec possibilité de personnalisation du format de bilan »). Logique pure, sans dépendance Vue. Le contenu forum est en FRANÇAIS
// FIXE, indépendant de la langue de l'interface, et les dates sont en année du JEU (1474), comme partout côté joueur.
//
// Comme La Balance : le SIGNE porte l'information, la couleur n'est qu'un repère.
//   liste rouge  [color=#dc2626]⚠ [char]Pseudo[/char][/color]
//   liste verte  [color=#16a34a]✔ [char]Pseudo[/char][/color]
//   groupe à surveiller (« Groupe de PSEUDO » seul) : jamais « brigand » (Greg, P8)
// Un bilan n'est jamais public (politique §6) : l'exporter sur un forum le rend public — c'est le geste de celui qui exporte, et l'écran le dit.
// L'auteur d'un bilan n'est jamais nommé. Rien n'est gardé : le texte part au presse-papiers.

export const CUSTOMS_COLORS = Object.freeze({ red: '#dc2626', green: '#16a34a' })

/** Options de l'export : ce que le joueur choisit d'inclure. Rien n'est enregistré. */
export const CUSTOMS_EXPORT_DEFAULTS = Object.freeze({
  villagers: false, // la liste complète des habitants (longue) ; le total figure toujours
  colours: true,    // marqueurs rouge / vert des listes de la province
  visions: true,
  armiesGroups: true,
})

const GROUP_TYPES_FR = { lance: 'Lance', corps_armes: "Corps d'armes", marechaux: 'Groupe de maréchaux', groupe: 'Groupe', milice: 'Milice' }

// Aucun crochet d'un texte libre ne doit pouvoir ouvrir une balise du forum.
const safe = text => String(text ?? '').replace(/\[/g, '(').replace(/\]/g, ')')
const oneLine = text => safe(text).split(/\r?\n/).map(part => part.trim()).filter(Boolean).join(' — ').replace(/\t+/g, ' · ')

const heading = text => `[size=15][color=blue][i]${text}[/i][/color][/size]`

function name(entry, colours) {
  const tag = `[char]${safe(entry.pseudo)}[/char]`
  if (colours && entry.colour === 'red') return `[color=${CUSTOMS_COLORS.red}]⚠ ${tag}[/color]`
  if (colours && entry.colour === 'green') return `[color=${CUSTOMS_COLORS.green}]✔ ${tag}[/color]`
  return tag
}

const names = (entries, colours) => entries.map(entry => name(entry, colours))

/**
 * @param {object} report un bilan tel que l'API le sert (`sections.guet|visions|armies_groups`, pseudos `{ pseudo, colour }`)
 * @param {{ cityName: string, dayLabel: string, options?: object }} context `dayLabel` : le jour du bilan en année du jeu, déjà formaté (jj/mm/1474)
 * @returns {string} le BBCode, ou '' s'il n'y a rien à exporter
 */
export function customsReportToBBCode(report, { cityName, dayLabel, options = {} }) {
  const o = { ...CUSTOMS_EXPORT_DEFAULTS, ...options }
  const sections = report?.sections ?? {}
  const blocks = []

  // Sans ville (Relevé de guet sans titre de sécurité) : pas de « Ville : … ».
  blocks.push(`[b][size=20]Bilan de défense du ${dayLabel}${cityName ? ` — Ville : ${safe(cityName)}` : ''}[/size][/b]`)

  const guet = sections.guet
  if (guet) {
    const lines = [heading(`Habitants (${guet.read_total})`)]
    if (guet.total_matches === false) lines.push(`[i]Le collage annonçait ${guet.declared_total} villageois, ${guet.read_total} ont été lus : il était peut-être tronqué.[/i]`)
    if (o.villagers) lines.push(`[quote]${names(guet.villagers ?? [], o.colours).join('\n')}[/quote]`)

    const diff = guet.diff
    if (diff) {
      lines.push(diff.comparedLabel || diff.compared_to ? `[i]Comparé au bilan du ${diff.comparedLabel ?? diff.compared_to}.[/i]` : '[i]Comparé à la liste d\'hier.[/i]')
      lines.push(heading(`Arrivées (${diff.arrivals.length})`))
      lines.push(diff.arrivals.length ? `[quote]${names(diff.arrivals, o.colours).join('\n')}[/quote]` : 'Aucune')
      lines.push(heading(`Départs (${diff.departures.length})`))
      lines.push(diff.departures.length ? `[quote]${names(diff.departures, o.colours).join('\n')}[/quote]` : 'Aucun')
    } else {
      lines.push('[i]Aucun bilan antérieur : pas de comparaison.[/i]')
    }
    blocks.push(lines.join('\n'))
  }

  const visions = sections.visions
  if (visions && o.visions && (visions.entries ?? []).length) {
    const lines = [heading('Visions en chemin (la nuit précédente)')]
    for (const entry of visions.entries) {
      const parts = [...names(entry.singles ?? [], o.colours), ...(entry.groups ?? []).map(group => `un groupe : ${names(group, o.colours).join(', ')}`)]
      lines.push(parts.join(', '))
    }
    blocks.push(lines.join('\n'))
  }

  const block = sections.armies_groups
  if (block && o.armiesGroups) {
    if ((block.armies ?? []).length) {
      const lines = [heading('Armées')]
      for (const army of block.armies) {
        const status = oneLine(army.status)
        lines.push(`[b]${safe(army.name)}[/b] — chef d'armée : ${name(army.commander, o.colours)}${status ? ` — ${status}` : ''}`)
      }
      blocks.push(lines.join('\n'))
    }
    if ((block.groups ?? []).length) {
      const lines = [heading('Groupes')]
      for (const group of block.groups) {
        const label = GROUP_TYPES_FR[group.type] ?? group.type
        const status = oneLine(group.status)
        const alert = group.alert ? `[color=${CUSTOMS_COLORS.red}][b]⚠ Groupe à surveiller[/b][/color] ` : ''
        const members = (group.members ?? []).length ? ` : ${names(group.members, o.colours).join(', ')}` : ''
        lines.push(`${alert}[b]${label}[/b]${members}${status ? ` — ${status}` : ''}`)
      }
      blocks.push(lines.join('\n'))
    }
    if (block.zone) blocks.push(`${heading('Contrôle de la zone')}\n${oneLine(block.zone)}`)
  }

  return blocks.join('\n\n')
}
