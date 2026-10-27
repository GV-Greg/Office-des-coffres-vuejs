import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ModuleHomeCards from '../../src/components/ModuleHomeCards.vue'

// Cartes d'accueil d'un module : générique (Animation d'abord, puis les autres modules), aucun texte en dur.

const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const readLocale = lang => JSON.parse(fs.readFileSync(path.join(localesDir, `${lang}.json`), 'utf8'))
const messages = { fr: readLocale('fr'), en: readLocale('en') }

const items = [
  { key: 'a', title: 'Première', description: 'Son descriptif.', to: { name: 'a' }, icon: 'gi-chest' },
  { key: 'b', title: 'Seconde', description: 'Un autre descriptif.', to: { name: 'b' }, action: 'Entrer' },
]

function mountCards(props = {}) {
  return mount(ModuleHomeCards, {
    props: { items, ...props },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'fr', messages })],
      stubs: { RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' } },
    },
  })
}

describe('ModuleHomeCards', () => {
  it('une carte par page, avec son titre et son descriptif', () => {
    const w = mountCards()

    expect(w.findAll('article')).toHaveLength(2)
    expect(w.find('[data-testid="card-a"] h3').text()).toBe('Première')
    expect(w.find('[data-testid="card-b"]').text()).toContain('Un autre descriptif.')
  })

  it('le lien porte « Découvrir » par défaut, ou le libellé de l\'appelant', () => {
    const w = mountCards()

    expect(w.find('[data-testid="card-link-a"]').text()).toContain('Découvrir')
    expect(w.find('[data-testid="card-link-b"]').text()).toContain('Entrer')
    expect(w.find('[data-testid="card-link-b"]').attributes('data-to')).toContain('"b"')
  })

  it('l\'icône est dans le bouton, seulement pour une carte qui en a une, et reste décorative', () => {
    const w = mountCards()

    expect(w.find('[data-testid="card-link-a"] [data-testid="card-icon-a"]').exists()).toBe(true)
    expect(w.find('[data-testid="card-icon-a"]').attributes('aria-hidden')).toBe('true')
    expect(w.find('[data-testid="card-icon-b"]').exists()).toBe(false)
  })

  it('un visuel propre à une activité se glisse par le slot visual-<clé>, et seulement pour elle', () => {
    const w = mount(ModuleHomeCards, {
      props: { items },
      slots: { 'visual-a': '<i data-testid="mon-visuel"></i>' },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'fr', messages })],
        stubs: { RouterLink: { props: ['to'], template: '<a><slot /></a>' } },
      },
    })

    expect(w.find('[data-testid="card-a"] [data-testid="mon-visuel"]').exists()).toBe(true)
    expect(w.find('[data-testid="card-visual-b"]').exists()).toBe(false)
  })

  it('la couleur du module habille le liseré et la plaque, et le bouton prend la classe du module', () => {
    const w = mountCards({ accent: 'gold' })

    expect(w.find('[data-testid="card-bar-a"]').attributes('style')).toMatch(/#a16207|rgb\(161, 98, 7\)/)
    expect(w.find('[data-testid="card-link-a"]').classes()).toContain('odc--gold')
  })

  it('le texte est lisible : slate-800 et slate-700 déclarés sur la carte claire, dans les deux thèmes', () => {
    const w = mountCards()

    const title = w.find('[data-testid="card-a"] h3').classes()
    const text = w.find('[data-testid="card-a"] p').classes()
    expect(title).toContain('text-slate-800')
    expect(title).toContain('dark:text-slate-800')
    expect(text).toContain('text-slate-700')
    expect(text).toContain('dark:text-slate-700')
  })
})
