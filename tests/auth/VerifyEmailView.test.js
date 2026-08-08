import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import VerifyEmailView from '../../src/views/auth/VerifyEmailView.vue'
import { useAuthStore } from '../../src/stores/authStore'

vi.mock('notivue', () => ({ push: { error: vi.fn() } }))
vi.mock('../../src/api.js', () => ({ http: { post: vi.fn(), get: vi.fn() } }))

const i18n = createI18n({
  legacy: false,
  locale: 'fr',
  messages: {
    fr: {
      Common: { SiteName: 'Office des coffres' },
      VerifyEmail: {
        Verifying: 'Vérification en cours...',
        InvalidLink: 'Lien invalide.',
        ResendPrompt: 'Entrez votre email.',
        ResendButton: 'Renvoyer',
        ResendSuccess: 'Envoyé.'
      },
      Login: { Heading: 'Connectez-vous' },
      Auth: { EmailPlaceholder: 'Entrez votre email' },
      email: 'email'
    }
  }
})

async function mountView(query, { checkAuthResult = true, hasCharacters = false } = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/verify-email', name: 'verify-email', component: VerifyEmailView },
      { path: '/app/profil', name: 'profil', component: { template: '<div/>' } },
      { path: '/app/character/new', name: 'character-new', component: { template: '<div/>' } },
    ]
  })
  router.push({ path: '/verify-email', query })
  await router.isReady()

  const pinia = createTestingPinia({
    createSpy: vi.fn,
    initialState: {
      auth: { user: hasCharacters ? { characters: [{ id: 1, pseudo: 'Artifice' }] } : { characters: [] } }
    }
  })

  // Configure le store AVANT le montage : onMounted appelle checkAuth() dès le render initial.
  const authStore = useAuthStore(pinia)
  authStore.checkAuth.mockResolvedValueOnce(checkAuthResult)

  const wrapper = mount(VerifyEmailView, {
    global: { plugins: [pinia, i18n, router] }
  })
  await flushPromises()
  return { wrapper, router, authStore }
}

describe('VerifyEmailView', () => {
  it("redirige vers la création de personnage si le compte connecté n'en a aucun", async () => {
    const { router } = await mountView({ token: 'tok123' }, { checkAuthResult: true, hasCharacters: false })
    expect(router.currentRoute.value.name).toBe('character-new')
  })

  it('redirige vers le profil si le compte a déjà au moins un personnage', async () => {
    const { router } = await mountView({ token: 'tok123' }, { checkAuthResult: true, hasCharacters: true })
    expect(router.currentRoute.value.name).toBe('profil')
  })

  it("affiche un message d'erreur et un formulaire de renvoi si le lien est invalide", async () => {
    const { wrapper } = await mountView({ error: 'invalid' })
    expect(wrapper.text()).toContain('Lien invalide.')
    expect(wrapper.find('input[name="email"]').exists()).toBe(true)
  })
})
