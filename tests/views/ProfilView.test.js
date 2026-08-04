import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import ProfilView from '../../src/views/auth/ProfilView.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'fr',
  messages: {
    fr: {
      Profil: {
        Title: 'Mon profil',
        NoCharacter: "Vous n'avez pas encore de personnage.",
        AddCharacter: 'Ajouter un personnage',
        Status: {
          Validated: 'Personnage validé.',
          PendingMessage: 'En attente de validation.',
          PendingResidenceChangeMessage: 'En attente de validation du changement de résidence.'
        }
      }
    }
  }
})

function mountProfil(user) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/app/profil', name: 'profil', component: { template: '<div/>' } },
      { path: '/app/character/new', name: 'character-new', component: { template: '<div/>' } },
    ]
  })

  return mount(ProfilView, {
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          initialState: { auth: { user, token: null } }
        }),
        i18n,
        router
      ],
      stubs: { NavMenu: true }
    }
  })
}

describe('ProfilView', () => {
  it("affiche un message si le compte n'a pas encore de personnage", () => {
    const wrapper = mountProfil({ id: 1, email: 'artifice@test.com', characters: [] })
    expect(wrapper.text()).toContain("Vous n'avez pas encore de personnage.")
  })

  it('affiche chaque personnage du compte avec son statut', () => {
    const wrapper = mountProfil({
      id: 1,
      email: 'artifice@test.com',
      characters: [
        { id: 1, pseudo: 'Artifice', is_validated: true, city_name: 'Burgos', province_name: 'Reino de Castilla', kingdom_name: 'Corona de Castilla y León' },
        { id: 2, pseudo: 'Buldo', is_validated: false },
      ]
    })

    expect(wrapper.text()).toContain('Artifice')
    expect(wrapper.text()).toContain('Personnage validé.')
    expect(wrapper.text()).toContain('Burgos, Reino de Castilla, Couronne de Castille et Léon')
    expect(wrapper.text()).toContain('Buldo')
    expect(wrapper.text()).toContain('En attente de validation.')
  })

  it('affiche un message différent quand le personnage est en attente suite à un changement de résidence', () => {
    const wrapper = mountProfil({
      id: 1,
      email: 'artifice@test.com',
      characters: [
        { id: 1, pseudo: 'Artifice', is_validated: false, pending_residence_change: true },
      ]
    })

    expect(wrapper.text()).toContain('En attente de validation du changement de résidence.')
    expect(wrapper.text()).not.toContain('En attente de validation.')
  })

  it("propose d'ajouter un personnage même si le compte en a déjà un", () => {
    const wrapper = mountProfil({
      id: 1,
      email: 'artifice@test.com',
      characters: [{ id: 1, pseudo: 'Artifice', is_validated: true }]
    })

    expect(wrapper.text()).toContain('Ajouter un personnage')
  })
})
