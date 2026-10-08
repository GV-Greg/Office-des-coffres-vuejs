// Parsing du texte "mines" collé depuis le jeu -> bilan (production, entretien, net).
// Voir roadmap.md, Phase 5, pour le contexte métier (mécanique des mines, prix,
// pourquoi le salaire n'est pas calculé automatiquement).

import { realYear } from './gameCalendar'

const DATE_ISO = String.raw`\d{4}-\d{1,2}-\d{1,2}`
const DATE_FR = String.raw`\d{1,2}[./]\d{1,2}[./]\d{2,4}`
const DATE_ANY = `(?:${DATE_ISO}|${DATE_FR})`
const NUM = String.raw`-?\d+(?:[.,]\d+)?`

// Écran français OU anglais (brief Bilan §5 bis, Greg 07/10/2026) : la langue est celle du TEXTE
// collé, jamais celle de l'interface — un joueur peut jouer en anglais et lire l'Office en français.
// Libellés anglais relevés par Greg (admin/jeu/mines.md §7.12), jamais traduits par nous.
const SECTION_MARKERS = [
  { key: 'heures', re: /nombre d'heures travaill|number of hours worked/i },
  { key: 'production', re: /production des \d+ derniers jours|output of the past \w+ days/i },
  { key: 'conso', re: /ressources consomm|resources consumed/i },
]

const MINE_HEADER_RE = /Mine\s*(\d+)\s*:\s*([^-\d]+)/gi

export const RESOURCES = ['OR', 'FER', 'PIERRE', 'ARGILE', 'SEL']

function normalizeDate(raw) {
  let y, m, d
  if (raw.includes('-') && raw.split('-')[0].length === 4) {
    ;[y, m, d] = raw.split('-').map(Number)
  } else {
    const parts = raw.replace(/\./g, '/').split('/')
    if (parts.length !== 3) return null
    ;[d, m, y] = parts.map(Number)
    if (y < 100) y += 2000
  }

  // Le jeu date ses tableaux dans son propre calendrier (1474 = 2026) : on repasse en
  // année réelle dès le parsing, à la frontière du module. Tout le reste raisonne
  // ensuite en dates réelles — bornes de semaine et jours de la semaine (un 8 août
  // 1474 grégorien ne tombe pas le même jour qu'un 8 août 2026), filtrage, clés de
  // cache — et seul l'affichage rebascule en année de jeu (voir gameCalendar.js).
  y = realYear(y)

  return isValidDate(y, m, d) ? toIso(y, m, d) : null
}

function isValidDate(y, m, d) {
  return d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2000 && y <= 2100
}

function toIso(y, m, d) {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function parseNum(s) {
  return parseFloat(s.replace(',', '.'))
}

const DATE_RE = new RegExp(DATE_ANY, 'g')
const NUM_RE = new RegExp(NUM, 'g')

// Extrait (date, [nombres]) en bornant explicitement la zone de chaque date à
// "juste après cette date, jusqu'à la date suivante" : dans un collage sans
// aucun séparateur entre deux lignes (ex. "...83" suivi immédiatement de
// "2026-07-31..."), une regex globale gourmande fusionnerait "83" et "2026" en
// un seul nombre. Borner la zone lève l'ambiguïté sans dépendre des sauts de
// ligne ni des tabulations.
function extractSeries(text, count) {
  const dates = [...text.matchAll(DATE_RE)]
  const out = []
  for (let i = 0; i < dates.length; i++) {
    const d = normalizeDate(dates[i][0])
    if (!d) continue
    const zoneStart = dates[i].index + dates[i][0].length
    const zoneEnd = i + 1 < dates.length ? dates[i + 1].index : text.length
    const zone = text.slice(zoneStart, zoneEnd)
    const nums = [...zone.matchAll(NUM_RE)].slice(0, count).map(m => parseNum(m[0]))
    if (nums.length === count) {
      out.push([d, nums])
    }
  }
  return out
}

export function detectResource(label) {
  const s = (label || '').toLowerCase()
  if (s.includes('argile') || /\bclay\b/.test(s)) return 'ARGILE'
  if (s.includes('pierre') || /\b(stone|quarry)\b/.test(s)) return 'PIERRE'
  if (/\b(sel|salt)\b/.test(s)) return 'SEL'
  if (s.includes('fer') || /\biron\b/.test(s)) return 'FER'
  if (/\b(or|gold)\b/.test(s)) return 'OR'
  return null
}

function splitSections(chunk) {
  const found = []
  for (const { key, re } of SECTION_MARKERS) {
    const m = chunk.match(re)
    if (m) found.push({ key, index: m.index })
  }
  found.sort((a, b) => a.index - b.index)
  const sections = {}
  for (let i = 0; i < found.length; i++) {
    const start = found[i].index
    const end = i + 1 < found.length ? found[i + 1].index : chunk.length
    sections[found[i].key] = chunk.slice(start, end)
  }
  return sections
}

function splitMineChunks(text) {
  const matches = [...text.matchAll(MINE_HEADER_RE)]
  const chunks = []
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    const start = m.index
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length
    const chunkText = text.slice(start, end)
    chunks.push({
      number: parseInt(m[1], 10),
      label: m[2].trim().replace(/[-–]\s*$/, '').trim(),
      // Premier « Noeud N » du bloc : celui de son en-tête (un bloc s'arrête au « Mine N : » suivant).
      noeud: chunkText.match(NOEUD_RE)?.[1] ?? null,
      text: chunkText,
    })
  }
  return chunks
}

// Clé de fusion d'une mine (brief Bilan §6b). Le NŒUD est l'identifiant stable : le numéro « Mine N »
// est une numérotation d'affichage qui glisse quand une mine ouvre ou ferme, et le nom n'est pas
// unique (deux « Mine de fer » dans le même collage). Le numéro ne sert que de repli, pour un collage
// qui ne porte aucun nœud. ⚠️ Le Registre héritera de cette clé.
function mineKey(mine) {
  return mine.noeud ? `noeud:${mine.noeud}` : `numero:${mine.number}`
}

/**
 * Parse le texte collé -> liste de mines avec leurs relevés journaliers.
 * [{ number, noeud, label, resource, days: { 'AAAA-MM-JJ': { heures, production, pierre, fer } } }]
 */
export function parseMinesText(text) {
  if (!text) return []
  const chunks = splitMineChunks(text)
  // Jointure au sein d'un même collage : un bloc dont l'en-tête ne porte pas le nœud prend celui du
  // bloc de même numéro — dans un seul collage, le numéro désigne bien une seule mine.
  const noeudByNumber = new Map(chunks.filter(c => c.noeud).map(c => [c.number, c.noeud]))
  const byMine = new Map()

  for (const chunk of chunks) {
    const noeud = chunk.noeud ?? noeudByNumber.get(chunk.number) ?? null
    const key = mineKey({ noeud, number: chunk.number })
    const existing = byMine.get(key)
    const resource = existing?.resource ?? detectResource(chunk.label)
    const label = existing?.label ?? chunk.label
    const days = existing?.days ?? {}
    const sections = splitSections(chunk.text)

    if (sections.heures) {
      for (const [d, [h]] of extractSeries(sections.heures, 1)) {
        days[d] = { ...(days[d] ?? {}), heures: h }
      }
    }
    if (sections.production) {
      for (const [d, [p]] of extractSeries(sections.production, 1)) {
        days[d] = { ...(days[d] ?? {}), production: p }
      }
    }
    if (sections.conso) {
      for (const [d, [pierre, fer]] of extractSeries(sections.conso, 2)) {
        days[d] = { ...(days[d] ?? {}), pierre, fer }
      }
    }

    byMine.set(key, { number: chunk.number, noeud, label, resource, days })
  }

  return [...byMine.values()].sort((a, b) => a.number - b.number)
}

/**
 * Fusionne un nouveau parsing sur des données existantes sans rien perdre
 * (une valeur déjà connue n'est jamais écrasée par une valeur absente).
 * Clé : le nœud (voir mineKey).
 */
export function mergeMinesData(existing, incoming) {
  const byKey = new Map((existing || []).map(m => [mineKey(m), m]))
  for (const mine of incoming || []) {
    let key = mineKey(mine)
    let current = byKey.get(key)

    // Données mémorisées avant le clavetage sur le nœud (fil bilan-mines, Q7) : une entrée SANS nœud
    // se rattache une seule fois, par son numéro, à l'entrée nouvelle de même numéro, puis prend son
    // nœud — ensuite la clé est le nœud, définitivement.
    if (!current && mine.noeud) {
      const legacyKey = `numero:${mine.number}`
      if (byKey.has(legacyKey)) {
        current = byKey.get(legacyKey)
        byKey.delete(legacyKey)
      }
    }

    if (!current) {
      byKey.set(key, mine)
      continue
    }
    const days = { ...current.days }
    for (const [d, vals] of Object.entries(mine.days)) {
      const clean = Object.fromEntries(
        Object.entries(vals).filter(([, v]) => v !== undefined && v !== null && !Number.isNaN(v))
      )
      days[d] = { ...(days[d] ?? {}), ...clean }
    }
    byKey.set(key, {
      number: mine.number,
      noeud: mine.noeud ?? current.noeud ?? null,
      label: mine.label || current.label,
      resource: mine.resource || current.resource,
      days,
    })
  }
  return [...byKey.values()].sort((a, b) => a.number - b.number)
}

const isKnown = v => v !== undefined && v !== null && !Number.isNaN(v)

/** Les 7 dates (AAAA-MM-JJ) de la semaine qui commence le lundi `monday`. */
export function weekDates(monday) {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

/**
 * Le jour D d'une mine, apparié (brief Bilan §2.1, tranché par Greg le 05/10/2026) :
 * - règle A : production[D], consommation[D] et HEURES[D+1] — la ligne « heures travaillées » du
 *   jeu est étiquetée un jour plus tard que le travail qu'elle mesure (dossier mines §2.11d, mesuré
 *   sur trois jeux de données) ;
 * - règle B : si l'une des deux moitiés manque (production de D, heures de D+1), le jour est ÉCARTÉ
 *   tout entier — un salaire sans la production qui va avec, ou l'inverse, est le mensonge qu'on
 *   corrige. ⚠️ Une production à ZÉRO n'est pas une production absente : le jour reste.
 * Une consommation absente vaut 0 : le tableau du jeu ne liste que les jours d'entretien.
 * Renvoie null pour un jour écarté.
 */
function pairedDay(mine, day) {
  const production = mine.days[day]?.production
  const heures = mine.days[addDays(day, 1)]?.heures
  if (!isKnown(production) || !isKnown(heures)) return null
  return { production, heures, pierre: mine.days[day]?.pierre ?? 0, fer: mine.days[day]?.fer ?? 0 }
}

/**
 * Bilan d'une semaine (lundi `monday` → dimanche), UNE table par mine (brief §2.3, Greg 03-04/10) :
 * production, valeur, heures, salaire, entretien pierre/fer, entretien en écus, solde — et une ligne
 * Total. `mines` doit porter les heures du LUNDI SUIVANT (règle A).
 *
 * - Salaire = heures × `rate` : chaque mine porte ses propres heures, donc le salaire se répartit par
 *   construction (§2.2). Le taux est un réglage du bailli, daté : jamais une constante (§3).
 * - L'entretien d'une mine est SA PROPRE consommation (son tableau « Ressources consommées »), valorisé
 *   au prix du marché — un coût d'opportunité, pas une dépense (§2.5). La mise en commun du stock de
 *   pierre et de fer de la province ne vit que dans la ligne Total (§2.3, fil bilan-mines Q4).
 * - L'or produit des écus : sa production est sa valeur, sans prix unitaire.
 * - ⚠️ « Entretien normal » n'entre JAMAIS ici : c'est un cumul depuis le dernier entretien, le sommer
 *   compterait plusieurs fois les mêmes quintaux (§6c, test qui le fige).
 *
 * La synthèse par ressource (salaire entier sur l'or) a été supprimée le 05/10/2026 : elle inversait
 * la lecture (brief §1, défaut 2).
 */
export function computeBilan(mines, prices, rate, monday) {
  const days = weekDates(monday)
  const price = resource => Number(prices?.[resource]) || 0

  const lines = (mines || []).map(mine => {
    const sums = { production: 0, heures: 0, pierre: 0, fer: 0 }
    for (const day of days) {
      const paired = pairedDay(mine, day)
      if (!paired) continue
      for (const field of Object.keys(sums)) sums[field] += paired[field]
    }
    const valeur = mine.resource === 'OR' ? sums.production : sums.production * price(mine.resource)
    const salaire = sums.heures * (Number(rate) || 0)
    const entretien = sums.pierre * price('PIERRE') + sums.fer * price('FER')
    return {
      number: mine.number, noeud: mine.noeud ?? null, label: mine.label, resource: mine.resource,
      ...sums, valeur, salaire, entretien, solde: valeur - salaire - entretien,
    }
  })

  const total = ['heures', 'pierre', 'fer', 'valeur', 'salaire', 'entretien', 'solde']
    .reduce((acc, field) => ({ ...acc, [field]: lines.reduce((sum, l) => sum + l[field], 0) }), {})

  return { lines, total, net: total.solde, rate: Number(rate) || 0 }
}

/** Date (AAAA-MM-JJ) la plus récente présente dans les relevés, ou null. */
export function mostRecentDate(mines) {
  let latest = null
  for (const m of mines || []) {
    for (const d of Object.keys(m.days)) {
      if (!latest || d > latest) latest = d
    }
  }
  return latest
}

/** Ne garde que les relevés d'une date donnée (pour la mise en forme du jour). */
export function filterToDate(mines, dateIso) {
  return (mines || [])
    .map(m => ({ ...m, days: m.days[dateIso] ? { [dateIso]: m.days[dateIso] } : {} }))
    .filter(m => Object.keys(m.days).length > 0)
}

/**
 * Ne garde que les relevés dans [monday, sunday] inclus — pour scoper un
 * collage à la semaine choisie avant fusion (un collage peut déborder sur
 * des jours hors de cette semaine, ex. fenêtre glissante du jeu).
 */
export function filterToWeek(mines, monday, sunday) {
  return (mines || [])
    .map(m => ({
      ...m,
      days: Object.fromEntries(
        Object.entries(m.days).filter(([d]) => d >= monday && d <= sunday)
      ),
    }))
    .filter(m => Object.keys(m.days).length > 0)
}

/** Lundi de la semaine n semaines avant/après celle de `mondayIso`. */
export function shiftWeek(mondayIso, n) {
  return addDays(mondayIso, n * 7)
}

/**
 * Date du jour (AAAA-MM-JJ) À PARIS — isolée pour être simulable dans les tests.
 * Les dates du collage sont parisiennes (« de minuit à minuit, heure de Paris, France ») : en UTC,
 * entre minuit et 2 h du matin l'été, la semaine présélectionnée était la précédente (brief Bilan
 * §6a). ⚠️ addDays, getWeekBounds et shiftWeek restent en UTC, et c'est voulu : ils manipulent des
 * chaînes AAAA-MM-JJ sans heure.
 */
export function todayIso() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date())
      .map(({ type, value }) => [type, value])
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

function addDays(dateIso, n) {
  const d = new Date(dateIso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Lundi/dimanche de la semaine ISO contenant `dateIso`. */
export function getWeekBounds(dateIso) {
  const d = new Date(dateIso + 'T00:00:00Z')
  const day = d.getUTCDay() // 0=dimanche..6=samedi
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = addDays(dateIso, diffToMonday)
  const sunday = addDays(monday, 6)
  return { monday, sunday }
}

/**
 * La semaine du lundi `monday` est-elle complète (brief Bilan §2.1, §2.4) ? Un jour D est couvert
 * quand au moins une mine en a les DEUX moitiés — production[D] et heures[D+1] — et qu'aucune mine
 * n'en a qu'une seule. Le dimanche exige donc les heures du LUNDI SUIVANT : la semaine n'est complète
 * que le lundi. Une mine sans aucune donnée un jour donné (fermée) ne compte pas ce jour-là.
 * ⚠️ Avant le 05/10/2026, il ne vérifiait que la présence d'une date, pas des deux séries : il déclarait
 * complète une semaine qui ne l'était pas. Une semaine incomplète s'affiche, mais ne s'exporte pas
 * en bilan hebdomadaire (Greg, fil bilan-mines Q10).
 */
export function checkWeekCompleteness(mines, monday) {
  const sunday = addDays(monday, 6)
  const missingDates = weekDates(monday).filter(day => {
    const halves = (mines || []).map(mine => [
      isKnown(mine.days[day]?.production),
      isKnown(mine.days[addDays(day, 1)]?.heures),
    ])
    const paired = halves.some(([production, heures]) => production && heures)
    const lopsided = halves.some(([production, heures]) => production !== heures)
    return !paired || lopsided
  })
  return { complete: missingDates.length === 0, monday, sunday, missingDates }
}

/**
 * Lundi de la semaine proposée à l'arrivée sur la page (Greg, 08/10/2026 — remplace la « dernière
 * semaine achevée » du brief §2.4) : la semaine EN COURS, sauf le lundi, où l'on reste sur la semaine
 * passée pour compléter les heures du dimanche, qui n'arrivent que dans le collage du lundi.
 * `todayIsoDate` : la date de Paris (todayIso()).
 */
export function defaultWeek(todayIsoDate) {
  const { monday } = getWeekBounds(todayIsoDate)
  return todayIsoDate === monday ? shiftWeek(monday, -1) : monday
}


/**
 * « 12 qtx de pierre et 9 kg de fer » (ou « 12 tons of stone and 9 ounces of iron ») ->
 * { pierre: 12, fer: 9 }, ou null si illisible. 🔴 AUCUNE conversion : l'écran anglais porte les
 * MÊMES nombres sous d'autres noms (Greg, 07/10/2026) — tonne ↔ quintal serait un facteur 10 muet.
 */
function parseStoneIron(text) {
  const pierre = text?.match(/(\d+(?:[.,]\d+)?)\s*(?:qtx?|quintaux) de pierre|(\d+(?:[.,]\d+)?)\s*tons? of stone/i)
  const fer = text?.match(/(\d+(?:[.,]\d+)?)\s*kg de fer|(\d+(?:[.,]\d+)?)\s*ounces? of iron/i)
  if (!pierre || !fer) return null
  return { pierre: parseNum(pierre[1] ?? pierre[2]), fer: parseNum(fer[1] ?? fer[2]) }
}

/** Marge de la prévention : 2 unités ou moins sous le seuil (Greg, 04/10/2026). */
export const THRESHOLD_NEAR_MARGIN = 2

/**
 * Alerte de seuil d'une mine, en CONSTAT, jamais en prédiction (brief Bilan §4 ; fil bilan-mines,
 * Q8 et Q8 bis) — lue dans l'état collé, comparée, jamais recalculée :
 * - 'reached' dès que l'entretien normal (cumul depuis le dernier entretien) ÉGALE ou dépasse le
 *   seuil de rupture, sur la pierre OU le fer ;
 * - 'near' s'il en est à THRESHOLD_NEAR_MARGIN unités ou moins, quelle que soit l'heure du collage :
 *   il PEUT l'atteindre avant le passage de jour de 4 h.
 * La règle de rupture n'a jamais été vue déclencher, et l'entretien automatique ducal peut la rendre
 * sans objet : d'où le constat daté, jamais « la mine va tomber ».
 */
export function thresholdAlert(state) {
  const entretien = parseStoneIron(state?.entretienNormal)
  const seuil = parseStoneIron(state?.seuilRupture)
  if (!entretien || !seuil) return null

  const values = { pierre: entretien.pierre, fer: entretien.fer, seuilPierre: seuil.pierre, seuilFer: seuil.fer }
  if (entretien.pierre >= seuil.pierre || entretien.fer >= seuil.fer) return { level: 'reached', ...values }
  if (seuil.pierre - entretien.pierre <= THRESHOLD_NEAR_MARGIN || seuil.fer - entretien.fer <= THRESHOLD_NEAR_MARGIN) {
    return { level: 'near', ...values }
  }
  return null
}

const NOEUD_RE = /(?:Noeud|Nœud|Node)\s*(\d+)/i

function extractField(text, label) {
  const re = new RegExp(label + String.raw`\s*:\s*([^\n]+)`, 'i')
  const m = text.match(re)
  return m ? m[1].trim() : null
}

function extractParenAfterLabel(text, label) {
  const re = new RegExp(label + String.raw`\s*\n\s*\(([^)]*)\)`, 'i')
  const m = text.match(re)
  return m ? m[1].trim() : null
}

/**
 * Extrait l'état statique de chaque mine (niveau, rendement, créneaux,
 * seuil de rupture, entretien) depuis le bloc de configuration du texte
 * collé — PAS les tableaux des 7 derniers jours. Ignore volontairement les
 * libellés de boutons de l'interface du jeu ("Diminuer le niveau de la
 * mine", "Fermer la mine"), qui ne sont pas de la donnée.
 */
export function parseMineStates(text) {
  if (!text) return []
  const byNumber = new Map()
  for (const chunk of splitMineChunks(text)) {
    // Le bloc "config" est celui qui contient "Niveau :" ; le bloc "données"
    // (juste avant les tableaux heures/production/conso) n'en a pas.
    if (!/(?:Niveau|Level)\s*:/i.test(chunk.text) || byNumber.has(chunk.number)) continue
    const noeudMatch = chunk.text.match(NOEUD_RE)
    byNumber.set(chunk.number, {
      number: chunk.number,
      label: chunk.label,
      resource: detectResource(chunk.label),
      noeud: noeudMatch ? noeudMatch[1] : null,
      niveau: extractField(chunk.text, '(?:Niveau|Level)'),
      rendement: extractField(chunk.text, '(?:Rendement|Output)'),
      creneaux: extractField(chunk.text, String.raw`(?:Cr[ée]neaux horaires|Time slots)`),
      seuilRupture: extractField(chunk.text, '(?:Seuil de rupture|Deterioration threshold)'),
      entretienNormal: extractParenAfterLabel(chunk.text, '(?:Entretien normal|Normal maintenance)'),
      entretienAmelioration: extractParenAfterLabel(chunk.text, String.raw`(?:Entretien et am[ée]lioration|Maintenance and improvement)`),
    })
  }
  return [...byNumber.values()].sort((a, b) => a.number - b.number)
}

const FRENCH_MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

/** "2026-08-03" -> "3 août 2026" */
export function formatDateFr(dateIso) {
  const [y, m, d] = dateIso.split('-').map(Number)
  return `${d} ${FRENCH_MONTHS[m - 1]} ${y}`
}
