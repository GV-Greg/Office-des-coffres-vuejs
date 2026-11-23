// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DATA_PAGE_SECTIONS } from '../../src/modules/dataPageSections.js'

/*
  Garde-fou — le Relevé de guet devient le point de collage unique (fil module-securite 12 à 14, texte validé par Greg le 22/11/2026, non substantiel) :
  cinq types de collage, le navigateur ne garde que le DERNIER collage de chaque type, sans historique, et ces textes peuvent citer des pseudos de tiers.
  Le texte légal passe AVANT le code (PR 3-2). Lecture par fs : un import de fr.json est précompilé et rend undefined.
*/
const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const locale = lang => JSON.parse(readFileSync(resolve(localesDir, `${lang}.json`), 'utf-8')).Legal

describe('Politique cookies et « Vos données » — Relevé de guet (collage unique)', () => {
  it.each([
    ['fr', ['liste des villageois', 'visions', 'armées', 'groupes', 'contrôle de la zone', 'dernier collage de chaque type', 'sans historique', 'noms de personnages d\'autres joueurs']],
    ['en', ['villager list', 'visions', 'armies', 'groups', 'control of the area', 'last paste of each type', 'no history', 'other players\' characters']],
  ])('%s : les cookies de préférences disent ce que le Relevé garde', (lang, terms) => {
    const data = locale(lang).Cookies.Section3.Preferences.Data
    for (const term of terms) expect(data).toContain(term)
  })

  it.each([
    ['fr', 'dernier collage de chaque type', 'remplacé à chaque nouveau collage', 'Sans ce consentement, rien n\'est gardé', 'Registre de douane'],
    ['en', 'last paste of each type', 'replaced at each new paste', 'Without that consent, nothing is kept', 'Customs Register'],
  ])('%s : « Vos données » ne dit plus « deux listes » et annonce l\'inscription au Registre pour qui a un compte et un rôle', (lang, ...terms) => {
    const watch = locale(lang).Data.Watch
    for (const term of terms) expect(`${watch.Stored} ${watch.Audience}`).toContain(term)
    expect(`${watch.Purpose} ${watch.Input}`.toLowerCase()).not.toMatch(/deux listes|two lists/)
    // sans compte, rien n'est enregistré sur nos serveurs : la promesse reste écrite
    expect(watch.Stored).toMatch(lang === 'fr' ? /Sans compte, rien n'est enregistré sur nos serveurs/ : /Without an account, nothing is stored on our servers/)
  })

  /*
    Pseudos en transit (fil module-securite 15 et 16, B retenue par Greg le 22/11/2026, non substantiel, sans policy:notify) :
    avec un titre de sécurité, la génération du relevé (bouton « Confier au scribe ») envoie au serveur les PSEUDOS collés (jamais un texte) pour les colorer ;
    le serveur ne les écrit pas (CustomsPreviewTest). 🔴 « ni journalisés » est INTERDIT tant que les journaux de l'hébergeur ne sont pas vérifiés.
  */
  it.each([
    ['fr', /pseudos collés[^.]*sont envoyés au serveur pour afficher les marques des listes rouge et verte ; ils ne sont pas enregistrés/, /journalis/i],
    ['en', /nicknames[^.]*are sent to the server to show the marks of the red and green lists; they are not stored/, /logged/i],
  ])('%s : « Vos données » dit que les pseudos partent au serveur sans être enregistrés — et ne promet pas plus', (lang, sentence, forbidden) => {
    const { Watch, Security } = locale(lang).Data
    expect(Watch.Stored).toMatch(sentence)
    expect(Security.Stored).toMatch(sentence)
    // la phrase « ne quittent pas votre navigateur » ne doit plus être absolue
    expect(Watch.Audience).toMatch(lang === 'fr' ? /sauf les pseudos envoyés pour les marques des listes/ : /except the nicknames sent for the list marks/)
    expect(`${Watch.Stored} ${Watch.Audience} ${Security.Stored}`).not.toMatch(forbidden)
  })

  it('le Relevé reste un outil SANS accès : la page « Vos données » n\'exige pas de compte pour lui', () => {
    expect(DATA_PAGE_SECTIONS.find(s => s.id === 'guet')).toMatchObject({ key: 'Watch', access: 'none' })
  })
})
