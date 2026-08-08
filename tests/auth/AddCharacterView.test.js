import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import AddCharacterView from '../../src/views/auth/AddCharacterView.vue'
import { useAuthStore } from '../../src/stores/authStore'

vi.mock('notivue', () => ({ push: { error: vi.fn() } }))

const mapResponse = {
  data: {
    success: true,
    kingdoms: [
      {
        id: 1,
        kingdom_name: 'Royaume de Test',
        provinces: [
          { id: 10, province_name: 'Province de Test', cities: [{ id: 100, city_name: 'Ville de Test' }] }
        ]
      }
    ]
  }
}

vi.mock('../../src/api.js', () => ({
  http: { post: vi.fn(), get: vi.fn(() => Promise.resolve(mapResponse)) }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'fr',
  messages: {
    fr: {
      AddCharacter: {
        Heading: 'Ajoutez votre personnage',
        KingdomLabel: 'Royaume', KingdomPlaceholder: 'Choisissez un royaume',
        ProvinceLabel: 'Province', ProvincePlaceholder: 'Choisissez une province',
        CityLabel: 'Ville', CityPlaceholder: 'Choisissez une ville',
        SubmitButton: 'Créer mon personnage',
        LoadingMap: 'Chargement...',
        MapError: 'Erreur',
        Errors: { PseudoRequired: 'Pseudo requis', CityRequired: 'Ville requise' }
      },
      Auth: { UsernamePlaceholder: 'Entrez votre pseudo' },
      username: 'pseudo'
    }
  }
})

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/app/profil', name: 'profil', component: { template: '<div/>' } }]
  })

  const wrapper = mount(AddCharacterView, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn }), i18n, router],
    }
  })
  await flushPromises()
  return wrapper
}

describe('AddCharacterView', () => {
  it('charge la carte et affiche les royaumes disponibles', async () => {
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('Royaume de Test')
  })

  it('la province dépend du royaume sélectionné (cascade)', async () => {
    const wrapper = await mountView()
    const [kingdomSelect, provinceSelect] = wrapper.findAll('select')

    expect(provinceSelect.attributes('disabled')).toBeDefined()

    await kingdomSelect.setValue('1')
    expect(provinceSelect.attributes('disabled')).toBeUndefined()
    expect(wrapper.text()).toContain('Province de Test')
  })

  it('crée le personnage avec le pseudo et la ville choisis', async () => {
    const wrapper = await mountView()
    const authStore = useAuthStore()
    authStore.createCharacter.mockResolvedValueOnce({ success: true })

    const [kingdomSelect, provinceSelect, citySelect] = wrapper.findAll('select')
    await wrapper.find('input[type="text"]').setValue('Artifice')
    await kingdomSelect.setValue('1')
    await provinceSelect.setValue('10')
    await citySelect.setValue('100')
    await wrapper.find('form').trigger('submit')

    expect(authStore.createCharacter).toHaveBeenCalledWith({ pseudo: 'Artifice', city_id: 100 })
  })
})
