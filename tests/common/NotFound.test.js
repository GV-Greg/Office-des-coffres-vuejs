import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import NotFoundView from '../../src/views/404.vue'
import SelectorMenu from '../../src/components/SelectorMenu.vue'

// Mock api.js (importé par authStore.js, lui-même importé par router/index.js — voir le dernier
// bloc, qui résout la route réelle).
vi.mock('../../src/api.js', () => ({
  http: {
    post: vi.fn(),
    get: vi.fn(),
  },
  ADMIN_ORIGIN: 'https://odc-admin.test',
}))

const i18n = createI18n({
  legacy: false,
  locale: 'fr',
  messages: {
    fr: {
      Common: { SiteName: 'Office des coffres' },
      NotFound: {
        Title: 'Page introuvable',
        Lead: "Ce coffre ne figure sur aucun registre de l'Office.",
        Hint: "L'adresse a peut-être été mal recopiée.",
        BackHome: "Retour à l'Office",
      },
    },
  },
})

async function mountNotFound({ isLoggedIn = false } = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'welcome', component: { template: '<div/>' } },
      { path: '/app/', name: 'home', component: { template: '<div/>' } },
      { path: '/:pathMatch(.*)*', name: 'not-found', component: { template: '<div/>' } },
    ],
  })
  router.push('/une-adresse-qui-nexiste-pas')
  await router.isReady()

  const wrapper = mount(NotFoundView, {
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          initialState: {
            auth: {
              token: isLoggedIn ? 'fake-token' : null,
              user: isLoggedIn ? { characters: [] } : null,
            },
          },
        }),
        router,
        i18n,
      ],
      stubs: { SelectorMenu: true },
    },
  })

  return { wrapper, router }
}

describe('404 — contenu de la page', () => {
  it('affiche le logo, le titre et le texte d\'explication, tous traduits — sans code « 404 »', async () => {
    const { wrapper } = await mountNotFound()

    expect(wrapper.find('img').attributes('alt')).toBe('Office des coffres')
    expect(wrapper.text()).not.toContain('404')
    expect(wrapper.text()).toContain('Page introuvable')
    expect(wrapper.text()).toContain("Ce coffre ne figure sur aucun registre de l'Office.")
    expect(wrapper.text()).toContain("L'adresse a peut-être été mal recopiée.")
  })

  it('monte le sélecteur thème/langue — cette route n\'a pas de NavBar pour les porter', async () => {
    const { wrapper } = await mountNotFound()
    expect(wrapper.findComponent(SelectorMenu).exists()).toBe(true)
  })
})

describe('404 — navigation de retour (un seul bouton, 27/09/2026)', () => {
  afterEach(() => vi.restoreAllMocks())

  const backButton = (wrapper) => wrapper.findAll('button').find((b) => b.text().includes("Retour à l'Office"))

  it('ne propose qu’un seul bouton de retour', async () => {
    const { wrapper } = await mountNotFound()
    expect(wrapper.findAll('button')).toHaveLength(1)
    expect(backButton(wrapper)).toBeDefined()
  })

  it('revient à la page précédente du navigateur quand il y en a une (même après une URL tapée)', async () => {
    const { wrapper, router } = await mountNotFound()
    vi.spyOn(window.history, 'length', 'get').mockReturnValue(3)
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    const push = vi.spyOn(router, 'push')
    await backButton(wrapper).trigger('click')
    expect(back).toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it("en onglet neuf, renvoie un visiteur non connecté vers l'accueil public", async () => {
    const { wrapper, router } = await mountNotFound({ isLoggedIn: false })
    vi.spyOn(window.history, 'length', 'get').mockReturnValue(1)
    const push = vi.spyOn(router, 'push')
    await backButton(wrapper).trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'welcome' })
  })

  it("en onglet neuf, renvoie un visiteur connecté dans l'app", async () => {
    const { wrapper, router } = await mountNotFound({ isLoggedIn: true })
    vi.spyOn(window.history, 'length', 'get').mockReturnValue(1)
    const push = vi.spyOn(router, 'push')
    await backButton(wrapper).trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'home' })
  })
})

describe('Route catch-all', () => {
  it('est nommée, publique et pointe vers la vue 404', async () => {
    const { default: router } = await import('../../src/router/index.js')
    const resolved = router.resolve('/cette-page-nexiste-pas')

    expect(resolved.name).toBe('not-found')
    // `meta.public` conditionne le contenu du footer légal (App.vue) : préférences cookies et
    // mention "outil non officiel" doivent rester visibles sur une URL cassée.
    expect(resolved.meta.public).toBe(true)
  })
})
