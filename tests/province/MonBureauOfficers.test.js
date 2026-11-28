import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import MonBureauView from '../../src/views/MonBureauView.vue'
import { http } from '../../src/api.js'

/*
  L'onglet « Douaniers » de Mon bureau (Greg, 22/11/2026) : la validation des demandes de douanier. ⚠️ Aucune règle côté site : l'onglet n'existe que
  si le serveur donne un rôle de validation (`GET characters/{id}/customs` → decider). L'ancienne adresse /app/secu/douaniers y renvoie.
*/
vi.mock('notivue', () => ({ push: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../src/api.js', () => ({ http: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const fr = JSON.parse(fs.readFileSync(path.join(localesDir, 'fr.json'), 'utf8'))
const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'))
const routerSource = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/router/index.js'), 'utf8')

const HISTORY = { success: true, province: { id: 10, name: 'Franche-Comté' }, offices: [], mayors: [], cities_without_mandate: [] }
const NO_PRICES = { success: true, write: null, read: null, prices: { write: null, read: null } }
const DECIDER = { level: 1, province: { id: 3, name: 'Artois' }, has_security_trio: true, inactivity_days: 90, inactivity_default: 90, inactivity_min: 30, inactivity_max: 365, pending: [], officers: [] }

async function mountAt(url, { decider = DECIDER, locale = 'fr' } = {}) {
  http.get.mockImplementation(async (u) => {
    if (u.includes('mine-registry')) return { data: NO_PRICES }
    if (u.endsWith('/customs')) return { data: { success: true, officer: null, can_request: true, decider } }
    return { data: HISTORY }
  })
  localStorage.clear()
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/app/mon-bureau/:section(province|prix|douaniers|categories)?', name: 'province', component: { template: '<div/>' } }],
  })
  router.push(url)
  await router.isReady()
  const wrapper = mount(MonBureauView, {
    global: {
      plugins: [createI18n({ legacy: false, locale, messages: { fr, en } }), router, createTestingPinia({ createSpy: vi.fn, initialState: {}, stubActions: false })],
      stubs: { 'v-icon': true, NavMenu: true, MinePricesModal: true },
    },
  })
  const { useAuthStore } = await import('../../src/stores/authStore')
  useAuthStore().$patch({ user: { characters: [{ id: 7, pseudo: 'Artifice' }] }, token: 'jeton' })
  await flushPromises()
  return { wrapper, router }
}
const tab = w => w.find('[data-testid="mon-bureau-tab-douaniers"]')

describe('Mon bureau — l\'onglet Douaniers', () => {
  it('qui valide les demandes a l\'onglet, avec un vrai lien et le panneau de validation', async () => {
    const { wrapper } = await mountAt('/app/mon-bureau/douaniers')

    expect(tab(wrapper).exists()).toBe(true)
    expect(tab(wrapper).text()).toContain('Douaniers')
    expect(tab(wrapper).attributes('href')).toBe('/app/mon-bureau/douaniers')
    expect(tab(wrapper).attributes('aria-current')).toBe('page')
    expect(wrapper.find('[aria-labelledby="panel-officers"]').exists()).toBe(true)
    expect(wrapper.find('#panel-officers').text()).toBe('Valider les douaniers de Artois') // un seul titre, avec la province
    expect(wrapper.findAll('h3').filter(h => h.text() === 'Valider les douaniers de Artois')).toHaveLength(0)
    expect(wrapper.find('[data-testid="officer-decisions"]').exists()).toBe(true)
    expect(wrapper.find('[aria-labelledby="panel-province"]').exists()).toBe(false) // une section à la fois
  })

  it('l\'onglet vient après les prix et avant les catégories', async () => {
    const { wrapper } = await mountAt('/app/mon-bureau')
    const keys = wrapper.findAll('[data-testid^="mon-bureau-tab-"]').map(a => a.attributes('data-testid').replace('mon-bureau-tab-', ''))

    expect(keys).toEqual(['province', 'douaniers', 'categories'])
  })

  it('sans rôle de validation : pas d\'onglet', async () => {
    const { wrapper } = await mountAt('/app/mon-bureau', { decider: null })

    expect(tab(wrapper).exists()).toBe(false)
  })

  it('/douaniers sans rôle de validation retombe sur « Ma province » (jamais une page vide)', async () => {
    const { wrapper } = await mountAt('/app/mon-bureau/douaniers', { decider: null })

    expect(wrapper.find('[aria-labelledby="panel-province"]').exists()).toBe(true)
    expect(wrapper.find('[aria-labelledby="panel-officers"]').exists()).toBe(false)
  })

  it('en anglais', async () => {
    const { wrapper } = await mountAt('/app/mon-bureau/douaniers', { locale: 'en' })

    expect(tab(wrapper).text()).toContain('Customs officers')
    expect(wrapper.find('#panel-officers').text()).toBe('Validate the customs officers of Artois')
  })

  it('l\'ancienne adresse /app/secu/douaniers renvoie vers l\'onglet ; la route « security-officers » n\'existe plus', () => {
    expect(routerSource).toMatch(/path: 'douaniers',\s*redirect: \{ name: 'province', params: \{ section: 'douaniers' \} \}/)
    expect(routerSource).not.toContain('security-officers')
    expect(routerSource).toContain(':section(province|prix|cheptel|douaniers|categories)?')
  })
})
