import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import CookiesModal from '../../src/components/CookiesModal.vue'
import SwitchButton from '../../src/components/buttons/SwitchButton.vue'

// Mock translations
const i18n = createI18n({
  locale: 'fr',
  messages: {
    fr: {
      Cookies: {
        Modal: {
          Title: 'Gérer mes préférences de cookies'
        },
        Button: {
          Save: 'Enregistrer mes choix',
          Cancel: 'Annuler'
        },
        Required: 'Requis'
      }
    }
  }
})

describe('CookiesModal', () => {
  let wrapper

  const mockPreferences = [
    {
      title: 'Cookie fonctionnel',
      description: 'Description du cookie fonctionnel',
      items: [
        {
          label: 'Cookie essentiel',
          value: 'functional',
          isRequired: true
        }
      ]
    },
    {
      title: 'Cookie de session',
      description: 'Description du cookie de session',
      items: [
        {
          label: 'Cookie de session',
          value: 'session',
          isRequired: false
        }
      ]
    }
  ]

  beforeEach(() => {
    wrapper = mount(CookiesModal, {
      props: {
        show: true,
        preferences: mockPreferences
      },
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn
          }),
          i18n
        ]
      }
    })
  })

  it('should not show modal when show prop is false', async () => {
    await wrapper.setProps({ show: false })
    expect(wrapper.find('.cookie-modal').exists()).toBe(false)
  })

  it('should show modal when show prop is true', () => {
    expect(wrapper.find('.cookie-modal').exists()).toBe(true)
  })

  it('should have required cookies checked and disabled', () => {
    const switches = wrapper.findAllComponents(SwitchButton)
    const requiredSwitch = switches[0] // seul item de la 1ère catégorie, isRequired: true

    expect(requiredSwitch.props('checked')).toBe(true)
    expect(requiredSwitch.props('disabled')).toBe(true)
  })

  it('should not toggle a required (disabled) switch on click', async () => {
    const switches = wrapper.findAllComponents(SwitchButton)
    const requiredSwitch = switches[0]

    await requiredSwitch.find('button').trigger('click')

    // handleCookieChange ignore les items requis : aucun 'save' ne doit
    // refléter un changement, la prop reste inchangée
    expect(requiredSwitch.props('checked')).toBe(true)
  })

  it('should emit save event with selected cookies when saving', async () => {
    const sessionSwitch = wrapper.findAllComponents(SwitchButton)[1] // catégorie session, isRequired: false
    await sessionSwitch.find('button').trigger('click')

    const saveButton = wrapper.findAll('button').find((b) => b.text().includes('Enregistrer mes choix'))
    await saveButton.trigger('click')

    const emitted = wrapper.emitted('save')
    expect(emitted).toBeTruthy()
    expect(emitted[0][0]).toContain('session')
    expect(emitted[0][0]).toContain('functional') // Cookie requis toujours inclus
  })

  it('should always include required cookies when saving, even without changes', async () => {
    const saveButton = wrapper.findAll('button').find((b) => b.text().includes('Enregistrer mes choix'))
    await saveButton.trigger('click')

    const emitted = wrapper.emitted('save')
    expect(emitted).toBeTruthy()
    expect(emitted[0][0]).toEqual(['functional'])
  })

  it('should emit close event when cancelling', async () => {
    const cancelButton = wrapper.findAll('button').find((b) => b.text().includes('Annuler'))
    await cancelButton.trigger('click')

    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
