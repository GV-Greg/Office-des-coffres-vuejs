/*
  Parseurs des collages du Registre de douane (module Sécurité), logique pure, FR et EN.
  Validés sur les COLLAGES RÉELS de Greg du 22/11/2026 (tests/fixtures/customs/, copies de admin/exemples/collage-*.txt).

  🔴 UN SEUL parseur, au FRONTEND, comme le Registre des mines (décision de Greg, 22/11/2026, fil admin/echanges/module-securite/11) :
  le serveur reçoit le JSON analysé + le collage brut, valide la FORME, ne re-parse jamais. Aucun jumeau PHP.

  Corrections du brief par les collages réels :
  - les visions sont un JOURNAL de plusieurs jours, chaque bloc sous une date de jeu explicite ;
  - un groupe ne liste PAS ses membres : le ou les CHEFS sont sur la ligne de nom ; cinq types dont la milice (sans pseudo) ;
  - un pseudo ne contient jamais d'espace (points, soulignés, chiffres, tirets : on ne les nettoie jamais).
*/

import { realYear } from '@/modules/gameCalendar.js'

/** Incrémenter quand une règle de lecture change : tamponné sur chaque bilan, pour repérer ceux qu'un bug aurait touchés. */
export const PARSER_VERSION = 1

const MONTHS = {
  janvier: 1, février: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, août: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
}

const lines = raw => String(raw ?? '').split(/\r\n|\n|\r/)

/* ─── Visions en chemin ─────────────────────────────────────────────────────────────────────── */

function realDate(year, monthName, day) {
  const month = MONTHS[String(monthName).toLowerCase()]
  const real = realYear(year)
  if (!month) return null
  const probe = new Date(Date.UTC(real, month - 1, day))
  const valid = probe.getUTCFullYear() === real && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day
  return valid ? `${String(real).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null
}

function members(chunk, lang) {
  const separator = lang === 'fr' ? /\s*,\s+de\s+|\s+et\s+de\s+|\s*,\s+/u : /\s+,\s+|\s*,\s+|\s+and\s+/u
  return chunk.trim().split(separator).filter(part => part !== '')
}

const VISION_LINES = [
  { lang: 'fr', lead: /^Aujourd'hui, en chemin, vous avez croisé /u, group: /un groupe composé de /iu },
  { lang: 'en', lead: /^Today, on the road you met /u, group: /a group composed of /iu },
]

/**
 * Journal de visions. UN SEUL point final est retiré par ligne : « Elyas. » → « Elyas », mais « Agathe.. » suivi de
 * « , un groupe composé de » garde ses deux points (ce n'est pas la fin de la phrase). On ne découpe jamais sur le point.
 *
 * @returns {{ entries: Array<{date: string, singles: string[], groups: string[][]}>, ignoredLines: number }}
 */
export function parseVisions(raw) {
  const entries = []
  let ignoredLines = 0
  let date = null

  for (const original of lines(raw)) {
    const line = original.trim()
    if (line === '') continue

    let m = line.match(/^Le (\d{1,2}) (\S+) (\d{4})$/u)
    if (m) { date = realDate(Number(m[3]), m[2], Number(m[1])); continue }
    m = line.match(/^On (\d{4}) (\S+) (\d{1,2})$/u)
    if (m) { date = realDate(Number(m[1]), m[2], Number(m[3])); continue }

    const kind = VISION_LINES.find(({ lead }) => lead.test(line))
    if (!kind) { ignoredLines++; continue }
    if (date === null) { ignoredLines++; continue }

    let rest = line.replace(kind.lead, '')
    if (rest.endsWith('.')) rest = rest.slice(0, -1) // UN SEUL point final

    let singles
    const groups = []
    if (kind.group.test(rest)) {
      const pieces = rest.split(kind.group)
      singles = members(pieces.shift().replace(/^[ ,]+|[ ,]+$/g, ''), kind.lang)
      for (const piece of pieces) groups.push(members(piece.replace(/[, ]+$/, ''), kind.lang))
    } else {
      singles = members(rest, kind.lang)
    }
    entries.push({ date, singles, groups })
  }

  return { entries, ignoredLines }
}

/**
 * Le bilan du jour J ne garde que les visions de l'en-tête J = nuit J-1 → J (Greg, 22/11/2026, C1 et C2) ; les autres jours sont comptés
 * (« N visions d'autres jours ignorées »). Rattachées à la ville choisie dans le formulaire (C3).
 */
export function visionsForDay(entries, date) {
  const kept = entries.filter(entry => entry.date === date).map(({ singles, groups }) => ({ singles, groups }))
  return { kept, otherDays: entries.length - kept.length }
}

/* ─── Armées, groupes, contrôle de la zone ──────────────────────────────────────────────────── */

/** Du plus spécifique au plus général : « Groupe de maréchaux de » avant « Groupe de ». */
const GROUP_TYPES = [
  ['marechaux', /^(?:Groupe de maréchaux de|Marshal group of) (.+)$/u],
  ['corps_armes', /^(?:Corps d'armes de|Armed Mob of) (.+)$/u],
  ['lance', /^(?:Lance de|Armed Retinue of) (.+)$/u],
  ['milice', /^(?:Milice de|Militia of) (.+)$/u],
  ['groupe', /^(?:Groupe de|Group of) (.+)$/u],
]

const SECTION_HEADERS = [
  ['armies', /^(?:Armées présentes ici|Armies here)\s*:?\s*$/iu],
  ['groups', /^(?:Groupes présents ici|Groups here)\s*:?\s*$/iu],
  ['zone', /^(?:Contrôle de la zone|Control of the area)\s*$/iu],
]

/** Seul « Groupe de PSEUDO » alerte (« groupe à surveiller », jamais « brigand ») ; ni lance, corps d'armes, maréchaux ni milice (P8, C5). */
export const ALERT_GROUP_TYPES = ['groupe']

/**
 * @returns {{ armies: Array<{name: string, commander: string, status: string}>,
 *             groups: Array<{type: string, leaders: string[], status: string}>, zone: string|null }}
 */
export function parseArmiesGroups(raw) {
  const armies = []
  const groups = []
  const zone = []
  let section = null
  let current = null

  for (const original of lines(raw)) {
    const line = original.trim()

    const header = SECTION_HEADERS.find(([, pattern]) => pattern.test(line))
    if (header) { section = header[0]; current = null; continue }
    if (line === '' || section === null) continue

    if (section === 'zone') { zone.push(line); continue }

    if (section === 'armies') {
      const army = line.match(/^Armée "(.*)" commandée par (\S+)$/u) ?? line.match(/^Army (.*) led by (\S+)$/u)
      if (army) {
        armies.push({ name: army[1], commander: army[2], status: '' })
        current = armies.length - 1
      } else if (current !== null) {
        armies[current].status = `${armies[current].status}\n${line}`.trim()
      }
      continue
    }

    const group = GROUP_TYPES.map(([type, pattern]) => [type, line.match(pattern)]).find(([, match]) => match)
    if (group) {
      const [type, match] = group
      const leaders = type === 'milice' ? [] : match[1].split(',').map(p => p.trim()).filter(p => p !== '')
      groups.push({ type, leaders, status: '' })
      current = groups.length - 1
    } else if (current !== null) {
      groups[current].status = `${groups[current].status}\n${line}`.trim()
    }
  }

  return { armies, groups, zone: zone.length ? zone.join('\n') : null }
}
