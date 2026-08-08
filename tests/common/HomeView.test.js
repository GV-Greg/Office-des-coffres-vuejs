import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import HomeView from '../../src/views/HomeView.vue'

vi.mock('../../src/data/whatsNew.json', () => ({
  default: [
    { id: 'old-public', date: '2026-08-01', scope: 'public', type: 'feature', fr: 'Ancienne annonce publique', en: 'Old public announcement' },
    { id: 'new-public', date: '2026-08-05', scope: 'public', type: 'feature', fr: 'Nouvelle annonce publique', en: 'New public announcement' },
    { id: 'members-only', date: '2026-08-05', scope: 'private', type: 'feature', fr: 'Annonce réservée aux membres', en: 'Members-only announcement' },
    { id: 'a-fix', date: '2026-08-06', scope: 'public', type: 'fix', fr: 'Correction du bug X', en: 'Fixed bug X' },
  ]
}))

const i18n = createI18n({
  legacy: false,
  locale: 'fr',
  messages: {
    fr: {
      Common: { SiteName: 'Office des coffres' },
      Home: {
        WelcomeMessage: "L'{brand} vous souhaite la bienvenue !",
        News: "Chroniques de l'Office",
        NewsMembers: 'Membres',
        Fixes: 'Le Registre des Réparations',
        LoginButton: 'Se connecter'
      }
    }
  }
})

function mountHome(initialState = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/app/', name: 'home', component: { template: '<div/>' } },
      { path: '/login', name: 'login', component: { template: '<div/>' } }
    ]
  })
  router.push('/app/')

  return mount(HomeView, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn, initialState }), i18n, router],
      stubs: { NavMenu: true }
    }
  })
}

describe('HomeView', () => {
  it('renders properly', () => {
    const wrapper = mountHome()
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.text()).toContain('Office des coffres')
  })

  it('affiche uniquement les nouveautés publiques quand déconnecté', () => {
    const wrapper = mountHome()
    expect(wrapper.text()).toContain('Nouvelle annonce publique')
    expect(wrapper.text()).toContain('Ancienne annonce publique')
    expect(wrapper.text()).not.toContain('Annonce réservée aux membres')
  })

  it('affiche aussi les nouveautés privées une fois connecté', () => {
    const wrapper = mountHome({ auth: { token: 'faketoken', user: { characters: [] } } })
    expect(wrapper.text()).toContain('Annonce réservée aux membres')
    expect(wrapper.text()).toContain('Membres')
  })

  it('trie les nouveautés de la plus récente à la plus ancienne', () => {
    const wrapper = mountHome({ auth: { token: 'faketoken', user: { characters: [] } } })
    const items = wrapper.findAll('li').map(li => li.text())
    const recentIndex = items.findIndex(t => t.includes('Nouvelle annonce publique'))
    const oldIndex = items.findIndex(t => t.includes('Ancienne annonce publique'))
    expect(recentIndex).toBeLessThan(oldIndex)
  })

  it("n'affiche pas les correctifs dans la Chronique", () => {
    const wrapper = mountHome()
    const chronicle = wrapper.find('.news')
    expect(chronicle.text()).not.toContain('Correction du bug X')
  })

  it('affiche le bouton de connexion quand déconnecté', () => {
    const wrapper = mountHome()
    expect(wrapper.text()).toContain('Se connecter')
  })

  it('masque le bouton de connexion une fois connecté', () => {
    const wrapper = mountHome({ auth: { token: 'faketoken', user: { characters: [] } } })
    expect(wrapper.text()).not.toContain('Se connecter')
  })

  it('affiche les correctifs dans une section "Registre des Réparations" séparée', () => {
    const wrapper = mountHome()
    expect(wrapper.text()).toContain('Le Registre des Réparations')
    const fixes = wrapper.find('.fixes')
    expect(fixes.exists()).toBe(true)
    expect(fixes.text()).toContain('Correction du bug X')
    expect(fixes.text()).not.toContain('Nouvelle annonce publique')
  })
})
