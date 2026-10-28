// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/*
  Garde-fou — le texte de Décode le code dans la politique et dans la politique des cookies
  (admin/content/policy-coffres-scelles.md, Cowork, 28/10/2026). Rien ne se déploie avant que ce
  texte soit en ligne (D40). Les formulations qui suivent sont des ENGAGEMENTS : la durée de
  conservation, l'effacement à la clôture, ce que la page figée ne montre jamais.

  Lecture par fs : un import de fr.json est précompilé par le plugin vue-i18n et rend undefined.
*/

const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const locale = lang => JSON.parse(readFileSync(resolve(localesDir, `${lang}.json`), 'utf-8')).Legal

describe('Politique — Décode le code', () => {
  it.each(['fr', 'en'])('%s : les trois insertions existent (§3, §5, §6)', (lang) => {
    const { Section3, Section5, Section6 } = locale(lang).Privacy
    expect(Section3.AnimDecodeIntro).toBeTruthy()
    expect(Section3.AnimDecodeFields).toHaveLength(4)
    expect(Section3.AnimDecodeNote).toBeTruthy()
    expect(Section5.AnimDecode).toContain('{email}')
    expect(Section6.AnimDecodeHolders).toBeTruthy()
  })

  it('FR : les engagements sont écrits tels quels', () => {
    const { Section5, Section6 } = locale('fr').Privacy
    expect(Section5.AnimDecode).toContain('supprime l\'activité avec eux')
    expect(Section5.AnimDecode).toContain('30 jours')
    expect(Section5.AnimDecode).toContain('5 ans après la clôture')
    expect(Section5.AnimDecode).toContain('jamais les propositions reçues')
    expect(Section5.AnimDecode).toContain('l\'empreinte de votre connexion, votre adresse email, votre mot de passe')
    expect(Section6.AnimDecodeHolders).toContain('Votre mot de passe n\'est jamais visible de personne')
  })

  it('EN : les engagements sont écrits tels quels', () => {
    const { Section5, Section6 } = locale('en').Privacy
    expect(Section5.AnimDecode).toContain('deletes the activity with them')
    expect(Section5.AnimDecode).toContain('30 days')
    expect(Section5.AnimDecode).toContain('5 years after closing')
    expect(Section5.AnimDecode).toContain('never the proposals received')
    expect(Section5.AnimDecode).toContain('the fingerprint of your connection, your email address, your password')
    expect(Section6.AnimDecodeHolders).toContain('Your password is never visible to anyone')
  })

  it.each(['fr', 'en'])('%s : la politique des cookies nomme l’outil et l’adresse mémorisée', (lang) => {
    const { Purpose, Data } = locale(lang).Cookies.Section3.Preferences
    const tool = lang === 'fr' ? 'Décode le code' : 'Crack the Code'
    expect(Purpose).toContain(tool)
    expect(Data).toContain(tool)
  })
})
