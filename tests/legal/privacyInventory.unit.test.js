// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DATA_PAGE_SECTIONS } from '../../src/modules/dataPageSections.js'

/*
  Garde-fou — la « Gestion des stocks » (les inventaires, en base pour un joueur connecté) dans la politique, « Vos données » et les
  cookies. Texte de Cowork (fil admin/echanges/inventaire-scopes/02-reponse-cowork.md), validé par Greg le 11/11/2026 ; la phrase
  d'accès de l'éditeur est la « formulation retenue » de admin/strategies/donnees-utilisateur.md §5bis. Les formulations qui suivent
  sont des ENGAGEMENTS : un seul exemplaire remplacé, historique de la province, chiffrement, qui lit, ce qui part avec le personnage.
  Les termes anglais sont ceux du site (« Trade Minister », pas « trade commissioner » comme dans le brouillon de Cowork).

  Lecture par fs : un import de fr.json est précompilé par le plugin vue-i18n et rend undefined.
*/

const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const locale = lang => JSON.parse(readFileSync(resolve(localesDir, `${lang}.json`), 'utf-8'))
const fieldsText = fields => fields.map(f => `${f.Label} ${f.Text}`).join(' ')

describe('Politique — Bilan des stocks', () => {
  it.each(['fr', 'en'])('%s : les insertions existent (§3, §5, §6)', (lang) => {
    const { Section3, Section5, Section6 } = locale(lang).Legal.Privacy
    expect(Section3.InventoryIntro).toBeTruthy()
    expect(Section3.InventoryFields).toHaveLength(5)
    expect(Section3.InventoryNote).toBeTruthy()
    expect(Section5.Inventory).toBeTruthy()
    expect(Section6.InventoryHolders).toBeTruthy()
  })

  it('FR : les engagements du §3 sont écrits tels quels', () => {
    const { Section3 } = locale('fr').Legal.Privacy
    const all = `${Section3.InventoryIntro} ${fieldsText(Section3.InventoryFields)} ${Section3.InventoryNote}`
    for (const term of ['Bilan des stocks', 'chiffré', 'commissaire au commerce', 'historique', 'un seul exemplaire', 'supprimé avec votre personnage', 'transmis à votre successeur', 'maire en fonction'])
      expect(all).toContain(term)
    expect(Section3.InventoryIntro).toContain('sans compte, ils restent dans votre navigateur')
    // les réglages ne sont PAS chiffrés : le texte le dit, il ne laisse pas croire le contraire
    expect(fieldsText(Section3.InventoryFields)).toContain('Ils ne sont pas chiffrés')
  })

  it('EN : les engagements du §3 sont écrits tels quels', () => {
    const { Section3 } = locale('en').Legal.Privacy
    const all = `${Section3.InventoryIntro} ${fieldsText(Section3.InventoryFields)} ${Section3.InventoryNote}`.toLowerCase()
    for (const term of ['stock report', 'encrypted', 'trade minister', 'history', 'a single copy', 'deleted with your character', 'handed on to your successor', 'acting mayor'])
      expect(all).toContain(term)
    expect(all).toContain('without an account, they stay in your browser')
  })

  // Registre des stocks (fil admin/echanges/registre-stocks, texte de Cowork du 20/11/2026) : instantanés datés de la ville et de la
  // province, et pseudo du rédacteur remplacé visible dans l'historique. Rien sur le niveau personnel (reporté) ni sur le bailli.
  it.each([
    ['fr', 'Registre des stocks', 'instantané daté', 'instantanés datés', 'le pseudo du rédacteur précédent reste visible'],
    ['en', 'Stock Registry', 'dated snapshot', 'dated snapshots', 'the previous author\'s character name remains visible'],
  ])('%s : le Registre des stocks (instantanés ville et province, pseudo du rédacteur remplacé) est écrit au §3', (lang, name, citySnapshot, provinceSnapshots, replacedAuthor) => {
    const { Section3 } = locale(lang).Legal.Privacy
    const [, , personal, city, province] = Section3.InventoryFields
    expect(city.Text).toContain(name)
    expect(city.Text).toContain(citySnapshot)
    expect(province.Text).toContain(name)
    expect(province.Text).toContain(provinceSnapshots)
    expect(Section3.InventoryNote).toContain(replacedAuthor)
    // le niveau personnel reste « un seul exemplaire » : aucun historique personnel n'est promis (Q4 du fil, reporté)
    expect(personal.Text).not.toContain(name)
    // les droits ne changent pas : le bailli n'écrit pas (Q2 du fil)
    expect(`${city.Text} ${province.Text} ${Section3.InventoryNote}`.toLowerCase()).not.toMatch(/bailli|bailiff/)
  })

  it.each([
    ['fr', 'Aucune interface d\'administration du site ne permet de consulter vos inventaires ni vos réglages', 'vérifiée automatiquement', 'accès technique à l\'hébergement', 's\'engage à ne pas l\'utiliser'],
    ['en', 'No site administration interface lets anyone view your inventories or your settings', 'checked automatically', 'technical access to the hosting', 'undertakes not to use it'],
  ])('%s : la phrase d\'accès de l\'éditeur est la formulation retenue (§5bis), jamais « impossible techniquement »', (lang, ...terms) => {
    const note = locale(lang).Legal.Privacy.Section3.InventoryNote
    for (const term of terms) expect(note).toContain(term)
    expect(note.toLowerCase()).not.toMatch(/techniquement (impossible|inaccessible)|cannot technically|technically impossible/)
  })

  // Registre des stocks (fil registre-stocks R1) : l'historique de la VILLE a la même durée que celui de la province, dite au §5.
  it.each([
    ['fr', 'une province ou d\'une ville est conservé sans limite de durée', 'mémoire de gestion du poste'],
    ['en', 'province\'s or city\'s inventory history is kept with no time limit', 'office\'s management memory'],
  ])('%s : le §5 dit la durée de l\'historique de la ville comme celle de la province', (lang, duration, memory) => {
    const { Section5 } = locale(lang).Legal.Privacy
    expect(Section5.Inventory).toContain(duration)
    expect(Section5.Inventory).toContain(memory)
  })

  // R2 : la ville garde « un seul exemplaire » du DERNIER COLLAGE ; le registre est une inscription volontaire, jamais automatique.
  it.each([
    ['fr', 'un seul exemplaire du dernier collage', 'à votre initiative'],
    ['en', 'a single copy of the last paste', 'at your initiative'],
  ])('%s : l\'inventaire municipal distingue le dernier collage du registre, inscrit à l\'initiative du maire', (lang, lastPaste, initiative) => {
    const city = locale(lang).Legal.Privacy.Section3.InventoryFields[3].Text
    expect(city).toContain(lastPaste)
    expect(city).toContain(initiative)
  })

  it('FR : la durée (§5) et les destinataires (§6) sont écrits tels quels', () => {
    const { Section5, Section6 } = locale('fr').Legal.Privacy
    for (const term of ['tant que votre personnage existe', 'supprimés avec lui', 'sans limite de durée', 'mémoire de gestion', 'le lien est supprimé'])
      expect(Section5.Inventory).toContain(term)
    for (const term of ['vous seul', 'le maire en fonction', 'le commissaire au commerce en fonction', 'le dirigeant', 'lecture seule', 'après la suppression de votre compte', 'aucune interface d\'administration'])
      expect(Section6.InventoryHolders).toContain(term)
  })

  it('EN : la durée (§5) et les destinataires (§6) sont écrits tels quels', () => {
    const { Section5, Section6 } = locale('en').Legal.Privacy
    for (const term of ['as long as your character exists', 'deleted with it', 'no time limit', 'management memory', 'the link is removed'])
      expect(Section5.Inventory).toContain(term)
    for (const term of ['you alone', 'acting mayor', 'acting Trade Minister', 'leader', 'read-only', 'after your account is deleted', 'no site administration interface'])
      expect(Section6.InventoryHolders).toContain(term)
  })
})

describe('« Vos données » — Bilan des stocks', () => {
  it('l\'outil figure à la liste unique, sans compte requis', () => {
    expect(DATA_PAGE_SECTIONS.find(s => s.key === 'Inventory')).toEqual({ id: 'gestion-des-stocks', key: 'Inventory', access: 'none' })
  })

  it.each(['fr', 'en'])('%s : titre, usage, contenu, et ce qui part avec le personnage (export art. 20)', (lang) => {
    const { Inventory } = locale(lang).Legal.Data
    expect(Inventory.Title).toBe(lang === 'fr' ? 'Bilan des stocks' : 'Stock Report')
    expect(Inventory.Purpose).toBeTruthy()
    expect(Inventory.Input).toBeTruthy()
    expect(Inventory.Deletion).toMatch(lang === 'fr' ? /article 20/ : /Article 20/)
    expect(Inventory.Deletion).toContain('export')
    expect(Inventory.Deletion).toContain(lang === 'fr' ? 'supprimés avec votre personnage' : 'deleted with your character')
  })
})

describe('Cookies — Préférences nomment le Bilan des stocks', () => {
  it.each([['fr', 'Bilan des stocks'], ['en', 'Stock Report']])('%s : finalité et données', (lang, name) => {
    const pref = locale(lang).Legal.Cookies.Section3.Preferences
    expect(pref.Purpose).toContain(name)
    expect(pref.Data).toContain(name)
  })
})

describe('Renommage — le module s\'appelle Bilan des stocks', () => {
  it.each([['fr', 'Bilan des stocks'], ['en', 'Stock Report']])('%s : menu d\'Économie, carte, titre de page', (lang, name) => {
    const d = locale(lang)
    expect(d.Economy.InventoryLink).toBe(name)
    expect(d.Economy.Cards.inventory.Name).toBe(name)
    expect(d.EconomyInventory.PageTitle).toBe(name)
    expect(d.EconomyInventory.HelpTitle).toContain(name)
  })
})
