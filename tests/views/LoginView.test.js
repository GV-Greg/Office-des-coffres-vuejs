import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import LoginView from '../../src/views/auth/LoginView.vue'
import SelectorMenu from '../../src/components/SelectorMenu.vue'
import { useAuthStore } from '../../src/stores/authStore'

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
        UnvalidatedWarning: 'Contactez-moi dans le jeu.'
      },
      Auth: {
        UsernamePlaceholder: 'Entrez votre pseudo',
        PasswordPlaceholder: 'Entrez votre mot de passe',
        Errors: {
          RequiredFields: "Vous n'avez pas rempli les champs requis !",
          UsernameTooLong: 'Le pseudo doit contenir moins de 190 caractères !',
          PasswordTooShort: 'Le mot de passe doit contenir plus de 8 caractères !',
          PasswordTooLong: 'Le mot de passe doit contenir moins de 190 caractères !'
        }
      },
      username: 'pseudo',
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

async function fillAndSubmit(wrapper, { username = 'Buldo', password = 'password123' } = {}) {
  await wrapper.find('input[name="username"]').setValue(username)
  await wrapper.find('input[name="password"]').setValue(password)
  await wrapper.find('form').trigger('submit')
  await wrapper.vm.$nextTick()
}

describe('LoginView', () => {
  it('affiche le sélecteur thème/langue (dark mode + langue toujours disponibles)', () => {
    const wrapper = mountLogin()
    expect(wrapper.findComponent(SelectorMenu).exists()).toBe(true)
  })

  it("n'affiche pas le bandeau de compte non validé par défaut", () => {
    const wrapper = mountLogin()
    expect(wrapper.find('[data-testid="unvalidated-warning"]').isVisible()).toBe(false)
  })

  it("affiche le bandeau si le compte n'est pas encore validé", async () => {
    const wrapper = mountLogin()
    const authStore = useAuthStore()
    authStore.login.mockRejectedValueOnce({ response: { data: { message: 'Compte non validé.' } } })

    await fillAndSubmit(wrapper)

    expect(wrapper.find('[data-testid="unvalidated-warning"]').isVisible()).toBe(true)
  })

  it("n'affiche pas le bandeau pour une autre erreur (ex. mauvais mot de passe)", async () => {
    const wrapper = mountLogin()
    const authStore = useAuthStore()
    authStore.login.mockRejectedValueOnce({ response: { data: { message: 'Identifiants incorrects.' } } })

    await fillAndSubmit(wrapper)

    expect(wrapper.find('[data-testid="unvalidated-warning"]').isVisible()).toBe(false)
  })
})
