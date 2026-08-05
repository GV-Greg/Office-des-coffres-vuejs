// Parsing du texte "mines" collé depuis le jeu -> bilan (production, entretien, net).
// Voir roadmap.md, Phase 5, pour le contexte métier (mécanique des mines, prix,
// pourquoi le salaire n'est pas calculé automatiquement).

const DATE_ISO = String.raw`\d{4}-\d{1,2}-\d{1,2}`
const DATE_FR = String.raw`\d{1,2}[./]\d{1,2}[./]\d{2,4}`
const DATE_ANY = `(?:${DATE_ISO}|${DATE_FR})`
const NUM = String.raw`-?\d+(?:[.,]\d+)?`

const SECTION_MARKERS = [
  { key: 'heures', re: /nombre d'heures travaill/i },
  { key: 'production', re: /production des \d+ derniers jours/i },
  { key: 'conso', re: /ressources consomm/i },
]

const MINE_HEADER_RE = /Mine\s*(\d+)\s*:\s*([^-\d]+)/gi

export const RESOURCES = ['OR', 'FER', 'PIERRE', 'ARGILE', 'SEL']

function normalizeDate(raw) {
  if (raw.includes('-') && raw.split('-')[0].length === 4) {
    const [y, m, d] = raw.split('-').map(Number)
    return isValidDate(y, m, d) ? toIso(y, m, d) : null
  }
  const parts = raw.replace(/\./g, '/').split('/')
  if (parts.length !== 3) return null
  let [d, m, y] = parts.map(Number)
  if (y < 100) y += 2000
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
  if (s.includes('argile')) return 'ARGILE'
  if (s.includes('pierre')) return 'PIERRE'
  if (/\bsel\b/.test(s)) return 'SEL'
  if (s.includes('fer')) return 'FER'
  if (/\bor\b/.test(s)) return 'OR'
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
    chunks.push({
      number: parseInt(m[1], 10),
      label: m[2].trim().replace(/[-–]\s*$/, '').trim(),
      text: text.slice(start, end),
    })
  }
  return chunks
}

/**
 * Parse le texte collé -> liste de mines avec leurs relevés journaliers.
 * [{ number, label, resource, days: { 'AAAA-MM-JJ': { heures, production, pierre, fer } } }]
 */
export function parseMinesText(text) {
  if (!text) return []
  const byMine = new Map()

  for (const chunk of splitMineChunks(text)) {
    const existing = byMine.get(chunk.number)
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

    byMine.set(chunk.number, { number: chunk.number, label, resource, days })
  }

  return [...byMine.values()].sort((a, b) => a.number - b.number)
}

/**
 * Fusionne un nouveau parsing sur des données existantes sans rien perdre
 * (une valeur déjà connue n'est jamais écrasée par une valeur absente).
 */
export function mergeMinesData(existing, incoming) {
  const byNumber = new Map((existing || []).map(m => [m.number, m]))
  for (const mine of incoming || []) {
    const current = byNumber.get(mine.number)
    if (!current) {
      byNumber.set(mine.number, mine)
      continue
    }
    const days = { ...current.days }
    for (const [d, vals] of Object.entries(mine.days)) {
      const clean = Object.fromEntries(
        Object.entries(vals).filter(([, v]) => v !== undefined && v !== null && !Number.isNaN(v))
      )
      days[d] = { ...(days[d] ?? {}), ...clean }
    }
    byNumber.set(mine.number, {
      number: mine.number,
      label: mine.label || current.label,
      resource: mine.resource || current.resource,
      days,
    })
  }
  return [...byNumber.values()].sort((a, b) => a.number - b.number)
}

function sumDays(days) {
  return Object.values(days).reduce(
    (acc, day) => ({
      heures: acc.heures + (day.heures ?? 0),
      production: acc.production + (day.production ?? 0),
      pierre: acc.pierre + (day.pierre ?? 0),
      fer: acc.fer + (day.fer ?? 0),
    }),
    { heures: 0, production: 0, pierre: 0, fer: 0 }
  )
}

/**
 * Calcule le bilan : valeur de production, valeur d'entretien, net (déduction
 * faite du salaire saisi à la main). `prices` : { PIERRE, FER, ARGILE, SEL }
 * (pas de prix "Or", la mine d'or produit directement des écus).
 */
export function computeBilan(mines, prices, salary = 0) {
  const lines = (mines || []).map(mine => {
    const totals = sumDays(mine.days)
    const valeurProduction = mine.resource === 'OR'
      ? totals.production
      : totals.production * (prices?.[mine.resource] ?? 0)
    const valeurEntretien =
      totals.pierre * (prices?.PIERRE ?? 0) + totals.fer * (prices?.FER ?? 0)

    return { ...mine, ...totals, valeurProduction, valeurEntretien }
  })

  const totals = lines.reduce(
    (acc, l) => ({
      heures: acc.heures + l.heures,
      pierre: acc.pierre + l.pierre,
      fer: acc.fer + l.fer,
      valeurProduction: acc.valeurProduction + l.valeurProduction,
      valeurEntretien: acc.valeurEntretien + l.valeurEntretien,
    }),
    { heures: 0, pierre: 0, fer: 0, valeurProduction: 0, valeurEntretien: 0 }
  )

  const net = totals.valeurProduction - totals.valeurEntretien - (salary || 0)

  return { lines, totals, salary: salary || 0, net }
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
 * Vérifie si la semaine (lundi->dimanche) contenant la date la plus récente
 * est entièrement couverte par au moins une mine chaque jour. Ne bloque rien
 * (juste informatif) : le bilan reste calculable sur une semaine incomplète.
 */
export function checkWeekCompleteness(mines) {
  const allDates = new Set()
  for (const m of mines || []) {
    for (const d of Object.keys(m.days)) allDates.add(d)
  }
  if (allDates.size === 0) {
    return { complete: false, monday: null, sunday: null, missingDates: [] }
  }
  const { monday, sunday } = getWeekBounds([...allDates].sort().at(-1))
  const missingDates = []
  for (let d = monday; d <= sunday; d = addDays(d, 1)) {
    if (!allDates.has(d)) missingDates.push(d)
  }
  return { complete: missingDates.length === 0, monday, sunday, missingDates }
}

const NOEUD_RE = /Noeud\s*(\d+)/i

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
    if (!/Niveau\s*:/i.test(chunk.text) || byNumber.has(chunk.number)) continue
    const noeudMatch = chunk.text.match(NOEUD_RE)
    byNumber.set(chunk.number, {
      number: chunk.number,
      label: chunk.label,
      resource: detectResource(chunk.label),
      noeud: noeudMatch ? noeudMatch[1] : null,
      niveau: extractField(chunk.text, 'Niveau'),
      rendement: extractField(chunk.text, 'Rendement'),
      creneaux: extractField(chunk.text, String.raw`Cr[ée]neaux horaires`),
      seuilRupture: extractField(chunk.text, 'Seuil de rupture'),
      entretienNormal: extractParenAfterLabel(chunk.text, 'Entretien normal'),
      entretienAmelioration: extractParenAfterLabel(chunk.text, String.raw`Entretien et am[ée]lioration`),
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
