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
    { id: 'an-improvement', date: '2026-08-07', scope: 'public', type: 'improvement', fr: 'Le bilan se lit mieux', en: 'The report reads better' },
    { id: 'private-improvement', date: '2026-08-04', scope: 'private', type: 'improvement', fr: 'Amélioration réservée aux membres', en: 'Members-only improvement' },
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
        RegistryTitle: 'Registre des réparations et des améliorations',
        TagFix: 'Réparation',
        TagImprovement: 'Amélioration',
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

  it('le registre porte réparations ET améliorations dans une liste unique, du plus récent au plus ancien, chacune avec son badge', () => {
    const wrapper = mountHome()
    expect(wrapper.find('#home-fixes-title').text()).toBe('Registre des réparations et des améliorations')
    const rows = wrapper.findAll('[data-testid^="registry-"]').filter(r => r.attributes('data-testid') !== 'registry-tag')
    expect(rows.map(r => r.attributes('data-testid'))).toEqual(['registry-improvement', 'registry-fix'])
    expect(rows[0].find('[data-testid="registry-tag"]').text()).toBe('Amélioration')
    expect(rows[1].find('[data-testid="registry-tag"]').text()).toBe('Réparation')
    expect(rows[0].text()).toContain('Le bilan se lit mieux')
    expect(rows[1].text()).toContain('Correction du bug X')
  })

  it("une amélioration réservée aux membres n'apparaît qu'une fois connecté, avec le badge « Membres »", () => {
    expect(mountHome().text()).not.toContain('Amélioration réservée aux membres')
    const wrapper = mountHome({ auth: { token: 'faketoken', user: { characters: [] } } })
    const row = wrapper.findAll('[data-testid="registry-improvement"]').find(r => r.text().includes('Amélioration réservée aux membres'))
    expect(row).toBeTruthy()
    expect(row.text()).toContain('Membres')
  })

  it("n'affiche pas les améliorations dans la Chronique", () => {
    expect(mountHome().find('.news').text()).not.toContain('Le bilan se lit mieux')
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

  it('affiche les correctifs dans une section « Registre des réparations et des améliorations » séparée', () => {
    const wrapper = mountHome()
    expect(wrapper.text()).toContain('Registre des réparations et des améliorations')
    const fixes = wrapper.find('.fixes')
    expect(fixes.exists()).toBe(true)
    expect(fixes.text()).toContain('Correction du bug X')
    expect(fixes.text()).not.toContain('Nouvelle annonce publique')
  })
})
