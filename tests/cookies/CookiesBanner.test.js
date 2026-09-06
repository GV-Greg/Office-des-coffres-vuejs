import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import CookiesBanner from '../../src/components/CookiesBanner.vue'
import CookiesModal from '../../src/components/CookiesModal.vue'
import { useCookieStore } from '../../src/stores/cookieStore'

vi.mock('notivue', () => ({ push: { error: vi.fn(), success: vi.fn() } }))

// Le mock notivue est un singleton de module : sans reset, l'historique des
// appels d'un test contamine les assertions "not.toHaveBeenCalled" du suivant.
afterEach(() => {
  vi.clearAllMocks()
})

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
          Decline: 'Refuser',
          Cancel: 'Annuler',
          Save: 'Enregistrer mes choix'
        },
        Saved: 'Vos préférences ont été enregistrées.',
        SaveError: "Vos préférences n'ont pas pu être enregistrées. Réessayez."
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
    const store = useCookieStore()
    const preferencesButton = wrapper.findAll('button').find((b) => b.text().includes('Gérer mes préférences'))
    await preferencesButton.trigger('click')

    expect(store.openPreferencesModal).toHaveBeenCalled()
  })

  it('reflète isPreferencesModalOpen du store sur la prop show de la modale', async () => {
    const wrapper = mount(CookiesBanner, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            initialState: { cookie: { consent: NO_CHOICE, isPreferencesModalOpen: true } }
          }),
          i18n
        ]
      }
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.findComponent(CookiesModal).props('show')).toBe(true)
  })

  // Régression : "Annuler" dans la modale (ouverte depuis NavBar/ProfilView, hors bannière)
  // ne doit pas faire réapparaître la bannière si l'utilisateur a déjà répondu.
  it("n'affiche pas la bannière si la modale est annulée alors qu'un choix a déjà été fait", async () => {
    const wrapper = mount(CookiesBanner, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            initialState: { cookie: { consent: CHOICE_MADE, isPreferencesModalOpen: true } }
          }),
          i18n
        ]
      }
    })
    await wrapper.vm.$nextTick()

    const cancelButton = wrapper.findComponent(CookiesModal).findAll('button')
      .find((b) => b.text().includes('Annuler'))
    await cancelButton.trigger('click')

    expect(wrapper.find('.fixed.bottom-0').exists()).toBe(false)
  })

  it("réaffiche la bannière si la modale est annulée sans qu'aucun choix n'ait été fait", async () => {
    const wrapper = mount(CookiesBanner, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            initialState: { cookie: { consent: NO_CHOICE, isPreferencesModalOpen: true } }
          }),
          i18n
        ]
      }
    })
    await wrapper.vm.$nextTick()

    const cancelButton = wrapper.findComponent(CookiesModal).findAll('button')
      .find((b) => b.text().includes('Annuler'))
    await cancelButton.trigger('click')

    expect(wrapper.find('.fixed.bottom-0').exists()).toBe(true)
  })

  it('affiche une confirmation au clic sur Enregistrer mes choix si la sauvegarde réussit', async () => {
    const wrapper = mount(CookiesBanner, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            initialState: { cookie: { consent: NO_CHOICE, isPreferencesModalOpen: true } }
          }),
          i18n
        ]
      }
    })
    await wrapper.vm.$nextTick()
    const store = useCookieStore()
    store.setConsent.mockReturnValue(true)
    const { push } = await import('notivue')

    const saveButton = wrapper.findComponent(CookiesModal).findAll('button')
      .find((b) => b.text().includes('Enregistrer mes choix'))
    await saveButton.trigger('click')

    expect(store.setConsent).toHaveBeenCalled()
    expect(push.success).toHaveBeenCalledWith('Vos préférences ont été enregistrées.')
    expect(push.error).not.toHaveBeenCalled()
  })

  it("affiche une erreur au clic sur Enregistrer mes choix si la sauvegarde échoue", async () => {
    const wrapper = mount(CookiesBanner, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            initialState: { cookie: { consent: NO_CHOICE, isPreferencesModalOpen: true } }
          }),
          i18n
        ]
      }
    })
    await wrapper.vm.$nextTick()
    const store = useCookieStore()
    store.setConsent.mockReturnValue(false)
    const { push } = await import('notivue')

    const saveButton = wrapper.findComponent(CookiesModal).findAll('button')
      .find((b) => b.text().includes('Enregistrer mes choix'))
    await saveButton.trigger('click')

    expect(push.error).toHaveBeenCalledWith("Vos préférences n'ont pas pu être enregistrées. Réessayez.")
    expect(push.success).not.toHaveBeenCalled()
  })
})
