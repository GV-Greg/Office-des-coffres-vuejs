import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import NavBar from '../../src/components/NavBar.vue'
import SelectorMenu from '../../src/components/SelectorMenu.vue'
import SelectorCharacter from '../../src/components/SelectorCharacter.vue'
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
      NavBar: { Home: 'Accueil', Logout: 'Se déconnecter', LoggedOut: 'Vous avez été déconnecté.', Admin: 'Admin', CharacterSelector: 'Changer de personnage' }
    }
  }
})

async function mountNavBar({ isLoggedIn = false, isAdmin = false, characters = [] } = {}) {
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
          initialState: {
            auth: {
              token: isLoggedIn ? 'fake-token' : null,
              user: isLoggedIn ? { is_admin: isAdmin, characters } : null,
            }
          }
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

  it('monte le sélecteur de personnage directement dans la NavBar (pas via SelectorMenu partagé)', async () => {
    const characters = [{ id: 1, pseudo: 'Artifice' }, { id: 2, pseudo: 'Buldo' }]
    const { wrapper } = await mountNavBar({ isLoggedIn: true, characters })
    expect(wrapper.findComponent(SelectorCharacter).exists()).toBe(true)
  })

  it("ne montre pas le lien admin si l'utilisateur n'est pas connecté", async () => {
    const { wrapper } = await mountNavBar({ isLoggedIn: false })
    expect(wrapper.text()).not.toContain('Admin')
  })

  it("ne montre pas le lien admin pour un compte connecté non-admin", async () => {
    const { wrapper } = await mountNavBar({ isLoggedIn: true, isAdmin: false })
    expect(wrapper.text()).not.toContain('Admin')
  })

  it('montre le lien admin pour un compte connecté avec le rôle admin', async () => {
    const { wrapper } = await mountNavBar({ isLoggedIn: true, isAdmin: true })
    expect(wrapper.text()).toContain('Admin')
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
