// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DATA_PAGE_SECTIONS } from '../../src/modules/dataPageSections.js'

/*
  La Balance des stocks dans « Vos données, outil par outil » (fil inventaire-comparaison, 03 et 04, validé par Cowork le 19/11/2026).
  L'outil ne stocke RIEN : ni serveur, ni navigateur. Cette phrase est plus forte que celle du Bilan et du Guet (qui gardent un cache avec
  consentement) : elle doit rester vraie — voir aussi `tests/eco/EconomyInventoryBalance.test.js` (aucune écriture pendant un collage).
  Lecture par fs : un import de fr.json est précompilé par le plugin vue-i18n et rend undefined.
*/
const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const legal = lang => JSON.parse(readFileSync(resolve(localesDir, `${lang}.json`), 'utf-8')).Legal

describe('La Balance des stocks — texte légal', () => {
  it('a sa propre section, juste après la Gestion des stocks, sans compte requis', () => {
    const keys = DATA_PAGE_SECTIONS.map(s => s.key)
    expect(keys.indexOf('InventoryBalance')).toBe(keys.indexOf('Inventory') + 1)
    expect(DATA_PAGE_SECTIONS.find(s => s.key === 'InventoryBalance')).toEqual({ id: 'balance-des-stocks', key: 'InventoryBalance', access: 'none' })
  })

  it.each([
    ['fr', "Rien n'est enregistré, ni sur nos serveurs ni dans votre navigateur"],
    ['en', 'Nothing is stored, neither on our servers nor in your browser'],
  ])('%s : dit que rien n\'est enregistré, ni serveur ni navigateur', (lang, sentence) => {
    const section = legal(lang).Data.InventoryBalance
    expect(section.Title).toBeTruthy()
    expect(section.Stored).toContain(sentence)
    // Pas de durée ni de suppression de compte : sans objet pour un outil qui ne garde rien.
    expect(section.Duration).toBeUndefined()
    expect(section.Deletion).toBeUndefined()
  })

  it('le nom anglais suit « Stock Management » : « The Stock Balance »', () => {
    expect(legal('en').Data.InventoryBalance.Title).toBe('The Stock Balance')
  })
})
