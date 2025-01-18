import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import CookiesBanner from '../../src/components/CookiesBanner.vue'
import { useCookieStore } from '../../src/stores/cookieStore'

// Mock translations
const i18n = createI18n({
  locale: 'fr',
  messages: {
    fr: {
      Cookies: {
        Banner: {
          Title: 'Préférences des cookies',
          Description: 'Nous utilisons deux types de cookies pour vous offrir la meilleure expérience possible :'
        },
        Button: {
          Preferences: 'Gérer mes préférences',
          AcceptAuto: 'Accepter automatiquement'
        }
      }
    }
  }
})

describe('CookiesBanner', () => {
  let wrapper
  let store

  beforeEach(() => {
    // Create a fresh store before each test
    wrapper = mount(CookiesBanner, {
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

  it('should not show banner if user has already made a choice', async () => {
    store.hasUserChoice = true
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.fixed.bottom-0').exists()).toBe(false)
  })

  it('should show banner if user has not made a choice', async () => {
    store.hasUserChoice = false
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.fixed.bottom-0').exists()).toBe(true)
  })

  it('should accept all cookies when clicking accept button', async () => {
    const acceptButton = wrapper.find('button:contains("Accepter automatiquement")')
    await acceptButton.trigger('click')
    
    expect(store.acceptAllCookies).toHaveBeenCalled()
    expect(wrapper.find('.fixed.bottom-0').exists()).toBe(false)
  })

  it('should open preferences modal when clicking preferences button', async () => {
    const preferencesButton = wrapper.find('button:contains("Gérer mes préférences")')
    await preferencesButton.trigger('click')
    
    expect(wrapper.vm.showModal).toBe(true)
  })
})
