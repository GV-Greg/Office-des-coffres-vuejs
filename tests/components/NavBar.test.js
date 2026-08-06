import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import NavBar from '../../src/components/NavBar.vue'
import SelectorMenu from '../../src/components/SelectorMenu.vue'
import { useAuthStore } from '../../src/stores/authStore'

vi.mock('notivue', () => ({
  push: { success: vi.fn(), error: vi.fn() }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'fr',
  messages: {
    fr: {
      Common: { SiteName: 'Office des coffres' },
      NavBar: { Home: 'Accueil', Logout: 'Se déconnecter', LoggedOut: 'Vous avez été déconnecté.' }
    }
  }
})

async function mountNavBar({ isLoggedIn = false } = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/app/', name: 'home', component: { template: '<div/>' } },
      { path: '/', name: 'welcome', component: { template: '<div/>' } }
    ]
  })
  router.push('/app/')
  await router.isReady()

  const wrapper = mount(NavBar, {
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          initialState: { auth: { token: isLoggedIn ? 'fake-token' : null } }
        }),
        router,
        i18n
      ],
      stubs: { SelectorMenu: true }
    }
  })

  return { wrapper, router }
}

describe('NavBar', () => {
  it('affiche le sélecteur thème/langue (dark mode + langue disponibles sur les pages /app/*)', async () => {
    const { wrapper } = await mountNavBar()
    expect(wrapper.findComponent(SelectorMenu).exists()).toBe(true)
  })

  it("affiche le libellé d'accueil traduit", async () => {
    const { wrapper } = await mountNavBar()
    expect(wrapper.text()).toContain('Accueil')
  })

  it("ne montre pas le bouton de déconnexion si l'utilisateur n'est pas connecté", async () => {
    const { wrapper } = await mountNavBar({ isLoggedIn: false })
    expect(wrapper.find('[aria-label="Se déconnecter"]').exists()).toBe(false)
  })

  it("montre le bouton de déconnexion si l'utilisateur est connecté", async () => {
    const { wrapper } = await mountNavBar({ isLoggedIn: true })
    expect(wrapper.find('[aria-label="Se déconnecter"]').exists()).toBe(true)
  })

  it('déconnecte et redirige vers l\'accueil au clic sur le bouton de déconnexion', async () => {
    const { wrapper, router } = await mountNavBar({ isLoggedIn: true })
    const authStore = useAuthStore()
    authStore.logout.mockResolvedValue()
    const pushSpy = vi.spyOn(router, 'push')

    await wrapper.find('[aria-label="Se déconnecter"]').trigger('click')
    await flushPromises()

    expect(authStore.logout).toHaveBeenCalled()
    expect(pushSpy).toHaveBeenCalledWith({ name: 'welcome' })
  })
})
