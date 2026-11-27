// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/*
  Garde-fou — le texte de l'historique des naissances (validé par Greg le 27/11/2026). Les engagements : chiffrement des
  naissances, nom non montré aux autres lecteurs, retrait le jour même seulement, prix verrouillés au terme, attente de 30 jours
  au plus. Ni cheptel ni ventes : ils ne sont pas enregistrés.
*/
const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const legal = lang => JSON.parse(readFileSync(resolve(localesDir, `${lang}.json`), 'utf-8')).Legal

describe('Politique — historique des naissances', () => {
  it.each(['fr', 'en'])('%s : les insertions existent (§3, §5, §6) et les deux sections de « Vos données »', (lang) => {
    const { Privacy, Data } = legal(lang)
    expect(Privacy.Section3.BirthIntro).toBeTruthy()
    expect(Privacy.Section3.BirthFields).toHaveLength(4)
    expect(Privacy.Section5.Births).toBeTruthy()
    expect(Privacy.Section6.BirthsHolders).toBeTruthy()
    expect(Data.BirthRegister.Stored).toBeTruthy()
    expect(Data.BirthHistory.Deletion).toBeTruthy()
  })

  it.each([
    ['fr', ['chiffrées en base de données', 'pas montré aux autres lecteurs'], ['le jour du jeu où vous l\'avez inscrite', 'pendant 30 jours au plus', 'plus ajouter ni corriger un prix']],
    ['en', ['encrypted in the database', 'not shown to other readers'], ['on the game day you recorded it', 'for 30 days at most', 'no longer add or correct a price']],
  ])('%s : les engagements sont écrits', (lang, fields, retention) => {
    const { Privacy } = legal(lang)
    const text = Privacy.Section3.BirthFields.map(f => f.Text).join('\n')
    for (const sentence of fields) expect(text).toContain(sentence)
    for (const sentence of retention) expect(Privacy.Section5.Births).toContain(sentence)
  })
})
