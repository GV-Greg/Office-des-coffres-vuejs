import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import WelcomeView from '../../src/views/WelcomeView.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'fr',
  messages: {
    fr: {
      Common: { SiteName: 'Office des coffres' },
      Welcome: {
        ClickHint: 'cliquez',
        Intro: 'Bienvenue.',
        Access: { Text: 'Vous pouvez franchir le seuil de l\'Office sans y déposer votre nom.' },
        Disclaimer: 'Site non officiel {link}.',
        Copyright: '© {years} Office des coffres.',
      },
      Legal: {
        Privacy: { CookiesPolicyLink: 'Politique cookies' },
        Cookies: { PrivacyPolicyLink: 'Politique de confidentialité' },
        Mentions: { PageTitle: 'Mentions légales' },
      },
    },
  },
})

function mountWelcome() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: { template: '<div/>' } },
      { path: '/legal/cookies', name: 'legal-cookies', component: { template: '<div/>' } },
      { path: '/legal/privacy', name: 'legal-privacy', component: { template: '<div/>' } },
      { path: '/legal/mentions', name: 'legal-mentions', component: { template: '<div/>' } },
    ],
  })

  return mount(WelcomeView, {
    global: {
      plugins: [createTestingPinia({ createSpy: () => () => {} }), router, i18n],
      stubs: { SelectorMenu: true },
    },
  })
}

describe('WelcomeView — phrase double périmètre public/privé (Cookies #10)', () => {
  it('affiche la phrase sur les deux périmètres, sous le texte roleplay', () => {
    const wrapper = mountWelcome()
    expect(wrapper.text()).toContain('Vous pouvez franchir le seuil de l\'Office sans y déposer votre nom.')
  })
})

describe('WelcomeView — footer fusionné (Cookies #12)', () => {
  it('affiche les 3 liens légaux et le disclaimer/copyright dans un seul footer', () => {
    const wrapper = mountWelcome()
    expect(wrapper.text()).toContain('Politique cookies')
    expect(wrapper.text()).toContain('Politique de confidentialité')
    expect(wrapper.text()).toContain('Mentions légales')
    expect(wrapper.text()).toContain('Site non officiel')
    expect(wrapper.text()).toContain('Office des coffres.')
  })

  it("n'affiche pas de bouton Gérer mes préférences ni de mention distincte outil non officiel (déjà dans le disclaimer)", () => {
    const wrapper = mountWelcome()
    expect(wrapper.text()).not.toContain('Gérer mes préférences')
    expect(wrapper.findAll('button').some((b) => b.text().includes('préférences'))).toBe(false)
  })
})

describe('WelcomeView — rebond de la flèche au survol du cadenas', () => {
  // jsdom n'implémente ni Element.animate ni matchMedia : on les fournit, et on observe l'appel.
  const setup = (reduced) => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: reduced })
    const animate = vi.fn().mockReturnValue({ playState: 'running' })
    Element.prototype.animate = animate
    const wrapper = mountWelcome()
    return { wrapper, animate, lock: wrapper.get('button[aria-label]') }
  }
  afterEach(() => { delete Element.prototype.animate; delete window.matchMedia })

  it('rejoue un rebond plus vif de 3 s, qui finit en haut', async () => {
    const { lock, animate } = setup(false)
    await lock.trigger('mouseenter')

    expect(animate).toHaveBeenCalledOnce()
    const [keyframes, options] = animate.mock.calls[0]
    expect(options).toMatchObject({ duration: 500, iterations: 6, fill: 'forwards' })
    expect(options.duration * options.iterations).toBe(3000)
    expect(keyframes.at(-1).transform).toBe('translateY(-25%)') // arrêt en haut du mouvement
  })

  it('ne relance pas un rebond déjà en cours', async () => {
    const { lock, animate } = setup(false)
    await lock.trigger('mouseenter')
    await lock.trigger('mouseenter')
    expect(animate).toHaveBeenCalledOnce()
  })

  it("ne bouge pas quand le mouvement réduit est demandé", async () => {
    const { lock, animate } = setup(true)
    await lock.trigger('mouseenter')
    expect(animate).not.toHaveBeenCalled()
  })
})
