import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import LoginView from '../../src/views/auth/LoginView.vue'
import SelectorMenu from '../../src/components/SelectorMenu.vue'
import { useAuthStore } from '../../src/stores/authStore'
import { useCookieStore } from '../../src/stores/cookieStore'

vi.mock('notivue', () => ({
  push: { error: vi.fn() }
}))

// Mock api.js (importé par authStore.js)
vi.mock('../../src/api.js', () => ({
  http: {
    post: vi.fn(),
    get: vi.fn(),
  }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'fr',
  messages: {
    fr: {
      Common: { SiteName: 'Office des coffres' },
      Login: {
        EnterWithoutAccount: 'Entrez sans compte',
        Heading: 'Connectez-vous',
        SubmitButton: 'Se connecter',
        NoAccount: "Vous n'avez pas de compte ?",
        RegisterLink: 'Enregistrez-vous!',
        UnverifiedWarning: 'Vérifiez votre boîte mail.',
        ResendButton: "Renvoyer l'email de vérification"
      },
      VerifyEmail: {
        ResendSuccess: 'Un nouveau lien vient de vous être envoyé.'
      },
      Auth: {
        EmailPlaceholder: 'Entrez votre email',
        PasswordPlaceholder: 'Entrez votre mot de passe',
        RememberMe: 'Rester connecté',
        Errors: {
          RequiredFields: "Vous n'avez pas rempli les champs requis !",
          EmailTooLong: "L'email doit contenir moins de 190 caractères !",
          PasswordTooShort: 'Le mot de passe doit contenir plus de 8 caractères !',
          PasswordTooLong: 'Le mot de passe doit contenir moins de 190 caractères !'
        }
      },
      email: 'email',
      password: 'mot de passe'
    }
  }
})

function mountLogin() {
  return mount(LoginView, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn }), i18n],
      stubs: { RouterLink: true, SelectorMenu: true }
    }
  })
}

async function fillAndSubmit(wrapper, { email = 'buldo@test.com', password = 'password123' } = {}) {
  await wrapper.find('input[name="email"]').setValue(email)
  await wrapper.find('input[name="password"]').setValue(password)
  await wrapper.find('form').trigger('submit')
  await wrapper.vm.$nextTick()
}

describe('LoginView', () => {
  it('affiche le sélecteur thème/langue (dark mode + langue toujours disponibles)', () => {
    const wrapper = mountLogin()
    expect(wrapper.findComponent(SelectorMenu).exists()).toBe(true)
  })

  it("n'affiche pas le bandeau email non vérifié par défaut", () => {
    const wrapper = mountLogin()
    expect(wrapper.find('[data-testid="unverified-warning"]').isVisible()).toBe(false)
  })

  it("affiche le bandeau si l'email n'est pas encore vérifié", async () => {
    const wrapper = mountLogin()
    const authStore = useAuthStore()
    authStore.login.mockRejectedValueOnce({ response: { data: { message: 'Email non vérifié.' } } })

    await fillAndSubmit(wrapper)

    expect(wrapper.find('[data-testid="unverified-warning"]').isVisible()).toBe(true)
  })

  it("n'affiche pas le bandeau pour une autre erreur (ex. mauvais mot de passe)", async () => {
    const wrapper = mountLogin()
    const authStore = useAuthStore()
    authStore.login.mockRejectedValueOnce({ response: { data: { message: 'Identifiants incorrects.' } } })

    await fillAndSubmit(wrapper)

    expect(wrapper.find('[data-testid="unverified-warning"]').isVisible()).toBe(false)
  })

  it('transmet remember_me=false par défaut (case "Rester connecté" non cochée)', async () => {
    const wrapper = mountLogin()
    const authStore = useAuthStore()
    authStore.login.mockRejectedValueOnce({ response: { data: { message: 'Identifiants incorrects.' } } })

    await fillAndSubmit(wrapper)

    expect(authStore.login).toHaveBeenCalledWith(expect.objectContaining({ remember_me: false }))
  })

  it('transmet remember_me=true quand la case "Rester connecté" est cochée', async () => {
    const wrapper = mountLogin()
    const authStore = useAuthStore()
    authStore.login.mockRejectedValueOnce({ response: { data: { message: 'Identifiants incorrects.' } } })

    await wrapper.find('input[name="remember_me"]').setValue(true)
    await fillAndSubmit(wrapper)

    expect(authStore.login).toHaveBeenCalledWith(expect.objectContaining({
      email: 'buldo@test.com', password: 'password123', remember_me: true,
    }))
  })
})

describe('LoginView — pré-remplissage "Rester connecté" (Refinement Option B)', () => {
  it('pré-coche la case et pré-remplit l\'email si mémorisés dans le cookieStore', () => {
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const cookieStore = useCookieStore(pinia)
    cookieStore.getComfortData.mockImplementation((key, fallback) => ({
      remember_me_preference: true,
      last_login_email: 'buldo@test.com',
    })[key] ?? fallback)

    const wrapper = mount(LoginView, {
      global: {
        plugins: [pinia, i18n],
        stubs: { RouterLink: true, SelectorMenu: true }
      }
    })

    expect(wrapper.find('input[name="email"]').element.value).toBe('buldo@test.com')
    expect(wrapper.find('input[name="remember_me"]').element.checked).toBe(true)
  })

  it("case décochée et email vide par défaut (rien mémorisé — pas de consentement, ou consentement retiré)", () => {
    const wrapper = mountLogin()

    expect(wrapper.find('input[name="email"]').element.value).toBe('')
    expect(wrapper.find('input[name="remember_me"]').element.checked).toBe(false)
  })
})
