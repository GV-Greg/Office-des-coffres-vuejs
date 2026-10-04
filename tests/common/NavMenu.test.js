import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import NavMenu from '../../src/components/NavMenu.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'fr',
  messages: {
    fr: { NavMenu: { Home: 'Accueil', Economy: 'Éco', Security: 'Sécu', Animation: 'Anim', Profile: 'Profil', Province: 'Ma province' } },
    en: { NavMenu: { Home: 'Home', Economy: 'Eco', Security: 'Sec', Animation: 'Anim', Profile: 'Profile', Province: 'My province' } }
  }
})

async function mountNavMenu({ isLoggedIn = false } = {}) {
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
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          initialState: { auth: { token: isLoggedIn ? 'fake-token' : null, user: isLoggedIn ? { characters: [] } : null } },
        }),
        router,
        i18n,
      ]
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

  it("sur /app/, seule l'entrée Accueil est la page courante (correspondance exacte)", async () => {
    const wrapper = await mountNavMenu()
    const current = wrapper.findAll('[aria-current="page"]')
    expect(current).toHaveLength(1)
    expect(current[0].text()).toContain('Accueil')
    expect(current[0].classes()).toContain('menu-btn--current')
  })

  it("sur une page de module, Accueil n'est plus marqué courant", async () => {
    const wrapper = await mountNavMenu()
    await wrapper.vm.$router.push('/app/eco')
    await flushPromises()
    const current = wrapper.findAll('[aria-current="page"]')
    expect(current).toHaveLength(1)
    expect(current[0].text()).toContain('Éco')
  })

  it('passe les couleurs en variables CSS, sans classe construite', async () => {
    const wrapper = await mountNavMenu()
    const first = wrapper.find('a.menu-btn')
    expect(first.attributes('style')).toContain('--c2: #2563eb')
    expect(first.classes().some((c) => c.startsWith('btn-'))).toBe(false)
  })

  it('affiche les 6 entrées, Profil et Ma province masqués hors connexion', async () => {
    const wrapper = await mountNavMenu()
    const links = wrapper.findAll('a.menu-btn')
    expect(links).toHaveLength(6)
    for (const name of ['Profil', 'Ma province']) {
      expect(links.find((l) => l.text().includes(name)).isVisible()).toBe(false)
    }
    expect(links.filter((l) => l.isVisible())).toHaveLength(4)
  })

  it('montre Profil une fois connecté', async () => {
    const wrapper = await mountNavMenu({ isLoggedIn: true })
    const profil = wrapper.findAll('a.menu-btn').find((l) => l.text().includes('Profil'))
    expect(profil.isVisible()).toBe(true)
  })
})
