// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/*
  Garde-fou — le texte du Registre des mines dans la politique (validé par Greg le 06/10/2026,
  admin/content/policy-registre-mines-draft.md). Deux formulations sont des ENGAGEMENTS, pas du
  style : « le lien avec votre compte est supprimé » (pseudonymisation, jamais « anonymisé » comme
  promesse) et « aucun relevé ne peut être effacé » (ajout seul, brief Registre §3). Et l'anglais
  porte les termes du JEU relevés par Greg (admin/jeu/mines.md §7.12), jamais une traduction.

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

  it('le comte n’y accède jamais, dans les deux langues', () => {
    expect(privacy('fr').Section6.MineRegistryHolders).toContain('Jamais le comte')
    expect(privacy('en').Section6.MineRegistryHolders).toContain('Never the count')
  })

  it('EN : termes du jeu relevés par Greg, jamais inventés', () => {
    const text = all(privacy('en').Section3) + all(privacy('en').Section6)
    expect(text).toContain('Management of the mines')
    expect(text).toContain('deterioration threshold')
    expect(text).toContain('Mines Superintendent')
    expect(text).not.toMatch(/Mine management|breaking threshold|mines commissioner/i)
  })
})
