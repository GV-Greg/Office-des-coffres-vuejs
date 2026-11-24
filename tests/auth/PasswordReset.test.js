import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import ForgotPasswordView from '../../src/views/auth/ForgotPasswordView.vue'
import ResetPasswordView from '../../src/views/auth/ResetPasswordView.vue'
import LoginView from '../../src/views/auth/LoginView.vue'
import router from '../../src/router/index.js'
import { useAuthStore } from '../../src/stores/authStore'
import { http } from '../../src/api.js'
import { push } from 'notivue'
import { withRealLocales } from '../helpers/withRealLocales.js'

/*
  « Mot de passe oublié » côté joueur (fil admin/echanges/mot-de-passe-oublie, 24/11/2026). Le serveur répond TOUJOURS pareil à la demande (pas d'oracle) : la page
  dit la même chose dans tous les cas. Le lien de l'email arrive sur /reset-password?token&email ; un jeton faux, expiré ou déjà utilisé n'a qu'UNE réponse
  (`invalid_token`). Aucun stockage local, aucun jeton gardé.
*/
vi.mock('notivue', () => ({ push: { error: vi.fn(), success: vi.fn() } }))
vi.mock('../../src/api.js', () => ({ http: { post: vi.fn(), get: vi.fn() } }))

const i18n = locale => createI18n({ legacy: false, locale, messages: withRealLocales({ fr: {}, en: {} }) })
const find = (w, id) => w.find(`[data-testid="${id}"]`)

beforeEach(() => vi.clearAllMocks())

function mountForgot({ locale = 'fr' } = {}) {
  return mount(ForgotPasswordView, { global: { plugins: [createTestingPinia({ createSpy: vi.fn }), i18n(locale)], stubs: { RouterLink: true, SelectorMenu: true } } })
}

async function mountReset(query = { token: 'jeton-du-lien', email: 'joueur@test.com' }, { locale = 'fr' } = {}) {
  const testRouter = createRouter({ history: createMemoryHistory(), routes: [{ path: '/reset-password', name: 'reset-password', component: ResetPasswordView }] })
  testRouter.push({ path: '/reset-password', query })
  await testRouter.isReady()
  const pinia = createTestingPinia({ createSpy: vi.fn })
  const wrapper = mount(ResetPasswordView, { global: { plugins: [pinia, i18n(locale), testRouter], stubs: { RouterLink: true, SelectorMenu: true } } })

  return { wrapper, authStore: useAuthStore(pinia) }
}

describe('ForgotPasswordView — la demande', () => {
  it('envoie l\'adresse saisie, puis dit la MÊME chose quel que soit le compte (« si un compte existe… »)', async () => {
    const w = mountForgot()
    const authStore = useAuthStore()
    authStore.forgotPassword.mockResolvedValueOnce({ success: true })

    await w.find('input[name="email"]').setValue('joueur@test.com')
    await find(w, 'forgot-form').trigger('submit')
    await flushPromises()

    expect(authStore.forgotPassword).toHaveBeenCalledWith('joueur@test.com')
    expect(find(w, 'forgot-sent').text()).toContain('Si un compte existe pour cette adresse')
    expect(find(w, 'forgot-sent').text()).not.toMatch(/aucun compte|n'existe pas/i)
    expect(find(w, 'forgot-form').exists()).toBe(false)
    expect(find(w, 'back-to-login').exists()).toBe(true)
  })

  it('un champ vide ou une adresse trop longue ne part pas', async () => {
    const w = mountForgot()
    const authStore = useAuthStore()

    await find(w, 'forgot-form').trigger('submit')
    await w.find('input[name="email"]').setValue(`${'a'.repeat(200)}@test.com`)
    await find(w, 'forgot-form').trigger('submit')

    expect(authStore.forgotPassword).not.toHaveBeenCalled()
    expect(push.error).toHaveBeenCalledTimes(2)
  })

  it('trop de demandes (429) : un message de patience, pas une erreur brute ; hors ligne : l\'erreur réseau', async () => {
    const w = mountForgot()
    const authStore = useAuthStore()
    authStore.forgotPassword.mockRejectedValueOnce({ response: { status: 429 } })
    await w.find('input[name="email"]').setValue('joueur@test.com')
    await find(w, 'forgot-form').trigger('submit')
    await flushPromises()
    expect(push.error).toHaveBeenLastCalledWith('Trop de tentatives : patientez une minute avant de réessayer.')
    expect(find(w, 'forgot-sent').exists()).toBe(false) // rien n'est parti : on peut réessayer

    authStore.forgotPassword.mockRejectedValueOnce({})
    await find(w, 'forgot-form').trigger('submit')
    await flushPromises()
    expect(push.error).toHaveBeenLastCalledWith('Impossible de contacter le serveur. Réessayez plus tard.')
  })

  it('pas de double envoi pendant l\'attente', async () => {
    const w = mountForgot()
    const authStore = useAuthStore()
    let release
    authStore.forgotPassword.mockImplementationOnce(() => new Promise((resolve) => { release = resolve }))
    await w.find('input[name="email"]').setValue('joueur@test.com')

    await find(w, 'forgot-form').trigger('submit')
    await find(w, 'forgot-form').trigger('submit')
    expect(authStore.forgotPassword).toHaveBeenCalledTimes(1)
    expect(find(w, 'forgot-submit').attributes('disabled')).toBeDefined()
    release({ success: true })
    await flushPromises()
  })

  it('en anglais', () => {
    expect(mountForgot({ locale: 'en' }).find('h2').text()).toBe('Forgot your password')
  })
})

describe('ResetPasswordView — le nouveau mot de passe', () => {
  const fill = async (w, password, confirmation = password) => {
    await w.find('input[name="password"]').setValue(password)
    await w.find('input[name="confirmation"]').setValue(confirmation)
    await find(w, 'reset-form').trigger('submit')
    await flushPromises()
  }

  it('envoie le jeton et l\'adresse du lien avec le nouveau mot de passe, puis propose de se connecter', async () => {
    const { wrapper, authStore } = await mountReset()
    authStore.resetPassword.mockResolvedValueOnce({ success: true })

    await fill(wrapper, 'nouveau_mot_de_passe_123')

    expect(authStore.resetPassword).toHaveBeenCalledWith({ token: 'jeton-du-lien', email: 'joueur@test.com', password: 'nouveau_mot_de_passe_123', password_confirmation: 'nouveau_mot_de_passe_123' })
    expect(find(wrapper, 'reset-done').text()).toContain('Mot de passe modifié')
    expect(find(wrapper, 'go-login').exists()).toBe(true)
    expect(find(wrapper, 'reset-form').exists()).toBe(false)
  })

  it('mot de passe trop court, trop long ou confirmation différente : rien ne part', async () => {
    const { wrapper, authStore } = await mountReset()

    await fill(wrapper, 'court')
    await fill(wrapper, 'a'.repeat(200))
    await fill(wrapper, 'nouveau_mot_de_passe_123', 'different')

    expect(authStore.resetPassword).not.toHaveBeenCalled()
    expect(push.error).toHaveBeenCalledTimes(3)
  })

  it('jeton faux, expiré ou déjà utilisé : UNE page « lien invalide ou expiré » et le chemin pour en redemander un', async () => {
    const { wrapper, authStore } = await mountReset()
    authStore.resetPassword.mockRejectedValueOnce({ response: { status: 422, data: { success: false, code: 'invalid_token' } } })

    await fill(wrapper, 'nouveau_mot_de_passe_123')

    expect(find(wrapper, 'reset-invalid').text()).toContain('Lien invalide ou expiré')
    expect(find(wrapper, 'ask-again').exists()).toBe(true)
    expect(find(wrapper, 'reset-form').exists()).toBe(false)
  })

  it('un lien incomplet (sans jeton ou sans adresse) : la page invalide d\'emblée, aucune demande au serveur', async () => {
    for (const query of [{}, { token: 'jeton' }, { email: 'joueur@test.com' }]) {
      const { wrapper, authStore } = await mountReset(query)

      expect(find(wrapper, 'reset-invalid').exists()).toBe(true)
      expect(find(wrapper, 'reset-form').exists()).toBe(false)
      expect(authStore.resetPassword).not.toHaveBeenCalled()
    }
  })

  it('une autre erreur (réseau, 429) : un message, le formulaire reste pour réessayer', async () => {
    const { wrapper, authStore } = await mountReset()
    authStore.resetPassword.mockRejectedValueOnce({ response: { status: 429 } })

    await fill(wrapper, 'nouveau_mot_de_passe_123')

    expect(push.error).toHaveBeenLastCalledWith('Trop de tentatives : patientez une minute avant de réessayer.')
    expect(find(wrapper, 'reset-form').exists()).toBe(true)
    expect(find(wrapper, 'reset-invalid').exists()).toBe(false)
  })

  it('en anglais', async () => {
    const { wrapper } = await mountReset(undefined, { locale: 'en' })

    expect(wrapper.find('h2').text()).toBe('Choose a new password')
  })

  it('ne garde rien dans le navigateur : ni jeton, ni mot de passe', async () => {
    const write = vi.spyOn(Storage.prototype, 'setItem')
    const { wrapper, authStore } = await mountReset()
    authStore.resetPassword.mockResolvedValueOnce({ success: true })

    await fill(wrapper, 'nouveau_mot_de_passe_123')

    expect(write).not.toHaveBeenCalled()
    write.mockRestore()
  })
})

describe('LoginView — le lien « Mot de passe oublié ? »', () => {
  it('la connexion propose le lien vers la demande, sous le champ du mot de passe', () => {
    const w = mount(LoginView, { global: { plugins: [createTestingPinia({ createSpy: vi.fn }), i18n('fr')], stubs: { RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' }, SelectorMenu: true } } })
    const link = find(w, 'forgot-link')

    expect(link.exists()).toBe(true)
    expect(link.text()).toBe('Mot de passe oublié ?')
    expect(JSON.parse(link.attributes('data-to'))).toEqual({ name: 'forgot-password' })
    expect(link.element.closest('.form-group').querySelector('input[name="password"]')).not.toBeNull()
  })
})

describe('authStore — les deux appels, sans jeton d\'accès', () => {
  it('forgotPassword envoie l\'adresse ; resetPassword envoie jeton, adresse, mot de passe et confirmation', async () => {
    setActivePinia(createPinia())
    http.post.mockResolvedValue({ data: { success: true } })
    const authStore = useAuthStore()

    await authStore.forgotPassword('joueur@test.com')
    await authStore.resetPassword({ token: 't', email: 'joueur@test.com', password: 'p'.repeat(8), password_confirmation: 'p'.repeat(8) })

    expect(http.post).toHaveBeenNthCalledWith(1, 'auth/forgot-password', { email: 'joueur@test.com' })
    expect(http.post).toHaveBeenNthCalledWith(2, 'auth/reset-password', { token: 't', email: 'joueur@test.com', password: 'p'.repeat(8), password_confirmation: 'p'.repeat(8) })
  })
})

describe('routeur — deux pages publiques, chargées à la demande', () => {
  it('/forgot-password et /reset-password existent, sont publiques et sans garde « déjà connecté »', () => {
    for (const [name, path] of [['forgot-password', '/forgot-password'], ['reset-password', '/reset-password']]) {
      const route = router.getRoutes().find(r => r.name === name)

      expect(route.path).toBe(path)
      expect(route.meta.public).toBe(true)
      expect(route.beforeEnter).toBeUndefined() // un joueur connecté qui clique le lien de l'email doit pouvoir l'utiliser
      expect(typeof route.components.default).toBe('function') // import dynamique
    }
  })
})
