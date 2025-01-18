import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import CookiesModal from '../../src/components/CookiesModal.vue'
import { useCookieStore } from '../../src/stores/cookieStore'

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
          Decline: 'Refuser'
        },
        Required: 'Requis'
      }
    }
  }
})

describe('CookiesModal', () => {
  let wrapper
  let store

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
    store = useCookieStore()
  })

  it('should not show modal when show prop is false', async () => {
    await wrapper.setProps({ show: false })
    expect(wrapper.find('.cookie-modal').exists()).toBe(false)
  })

  it('should show modal when show prop is true', () => {
    expect(wrapper.find('.cookie-modal').exists()).toBe(true)
  })

  it('should have required cookies checked and disabled', () => {
    const requiredCheckbox = wrapper.find('input[type="checkbox"][disabled]')
    expect(requiredCheckbox.element.checked).toBe(true)
    expect(requiredCheckbox.element.disabled).toBe(true)
  })

  it('should emit save event with required cookies when declining', async () => {
    const declineButton = wrapper.find('button:contains("Refuser")')
    await declineButton.trigger('click')
    
    const emitted = wrapper.emitted('decline')
    expect(emitted).toBeTruthy()
    expect(emitted[0][0]).toEqual(['functional'])
  })

  it('should emit save event with selected cookies when saving', async () => {
    // Simulate selecting session cookie
    const sessionCheckbox = wrapper.find('input[type="checkbox"]:not([disabled])')
    await sessionCheckbox.setValue(true)
    
    const saveButton = wrapper.find('button:contains("Enregistrer mes choix")')
    await saveButton.trigger('click')
    
    const emitted = wrapper.emitted('save')
    expect(emitted).toBeTruthy()
    expect(emitted[0][0]).toContain('session')
    expect(emitted[0][0]).toContain('functional') // Required cookie should always be included
  })

  it('should automatically include required cookies in preferences', async () => {
    await wrapper.vm.$nextTick()
    expect(store.acceptedCookies).toContain('functional')
  })
})
