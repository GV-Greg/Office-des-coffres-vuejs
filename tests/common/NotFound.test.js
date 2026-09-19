import { describe, it, expect, vi } from 'vitest'
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
      NotFound: {
        Code: '404',
        Title: 'Page introuvable',
        Lead: "Ce coffre ne figure sur aucun registre de l'Office.",
        Hint: "L'adresse a peut-être été mal recopiée.",
        BackHome: "Retour à l'Office",
        BackPrevious: 'Page précédente',
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
  it('affiche le code, le titre et le texte d\'explication, tous traduits', async () => {
    const { wrapper } = await mountNotFound()

    expect(wrapper.text()).toContain('404')
    expect(wrapper.text()).toContain('Page introuvable')
    expect(wrapper.text()).toContain("Ce coffre ne figure sur aucun registre de l'Office.")
    expect(wrapper.text()).toContain("L'adresse a peut-être été mal recopiée.")
  })

  it('monte le sélecteur thème/langue — cette route n\'a pas de NavBar pour les porter', async () => {
    const { wrapper } = await mountNotFound()
    expect(wrapper.findComponent(SelectorMenu).exists()).toBe(true)
  })
})

describe('404 — navigation de retour', () => {
  it("renvoie un visiteur non connecté vers l'accueil public", async () => {
    const { wrapper } = await mountNotFound({ isLoggedIn: false })

    const homeLink = wrapper.findAll('a').find((a) => a.text().includes("Retour à l'Office"))
    expect(homeLink.attributes('href')).toBe('/')
  })

  it("renvoie un visiteur connecté dans l'app plutôt que sur la page d'accueil publique", async () => {
    const { wrapper } = await mountNotFound({ isLoggedIn: true })

    const homeLink = wrapper.findAll('a').find((a) => a.text().includes("Retour à l'Office"))
    expect(homeLink.attributes('href')).toBe('/app/')
  })

  it('propose un retour à la page précédente qui retombe sur Welcome en arrivée directe', async () => {
    const { wrapper, router } = await mountNotFound()
    const pushSpy = vi.spyOn(router, 'push')

    const backButton = wrapper.findAll('button').find((b) => b.text().includes('Page précédente'))
    expect(backButton).toBeDefined()

    await backButton.trigger('click')

    // Arrivée directe sur une URL cassée (lien externe, faute de frappe) : pas d'historique
    // applicatif à remonter, goBackOrWelcome bascule sur Welcome.
    expect(pushSpy).toHaveBeenCalledWith({ name: 'welcome' })
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
