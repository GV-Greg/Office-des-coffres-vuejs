import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import NavBar from '../../src/components/NavBar.vue'
import SelectorMenu from '../../src/components/SelectorMenu.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'fr',
  messages: {
    fr: {
      Common: { SiteName: 'Office des coffres' },
      NavBar: { Home: 'Accueil' }
    }
  }
})

async function mountNavBar() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/app/', name: 'home', component: { template: '<div/>' } }]
  })
  router.push('/app/')
  await router.isReady()

  return mount(NavBar, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn }), router, i18n],
      stubs: { SelectorMenu: true }
    }
  })
}

describe('NavBar', () => {
  it('affiche le sélecteur thème/langue (dark mode + langue disponibles sur les pages /app/*)', async () => {
    const wrapper = await mountNavBar()
    expect(wrapper.findComponent(SelectorMenu).exists()).toBe(true)
  })

  it("affiche le libellé d'accueil traduit", async () => {
    const wrapper = await mountNavBar()
    expect(wrapper.text()).toContain('Accueil')
  })
})
