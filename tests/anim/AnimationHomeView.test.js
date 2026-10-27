import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { ref } from 'vue'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import AnimationHomeView from '../../src/views/modules/animation/AnimationHomeView.vue'

// Accueil du module Animation : une carte par activité ouverte, avec son nom et son descriptif (en roleplay).

const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const readLocale = lang => JSON.parse(fs.readFileSync(path.join(localesDir, `${lang}.json`), 'utf8'))
const fr = readLocale('fr')
const en = readLocale('en')

function mountHome({ types = ['decode'], locale = 'fr', provided = true } = {}) {
  const i18n = createI18n({ legacy: false, locale, messages: { fr, en } })
  return mount(AnimationHomeView, {
    global: {
      plugins: [i18n],
      provide: provided ? { animationTypes: ref(types) } : {},
      stubs: { RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' } },
    },
  })
}

describe('AnimationHomeView — accueil du module', () => {
  it('une carte pour l\'activité ouverte, avec son nom et son descriptif', () => {
    const w = mountHome()

    const card = w.find('[data-testid="card-decode"]')
    expect(card.exists()).toBe(true)
    expect(card.find('h3').text()).toBe('Décode le code')
    expect(card.text()).toContain('Une salle de coffres scellés vous attend')
    expect(card.find('[data-testid="decode-visual"]').attributes('aria-hidden')).toBe('true')
    expect(card.findAll('[data-testid="decode-visual"] span')).toHaveLength(5)
    expect(card.text()).toContain(fr.Animation.Types.decode.Description.slice(0, 40))
  })

  it('le lien de la carte mène à la page de l\'activité', () => {
    const w = mountHome()

    const link = w.find('[data-testid="card-link-decode"]')
    expect(link.attributes('data-to')).toContain('animation-decode')
    expect(link.text()).toContain('Entrez dans la salle')
  })

  it('le titre est centré et le sous-titre le suit', () => {
    const w = mountHome()

    expect(w.find('header').classes()).toContain('text-center')
    expect(w.find('[data-testid="animation-home-title"]').text()).toBe('La Salle des Jeux')
    expect(w.find('[data-testid="animation-home-intro"]').text()).toContain('les coffres que l\'Office met à disposition des animateurs')
  })

  it('le coffre est dans le bouton, décoratif, et les cinq cases sont dans la ligne du titre', () => {
    const w = mountHome()

    expect(w.find('[data-testid="card-link-decode"] [data-testid="card-icon-decode"]').exists()).toBe(true)
    expect(w.find('h3').element.parentElement.querySelector('[data-testid="decode-visual"]')).not.toBeNull()

    expect(w.find('[data-testid="card-icon-decode"]').attributes('aria-hidden')).toBe('true')
  })

  it('en anglais : Crack the Code et son descriptif', () => {
    const w = mountHome({ locale: 'en' })

    expect(w.find('[data-testid="card-decode"] h3').text()).toBe('Crack the Code')
    expect(w.find('[data-testid="card-decode"]').text()).toContain('A hall of sealed chests awaits you')
    expect(w.find('[data-testid="card-link-decode"]').text()).toContain('Enter the hall')
  })

  it('aucune activité ouverte : le dit, sans carte', () => {
    const w = mountHome({ types: [] })

    expect(w.find('[data-testid="animation-home-empty"]').exists()).toBe(true)
    expect(w.find('[data-testid="animation-cards"]').exists()).toBe(false)
  })

  it('une activité que le site ne connaît pas n\'a pas de carte', () => {
    const w = mountHome({ types: ['grid'] })

    expect(w.find('[data-testid="card-grid"]').exists()).toBe(false)
    expect(w.find('[data-testid="animation-home-empty"]').exists()).toBe(true)
  })

  it('sans liste fournie : accueil vide, pas d\'erreur', () => {
    const w = mountHome({ provided: false })

    expect(w.find('[data-testid="animation-home-empty"]').exists()).toBe(true)
  })

  it('le descriptif présente une salle de coffres déjà scellés et s\'adresse à l\'animateur, dans les deux langues', () => {
    expect(fr.Animation.Types.decode.Description).toMatch(/^Une salle de coffres scellés vous attend/)
    expect(en.Animation.Types.decode.Description).toMatch(/^A hall of sealed chests awaits you/)
    expect(fr.Animation.Types.decode.Description.toLowerCase()).not.toContain('joueur')
  })
})
