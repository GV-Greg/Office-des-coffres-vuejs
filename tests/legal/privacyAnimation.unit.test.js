// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DATA_PAGE_SECTIONS } from '../../src/modules/dataPageSections.js'

/*
  Garde-fou — le chapitre « Animation » de la politique et de la politique des cookies (Décode le code et Grille des
  lots, UN seul texte : admin/content/policy-animation.md, analysé par Cowork le 11/11/2026). Rien ne se déploie avant que
  ce texte soit en ligne (D40), et la Grille des lots reste inactive jusque-là. Les formulations qui suivent sont des
  ENGAGEMENTS : durée de conservation, effacement à la clôture, ce que la page figée ne montre jamais. Ceux de Décode le
  code, en ligne depuis le 28/10/2026, n'ont pas changé d'un mot ; la Grille des lots s'y ajoute.

  Lecture par fs : un import de fr.json est précompilé par le plugin vue-i18n et rend undefined.
*/

const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const locale = lang => JSON.parse(readFileSync(resolve(localesDir, `${lang}.json`), 'utf-8')).Legal

describe('Politique — Animation (Décode le code, Grille des lots)', () => {
  it.each(['fr', 'en'])('%s : les insertions existent (§3, §5, §6), une ligne par activité au §3', (lang) => {
    const { Section3, Section5, Section6 } = locale(lang).Privacy
    expect(Section3.AnimIntro).toBeTruthy()
    expect(Section3.AnimFields).toHaveLength(4)
    expect(Section3.AnimNote).toBeTruthy()
    expect(Section3.AnimActivities).toHaveLength(2)
    expect(Section5.Animation).toContain('{email}')
    expect(Section6.AnimationHolders).toBeTruthy()
  })

  it.each(['fr', 'en'])('%s : les anciennes clés « AnimDecode » ont disparu (un seul chapitre)', (lang) => {
    const { Section3, Section5, Section6 } = locale(lang).Privacy
    for (const key of ['AnimDecodeIntro', 'AnimDecodeFields', 'AnimDecodeNote']) expect(Section3[key]).toBeUndefined()
    expect(Section5.AnimDecode).toBeUndefined()
    expect(Section6.AnimDecodeHolders).toBeUndefined()
  })

  it('FR : les engagements de Décode le code sont écrits tels quels', () => {
    const { Section5, Section6 } = locale('fr').Privacy
    expect(Section5.Animation).toContain('supprime l\'activité avec eux')
    expect(Section5.Animation).toContain('30 jours')
    expect(Section5.Animation).toContain('5 ans après la clôture')
    expect(Section5.Animation).toContain('jamais les propositions reçues')
    expect(Section5.Animation).toContain('l\'empreinte de votre connexion, votre adresse email, votre mot de passe')
    expect(Section6.AnimationHolders).toContain('Votre mot de passe n\'est jamais visible de personne')
  })

  it('EN : les engagements de Crack the Code sont écrits tels quels', () => {
    const { Section5, Section6 } = locale('en').Privacy
    expect(Section5.Animation).toContain('deletes the activity with them')
    expect(Section5.Animation).toContain('30 days')
    expect(Section5.Animation).toContain('5 years after closing')
    expect(Section5.Animation).toContain('never the proposals received')
    expect(Section5.Animation).toContain('the fingerprint of your connection, your email address, your password')
    expect(Section6.AnimationHolders).toContain('Your password is never visible to anyone')
  })

  it('FR : les engagements propres à la Grille des lots sont écrits', () => {
    const { Section3, Section5, Section6 } = locale('fr').Privacy
    expect(Section5.Animation).toContain('tous les lots')
    expect(Section5.Animation).toContain('le nom des personnages qui ont choisi une case')
    expect(Section5.Animation).toContain('Dans les deux modes, une activité sans action depuis 30 jours est automatiquement close')
    expect(Section6.AnimationHolders).toContain('dès le tirage')
    expect(Section6.AnimationHolders).toContain('le contenu des cases non choisies reste caché jusqu\'à la clôture')
    expect(Section3.AnimActivities.map(a => a.Label)).toEqual(['Décode le code', 'Grille des lots'])
    // La Grille n'envoie aucun compte rendu de fin : l'adresse n'y sert qu'à Décode le code.
    expect(Section3.AnimFields[2].Text).toContain('pour Décode le code, elle sert aussi à recevoir un compte rendu complet')
  })

  it('EN : les engagements propres au Prize Grid sont écrits', () => {
    const { Section5, Section6 } = locale('en').Privacy
    expect(Section5.Animation).toContain('all the prizes')
    expect(Section5.Animation).toContain('the names of the characters who chose a cell')
    expect(Section5.Animation).toContain('In both modes, an activity with no action for 30 days is automatically closed')
    expect(Section6.AnimationHolders).toContain('from the draw onwards')
    expect(Section6.AnimationHolders).toContain('the contents of unchosen cells stay hidden until closing')
  })

  it.each(['fr', 'en'])('%s : la politique des cookies nomme les deux activités et « chaque type » d\'adresse mémorisée', (lang) => {
    const { Purpose, Data } = locale(lang).Cookies.Section3.Preferences
    const tools = lang === 'fr' ? ['Décode le code', 'Grille des lots'] : ['Crack the Code', 'Prize Grid']
    for (const tool of tools) {
      expect(Purpose).toContain(tool)
      expect(Data).toContain(tool)
    }
    expect(Data).toContain(lang === 'fr' ? 'de chaque type d\'Animation' : 'of each Animation type')
  })
})

describe('« Vos données » — une seule entrée Animation', () => {
  it('une entrée « animation », badge « sans compte », une seule pour toutes les activités', () => {
    const entries = DATA_PAGE_SECTIONS.filter(s => s.key === 'Animation')
    expect(entries).toEqual([{ id: 'animation', key: 'Animation', access: 'none' }])
    expect(DATA_PAGE_SECTIONS.some(s => /decode|rewards|grille/i.test(s.key + s.id))).toBe(false)
  })

  it.each(['fr', 'en'])('%s : titre, usage et contenu, sans durée ni destinataires (renvoyés à la politique)', (lang) => {
    const section = locale(lang).Data.Animation
    expect(section.Title).toBe('Animation')
    expect(section.Purpose).toBeTruthy()
    expect(section.Input).toBeTruthy()
    expect(section.Duration).toBeUndefined()
    expect(section.Audience).toBeUndefined()
  })
})
