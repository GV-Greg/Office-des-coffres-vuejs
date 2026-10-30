import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import { useAuthStore } from '../../src/stores/authStore'
import VerifyEmailChangeView from '../../src/views/auth/VerifyEmailChangeView.vue'
import ChangeEmailModal from '../../src/components/ChangeEmailModal.vue'
import ChangePasswordModal from '../../src/components/ChangePasswordModal.vue'

vi.mock('notivue', () => ({ push: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../src/api.js', () => ({ http: { patch: vi.fn(), get: vi.fn() } }))

// ─── i18n minimal (clés réelles) ──────────────────────────────────────────────
const i18n = createI18n({
  legacy: false,
  locale: 'fr',
  messages: {
    fr: {
      Common: { SiteName: 'Office des coffres' },
      Login: { Heading: 'Se connecter' },
      VerifyEmailChange: {
        Verifying: 'Vérification en cours…',
        SuccessTitle: 'Adresse email mise à jour',
        SuccessText: 'Votre nouvelle adresse est désormais active. Reconnectez-vous pour continuer.',
        InvalidLink: 'Ce lien de confirmation est invalide ou a expiré.',
        LoginButton: 'Se connecter',
      },
      Profil: {
        Account: {
          Email: 'Adresse email',
          ShowPassword: 'Afficher',
          HidePassword: 'Masquer',
          EmailModal: {
            Title: 'Modifier l\'adresse email',
            CurrentPasswordLabel: 'Mot de passe actuel',
            NewEmailLabel: 'Nouvelle adresse email',
            Submit: 'Envoyer le lien de confirmation',
            Success: 'Lien envoyé !',
            SuccessText: 'Un lien de confirmation a été envoyé à la nouvelle adresse.',
            SuccessNote: 'Votre adresse email actuelle ne change pas tant que vous n\'avez pas cliqué le lien.',
            Close: 'Fermer',
          },
          PasswordModal: {
            Title: 'Changer le mot de passe',
            CurrentPasswordLabel: 'Mot de passe actuel',
            NewPasswordLabel: 'Nouveau mot de passe',
            ConfirmPasswordLabel: 'Confirmation',
            Submit: 'Changer le mot de passe',
            NewSection: 'Nouveau mot de passe',
          },
        },
      },
    },
  },
})

// ─── VerifyEmailChangeView ─────────────────────────────────────────────────────

async function mountVerifyEmailChange(query = {}, { confirmResult, rejectWith } = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/verify-email-change', name: 'verify-email-change', component: VerifyEmailChangeView },
      { path: '/login', name: 'login', component: { template: '<div/>' } },
    ],
  })
  // Attendre que la route soit résolue AVANT de monter : onMounted lit route.query immédiatement.
  await router.push({ path: '/verify-email-change', query })

  const pinia = createTestingPinia({ createSpy: vi.fn })
  const authStore = useAuthStore(pinia)

  // Le mock DOIT être posé avant le montage : onMounted appelle confirmEmailChange dès le premier tick.
  if (rejectWith) {
    authStore.confirmEmailChange.mockRejectedValueOnce(rejectWith)
  } else if (confirmResult !== undefined || query.id) {
    authStore.confirmEmailChange.mockResolvedValueOnce(undefined)
  }

  const wrapper = mount(VerifyEmailChangeView, {
    global: { plugins: [pinia, i18n, router] },
  })

  return { wrapper, authStore }
}

describe('VerifyEmailChangeView', () => {
  it('affiche « Vérification en cours » pendant l\'appel', async () => {
    // La promesse ne résout jamais : l'état reste 'verifying'
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const authStore = useAuthStore(pinia)
    authStore.confirmEmailChange.mockReturnValue(new Promise(() => {}))

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/verify-email-change', name: 'verify-email-change', component: VerifyEmailChangeView },
        { path: '/login', name: 'login', component: { template: '<div/>' } },
      ],
    })
    await router.push({ path: '/verify-email-change', query: { id: '1', hash: 'abc', expires: '9999999999', signature: 'sig' } })

    const wrapper = mount(VerifyEmailChangeView, { global: { plugins: [pinia, i18n, router] } })
    expect(wrapper.find('[role="status"]').text()).toContain('Vérification en cours')
  })

  it('affiche le succès et le bouton de connexion après confirmation réussie', async () => {
    const { wrapper, authStore } = await mountVerifyEmailChange(
      { id: '1', hash: 'abc', expires: '9999999999', signature: 'sig' },
    )
    await flushPromises()
    expect(wrapper.text()).toContain('mise à jour')
    expect(wrapper.text()).toContain('Se connecter')
    expect(authStore.clearSession).toHaveBeenCalled()
  })

  it('affiche l\'erreur si les paramètres sont absents', async () => {
    const { wrapper } = await mountVerifyEmailChange({})
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toContain('invalide')
  })

  it('affiche l\'erreur si confirmEmailChange rejette', async () => {
    const { wrapper, authStore } = await mountVerifyEmailChange(
      { id: '1', hash: 'bad', expires: '9999999999', signature: 'sig' },
      { rejectWith: new Error('invalid') },
    )
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toContain('invalide')
    expect(authStore.clearSession).not.toHaveBeenCalled()
  })
})

// ─── ChangeEmailModal ──────────────────────────────────────────────────────────

function mountEmailModal(show = true) {
  return mount(ChangeEmailModal, {
    props: { show },
    global: { plugins: [i18n] },
  })
}

describe('ChangeEmailModal', () => {
  it('n\'est pas rendu quand show=false', () => {
    const wrapper = mountEmailModal(false)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('affiche le formulaire quand show=true', () => {
    const wrapper = mountEmailModal(true)
    expect(wrapper.find('[data-testid="change-email-current-password"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="change-email-new"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="change-email-submit"]').exists()).toBe(true)
  })

  it('émet confirm avec les valeurs saisies', async () => {
    const wrapper = mountEmailModal(true)
    await wrapper.find('[data-testid="change-email-current-password"]').setValue('motdepasse')
    await wrapper.find('[data-testid="change-email-new"]').setValue('new@example.com')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('confirm')).toHaveLength(1)
    const [payload] = wrapper.emitted('confirm')[0]
    expect(payload.currentPassword).toBe('motdepasse')
    expect(payload.newEmail).toBe('new@example.com')
  })

  it('affiche l\'écran de succès après onSuccess()', async () => {
    const wrapper = mountEmailModal(true)
    await wrapper.find('[data-testid="change-email-current-password"]').setValue('motdepasse')
    await wrapper.find('[data-testid="change-email-new"]').setValue('new@example.com')
    await wrapper.find('form').trigger('submit')
    const [, callbacks] = wrapper.emitted('confirm')[0]
    callbacks.onSuccess()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="change-email-submit"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Lien envoyé')
  })

  it('affiche le message d\'erreur via onError()', async () => {
    const wrapper = mountEmailModal(true)
    await wrapper.find('[data-testid="change-email-current-password"]').setValue('motdepasse')
    await wrapper.find('[data-testid="change-email-new"]').setValue('bad@example.com')
    await wrapper.find('form').trigger('submit')
    const [, callbacks] = wrapper.emitted('confirm')[0]
    callbacks.onError('Email déjà utilisé.')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="change-email-error"]').text()).toBe('Email déjà utilisé.')
  })

  it('remet à zéro le formulaire à la réouverture', async () => {
    const wrapper = mountEmailModal(true)
    await wrapper.find('[data-testid="change-email-current-password"]').setValue('secret')
    await wrapper.setProps({ show: false })
    await wrapper.setProps({ show: true })
    expect(wrapper.find('[data-testid="change-email-current-password"]').element.value).toBe('')
  })

  it('affiche l\'email actuel en lecture seule si fourni', () => {
    const wrapper = mount(ChangeEmailModal, {
      props: { show: true, currentEmail: 'greg@example.com' },
      global: { plugins: [i18n] },
    })
    expect(wrapper.text()).toContain('greg@example.com')
  })

  it('bascule le champ mot de passe entre password et text', async () => {
    const wrapper = mountEmailModal(true)
    const input = wrapper.find('[data-testid="change-email-current-password"]')
    expect(input.element.type).toBe('password')
    await wrapper.find('[data-testid="change-email-toggle-password"]').trigger('click')
    expect(input.element.type).toBe('text')
    await wrapper.find('[data-testid="change-email-toggle-password"]').trigger('click')
    expect(input.element.type).toBe('password')
  })

  it('remet le toggle à password à la réouverture', async () => {
    const wrapper = mountEmailModal(true)
    await wrapper.find('[data-testid="change-email-toggle-password"]').trigger('click')
    expect(wrapper.find('[data-testid="change-email-current-password"]').element.type).toBe('text')
    await wrapper.setProps({ show: false })
    await wrapper.setProps({ show: true })
    expect(wrapper.find('[data-testid="change-email-current-password"]').element.type).toBe('password')
  })
})

// ─── ChangePasswordModal ───────────────────────────────────────────────────────

function mountPasswordModal(show = true) {
  return mount(ChangePasswordModal, {
    props: { show },
    global: { plugins: [i18n] },
  })
}

describe('ChangePasswordModal', () => {
  it('affiche les trois champs quand show=true', () => {
    const wrapper = mountPasswordModal(true)
    expect(wrapper.find('[data-testid="change-password-current"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="change-password-new"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="change-password-confirm"]').exists()).toBe(true)
  })

  it('émet confirm avec les valeurs saisies', async () => {
    const wrapper = mountPasswordModal(true)
    await wrapper.find('[data-testid="change-password-current"]').setValue('ancien')
    await wrapper.find('[data-testid="change-password-new"]').setValue('nouveau123')
    await wrapper.find('[data-testid="change-password-confirm"]').setValue('nouveau123')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('confirm')).toHaveLength(1)
    const [payload] = wrapper.emitted('confirm')[0]
    expect(payload.currentPassword).toBe('ancien')
    expect(payload.newPassword).toBe('nouveau123')
    expect(payload.passwordConfirmation).toBe('nouveau123')
  })

  it('affiche le message d\'erreur via onError()', async () => {
    const wrapper = mountPasswordModal(true)
    await wrapper.find('[data-testid="change-password-current"]').setValue('ancien')
    await wrapper.find('[data-testid="change-password-new"]').setValue('nouveau123')
    await wrapper.find('[data-testid="change-password-confirm"]').setValue('nouveau123')
    await wrapper.find('form').trigger('submit')
    const [, callbacks] = wrapper.emitted('confirm')[0]
    callbacks.onError('Mot de passe incorrect.')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="change-password-error"]').text()).toBe('Mot de passe incorrect.')
  })

  it('bascule le champ actuel indépendamment du nouveau', async () => {
    const wrapper = mountPasswordModal(true)
    const current = wrapper.find('[data-testid="change-password-current"]')
    const newPw = wrapper.find('[data-testid="change-password-new"]')
    expect(current.element.type).toBe('password')
    expect(newPw.element.type).toBe('password')

    await wrapper.find('[data-testid="toggle-current-pw"]').trigger('click')
    expect(current.element.type).toBe('text')
    expect(newPw.element.type).toBe('password')
  })

  it('bascule nouveau et confirmation ensemble via un seul toggle', async () => {
    const wrapper = mountPasswordModal(true)
    const newPw = wrapper.find('[data-testid="change-password-new"]')
    const confirm = wrapper.find('[data-testid="change-password-confirm"]')
    expect(newPw.element.type).toBe('password')
    expect(confirm.element.type).toBe('password')

    await wrapper.find('[data-testid="toggle-new-pw"]').trigger('click')
    expect(newPw.element.type).toBe('text')
    expect(confirm.element.type).toBe('text')
  })

  it('remet les deux toggles à password à la réouverture', async () => {
    const wrapper = mountPasswordModal(true)
    await wrapper.find('[data-testid="toggle-current-pw"]').trigger('click')
    await wrapper.find('[data-testid="toggle-new-pw"]').trigger('click')
    await wrapper.setProps({ show: false })
    await wrapper.setProps({ show: true })
    expect(wrapper.find('[data-testid="change-password-current"]').element.type).toBe('password')
    expect(wrapper.find('[data-testid="change-password-new"]').element.type).toBe('password')
  })
})
