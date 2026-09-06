import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import RegisterView from '../../src/views/auth/RegisterView.vue'
import SelectorMenu from '../../src/components/SelectorMenu.vue'
import { useAuthStore } from '../../src/stores/authStore'

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
        SubmitButton: "S'enregistrer",
        Modules: { Intro: 'En créant un compte gratuit, vous débloquez des outils privés — voir {privacyLink}.' }
      },
      Legal: { Cookies: { PrivacyPolicyLink: 'Politique de confidentialité' } },
      Auth: {
        EmailPlaceholder: 'Entrez votre email',
        PasswordPlaceholder: 'Entrez votre mot de passe',
        ConfirmationPlaceholder: 'Confirmez votre mot de passe',
        Errors: {
          RequiredFields: "Vous n'avez pas rempli les champs requis !",
          EmailTooLong: "L'email doit contenir moins de 190 caractères !",
          PasswordTooShort: 'Le mot de passe doit contenir plus de 8 caractères !',
          PasswordTooLong: 'Le mot de passe doit contenir moins de 190 caractères !',
          ConfirmationMismatch: "La confirmation du mot de passe n'est pas identique à celui-ci !"
        }
      },
      password: 'mot de passe',
      email: 'email',
      confirmation: 'confirmation du mot de passe'
    }
  }
})

// Stub maison plutôt que `RouterLink: true` : ce dernier n'expose pas le contenu du slot
// par défaut, ce qui masquerait le texte des liens (BackLink, pitch #11) dans les assertions.
const RouterLinkStub = {
  props: ['to'],
  template: '<a :href="typeof to === \'string\' ? to : JSON.stringify(to)"><slot /></a>',
}

function mountRegister() {
  return mount(RegisterView, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn }), i18n],
      stubs: { RouterLink: RouterLinkStub, SelectorMenu: true }
    }
  })
}

describe('RegisterView', () => {
  it('affiche le sélecteur thème/langue (dark mode + langue toujours disponibles)', () => {
    const wrapper = mountRegister()
    expect(wrapper.findComponent(SelectorMenu).exists()).toBe(true)
  })

  it('ne demande que email + mot de passe (plus de pseudo à l\'inscription)', () => {
    const wrapper = mountRegister()
    expect(wrapper.find('input[name="email"]').exists()).toBe(true)
    expect(wrapper.find('input[name="username"]').exists()).toBe(false)
  })

  it('affiche le pitch généraliste des modules débloqués par un compte (Cookies #11)', () => {
    const wrapper = mountRegister()
    expect(wrapper.text()).toContain('En créant un compte gratuit, vous débloquez des outils privés')
    expect(wrapper.text()).toContain('Politique de confidentialité')
  })

  it('masque le pitch une fois l\'inscription réussie (écran "vérifiez votre email")', async () => {
    const wrapper = mountRegister()
    const authStore = useAuthStore()
    authStore.register.mockResolvedValueOnce({ success: true })

    await wrapper.find('input[name="email"]').setValue('artifice@test.com')
    await wrapper.find('input[name="password"]').setValue('password123')
    await wrapper.find('input[name="confirmation"]').setValue('password123')
    await wrapper.find('form').trigger('submit')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).not.toContain('En créant un compte gratuit')
  })

  it('affiche un écran "vérifiez votre email" après inscription réussie', async () => {
    const wrapper = mountRegister()
    const authStore = useAuthStore()
    authStore.register.mockResolvedValueOnce({ success: true })

    await wrapper.find('input[name="email"]').setValue('artifice@test.com')
    await wrapper.find('input[name="password"]').setValue('password123')
    await wrapper.find('input[name="confirmation"]').setValue('password123')
    await wrapper.find('form').trigger('submit')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="check-email-message"]').exists()).toBe(true)
  })
})
