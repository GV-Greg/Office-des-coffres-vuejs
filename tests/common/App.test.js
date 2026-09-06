import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import App from '../../src/App.vue'
import AppFooter from '../../src/components/AppFooter.vue'

const localStorageMock = (() => {
  let store = {}
  return {
    getItem:    (key) => store[key] ?? null,
    setItem:    (key, value) => { store[key] = value.toString() },
    removeItem: (key) => { delete store[key] },
    clear:      () => { store = {} },
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

const i18n = createI18n({ legacy: false, locale: 'fr', messages: { fr: {} } })

async function mountAppOnRoute(routeName, meta) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: routeName, component: { template: '<div/>' }, meta },
      { path: '/legal/cookies', name: 'legal-cookies', component: { template: '<div/>' } },
      { path: '/legal/privacy', name: 'legal-privacy', component: { template: '<div/>' } },
      { path: '/legal/mentions', name: 'legal-mentions', component: { template: '<div/>' } },
    ],
  })
  router.push('/')
  await router.isReady()

  return mount(App, {
    global: {
      plugins: [createTestingPinia({ createSpy: () => () => {} }), router, i18n],
      stubs: { CookiesBanner: true, LoadingOverlay: true, Notivue: true, Notification: true },
    },
  })
}

describe('App — footer légal (Cookies #12)', () => {
  it('affiche AppFooter avec préférences/mention non officiel sur une route publique non-Welcome (meta.public: true)', async () => {
    const wrapper = await mountAppOnRoute('login', { public: true })
    const footer = wrapper.findComponent(AppFooter)
    expect(footer.exists()).toBe(true)
    expect(footer.props('showPreferences')).toBe(true)
    expect(footer.props('showUnofficialTag')).toBe(true)
  })

  it("affiche AppFooter en contenu réduit sur une route non publique (pages /app/*) — pas de doublon avec la NavBar", async () => {
    const wrapper = await mountAppOnRoute('home', {})
    const footer = wrapper.findComponent(AppFooter)
    expect(footer.exists()).toBe(true)
    expect(footer.props('showPreferences')).toBe(false)
    expect(footer.props('showUnofficialTag')).toBe(false)
  })

  it("n'affiche pas AppFooter sur Welcome — elle a son propre footer fusionné", async () => {
    const wrapper = await mountAppOnRoute('welcome', { public: true })
    expect(wrapper.findComponent(AppFooter).exists()).toBe(false)
  })
})
