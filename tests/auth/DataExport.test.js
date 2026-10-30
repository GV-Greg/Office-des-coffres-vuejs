import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import ProfilView from '../../src/views/auth/ProfilView.vue'
import { useAuthStore } from '../../src/stores/authStore'

vi.mock('../../src/api.js', () => ({
  http: { get: vi.fn() }
}))

vi.mock('notivue', () => ({
  push: { success: vi.fn(), error: vi.fn() }
}))

import { http } from '../../src/api.js'
import { push } from 'notivue'

const i18n = createI18n({
  legacy: false,
  locale: 'fr',
  messages: {
    fr: {
      Profil: {
        Title: 'Mon profil',
        NoCharacter: "Vous n'avez pas encore de personnage.",
        AddCharacter: 'Ajouter un personnage',
        ActiveCharacter: 'Personnage actif à la connexion',
        SetActive: 'Définir comme actif à la connexion',
        Status: { ValidatedBadge: 'Validé', PendingBadge: 'En attente', PendingMessage: 'En attente.' },
        DeleteAccount: {
          SectionTitle: 'Suppression du compte',
          Warning: 'Action irréversible.',
          Button: 'Supprimer mon compte',
          Step1Title: 'Supprimer votre compte',
          Step1Text: 'Voici ce qui sera effacé.',
          Step1ItemEmail: 'votre email ;',
          Step1ItemCharacters: 'vos personnages : {names} ;',
          Step1ItemPreferences: 'vos préférences.',
          Step1Continue: 'Continuer',
          Step1Cancel: 'Annuler',
          Step2Title: 'Confirmation',
          Step2Text: 'Saisissez votre mot de passe.',
          Step2PasswordLabel: 'Mot de passe',
          Step2Confirm: 'Supprimer',
          SuccessToast: 'Compte supprimé.',
        },
        DataExport: {
          SectionTitle: 'Mes données',
          Text: 'Téléchargez une copie de vos données.',
          Button: 'Télécharger mes données',
          Preparing: 'Préparation…',
          SuccessToast: 'Vos données ont été téléchargées.',
          RateLimitToast: 'Trop de demandes. Réessayez dans une minute.',
          ErrorToast: 'Le téléchargement a échoué. Réessayez plus tard.',
        },
      },
      Cookies: { Button: { Preferences: 'Gérer mes préférences' } },
      Auth: { Errors: { NetworkError: 'Erreur réseau.' } },
    },
    en: {
      Profil: {
        Title: 'My profile',
        NoCharacter: "You don't have a character yet.",
        AddCharacter: 'Add a character',
        ActiveCharacter: 'Active character at login',
        SetActive: 'Set as active at login',
        Status: { ValidatedBadge: 'Validated', PendingBadge: 'Pending', PendingMessage: 'Pending validation.' },
        DeleteAccount: {
          SectionTitle: 'Delete account',
          Warning: 'Irreversible.',
          Button: 'Delete my account',
          Step1Title: 'Delete account',
          Step1Text: 'What will be deleted.',
          Step1ItemEmail: 'your email;',
          Step1ItemCharacters: 'your characters: {names};',
          Step1ItemPreferences: 'your preferences.',
          Step1Continue: 'Continue',
          Step1Cancel: 'Cancel',
          Step2Title: 'Confirm',
          Step2Text: 'Enter your password.',
          Step2PasswordLabel: 'Password',
          Step2Confirm: 'Delete',
          SuccessToast: 'Account deleted.',
        },
        DataExport: {
          SectionTitle: 'My data',
          Text: 'Download a copy of your data.',
          Button: 'Download my data',
          Preparing: 'Preparing…',
          SuccessToast: 'Your data has been downloaded.',
          RateLimitToast: 'Too many requests. Please try again in a minute.',
          ErrorToast: 'The download failed. Please try again later.',
        },
      },
      Cookies: { Button: { Preferences: 'Manage preferences' } },
      Auth: { Errors: { NetworkError: 'Network error.' } },
    },
  }
})

function mountProfil(token = 'fake-token') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/app/profil', name: 'profil', component: { template: '<div/>' } },
      { path: '/app/character/new', name: 'character-new', component: { template: '<div/>' } },
    ]
  })

  const wrapper = mount(ProfilView, {
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          initialState: {
            auth: {
              user: { id: 1, email: 'test@test.com', characters: [] },
              token,
            }
          }
        }),
        i18n,
        router,
      ],
      stubs: { NavMenu: true, CharacterMandates: true, CityCascadeSelect: true }
    }
  })
  return wrapper
}

describe('DataExport — ProfilView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    i18n.global.locale.value = 'fr'
    URL.createObjectURL = vi.fn().mockReturnValue('blob:fake-url')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(document.body, 'appendChild').mockImplementation((el) => { el.click?.(); return el })
    vi.spyOn(document.body, 'removeChild').mockReturnValue(undefined)
  })

  it('affiche la section « Mes données » et le bouton dans les deux langues', async () => {
    const wrapper = mountProfil()
    expect(wrapper.find('[data-testid="data-export-section"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="export-data-button"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Mes données')
    expect(wrapper.text()).toContain('Télécharger mes données')

    i18n.global.locale.value = 'en'
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('My data')
    expect(wrapper.text()).toContain('Download my data')
  })

  it('désactive le bouton et pose aria-busy pendant le téléchargement', async () => {
    let resolveRequest
    http.get.mockReturnValueOnce(new Promise((resolve) => { resolveRequest = resolve }))

    const wrapper = mountProfil()
    const button = wrapper.find('[data-testid="export-data-button"]')

    expect(button.attributes('disabled')).toBeUndefined()
    expect(button.attributes('aria-busy')).toBe('false')

    button.trigger('click')
    await wrapper.vm.$nextTick()

    expect(button.attributes('disabled')).toBeDefined()
    expect(button.attributes('aria-busy')).toBe('true')
    expect(button.text()).toBe('Préparation…')

    resolveRequest({ data: new Blob(['{}'], { type: 'application/json' }) })
    await flushPromises()
  })

  it('succès : createObjectURL appelé, nom daté, revokeObjectURL suivi, toast succès', async () => {
    http.get.mockResolvedValueOnce({ data: new Blob(['{}'], { type: 'application/json' }) })

    const wrapper = mountProfil()
    await wrapper.find('[data-testid="export-data-button"]').trigger('click')
    await flushPromises()

    expect(URL.createObjectURL).toHaveBeenCalledOnce()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-url')
    const today = new Date().toISOString().slice(0, 10)
    const anchor = document.body.appendChild.mock.calls[0]?.[0]
    expect(anchor?.download).toBe(`office-des-coffres-export-${today}.pdf`)
    expect(push.success).toHaveBeenCalledWith('Vos données ont été téléchargées.')
    expect(wrapper.find('[data-testid="export-data-button"]').attributes('disabled')).toBeUndefined()
  })

  it('429 : toast dédié, bouton réactivé', async () => {
    http.get.mockRejectedValueOnce({ response: { status: 429 } })

    const wrapper = mountProfil()
    await wrapper.find('[data-testid="export-data-button"]').trigger('click')
    await flushPromises()

    expect(push.error).toHaveBeenCalledWith('Trop de demandes. Réessayez dans une minute.')
    expect(wrapper.find('[data-testid="export-data-button"]').attributes('disabled')).toBeUndefined()
  })

  it('autre erreur : toast générique, bouton réactivé', async () => {
    http.get.mockRejectedValueOnce({ response: { status: 500 } })

    const wrapper = mountProfil()
    await wrapper.find('[data-testid="export-data-button"]').trigger('click')
    await flushPromises()

    expect(push.error).toHaveBeenCalledWith('Le téléchargement a échoué. Réessayez plus tard.')
    expect(wrapper.find('[data-testid="export-data-button"]').attributes('disabled')).toBeUndefined()
  })
})
