import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import EconomyInventory from '../../src/views/modules/economy/EconomyInventory.vue'
import { useAuthStore } from '../../src/stores/authStore'
import { SAVE_DELAY } from '../../src/stores/inventoryStore'
import { http } from '../../src/api.js'

/*
  La Salle des comptes avec un COMPTE : le dernier inventaire enregistré revient dans le champ, le sélecteur de niveau n'apparaît que
  pour qui a un poste, l'historique de la province s'inscrit à la main, une correction de catégorie est enregistrée tout de suite.
  Fils inventaire-scopes et inventaire-bilans (Greg et Cowork, 11/11/2026).
*/
vi.mock('notivue', () => ({ push: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../src/api.js', () => ({ http: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }))

import { push } from 'notivue'

const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const fr = JSON.parse(readFileSync(resolve(localesDir, 'fr.json'), 'utf-8'))
const en = JSON.parse(readFileSync(resolve(localesDir, 'en.json'), 'utf-8'))

const ok = data => Promise.resolve({ data })
const PERSONAL_TEXT = '596Miches de pain2980'
const PROVINCE_TEXT = '700Miches de pain3500'
const SCOPES = (province = { id: 3, name: 'Artois', can_write: true, can_read: true }) => ({
  success: true,
  personal: { id: 7, name: 'Artifice', can_write: true, can_read: true },
  city: { id: 1, name: 'Arras', can_write: true, can_read: true },
  province,
})

function serve({ scopes = SCOPES(), snapshots = [{ id: 2, taken_on: '2026-05-17', raw: PROVINCE_TEXT, by_me: true }, { id: 1, taken_on: '2026-05-10', raw: 'ancien', by_me: false }] } = {}) {
  http.get.mockImplementation(url => {
    if (url.endsWith('inventory-scopes')) return ok(scopes)
    if (url.includes('inventory-settings/')) return ok({ settings: { data: { itemCategories: { 'Miches de pain': 'alimentation' } }, version: 1, scope: {} } })
    if (url.endsWith('inventory/personal')) return ok({ inventory: { raw: PERSONAL_TEXT } })
    if (url.endsWith('inventory/city')) return ok({ inventory: { raw: '3Cailloux0' } })
    if (url.endsWith('inventory/province')) return ok({ province: { id: 3, name: 'Artois' }, can_write: true, snapshots })
    return ok({})
  })
  http.put.mockImplementation((url, body) => ok(url.includes('inventory-settings') ? { settings: { data: body.data, version: body.version + 1, scope: {} } } : { inventory: {} }))
}

async function mountPage({ scopes, snapshots, loggedIn = true } = {}) {
  setActivePinia(createPinia())
  if (loggedIn) useAuthStore().$patch({ user: { characters: [{ id: 7, pseudo: 'Artifice' }] }, token: 'jeton' })
  serve({ scopes, snapshots })
  const i18n = createI18n({ legacy: false, locale: 'fr', messages: { fr, en } })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/app/mon-bureau/:section?', name: 'province', component: { template: '<div/>' } }] })
  const wrapper = mount(EconomyInventory, { global: { plugins: [i18n, router], stubs: { 'v-icon': true } } })
  await flushPromises()
  return wrapper
}

const textarea = w => w.find('[data-testid="inventory-paste"]')
const levelButton = (w, level) => w.find(`[data-testid="inventory-level-${level}"]`)

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.useRealTimers())

describe('Salle des comptes avec un compte', () => {
  it('le dernier inventaire enregistré revient dans le champ, sur n\'importe quel appareil', async () => {
    const wrapper = await mountPage()
    expect(textarea(wrapper).element.value).toBe(PERSONAL_TEXT)
    expect(http.get).toHaveBeenCalledWith('characters/7/inventory/personal', expect.anything())
  })

  it('les catégories assignées viennent du serveur : l\'objet est classé sans correction', async () => {
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('Miches de pain')
    const select = wrapper.find('select[aria-label*="Miches de pain"]')
    expect(select.element.value).toBe('alimentation')
  })

  it('sans poste : pas de sélecteur de niveau', async () => {
    const wrapper = await mountPage({ scopes: { ...SCOPES(), city: null, province: null } })
    expect(wrapper.find('[data-testid="inventory-levels"]').exists()).toBe(false)
  })

  it('avec des postes : un bouton par inventaire, le personnel actif, la ville et la province nommées', async () => {
    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="inventory-levels"]').attributes('role')).toBe('group')
    expect(['personal', 'city', 'province'].map(l => levelButton(wrapper, l).text())).toEqual(['Personnel', 'Ville : Arras', 'Province : Artois'])
    expect(levelButton(wrapper, 'personal').attributes('aria-pressed')).toBe('true')
    expect(levelButton(wrapper, 'city').attributes('aria-pressed')).toBe('false')
  })

  it('changer de niveau charge le dernier inventaire de ce niveau (ville : le sien ; province : le plus récent de l\'historique)', async () => {
    const wrapper = await mountPage()
    await levelButton(wrapper, 'city').trigger('click')
    await flushPromises()
    expect(textarea(wrapper).element.value).toBe('3Cailloux0')

    await levelButton(wrapper, 'province').trigger('click')
    await flushPromises()
    expect(textarea(wrapper).element.value).toBe(PROVINCE_TEXT)
  })

  it('un collage est enregistré avec un délai, sur le niveau affiché (personnel)', async () => {
    const wrapper = await mountPage()
    vi.useFakeTimers()
    await textarea(wrapper).setValue('800Miches de pain4000')
    expect(http.put).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(SAVE_DELAY + 10)
    expect(http.put).toHaveBeenCalledWith('characters/7/inventory/personal', { raw: '800Miches de pain4000' }, expect.anything())
  })

  it('« Effacer » vide le champ SEULEMENT : ni l\'inventaire enregistré ni les catégories ne sont touchés', async () => {
    const wrapper = await mountPage()
    vi.useFakeTimers()
    await wrapper.find('[data-testid="clear-btn"]').trigger('click')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY + 10)
    expect(textarea(wrapper).element.value).toBe('')
    expect(http.put.mock.calls.some(c => c[0].includes('/inventory/'))).toBe(false)
    expect(http.delete).toBeUndefined()
    // les assignations n'ont pas bougé
    expect(http.put.mock.calls.every(c => !c[1]?.data || c[1].data.itemCategories?.['Miches de pain'] === 'alimentation')).toBe(true)
  })

  it('une correction de catégorie est enregistrée sur le serveur (Mon bureau la retrouve)', async () => {
    const wrapper = await mountPage()
    vi.useFakeTimers()
    await wrapper.find('select[aria-label*="Miches de pain"]').setValue('divers')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY + 10)
    const call = http.put.mock.calls.find(c => c[0] === 'characters/7/inventory-settings/personal')
    expect(call[1].data.itemCategories).toEqual({ 'Miches de pain': 'divers' })
    expect(call[1].version).toBe(1)
  })
})

describe('Province : l\'historique du commissaire au commerce', () => {
  async function provinceView(options) {
    const wrapper = await mountPage(options)
    await levelButton(wrapper, 'province').trigger('click')
    await flushPromises()
    return wrapper
  }

  it('le commissaire au commerce inscrit l\'inventaire du jour à la main (jamais automatiquement)', async () => {
    const wrapper = await provinceView()
    http.post.mockReturnValue(ok({ snapshot: { id: 3, taken_on: '2026-05-24' }, replaced: false, unchanged: false }))

    vi.useFakeTimers()
    await textarea(wrapper).setValue('900Miches de pain4500')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY + 10)
    expect(http.put.mock.calls.some(c => c[0].includes('/inventory/province'))).toBe(false) // pas d'enregistrement automatique
    vi.useRealTimers()

    await wrapper.find('[data-testid="province-record"]').trigger('click')
    await flushPromises()
    expect(http.post).toHaveBeenCalledWith('characters/7/inventory/province', { raw: '900Miches de pain4500' }, expect.anything())
    expect(push.success).toHaveBeenCalledWith(expect.stringContaining('inscrit dans l\'historique de la province'))
  })

  it('un second collage du jour est dit « remplacé », un texte identique « rien à changer »', async () => {
    const wrapper = await provinceView()
    http.post.mockReturnValueOnce(ok({ snapshot: { id: 4, taken_on: '2026-05-24' }, replaced: true, unchanged: false }))
      .mockReturnValueOnce(ok({ snapshot: { id: 4, taken_on: '2026-05-24' }, replaced: false, unchanged: true }))
    await wrapper.find('[data-testid="province-record"]').trigger('click')
    await flushPromises()
    expect(push.success.mock.calls[0][0]).toContain('remplacé')
    await wrapper.find('[data-testid="province-record"]').trigger('click')
    await flushPromises()
    expect(push.success.mock.calls[1][0]).toContain('rien à changer')
  })

  it('l\'historique se charge dans le champ, daté en année du jeu', async () => {
    const wrapper = await provinceView()
    const select = wrapper.find('[data-testid="province-history"]')
    const options = select.findAll('option')
    expect(options[0].text()).toBe(fr.EconomyInventory.ProvinceHistoryLoad)
    expect(options).toHaveLength(3)
    expect(options[1].text()).toMatch(/1474/) // 17/05/2026 → année du jeu
    await select.setValue('1')
    expect(textarea(wrapper).element.value).toBe('ancien')
  })

  it('le dirigeant (lecture seule) : l\'inventaire se consulte, rien ne s\'inscrit ni ne se corrige', async () => {
    const wrapper = await provinceView({ scopes: SCOPES({ id: 3, name: 'Artois', can_write: false, can_read: true }) })
    expect(wrapper.find('[data-testid="inventory-readonly"]').text()).toBe(fr.EconomyInventory.ReadOnlyScope)
    expect(wrapper.find('[data-testid="province-record"]').exists()).toBe(false)
    expect(wrapper.find('select[aria-label*="Miches de pain"]').exists()).toBe(false) // pas de correction de catégorie
    expect(wrapper.find('[data-testid="province-history"]').exists()).toBe(true)
  })

  it('une province sans historique le dit', async () => {
    const wrapper = await provinceView({ snapshots: [] })
    expect(wrapper.find('[data-testid="province-history-empty"]').text()).toBe(fr.EconomyInventory.ProvinceHistoryEmpty)
    expect(textarea(wrapper).element.value).toBe('')
  })
})
