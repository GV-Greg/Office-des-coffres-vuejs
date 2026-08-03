import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import NavMenu from '../../src/components/NavMenu.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'fr',
  messages: {
    fr: { NavMenu: { Home: 'Accueil', Economy: 'Éco', Security: 'Sécu', Animation: 'Anim', Profile: 'Profil' } },
    en: { NavMenu: { Home: 'Home', Economy: 'Eco', Security: 'Sec', Animation: 'Anim', Profile: 'Profile' } }
  }
})

async function mountNavMenu() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/app/', name: 'home', component: { template: '<div/>' } },
      { path: '/app/eco', name: 'economy', component: { template: '<div/>' } },
      { path: '/app/secu/guet', name: 'security-guet', component: { template: '<div/>' } },
      { path: '/app/anim', name: 'animation', component: { template: '<div/>' } },
      { path: '/app/profil', name: 'profil', component: { template: '<div/>' } },
    ]
  })
  router.push('/app/')
  await router.isReady()

  return mount(NavMenu, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn }), router, i18n]
    }
  })
}

describe('NavMenu', () => {
  it('affiche les libellés en français par défaut', async () => {
    const wrapper = await mountNavMenu()
    expect(wrapper.text()).toContain('Accueil')
    expect(wrapper.text()).toContain('Éco')
  })

  it('les libellés changent quand la langue du site change (réactivité au locale)', async () => {
    const wrapper = await mountNavMenu()
    i18n.global.locale.value = 'en'
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Home')
    expect(wrapper.text()).toContain('Eco')

    i18n.global.locale.value = 'fr'
  })
})
