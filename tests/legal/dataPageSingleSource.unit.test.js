// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DATA_PAGE_SECTIONS } from '../../src/modules/dataPageSections'

/*
  Garde-fou — « Vos données » et la politique de confidentialité ne disent jamais deux fois la même
  chose (brief admin/content/brief-pages-donnees-joueur.md §3 : « aucun fait n'est écrit aux deux
  endroits » — celui qu'on ne relit pas deviendra faux).

  Et deux phrases qui ne se simplifient pas : les données du Bilan et du Guet ne sont pas « rien »,
  elles sont dans le navigateur (relevé par Claude Code, fil pages-donnees-joueur, R3).

  Lecture par fs : un import de fr.json est précompilé par le plugin vue-i18n et rend undefined.
*/

const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const legal = lang => JSON.parse(readFileSync(resolve(localesDir, `${lang}.json`), 'utf-8')).Legal

/** Toutes les chaînes d'un sous-arbre de locale. */
function strings(node) {
  if (typeof node === 'string') return [node]
  return Object.values(node ?? {}).flatMap(strings)
}

describe('Vos données / politique — une seule source par fait', () => {
  it.each(['fr', 'en'])('%s : aucune phrase de la page « Vos données » ne figure aussi dans la politique', (lang) => {
    const { Data, Privacy } = legal(lang)
    const policy = strings(Privacy).join('\n')
    // Les phrases longues portent les faits ; les titres courts (noms d'outil) peuvent se répéter.
    const facts = strings(Data).filter(s => s.length > 60)

    for (const fact of facts) {
      expect(policy.includes(fact), fact.slice(0, 80)).toBe(false)
    }
  })

  // Version B (Greg, 06/10/2026 ; fil pages-donnees-joueur, 06 et 07) : les énumérations de la
  // politique ne perdent JAMAIS une ligne — « tout est effacé SAUF l'historique des postes » se lit
  // avec « suppression immédiate et définitive », et « Personne d'autre en dehors de ce qui
  // précède » ne tient qu'avec les joueurs de la province au-dessus. La page y renvoie.
  it.each(['fr', 'en'])('%s : la politique garde toutes ses lignes, la page ne fait qu’y renvoyer', (lang) => {
    const { Privacy } = legal(lang)
    expect(Privacy.Section3.CharacterFields).toHaveLength(4)
    expect(Privacy.Section4.Rows).toHaveLength(7)
    expect(Privacy.Section5.Mandates).toBeTruthy()
    expect(Privacy.Section6.ProvincePlayers).toBeTruthy()
    expect(Privacy.Section5.Tools).toBeUndefined()
    expect(Privacy.Section6.Tools).toBeUndefined()
  })

  it.each(['fr', 'en'])('%s : chaque outil de la page a son titre', (lang) => {
    const { Data } = legal(lang)
    for (const section of DATA_PAGE_SECTIONS) {
      expect(Data[section.key]?.Title, section.key).toBeTruthy()
    }
  })

  it('le Bilan et le Guet disent « rien sur nos serveurs », jamais « rien » tout court', () => {
    const { Data } = legal('fr')
    for (const tool of ['MinesReport', 'Watch']) {
      expect(Data[tool].Stored, tool).toContain('Rien n\'est enregistré sur nos serveurs')
      expect(Data[tool].Stored, tool).toContain('votre navigateur garde')
    }
  })
})
