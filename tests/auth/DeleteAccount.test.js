import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import ProfilView from '../../src/views/auth/ProfilView.vue'
import { useAuthStore } from '../../src/stores/authStore'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Lecture brute plutôt qu'un `import ... from '.json'` : `@intlify/unplugin-vue-i18n` compile
// les fichiers de `src/locales/**` en messages précompilés, un import direct ne rendrait donc
// pas l'objet JSON attendu (même famille de piège que `tm()` sans `rt()`).
const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const readLocale = (lang) => JSON.parse(fs.readFileSync(path.join(localesDir, `${lang}.json`), 'utf8'))
const frLocale = readLocale('fr')
const enLocale = readLocale('en')

vi.mock('notivue', () => ({
  push: { success: vi.fn(), error: vi.fn() }
}))

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
        Status: { ValidatedBadge: 'Validé', PendingBadge: 'En attente', PendingMessage: 'En attente.' },
        DeleteAccount: {
          SectionTitle: 'Suppression du compte',
          Warning: 'Cette action est immédiate et ne peut pas être annulée. Toutes vos données personnelles seront effacées.',
          Button: 'Supprimer mon compte',
          Step1Title: 'Supprimer votre compte',
          Step1Text: 'Voici ce qui sera effacé définitivement :',
          Step1ItemEmail: 'votre adresse email et votre mot de passe ;',
          Step1ItemCharacters: 'vos personnages : {names} ;',
          Step1ItemPreferences: 'vos préférences enregistrées.',
          Step1Continue: 'Continuer',
          Step1Cancel: 'Annuler',
          Step2Title: 'Confirmez avec votre mot de passe',
          Step2Text: 'Saisissez votre mot de passe actuel.',
          Step2PasswordLabel: 'Mot de passe actuel',
          Step2Confirm: 'Supprimer définitivement',
          SuccessToast: 'Votre compte a été supprimé.',
        },
      },
      Cookies: { Button: { Preferences: 'Gérer mes préférences' } },
      Auth: { Errors: { NetworkError: 'Erreur réseau.' } },
    }
  }
})

// Asynchrone à dessein : Vue Router démarre sur START_LOCATION et résout sa route initiale de
// façon asynchrone. Monter ProfilView — qui contient des RouterLink — sans attendre isReady()
// rendait ces tests instables : verts isolément, rouges environ une fois sur cinq en suite
// complète, avec des assertions de contenu qui ne trouvaient pas les pseudos. Le symptôme n'était
// pas dans le composant mais dans le montage.
async function mountProfil() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'welcome', component: { template: '<div/>' } },
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
              token: 'tok789',
              user: {
                id: 1,
                email: 'artifice@test.com',
                characters: [
                  { id: 1, pseudo: 'Artifice', is_validated: true },
                  { id: 2, pseudo: 'Buldo', is_validated: false },
                ],
              },
            }
          }
        }),
        i18n,
        router
      ],
      stubs: { NavMenu: true }
    }
  })

  await router.isReady()

  return { wrapper, router }
}

const openModal = async (wrapper) => {
  await wrapper.find('[data-testid="delete-account-open"]').trigger('click')
}
const goToStep2 = async (wrapper) => {
  await wrapper.find('[data-testid="delete-account-continue"]').trigger('click')
}

describe('Promesse de la politique de confidentialité', () => {
  // La politique annonçait la suppression comme une « fonctionnalité à venir ». Elle existe
  // maintenant : la promesse et la fonctionnalité doivent basculer ensemble, sinon le site ment
  // dans un sens ou dans l'autre. Ce test lit les vraies locales, pas des messages de test.
  it.each([
    ['fr', frLocale, ['fonctionnalité à venir', 'pour l\'instant, passer par email']],
    ['en', enLocale, ['upcoming feature', 'for now, please email']],
  ])('%s : §7 ne présente plus la suppression comme à venir', (_lang, locale, forbidden) => {
    const howToExercise = locale.Legal.Privacy.Section7.HowToExercise

    for (const mention of forbidden) {
      expect(howToExercise.toLowerCase()).not.toContain(mention.toLowerCase())
    }
  })

  it.each([
    ['fr', frLocale, 'Profil'],
    ['en', enLocale, 'Profile'],
  ])('%s : §7 renvoie bien vers le Profil', (_lang, locale, expected) => {
    expect(locale.Legal.Privacy.Section7.HowToExercise).toContain(expected)
  })
})

describe('ProfilView — zone dangereuse', () => {
  it('affiche la zone de suppression en bas du profil', async () => {
    const { wrapper } = await mountProfil()

    expect(wrapper.find('[data-testid="danger-zone"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Suppression du compte')
    expect(wrapper.text()).toContain('Cette action est immédiate et ne peut pas être annulée.')
  })

  it("n'ouvre aucune modale tant qu'on n'a pas cliqué — le bouton ne supprime rien directement", async () => {
    const { wrapper } = await mountProfil()

    expect(wrapper.find('[data-testid="delete-account-continue"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="delete-account-password"]').exists()).toBe(false)
  })

  it('ouvre la modale sur la première étape au clic sur « Supprimer mon compte »', async () => {
    const { wrapper } = await mountProfil()
    await openModal(wrapper)

    expect(wrapper.find('[data-testid="delete-account-continue"]').exists()).toBe(true)
    // L'étape 2 n'est pas accessible directement : pas de champ mot de passe à l'ouverture.
    expect(wrapper.find('[data-testid="delete-account-password"]').exists()).toBe(false)
  })

  it('nomme les personnages qui vont être supprimés', async () => {
    const { wrapper } = await mountProfil()
    await openModal(wrapper)

    expect(wrapper.text()).toContain('Artifice, Buldo')
  })
})

describe('ProfilView — confirmation en deux étapes', () => {
  it('donne accès au mot de passe seulement après « Continuer »', async () => {
    const { wrapper } = await mountProfil()
    await openModal(wrapper)
    await goToStep2(wrapper)

    expect(wrapper.find('[data-testid="delete-account-password"]').exists()).toBe(true)
  })

  it('garde « Supprimer définitivement » désactivé tant que le mot de passe est vide', async () => {
    const { wrapper } = await mountProfil()
    await openModal(wrapper)
    await goToStep2(wrapper)

    const confirm = wrapper.find('[data-testid="delete-account-confirm"]')
    expect(confirm.attributes('disabled')).toBeDefined()

    await wrapper.find('[data-testid="delete-account-password"]').setValue('password123')
    expect(wrapper.find('[data-testid="delete-account-confirm"]').attributes('disabled')).toBeUndefined()
  })

  it('repart de la première étape à la réouverture, sans conserver le mot de passe saisi', async () => {
    const { wrapper } = await mountProfil()
    await openModal(wrapper)
    await goToStep2(wrapper)
    await wrapper.find('[data-testid="delete-account-password"]').setValue('password123')

    // Fermeture par le vrai chemin : le bouton « Annuler » de l'étape 2.
    const cancel = wrapper.findAll('button').find((b) => b.text() === 'Annuler')
    await cancel.trigger('click')
    expect(wrapper.find('[data-testid="delete-account-password"]').exists()).toBe(false)

    await openModal(wrapper)

    expect(wrapper.find('[data-testid="delete-account-password"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="delete-account-continue"]').exists()).toBe(true)
  })
})

describe('ProfilView — suppression effective', () => {
  it('appelle deleteAccount avec le mot de passe, notifie et renvoie sur Welcome', async () => {
    const { wrapper, router } = await mountProfil()
    const authStore = useAuthStore()
    authStore.deleteAccount.mockResolvedValue()
    const pushSpy = vi.spyOn(router, 'push')

    await openModal(wrapper)
    await goToStep2(wrapper)
    await wrapper.find('[data-testid="delete-account-password"]').setValue('password123')
    await wrapper.find('[data-testid="delete-account-confirm"]').trigger('submit')
    await flushPromises()

    expect(authStore.deleteAccount).toHaveBeenCalledWith('password123')
    expect(push.success).toHaveBeenCalledWith('Votre compte a été supprimé.')
    expect(pushSpy).toHaveBeenCalledWith({ name: 'welcome' })
  })

  it('garde la modale ouverte et affiche le message du serveur si le mot de passe est refusé', async () => {
    const { wrapper, router } = await mountProfil()
    const authStore = useAuthStore()
    authStore.deleteAccount.mockRejectedValue({
      response: { status: 403, data: { message: 'Mot de passe incorrect.' } }
    })
    const pushSpy = vi.spyOn(router, 'push')

    await openModal(wrapper)
    await goToStep2(wrapper)
    await wrapper.find('[data-testid="delete-account-password"]').setValue('mauvais')
    await wrapper.find('[data-testid="delete-account-confirm"]').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[data-testid="delete-account-error"]').text()).toBe('Mot de passe incorrect.')
    // Toujours sur l'étape 2 : on peut réessayer sans reparcourir l'avertissement.
    expect(wrapper.find('[data-testid="delete-account-password"]').exists()).toBe(true)
    expect(pushSpy).not.toHaveBeenCalled()
  })

  it('retombe sur un message générique si le serveur ne répond pas', async () => {
    const { wrapper } = await mountProfil()
    const authStore = useAuthStore()
    authStore.deleteAccount.mockRejectedValue(new Error('Network Error'))

    await openModal(wrapper)
    await goToStep2(wrapper)
    await wrapper.find('[data-testid="delete-account-password"]').setValue('password123')
    await wrapper.find('[data-testid="delete-account-confirm"]').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[data-testid="delete-account-error"]').text()).toBe('Erreur réseau.')
  })
})
