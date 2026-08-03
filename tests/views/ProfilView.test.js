import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import ProfilView from '../../src/views/auth/ProfilView.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'fr',
  messages: {
    fr: {
      Profil: {
        Title: 'Profil de {pseudo}',
        Status: {
          Validated: 'Compte validé.',
          PendingTitle: 'Compte en attente de validation',
          PendingMessage: 'Contactez-moi dans le jeu.'
        }
      }
    }
  }
})

function mountProfil(user) {
  return mount(ProfilView, {
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          initialState: { auth: { user, token: null } }
        }),
        i18n
      ],
      stubs: { NavMenu: true }
    }
  })
}

describe('ProfilView', () => {
  it('affiche le pseudo du personnage', () => {
    const wrapper = mountProfil({ id: 1, pseudo: 'Artifice', is_validated: true })
    expect(wrapper.text()).toContain('Profil de Artifice')
  })

  it('affiche le message de validation si le compte est validé', () => {
    const wrapper = mountProfil({ id: 1, pseudo: 'Artifice', is_validated: true })
    expect(wrapper.text()).toContain('Compte validé.')
    expect(wrapper.text()).not.toContain('en attente de validation')
  })

  it("affiche le message d'attente si le compte n'est pas validé", () => {
    const wrapper = mountProfil({ id: 1, pseudo: 'Artifice', is_validated: false })
    expect(wrapper.text()).toContain('Compte en attente de validation')
    expect(wrapper.text()).not.toContain('Compte validé.')
  })
})
