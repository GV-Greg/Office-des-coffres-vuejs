import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import HomeView from '../../src/views/HomeView.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'fr',
  messages: {
    fr: {
      Common: { SiteName: 'Office des coffres' },
      Home: {
        WelcomeMessage: "L'{brand} vous souhaite la bienvenue !",
        Description: 'Elle met à disposition des coffres...',
        UnderConstruction: "L'Office est actuellement en construction..."
      }
    }
  }
})

describe('HomeView', () => {
  it('renders properly', () => {
    const wrapper = mount(HomeView, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn }), i18n],
        stubs: { NavMenu: true }
      }
    })
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.text()).toContain('Office des coffres')
  })
})
