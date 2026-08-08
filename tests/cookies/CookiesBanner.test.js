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

// hasUserChoice est un getter dérivé de consent.choiceMadeAt (pas un state
// assignable) : on contrôle le scénario via initialState, pas en mutant le
// store après mount. showBanner est mis à jour dans onMounted() : le flush
// réactif n'est pas garanti synchrone au retour de mount(), d'où le nextTick
// systématique après montage.
const NO_CHOICE = { preferences: false, choiceMadeAt: null }
const CHOICE_MADE = { preferences: true, choiceMadeAt: 1_770_000_000_000 }

async function mountBanner(consent = NO_CHOICE) {
  const wrapper = mount(CookiesBanner, {
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          initialState: { cookie: { consent } }
        }),
        i18n
      ]
    }
  })
  await wrapper.vm.$nextTick()
  return wrapper
}

describe('CookiesBanner', () => {
  it("n'affiche pas la bannière si un choix a déjà été fait", async () => {
    const wrapper = await mountBanner(CHOICE_MADE)
    expect(wrapper.find('.fixed.bottom-0').exists()).toBe(false)
  })

  it("affiche la bannière tant qu'aucun choix n'a été fait", async () => {
    const wrapper = await mountBanner()
    expect(wrapper.find('.fixed.bottom-0').exists()).toBe(true)
  })

  it('accepte les préférences au clic sur Accepter', async () => {
    const wrapper = await mountBanner()
    const store = useCookieStore()
    const acceptButton = wrapper.findAll('button').find((b) => b.text().includes('Accepter'))
    await acceptButton.trigger('click')

    expect(store.acceptPreferences).toHaveBeenCalled()
    expect(wrapper.find('.fixed.bottom-0').exists()).toBe(false)
  })

  it('refuse les préférences au clic sur Refuser', async () => {
    const wrapper = await mountBanner()
    const store = useCookieStore()
    const declineButton = wrapper.findAll('button').find((b) => b.text().includes('Refuser'))
    await declineButton.trigger('click')

    expect(store.declinePreferences).toHaveBeenCalled()
    expect(wrapper.find('.fixed.bottom-0').exists()).toBe(false)
  })

  it("n'expose plus qu'une seule catégorie de consentement", async () => {
    // La catégorie « Session » a disparu : le jeton d'auth est exempté de consentement.
    const wrapper = await mountBanner()
    const categories = wrapper.findComponent(CookiesModal).props('preferences')

    expect(categories).toHaveLength(1)
    expect(categories[0].items).toHaveLength(1)
    expect(categories[0].items[0].value).toBe('preferences')
  })

  it('ouvre la modale au clic sur Gérer mes préférences', async () => {
    const wrapper = await mountBanner()
    const preferencesButton = wrapper.findAll('button').find((b) => b.text().includes('Gérer mes préférences'))
    await preferencesButton.trigger('click')

    expect(wrapper.findComponent(CookiesModal).props('show')).toBe(true)
  })
})
