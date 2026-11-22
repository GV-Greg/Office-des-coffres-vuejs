/*
  Le Relevé unique (module Sécurité, PR 3-2 ; fil admin/echanges/module-securite 12 à 14) : de cinq types de collage à UN bilan affichable, EN LOCAL,
  dans la même forme que celui que le serveur sert — `CustomsReportView` et `CustomsExport` l'affichent donc tels quels, avec ou sans compte.
  Logique pure : rien n'est lu ni écrit ici.

  - Sans compte : aucune couleur (le serveur seul connaît les listes de la province) ; le différentiel du guet compare à la liste d'hier collée.
  - Avec un rôle : `colours` (appel `customs-preview`, pseudos envoyés tels que collés) et `previous` (guet du dernier bilan de la ville, Q3).
  Le jour des visions : celui que le serveur annonce (`customs-access.today`) ; sans compte, le plus récent du collage (le serveur n'est pas là pour
  trancher). ⚠️ Aucune règle de droit ici.
*/
import { parseGuet } from '@/modules/guetParser.js'
import { parseVisions, visionsForDay, parseArmiesGroups, ALERT_GROUP_TYPES } from '@/modules/customsParsers.js'

const filled = text => typeof text === 'string' && text.trim() !== ''
const key = pseudo => String(pseudo).toLowerCase()

/** Jour du jeu approché côté navigateur (bascule 04:00 de Paris), AAAA-MM-JJ en année réelle — SANS compte seulement ; le serveur reste maître avec un compte. */
export function localGameDay(now = new Date()) {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date(now.getTime() - 4 * 3600 * 1000))
}

/**
 * @param {{ guet?: string, yesterday?: string, visions?: string, armiesGroups?: string }} pastes
 * @param {string|null} [visionsDay] le jour D des visions ; null = le plus récent du collage
 */
export function parseReleve(pastes, visionsDay = null) {
  const guet = filled(pastes.guet) ? parseGuet(pastes.guet) : null
  const yesterday = filled(pastes.yesterday) ? parseGuet(pastes.yesterday) : null

  let visions = null
  if (filled(pastes.visions)) {
    const { entries } = parseVisions(pastes.visions)
    const day = visionsDay ?? entries.map(e => e.date).sort().at(-1) ?? null
    visions = day ? { day, ...visionsForDay(entries, day) } : { day: null, kept: [], otherDays: entries.length }
  }

  const block = filled(pastes.armiesGroups) ? parseArmiesGroups(pastes.armiesGroups) : null
  return { guet, yesterday, visions, block }
}

/** Tous les pseudos du relevé, uniques, tels que collés : ce que `customs-preview` reçoit (jamais un texte). */
export function collectPseudos(parsed) {
  const set = new Set()
  parsed.guet?.villagers.forEach(v => set.add(v.pseudo))
  parsed.visions?.kept.forEach(entry => {
    entry.singles.forEach(p => set.add(p))
    entry.groups.forEach(group => group.forEach(p => set.add(p)))
  })
  parsed.block?.armies.forEach(army => set.add(army.commander))
  parsed.block?.groups.forEach(group => group.members.forEach(p => set.add(p)))
  return [...set]
}

/** Y a-t-il quelque chose à montrer ? */
export function hasContent(parsed) {
  return !!(parsed.guet?.villagers.length || parsed.visions?.kept.length
    || parsed.block?.armies.length || parsed.block?.groups.length || parsed.block?.zone)
}

/**
 * @param {ReturnType<typeof parseReleve>} parsed
 * @param {{ day: string, colours?: Array<{pseudo: string, colour: string}>|null, previous?: {compared_to: string, pseudos: string[]}|null }} context
 * @returns {object} un bilan dans la forme de l'API (`reported_on`, `sections.guet|visions|armies_groups`)
 */
export function buildLocalReport(parsed, { day, colours = null, previous = null }) {
  const map = new Map((colours ?? []).map(({ pseudo, colour }) => [pseudo, colour]))
  const painted = pseudo => ({ pseudo, colour: map.get(pseudo) ?? null })
  const sections = {}

  if (parsed.guet?.villagers.length) {
    const villagers = parsed.guet.villagers.map(({ pseudo, noblesse }) => ({ ...painted(pseudo), noblesse }))
    sections.guet = {
      villagers,
      declared_total: parsed.guet.declaredTotal,
      read_total: villagers.length,
      total_matches: parsed.guet.totalMatches,
      diff: diffAgainst(villagers.map(v => v.pseudo), previous, parsed.yesterday, painted),
    }
  }

  if (parsed.visions?.kept.length) {
    sections.visions = {
      entries: parsed.visions.kept.map(entry => ({ singles: entry.singles.map(painted), groups: entry.groups.map(group => group.map(painted)) })),
      other_days: parsed.visions.otherDays,
    }
  }

  const block = parsed.block
  if (block && (block.armies.length || block.groups.length || block.zone)) {
    sections.armies_groups = {
      armies: block.armies.map(army => ({ name: army.name, commander: painted(army.commander), status: army.status ?? '' })),
      groups: block.groups.map(group => ({ type: group.type, alert: ALERT_GROUP_TYPES.includes(group.type), members: group.members.map(painted), status: group.status ?? '' })),
      zone: block.zone ?? null,
    }
  }

  return { reported_on: day, sections, sections_present: Object.keys(sections) }
}

// Arrivées et départs : au dernier bilan de la ville (Registre) s'il est donné, sinon à la liste d'hier collée ; sinon aucun différentiel.
function diffAgainst(today, previous, yesterday, painted) {
  const before = previous ? previous.pseudos : (yesterday ? yesterday.villagers.map(v => v.pseudo) : null)
  if (!before) return null
  const beforeKeys = new Set(before.map(key))
  const todayKeys = new Set(today.map(key))
  return {
    compared_to: previous?.compared_to ?? null, // null : « la liste d'hier » collée
    arrivals: today.filter(p => !beforeKeys.has(key(p))).map(painted),
    departures: before.filter(p => !todayKeys.has(key(p))).map(painted),
  }
}
