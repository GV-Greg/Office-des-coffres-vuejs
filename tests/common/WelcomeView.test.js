import { describe, it, expect } from 'vitest'
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
