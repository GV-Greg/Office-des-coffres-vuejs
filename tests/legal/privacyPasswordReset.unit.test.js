// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/*
  Garde-fou — « Mot de passe oublié » dans la politique (§4 et §5). Texte proposé par Claude Code le 24/11/2026 (fil admin/echanges/mot-de-passe-oublie
  01 et 02), VALIDÉ par Greg (03, toutes les recommandations) : modification NON substantielle, aucun email aux comptes. Les engagements ci-dessous sont
  tenus par le code backend livré après ce texte : jeton valable 60 minutes, haché, effacé à l'usage / à l'expiration (nettoyage quotidien `auth:clear-resets`)
  / à la suppression du compte ; tous les appareils déconnectés ; email d'avis du changement. Si l'un d'eux change, ce texte change AVANT.

  Lecture par fs : un import de fr.json est précompilé par le plugin vue-i18n et rend undefined.
*/

const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const locale = lang => JSON.parse(readFileSync(resolve(localesDir, `${lang}.json`), 'utf-8'))

describe('Politique — réinitialisation du mot de passe', () => {
  it.each(['fr', 'en'])('%s : une ligne du §4 (jeton haché, finalité, base légale) et un paragraphe du §5', (lang) => {
    const { Section4, Section5 } = locale(lang).Legal.Privacy
    const row = Section4.Rows.find(r => /réinitialisation|reset/i.test(r.Data))

    expect(row).toBeTruthy()
    expect(row.Data).toMatch(/haché|hashed/i)
    expect(row.Purpose).toBeTruthy()
    expect(row.LegalBasis).toBeTruthy()
    expect(Section5.PasswordReset).toBeTruthy()
  })

  it('FR : les engagements du §5 sont écrits (60 minutes, haché, effacé, nettoyage quotidien, déconnexion, email d\'avis)', () => {
    const text = locale('fr').Legal.Privacy.Section5.PasswordReset

    for (const term of ['conservé haché', '60 minutes au plus', 'nettoyage quotidien', 'suppression de votre compte', 'vous déconnecte de tous vos appareils', 'un email vous prévient du changement']) {
      expect(text).toContain(term)
    }
  })

  it('EN : the commitments of §5 are written', () => {
    const text = locale('en').Legal.Privacy.Section5.PasswordReset

    for (const term of ['kept hashed', '60 minutes at most', 'daily clean-up', 'your account is deleted', 'signs you out of all your devices', 'an email warns you of the change']) {
      expect(text).toContain(term)
    }
  })

  it('le §3 annonce déjà l\'email de réinitialisation (rien de nouveau côté destinataires)', () => {
    expect(locale('fr').Legal.Privacy.Section3.AccountFields[0].Text).toContain('réinitialisation de mot de passe')
  })
})
