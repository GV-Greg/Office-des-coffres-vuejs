// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DATA_PAGE_SECTIONS } from '../../src/modules/dataPageSections.js'

/*
  Garde-fou — La Salle des gardes (module Sécurité) dans la politique et « Vos données ». Texte de Cowork du 22/11/2026, repris par la v2
  de Claude Code (admin/content/policy-securite-draft-v2.md) et validée par Greg. C'est le premier module qui conserve des pseudos de
  tiers SANS compte : les formulations ci-dessous sont des ENGAGEMENTS. Plusieurs sont des décisions de Greg du 22/11/2026 :
    - le trio = prévôt + connétable + capitaine (le juge n'en fait pas partie) ;
    - aucune procédure de retrait annoncée (D1 refusée) ;
    - un retrait d'entrée de liste supprime l'entrée (choix B) ;
    - ni liste ni bilan dans l'export, seulement une trace d'activité sans contenu ;
    - l'éditeur ne consulte pas ces données, et l'écrit sans « impossible techniquement ».
  Les titres anglais sont ceux relevés en jeu (lang/en/mandates.php) : prévôt des maréchaux = Constable, connétable = Sergeant.

  Lecture par fs : un import de fr.json est précompilé par le plugin vue-i18n et rend undefined.
*/

const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const locale = lang => JSON.parse(readFileSync(resolve(localesDir, `${lang}.json`), 'utf-8'))
const flat = value => (typeof value === 'string' ? value : JSON.stringify(value))
const securityTexts = lang => {
  const { Legal } = locale(lang)
  const { Section3, Section5, Section6, Section7 } = Legal.Privacy
  return {
    privacy: [Section3.SecurityIntro, flat(Section3.SecurityFields), Section3.SecurityNote, Section5.Security, Section6.SecurityHolders, Section7.SecurityThirdParty].join(' '),
    data: flat(Legal.Data.Security),
  }
}

describe('Politique — La Salle des gardes', () => {
  it.each(['fr', 'en'])('%s : les insertions existent (§3, §4, §5, §6, §7 et « Vos données »)', (lang) => {
    const { Legal } = locale(lang)
    const { Section3, Section4, Section5, Section6, Section7 } = Legal.Privacy
    expect(Section3.SecurityIntro).toBeTruthy()
    expect(Section3.SecurityFields).toHaveLength(3)
    expect(Section3.SecurityNote).toBeTruthy()
    expect(Section4.Rows).toHaveLength(9)
    expect(Section4.Rows.slice(-2).map(r => r.LegalBasis)).toHaveLength(2)
    expect(Section5.Security).toBeTruthy()
    expect(Section6.SecurityHolders).toBeTruthy()
    expect(Section7.SecurityThirdParty).toBeTruthy()
    expect(Object.keys(Legal.Data.Security)).toEqual(['Title', 'Purpose', 'Input', 'Stored', 'Deletion'])
  })

  it('« Vos données » : la section demande un poste validé, vit après le Guet, et n\'est plus « à venir » (ouverte avec la PR 3-1)', () => {
    const ids = DATA_PAGE_SECTIONS.map(s => s.id)
    const section = DATA_PAGE_SECTIONS.find(s => s.id === 'salle-des-gardes')
    expect(section).toMatchObject({ key: 'Security', access: 'office' })
    expect(section.upcoming).toBeFalsy()
    expect(ids.indexOf('salle-des-gardes')).toBe(ids.indexOf('guet') + 1)
  })

  it('FR : le trio est prévôt, connétable et capitaine — jamais le juge —, et les droits sont écrits', () => {
    const { Legal } = locale('fr')
    const holders = Legal.Privacy.Section6.SecurityHolders
    expect(holders).toContain('prévôt des maréchaux, connétable et capitaine')
    expect(holders).toContain('Le juge : lecture des listes et ajout à la liste rouge, jamais de retrait')
    expect(holders).not.toMatch(/prévôt, connétable et juge|trio[^.]*juge\)/i)
    for (const term of ['jamais publics', 'seulement si aucun membre du trio n\'est connu de l\'Office', 'L\'auteur d\'un bilan n\'est jamais affiché']) expect(holders).toContain(term)
    const intro = Legal.Privacy.Section3.SecurityIntro
    for (const title of ['douanier', 'prévôt des maréchaux', 'connétable', 'capitaine', 'juge', 'procureur', 'maire']) expect(intro).toContain(title)
  })

  it('la correction d\'un bilan (24/11/2026) : l\'AUTEUR corrige le sien le jour du jeu même ; seuls le prévôt et le connétable (Constable et Sergeant) corrigent celui d\'un autre ou saisissent un jour passé', () => {
    const fr = locale('fr').Legal.Privacy.Section6.SecurityHolders
    expect(fr).toContain('l\'auteur d\'un bilan peut le corriger le jour du jeu même')
    expect(fr).toContain('seuls le prévôt et le connétable corrigent le bilan d\'un autre ou saisissent un jour passé')
    expect(fr).not.toContain('corrigent un bilan déjà saisi')

    const en = locale('en').Legal.Privacy.Section6.SecurityHolders
    expect(en).toContain('the author of a report can correct it on the game day itself')
    expect(en).toContain('only the Constable and the Sergeant correct someone else\'s report or enter a past day')
    expect(en).not.toContain('correct a report already entered')
  })

  it('EN : les titres sont ceux du jeu (Constable, Sergeant, Captain, Public Prosecutor), « The Guardroom »', () => {
    const { Legal } = locale('en')
    const all = `${Legal.Privacy.Section3.SecurityIntro} ${Legal.Privacy.Section6.SecurityHolders} ${Legal.Data.Security.Title}`
    for (const term of ['Constable', 'Sergeant', 'Captain', 'Public Prosecutor', 'The Guardroom']) expect(all).toContain(term)
    expect(securityTexts('en').privacy.toLowerCase()).not.toMatch(/provost|guard room/)
    expect(Legal.Privacy.Section6.SecurityHolders).toContain('Constable, Sergeant and Captain')
  })

  it.each(['fr', 'en'])('%s : la conservation est sans limite et dite telle, avec « le lien est supprimé » et jamais « anonymisé » comme promesse', (lang) => {
    const { Section5 } = locale(lang).Legal.Privacy
    const text = Section5.Security
    expect(text).toMatch(lang === 'fr' ? /sans limite de durée/ : /without any time limit/)
    expect(text).toMatch(lang === 'fr' ? /le lien avec votre compte est supprimé/ : /link with your account is removed/)
    expect(text).toMatch(lang === 'fr' ? /non « anonymisé »/ : /not "anonymised"/)
    // un retrait supprime l'entrée (choix B) : jamais « reste enregistrée »
    expect(text).toMatch(lang === 'fr' ? /un retrait les supprime définitivement/ : /a removal deletes them permanently/)
  })

  it.each(['fr', 'en'])('%s : AUCUNE procédure de retrait à la demande n\'est annoncée (Greg, 22/11/2026)', (lang) => {
    const { Section7 } = locale(lang).Legal.Privacy
    const text = `${Section7.SecurityThirdParty} ${securityTexts(lang).privacy} ${securityTexts(lang).data}`.toLowerCase()
    expect(text).not.toMatch(/nous retirons|vous pouvez en demander le retrait|we remove your|ask for (its|their) removal/)
    expect(Section7.SecurityThirdParty).toMatch(lang === 'fr' ? /relève du jeu/ : /matter for the game/)
  })

  it.each([
    ['fr', 'Aucune interface d\'administration du site ne permet de consulter', 'vérifiée automatiquement', 'accès technique à l\'hébergement', 's\'engage à ne pas l\'utiliser'],
    ['en', 'No site administration interface can display', 'checked automatically', 'technical access to the hosting', 'undertakes not to use it'],
  ])('%s : la phrase d\'accès de l\'éditeur est la formulation retenue (§5bis), jamais « impossible techniquement »', (lang, ...terms) => {
    const note = locale(lang).Legal.Privacy.Section3.SecurityNote
    for (const term of terms) expect(note).toContain(term)
    expect(note.toLowerCase()).not.toMatch(/techniquement (impossible|inaccessible)|cannot technically|technically impossible/)
  })

  it.each(['fr', 'en'])('%s : les listes et les bilans disent ce qui est chiffré, sans identifiant technique dans un texte joueur', (lang) => {
    const { Section3 } = locale(lang).Legal.Privacy
    const all = flat(Section3.SecurityFields)
    expect(all).toMatch(lang === 'fr' ? /chiffrées côté serveur/ : /encrypted server-side/)
    for (const forbidden of ['character_id', 'NULL', 'nullOnDelete', 'MODULE_DATA_KEY', 'bcrypt']) expect(securityTexts(lang).privacy).not.toContain(forbidden)
    // la couleur court de la date d'ajout, tant que l'entrée est en liste ; un retrait la supprime (choix B)
    expect(all).toMatch(lang === 'fr' ? /à partir de la date d'ajout, tant que l'entrée est en liste/ : /from the date of addition, as long as the entry is on the list/)
    expect(all).toMatch(lang === 'fr' ? /la supprime définitivement/ : /deletes it permanently/)
  })

  // Décision de Greg du 22/11/2026 (fil module-securite, 11 et 12) : le serveur garde le brut chiffré comme les mines, mais SEULEMENT la
  // liste des villageois (sans le préambule : maire, adjoints, noblesse d'épée) et les lignes des visions du jour du bilan. La politique
  // décrit ce qui est réellement stocké ; une armée n'a qu'un COMMANDANT, un groupe liste tous ses MEMBRES sur sa ligne de nom (collages réels).
  it.each(['fr', 'en'])('%s : le texte collé conservé est dit — liste des villageois sans préambule, armées, groupes, contrôle de la zone, visions du jour — et une armée a un commandant, un groupe des membres', (lang) => {
    const { Section3 } = locale(lang).Legal.Privacy
    const reports = Section3.SecurityFields[2].Text
    expect(reports).toMatch(lang === 'fr' ? /Le texte que vous collez est aussi conservé tel quel : la liste des villageois \(sans le préambule\), les armées, les groupes et le contrôle de la zone/ : /The text you paste is also kept as it is: the villager list \(without the preamble\), the armies, the groups and the control of the area/)
    expect(reports).toMatch(lang === 'fr' ? /lignes des visions du jour du bilan/ : /lines of the visions of the report's day/)
    expect(reports).toMatch(lang === 'fr' ? /pour une armée : son nom, son chef.*pour un groupe : son nom, tous ses membres/ : /for an army: its name, its leader.*for a group: its name, all its members/)
    const { Stored } = locale(lang).Legal.Data.Security
    expect(Stored).toMatch(lang === 'fr' ? /tel quel : la liste des villageois \(sans le préambule\), les armées, les groupes et le contrôle de la zone/ : /as it is: the villager list \(without the preamble\), the armies, the groups and the control of the area/)
  })

  it.each(['fr', 'en'])('%s : l\'export ne porte ni listes ni bilans, seulement une trace sans contenu (Greg, 22/11/2026)', (lang) => {
    const { Deletion } = locale(lang).Legal.Data.Security
    expect(Deletion).toMatch(lang === 'fr' ? /sans leur contenu/ : /without their content/)
    expect(Deletion).toMatch(lang === 'fr' ? /statut de douanier figure dans l'export/ : /customs officer status is in your data export/)
    // plus aucune mention d'entrées de listes exportées avec leur contenu
    expect(Deletion.toLowerCase()).not.toMatch(/entrées de listes (et|figurent)|list entries (and|are in)/)
  })
})

describe('Politique — mots de passe : le procédé de hachage n\'est pas révélé', () => {
  it.each(['fr', 'en'])('%s : aucune mention de bcrypt dans la politique, la page « Vos données » ni les cookies (Greg, 22/11/2026)', (lang) => {
    const { Legal } = locale(lang)
    const all = JSON.stringify(Legal).toLowerCase()
    expect(all).not.toContain('bcrypt')
    // le texte garde la promesse, sans le nom de l'algorithme
    const accountFields = Legal.Privacy.Section3.AccountFields.map(f => `${f.Label} ${f.Text}`).join(' ')
    expect(accountFields).toMatch(lang === 'fr' ? /haché\), jamais en clair/ : /hashed\), never in plain text/)
    expect(Legal.Privacy.Section8.Measures.join(' ')).toMatch(lang === 'fr' ? /Mots de passe hachés \(jamais stockés en clair/ : /Passwords hashed \(never stored in plain text/)
  })
})
