// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/*
  Textes de présentation du Registre des mines (lot 3 des prix, brief admin/content/brief-prix-registre.md) :
  l'aide dit ce que le module permet de FAIRE — prix, semaines, export. Garde-fou : une aide qui cite un bouton doit le
  citer TEL QU'IL S'AFFICHE. Lecture par fs : un import de fr.json est précompilé par le plugin vue-i18n (undefined en test).
*/
const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const locale = lang => JSON.parse(readFileSync(resolve(localesDir, `${lang}.json`), 'utf-8')).EconomyMines
const steps = (page, prefix, count) => Array.from({ length: count }, (_, i) => page[`${prefix}${i + 1}`])

describe.each(['fr', 'en'])('aide du registre — %s', (lang) => {
  const em = locale(lang)
  const page = em.RegistryPage

  it('neuf étapes, toutes écrites', () => {
    const list = steps(page, 'HelpStep', 9)
    expect(list.every(s => typeof s === 'string' && s.length > 20)).toBe(true)
    expect(page.HelpStep10).toBeUndefined()
  })

  it('cite les boutons des prix et de l\'export tels qu\'ils s\'affichent', () => {
    const prices = page.HelpStep8
    expect(prices).toContain(page.Prices.ManageButton)       // « Gérer les prix »
    expect(prices).toContain(page.Prices.PageTitleShort)     // « Historique des prix »
    expect(page.HelpStep9).toContain(page.Export.Button)     // « Confier au scribe »
  })

  it('l\'étape du bilan en cours mentionne la navigation et son retour à la période en cours', () => {
    expect(page.HelpStep2).toContain(page.Navigation.CurrentPeriod)
  })

  it('l\'aide ne parle plus d\'une lecture « de haut en bas » : la page est en deux colonnes', () => {
    expect(page.HelpOverview).not.toMatch(/haut en bas|top to bottom/)
  })

  it('l\'aide de la plaque ne demande plus de saisir les prix : ils viennent de la table de la province', () => {
    expect(em.Registry.HelpStep1).not.toMatch(/vérifiez les prix|check the prices/i)
    expect(em.Registry.HelpOverview).toMatch(/en vigueur|in force/)
  })

  it('le Bilan public dit que les prix d\'un gérant du registre sont en lecture seule', () => {
    expect(em.HelpStep5).toMatch(/lecture seule|read-only/)
  })
})

it('FR et EN ont les mêmes étapes', () => {
  for (const [prefix, from] of [['HelpStep', 'RegistryPage'], ['HelpStep', 'Registry']]) {
    const fr = Object.keys(locale('fr')[from]).filter(k => k.startsWith(prefix)).sort()
    const en = Object.keys(locale('en')[from]).filter(k => k.startsWith(prefix)).sort()
    expect(fr).toEqual(en)
  }
})
