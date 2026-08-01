import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import CookiesBanner from '../../src/components/CookiesBanner.vue'
import CookiesModal from '../../src/components/CookiesModal.vue'
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
          Accept: 'Accepter',
          Decline: 'Refuser'
        }
      }
    }
  }
})

// hasUserChoice est un getter dérivé de cookiePreferences (pas un state
// assignable) : on contrôle le scénario via initialState, pas en mutant
// le store après mount. showBanner est mis à jour dans onMounted() : le
// flush réactif n'est pas garanti synchrone au retour de mount(), d'où
// le nextTick systématique après montage.
async function mountBanner(cookiePreferences = null) {
  const wrapper = mount(CookiesBanner, {
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          initialState: { cookie: { cookiePreferences } }
        }),
        i18n
      ]
    }
  })
  await wrapper.vm.$nextTick()
  return wrapper
}

describe('CookiesBanner', () => {
  it('should not show banner if user has already made a choice', async () => {
    const wrapper = await mountBanner('all')
    expect(wrapper.find('.fixed.bottom-0').exists()).toBe(false)
  })

  it('should show banner if user has not made a choice', async () => {
    const wrapper = await mountBanner(null)
    expect(wrapper.find('.fixed.bottom-0').exists()).toBe(true)
  })

  it('should accept all cookies when clicking accept button', async () => {
    const wrapper = await mountBanner(null)
    const store = useCookieStore()
    const acceptButton = wrapper.findAll('button').find((b) => b.text().includes('Accepter'))
    await acceptButton.trigger('click')

    expect(store.acceptAllCookies).toHaveBeenCalled()
    expect(wrapper.find('.fixed.bottom-0').exists()).toBe(false)
  })

  it('should decline all non-required cookies when clicking decline button', async () => {
    const wrapper = await mountBanner(null)
    const store = useCookieStore()
    const declineButton = wrapper.findAll('button').find((b) => b.text().includes('Refuser'))
    await declineButton.trigger('click')

    expect(store.declineAllCookies).toHaveBeenCalled()
    expect(wrapper.find('.fixed.bottom-0').exists()).toBe(false)
  })

  it('should open preferences modal when clicking preferences button', async () => {
    const wrapper = await mountBanner(null)
    const preferencesButton = wrapper.findAll('button').find((b) => b.text().includes('Gérer mes préférences'))
    await preferencesButton.trigger('click')

    expect(wrapper.findComponent(CookiesModal).props('show')).toBe(true)
  })
})
