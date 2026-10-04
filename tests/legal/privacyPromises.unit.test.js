// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/*
  Garde-fou — les promesses du §5 de /legal/privacy, au mot près.

  Le backend APPLIQUE ces règles (config/accounts.php, accounts:purge : suppression à 1 an sans
  connexion, comptes non confirmés à 30 jours et au plus tôt une semaine après un rappel). Le texte
  est ce que le joueur lit avant de perdre son compte : les chaînes ont été validées par Greg le
  04/10/2026 (admin/echanges/politique-promesses/02-reponse-cowork.md) et ne se reformulent pas en
  passant. Changer une durée ici sans changer config/accounts.php (ou l'inverse) romprait une
  promesse ; et toute modification substantielle se notifie (policy:notify, §10).

  Lecture par fs : un import de fr.json est précompilé par le plugin vue-i18n et rend undefined.
*/

const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const section5 = (lang) => JSON.parse(readFileSync(resolve(localesDir, `${lang}.json`), 'utf-8')).Legal.Privacy.Section5

const PROMISES = {
  fr: {
    InactiveAccount: "Compte inactif : après 1 an sans connexion, votre compte peut être supprimé automatiquement, après un email de préavis à l'adresse déclarée.",
    UnverifiedAccount: "Compte non confirmé : si l'adresse email n'est pas confirmée, le compte est supprimé au bout de 30 jours, et au plus tôt une semaine après un rappel envoyé à cette adresse.",
  },
  en: {
    InactiveAccount: 'Inactive account: after 1 year without login, your account may be automatically deleted, following a notice email to the declared address.',
    UnverifiedAccount: 'Unverified account: if the email address is not confirmed, the account is deleted after 30 days, and no sooner than one week after a reminder sent to that address.',
  },
}

describe('Politique de confidentialité §5 — promesses appliquées par accounts:purge', () => {
  it.each(['fr', 'en'])('%s : les deux chaînes validées par Greg, au mot près', (lang) => {
    for (const [key, text] of Object.entries(PROMISES[lang])) {
      expect(section5(lang)[key], key).toBe(text)
    }
  })

  it('la vue rend la ligne des comptes non confirmés', () => {
    const source = readFileSync(resolve(localesDir, '../views/legal/PrivacyPolicyView.vue'), 'utf-8')
    expect(source).toContain("t('Legal.Privacy.Section5.UnverifiedAccount')")
  })
})
