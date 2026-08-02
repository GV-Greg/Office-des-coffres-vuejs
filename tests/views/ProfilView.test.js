import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import ProfilView from '../../src/views/auth/ProfilView.vue'
import fr from '../../src/locales/fr.json'
import en from '../../src/locales/en.json'

const i18n = createI18n({
  legacy: false,
  locale: 'fr',
  messages: { fr, en }
})

const mockUser = { id: 1, email: 'test@test.com', pseudo: 'Artifice', is_validated: false }

function mountProfil(user) {
  return mount(ProfilView, {
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          initialState: { auth: { user, token: 'tok' } }
        }),
        i18n
      ],
      stubs: { NavMenu: true }
    }
  })
}

describe('ProfilView', () => {
  it('affiche le pseudo du compte connecté', () => {
    const wrapper = mountProfil(mockUser)
    expect(wrapper.text()).toContain('Artifice')
  })

  it('affiche le message de compte en attente de validation si non validé', () => {
    const wrapper = mountProfil({ ...mockUser, is_validated: false })
    expect(wrapper.text()).toContain('Compte en attente de validation')
  })

  it('affiche le message de compte validé si validé', () => {
    const wrapper = mountProfil({ ...mockUser, is_validated: true })
    expect(wrapper.text()).toContain('Votre compte est validé.')
    expect(wrapper.text()).not.toContain('Compte en attente de validation')
  })
})
