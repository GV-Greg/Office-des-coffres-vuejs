/*
  Lecture d'un collage du guet (« Liste des villageois »), logique pure.

  Spécification corrigée par la donnée réelle
  (tests/fixtures/Bug_ExportSorties.txt, pseudos confirmés par Greg le 02/08/2026).

  ⚠️ Deux écarts du brief avec le collage réel, tranchés en faveur du collage réel :
  - la noblesse suit le pseudo après un ESPACE (« Brennos de Lapin », « Wouchi du Bois Hardent »),
    pas après « , » (« Lucienne, Baronne » n'apparaît dans aucun collage réel). La virgule reste
    tolérée en repli : « Lucienne, Baronne » donne bien le pseudo « Lucienne ».
  - un pseudo ne contient jamais d'espace : le premier mot du champ EST le pseudo.

  Un pseudo peut contenir points, tirets, soulignés, chiffres, accents : on ne le « nettoie » jamais.

  En-tête du total : FR « Liste des villageois (N) » et EN « Presently in town (N) » ; le tableau lui-même ne dépend d'aucune
  langue : pseudo[TAB]nPR.
*/

// FR « Liste des villageois (N) », EN « Presently in town (N) » (collage réel du 22/11/2026).
export const GUET_HEADER = /(?:Liste des villageois|Presently in town)\s*\((\d+)\)/i
const REPUTATION = /^(\d+)\s*PR$/i

/**
 * @param {string} [raw] texte collé (préambule + en-tête + tableau)
 * @returns {{ villagers: Array<{pseudo: string, noblesse: string, reputation: number|null}>,
 *             declaredTotal: number|null, totalMatches: boolean|null }}
 */
export function parseGuet(raw) {
  const text = typeof raw === 'string' ? raw : ''
  const villagers = []
  let declaredTotal = null

  for (const line of text.split(/\r?\n/)) {
    const header = line.match(GUET_HEADER)
    if (header && !line.includes('\t')) {
      declaredTotal = Number(header[1])
      continue
    }

    // Seules les lignes du tableau (pseudo + PR séparés par une tabulation) sont de vrais
    // villageois : le préambule (maire, adjoints, noblesse d'épée) n'en a pas.
    if (!line.includes('\t')) continue

    const [identity = '', reputationField = ''] = line.split('\t')
    const trimmed = identity.trim()
    if (trimmed === '') continue

    const firstSpace = trimmed.search(/\s/)
    let pseudo = firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace)
    // Une virgule de tête n'appartient pas au titre (« Aurelia. , Edle von … » → « Edle von … »).
    let noblesse = firstSpace === -1 ? '' : trimmed.slice(firstSpace + 1).replace(/^[\s,]+/, '').trim()

    // Repli sur la forme du brief « Pseudo, Titre » : la virgule collée au pseudo n'en fait pas partie.
    if (pseudo.endsWith(',') && pseudo.length > 1) pseudo = pseudo.slice(0, -1)

    const match = reputationField.trim().match(REPUTATION)
    villagers.push({ pseudo, noblesse, reputation: match ? Number(match[1]) : null })
  }

  return {
    villagers,
    declaredTotal,
    totalMatches: declaredTotal === null ? null : declaredTotal === villagers.length
  }
}

/** Les pseudos seuls, dans l'ordre du collage. */
export function guetPseudos(raw) {
  return parseGuet(raw).villagers.map(v => v.pseudo)
}

/** Arrivées et départs entre deux collages (hier → aujourd'hui). */
export function diffGuet(yesterdayRaw, todayRaw) {
  const yesterday = guetPseudos(yesterdayRaw)
  const today = guetPseudos(todayRaw)
  return {
    today,
    inputs: today.filter(p => !yesterday.includes(p)),
    outputs: yesterday.filter(p => !today.includes(p))
  }
}

/**
 * Le brut du guet QUE L'OFFICE GARDE : l'en-tête « Liste des villageois (N) » et les lignes du tableau (pseudo + tabulation + nPR),
 * SANS le préambule (maire, adjoints, tribun, noblesse d'épée) — décision de Greg, 22/11/2026, fil module-securite/12.
 */
export function extractGuetRaw(raw) {
  return String(raw ?? '').split(/\r\n|\n|\r/)
    .filter(line => line.includes('\t') || GUET_HEADER.test(line))
    .map(line => line.replace(/\s+$/, ''))
    .join('\n')
}
