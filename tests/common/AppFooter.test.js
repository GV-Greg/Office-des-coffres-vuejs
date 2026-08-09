import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import AppFooter from '../../src/components/AppFooter.vue'
import { useCookieStore } from '../../src/stores/cookieStore'

const i18n = createI18n({
  legacy: false,
  locale: 'fr',
  messages: {
    fr: {
      Common: { SiteName: 'Office des coffres' },
      Cookies: { Button: { Preferences: 'Gérer mes préférences' } }
    }
  }
})

function mountFooter() {
  return mount(AppFooter, {
    global: {
      plugins: [
        createTestingPinia({ createSpy: vi.fn }),
        i18n
      ]
    }
  })
}

describe('AppFooter', () => {
  it('affiche le nom du site', () => {
    const wrapper = mountFooter()
    expect(wrapper.text()).toContain('Office des coffres')
  })

  it('ouvre la modale de préférences au clic sur Gérer mes préférences', async () => {
    const wrapper = mountFooter()
    const store = useCookieStore()
    const button = wrapper.findAll('button').find((b) => b.text().includes('Gérer mes préférences'))
    await button.trigger('click')

    expect(store.openPreferencesModal).toHaveBeenCalled()
  })
})
