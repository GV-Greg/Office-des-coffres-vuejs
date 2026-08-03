import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import RegisterView from '../../src/views/auth/RegisterView.vue'
import SelectorMenu from '../../src/components/SelectorMenu.vue'

vi.mock('notivue', () => ({
  push: { error: vi.fn() }
}))

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
      Register: {
        BackLink: 'Retour',
        Heading: 'Créez votre compte',
        SubmitButton: "S'enregistrer"
      },
      Auth: {
        UsernamePlaceholder: 'Entrez votre pseudo',
        EmailPlaceholder: 'Entrez votre email',
        PasswordPlaceholder: 'Entrez votre mot de passe',
        ConfirmationPlaceholder: 'Confirmez votre mot de passe',
        Errors: {
          RequiredFields: "Vous n'avez pas rempli les champs requis !",
          UsernameTooLong: 'Le pseudo doit contenir moins de 190 caractères !',
          EmailTooLong: "L'email doit contenir moins de 190 caractères !",
          PasswordTooShort: 'Le mot de passe doit contenir plus de 8 caractères !',
          PasswordTooLong: 'Le mot de passe doit contenir moins de 190 caractères !',
          ConfirmationMismatch: "La confirmation du mot de passe n'est pas identique à celui-ci !"
        }
      },
      username: 'pseudo',
      password: 'mot de passe',
      email: 'email',
      confirmation: 'confirmation du mot de passe'
    }
  }
})

function mountRegister() {
  return mount(RegisterView, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn }), i18n],
      stubs: { RouterLink: true, SelectorMenu: true }
    }
  })
}

describe('RegisterView', () => {
  it('affiche le sélecteur thème/langue (dark mode + langue toujours disponibles)', () => {
    const wrapper = mountRegister()
    expect(wrapper.findComponent(SelectorMenu).exists()).toBe(true)
  })
})
