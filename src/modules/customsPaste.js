/*
  De trois collages à l'envoi du Registre de douane (module Sécurité) : logique pure. Le serveur reçoit le JSON analysé ET le brut, valide la
  FORME, ne re-parse jamais (décision de Greg, 22/11/2026, comme les mines). Ce que l'Office GARDE comme brut :
  - le guet : l'en-tête et les lignes du tableau, SANS le préambule ;
  - les visions : l'en-tête du jour D et ses lignes, rien des autres jours (C1/C2 : l'en-tête J = la nuit J-1 → J) ;
  - armées, groupes et contrôle de la zone : le collage entier.
  Le jour D est décidé par le SERVEUR (`customs-access.today`, bascule 04:00) ; ce module ne le calcule jamais.
*/
import { parseGuet, extractGuetRaw } from '@/modules/guetParser.js'
import { parseVisions, visionsForDay, parseArmiesGroups, extractVisionsRaw, PARSER_VERSION } from '@/modules/customsParsers.js'

const filled = text => typeof text === 'string' && text.trim() !== ''

/**
 * @param {{ guet?: string, visions?: string, armiesGroups?: string }} pastes les trois zones de collage
 * @param {string} day jour du jeu (AAAA-MM-JJ) du bilan
 * @returns {{ sections: object, summary: object, problems: string[] }}
 *   `sections` : exactement ce que l'API attend (`guet`, `visions`, `armies_groups`) ;
 *   `problems` : codes que l'écran traduit (`guet_empty`, `visions_none`, `armies_groups_empty`).
 */
export function buildSections(pastes, day) {
  const sections = {}
  const summary = {}
  const problems = []

  if (filled(pastes.guet)) {
    const guet = parseGuet(pastes.guet)
    summary.guet = { read: guet.villagers.length, declared: guet.declaredTotal, matches: guet.totalMatches }
    if (guet.villagers.length === 0) {
      problems.push('guet_empty')
    } else {
      sections.guet = {
        raw: extractGuetRaw(pastes.guet),
        parser_version: PARSER_VERSION,
        report: {
          villagers: guet.villagers.map(({ pseudo, noblesse, reputation }) => ({ pseudo, noblesse, reputation })),
          declared_total: guet.declaredTotal,
        },
      }
    }
  }

  if (filled(pastes.visions)) {
    const parsed = parseVisions(pastes.visions)
    const forDay = visionsForDay(parsed.entries, day)
    summary.visions = { kept: forDay.kept.length, otherDays: forDay.otherDays, ignoredLines: parsed.ignoredLines }
    if (forDay.kept.length === 0) {
      problems.push('visions_none')
    } else {
      sections.visions = {
        raw: extractVisionsRaw(pastes.visions, day),
        parser_version: PARSER_VERSION,
        report: { entries: forDay.kept, other_days: forDay.otherDays },
      }
    }
  }

  if (filled(pastes.armiesGroups)) {
    const block = parseArmiesGroups(pastes.armiesGroups)
    summary.armiesGroups = { armies: block.armies.length, groups: block.groups.length, zone: block.zone !== null }
    if (block.armies.length === 0 && block.groups.length === 0 && block.zone === null) {
      problems.push('armies_groups_empty')
    } else {
      sections.armies_groups = { raw: pastes.armiesGroups.trim(), parser_version: PARSER_VERSION, report: block }
    }
  }

  return { sections, summary, problems }
}
