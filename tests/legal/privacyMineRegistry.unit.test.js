// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/*
  Garde-fou — le texte du Registre des mines dans la politique (validé le 06/10/2026). Deux formulations sont des ENGAGEMENTS, pas du
  style : « le lien avec votre compte est supprimé » (pseudonymisation, jamais « anonymisé » comme
  promesse) et « aucun relevé ne peut être effacé » (ajout seul, brief Registre §3). Et l'anglais
  porte les termes du JEU relevés par Greg, jamais une traduction.

  Lecture par fs : un import de fr.json est précompilé par le plugin vue-i18n et rend undefined.
*/

const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const privacy = lang => JSON.parse(readFileSync(resolve(localesDir, `${lang}.json`), 'utf-8')).Legal.Privacy
const all = node => (typeof node === 'string' ? [node] : Object.values(node ?? {}).flatMap(all)).join('\n')

describe('Politique — Registre des mines', () => {
  it.each(['fr', 'en'])('%s : les trois insertions existent (§3, §5, §6)', (lang) => {
    const p = privacy(lang)
    expect(p.Section3.MineRegistryIntro).toBeTruthy()
    expect(p.Section3.MineRegistryFields).toHaveLength(4)
    expect(p.Section5.MineRegistry).toBeTruthy()
    expect(p.Section6.MineRegistryHolders).toBeTruthy()
  })

  it('FR : les deux engagements sont écrits tels quels', () => {
    const { Section5 } = privacy('fr')
    expect(Section5.MineRegistry).toContain('le lien avec votre compte est supprimé')
    expect(Section5.MineRegistry).toContain('aucun relevé ne peut être effacé')
    expect(Section5.MineRegistry).toContain('sans limite de durée')
  })

  it('EN : les deux engagements sont écrits tels quels', () => {
    const { Section5 } = privacy('en')
    expect(Section5.MineRegistry).toContain('its link to your account is removed')
    expect(Section5.MineRegistry).toContain('no report can be deleted')
    expect(Section5.MineRegistry).toContain('no time limit')
  })

  // Greg, 08/10/2026 : le dirigeant (comte, duc…) CONSULTE le registre de sa province — il en est le
  // chef ; l'écriture reste au commissaire aux mines et au bailli. Greg, 15/10/2026 : le commissaire au
  // commerce le CONSULTE aussi. Les autres conseillers, jamais.
  it('le commissaire au commerce et le dirigeant consultent, les autres conseillers jamais, dans les deux langues', () => {
    expect(privacy('fr').Section6.MineRegistryHolders).toContain('son commissaire au commerce et son dirigeant (comte, duc…), qui peuvent le consulter')
    expect(privacy('fr').Section6.MineRegistryHolders).toContain('Jamais les autres conseillers')
    expect(privacy('fr').Section6.MineRegistryHolders).not.toContain('Jamais le comte')
    expect(privacy('en').Section6.MineRegistryHolders).toContain('its Trade Minister and its leader (count, duke…), who may read it')
    expect(privacy('en').Section6.MineRegistryHolders).toContain('Never the other councillors')
    expect(privacy('en').Section6.MineRegistryHolders).not.toContain('Never the count')
  })

  it('EN : termes du jeu relevés par Greg, jamais inventés', () => {
    const text = all(privacy('en').Section3) + all(privacy('en').Section6)
    expect(text).toContain('Management of the mines')
    expect(text).toContain('deterioration threshold')
    expect(text).toContain('Mines Superintendent')
    expect(text).not.toMatch(/Mine management|breaking threshold|mines commissioner/i)
  })

  // Greg, 16/10/2026 : les prix de la province.
  it.each(['fr', 'en'])('%s : les insertions des prix existent (§3, §5, §6)', (lang) => {
    const p = privacy(lang)
    expect(p.Section3.MinePricesIntro).toBeTruthy()
    expect(p.Section3.MinePricesFields).toHaveLength(3)
    expect(p.Section5.MinePrices).toBeTruthy()
    expect(p.Section6.MinePricesHolders).toBeTruthy()
  })

  it('les engagements sur les prix sont écrits tels quels, dans les deux langues', () => {
    const fr = privacy('fr'), en = privacy('en')
    expect(fr.Section5.MinePrices).toContain('sans limite de durée')
    expect(fr.Section5.MinePrices).toContain('Vous pouvez corriger un prix pendant votre mandat ; à son terme, il est verrouillé')
    expect(fr.Section5.MinePrices).not.toContain('7 jours')
    expect(fr.Section5.MinePrices).toContain('l\'ancienne valeur n\'est pas conservée')
    expect(fr.Section5.MinePrices).toContain('le lien avec votre compte est supprimé')
    expect(fr.Section6.MinePricesHolders).toContain('une fois par jour')
    expect(en.Section5.MinePrices).toContain('no time limit')
    expect(en.Section5.MinePrices).toContain('You can correct a price during your term; once it ends, the price is locked')
    expect(en.Section5.MinePrices).not.toContain('7 days')
    expect(en.Section5.MinePrices).toContain('the previous value is not kept')
    expect(en.Section5.MinePrices).toContain('their link to your account is removed')
    expect(en.Section6.MinePricesHolders).toContain('once a day')
  })

  // 27/11/2026 : un conseiller reste en poste jusqu'à son successeur, 30 jours au plus, sans pouvoir modifier un prix.
  it.each([
    ['fr', ['tant qu\'aucun successeur n\'est connu de l\'Office, pendant 30 jours au plus', 'ne peut plus ajouter ni corriger un prix']],
    ['en', ['as long as the Office knows no successor, for 30 days at most', 'can no longer add or correct a price']],
  ])('%s : l\'attente du successeur est dite au §6', (lang, sentences) => {
    for (const sentence of sentences) expect(privacy(lang).Section6.CouncilOffices).toContain(sentence)
  })

  it('la ligne des prix du relevé ne dit plus que le joueur les renseigne', () => {
    expect(privacy('fr').Section3.MineRegistryFields[2].Text).toContain('table des prix de la province')
    expect(privacy('en').Section3.MineRegistryFields[2].Text).toContain("province's price table")
  })

  // Bilans de mandat passés (22/11/2026) : un ancien titulaire relit, en lecture seule, les relevés de
  // la période de SON mandat — jamais ceux de ses successeurs. Texte validé par Greg et Cowork, NON substantiel (pas de policy:notify). Le texte passe
  // AVANT le code.
  it.each([
    ['fr', 'les anciens titulaires de ces postes, qui peuvent relire les relevés de la période de leur mandat, sans limite de durée, tant que ces relevés existent'],
    ['en', 'the former holders of these offices, who may re-read the reports from the period of their term, with no time limit, for as long as those reports exist'],
  ])('%s : les anciens titulaires relisent les relevés de leur période, sans limite de durée (§6)', (lang, sentence) => {
    const holders = privacy(lang).Section6.MineRegistryHolders
    expect(holders).toContain(sentence)
    // les anciens titulaires ne lisent pas le travail de leurs successeurs : la phrase borne à « leur mandat »
    expect(holders).not.toMatch(lang === 'fr' ? /tous les relevés/ : /all the reports/)
  })

  it.each([
    ['fr', 'Une fois leur mandat terminé, les anciens titulaires de ces postes peuvent relire, en lecture seule, les relevés de la période de leur mandat'],
    ['en', 'Once their term has ended, the former holders of these offices may re-read, read-only, the reports from the period of their term'],
  ])('%s : « Vos données » le dit aussi, en lecture seule', (lang, sentence) => {
    const { Purpose } = JSON.parse(readFileSync(resolve(localesDir, `${lang}.json`), 'utf-8')).Legal.Data.MineRegistry
    expect(Purpose).toContain(sentence)
  })
})
