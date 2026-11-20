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
  La Gestion des stocks avec un COMPTE : le dernier inventaire enregistré revient dans le champ, le sélecteur de niveau n'apparaît que
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

const CITY_SNAPSHOTS = [{ id: 9, taken_on: '2026-05-17', raw: '8Cailloux0', by_me: true, replaced: null }]

function serve({ scopes = SCOPES(), snapshots = [{ id: 2, taken_on: '2026-05-17', raw: PROVINCE_TEXT, by_me: true }, { id: 1, taken_on: '2026-05-10', raw: 'ancien', by_me: false }], citySnapshots = CITY_SNAPSHOTS } = {}) {
  http.get.mockImplementation(url => {
    if (url.endsWith('inventory-scopes')) return ok(scopes)
    if (url.includes('inventory-settings/')) return ok({ settings: { data: { itemCategories: { 'Miches de pain': 'alimentation' } }, version: 1, scope: {} } })
    if (url.endsWith('inventory/personal')) return ok({ inventory: { raw: PERSONAL_TEXT } })
    if (url.endsWith('inventory/city')) return ok({ inventory: { raw: '3Cailloux0' } })
    if (url.endsWith('inventory/city/registry')) return ok({ city: { id: 1, name: 'Arras' }, can_write: true, snapshots: citySnapshots })
    if (url.endsWith('inventory/province')) return ok({ province: { id: 3, name: 'Artois' }, can_write: true, snapshots })
    return ok({})
  })
  http.put.mockImplementation((url, body) => ok(url.includes('inventory-settings') ? { settings: { data: body.data, version: body.version + 1, scope: {} } } : { inventory: {} }))
}

async function mountPage({ scopes, snapshots, citySnapshots, loggedIn = true } = {}) {
  setActivePinia(createPinia())
  if (loggedIn) useAuthStore().$patch({ user: { characters: [{ id: 7, pseudo: 'Artifice' }] }, token: 'jeton' })
  serve({ scopes, snapshots, citySnapshots })
  const i18n = createI18n({ legacy: false, locale: 'fr', messages: { fr, en } })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/app/mon-bureau/:section?', name: 'province', component: { template: '<div/>' } }, { path: '/app/eco/registre-stocks', name: 'economy-inventory-registry', component: { template: '<div/>' } }] })
  const wrapper = mount(EconomyInventory, { global: { plugins: [i18n, router], stubs: { 'v-icon': true } } })
  await flushPromises()
  return wrapper
}

const textarea = w => w.find('[data-testid="inventory-paste"]')
const levelButton = (w, level) => w.find(`[data-testid="inventory-level-${level}"]`)

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.useRealTimers())

describe('Gestion des stocks avec un compte', () => {
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

describe('Registre des stocks : la ville et la province, depuis le Bilan', () => {
  async function levelView(level, options) {
    const wrapper = await mountPage(options)
    await levelButton(wrapper, level).trigger('click')
    await flushPromises()
    return wrapper
  }
  const conflict = existing => Promise.reject({
    response: { status: 409, data: { success: false, code: 'registry_needs_confirmation', message: 'Un inventaire existe déjà au registre pour le 10/05/2026 (Artois).', messages: { fr: 'Un inventaire existe déjà au registre pour le 10/05/2026 (Artois). Il sera remplacé, pas effacé.', en: 'An inventory is already in the registry for 10/05/2026 (Artois).' }, existing } },
  })

  it('au niveau personnel : aucun registre (pas d\'inscription, pas d\'historique)', async () => {
    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="registry-block"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="registry-record"]').exists()).toBe(false)
  })

  it('le commissaire au commerce inscrit l\'inventaire du jour à la main (jamais automatiquement) ; l\'écran dit où AVANT l\'envoi', async () => {
    const wrapper = await levelView('province')
    http.post.mockReturnValue(ok({ snapshot: { id: 3, taken_on: '2026-05-24' }, replaced: null, unchanged: false }))
    expect(wrapper.find('[data-testid="registry-target"]').text()).toBe('Sera inscrit au registre : Province : Artois.')

    vi.useFakeTimers()
    await textarea(wrapper).setValue('900Miches de pain4500')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY + 10)
    expect(http.put.mock.calls.some(c => c[0].includes('/inventory/province'))).toBe(false) // pas d'enregistrement automatique
    vi.useRealTimers()

    await wrapper.find('[data-testid="registry-record"]').trigger('click')
    await flushPromises()
    expect(http.post).toHaveBeenCalledWith('characters/7/inventory/province', { raw: '900Miches de pain4500' }, expect.anything())
    expect(push.success).toHaveBeenCalledWith(expect.stringContaining('inscrit au registre (Province : Artois)'))
  })

  it('le maire inscrit au registre de SA ville : route et message propres au niveau', async () => {
    const wrapper = await levelView('city')
    http.post.mockReturnValue(ok({ snapshot: { id: 10, taken_on: '2026-05-24' }, replaced: null, unchanged: false }))
    expect(wrapper.find('[data-testid="registry-target"]').text()).toBe('Sera inscrit au registre : Ville : Arras.')
    await textarea(wrapper).setValue('900Cailloux0')
    await wrapper.find('[data-testid="registry-record"]').trigger('click')
    await flushPromises()
    expect(http.post).toHaveBeenCalledWith('characters/7/inventory/city/registry', { raw: '900Cailloux0' }, expect.anything())
    expect(push.success).toHaveBeenCalledWith(expect.stringContaining('inscrit au registre (Ville : Arras)'))
  })

  it('un autre texte le même jour : le serveur répond 409, l\'écran nomme le rédacteur et demande confirmation — rien n\'est écrit sans elle', async () => {
    const wrapper = await levelView('province')
    http.post.mockReturnValueOnce(conflict({ id: 2, pseudo: 'Marchand', office_key: 'commissaire_commerce', office_label: { fr: 'Commissaire au commerce', en: 'Trade Minister' } }))
    await wrapper.find('[data-testid="registry-record"]').trigger('click')
    await flushPromises()

    const box = wrapper.find('[data-testid="registry-confirm"]')
    expect(box.exists()).toBe(true)
    expect(box.text()).toContain('Il sera remplacé, pas effacé.')
    expect(wrapper.find('[data-testid="registry-confirm-author"]').text()).toBe('L\'inventaire en place a été inscrit par Marchand (Commissaire au commerce).')
    expect(push.error).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="registry-record"]').exists()).toBe(false) // le bouton cède la place à la confirmation

    http.post.mockReturnValueOnce(ok({ snapshot: { id: 4, taken_on: '2026-05-24' }, replaced: { id: 2, pseudo: 'Marchand' }, unchanged: false }))
    await wrapper.find('[data-testid="registry-confirm-yes"]').trigger('click')
    await flushPromises()
    expect(http.post).toHaveBeenLastCalledWith('characters/7/inventory/province', { raw: PROVINCE_TEXT, confirm_replace: true }, expect.anything())
    expect(push.success.mock.calls[0][0]).toContain('Il remplace celui de Marchand')
    expect(wrapper.find('[data-testid="registry-confirm"]').exists()).toBe(false)
  })

  it('« Annuler » referme la confirmation sans rien écrire ; un rédacteur disparu se dit', async () => {
    const wrapper = await levelView('province')
    http.post.mockReturnValueOnce(conflict({ id: 2, pseudo: null, office_key: 'commissaire_commerce', office_label: { fr: 'Commissaire au commerce', en: 'Trade Minister' } }))
    await wrapper.find('[data-testid="registry-record"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="registry-confirm-author"]').text()).toContain('un personnage disparu')
    await wrapper.find('[data-testid="registry-confirm-no"]').trigger('click')
    expect(wrapper.find('[data-testid="registry-confirm"]').exists()).toBe(false)
    expect(http.post).toHaveBeenCalledTimes(1)
  })

  it('un texte identique à celui du jour : « rien à changer »', async () => {
    const wrapper = await levelView('province')
    http.post.mockReturnValueOnce(ok({ snapshot: { id: 4, taken_on: '2026-05-24' }, replaced: null, unchanged: true }))
    await wrapper.find('[data-testid="registry-record"]').trigger('click')
    await flushPromises()
    expect(push.success.mock.calls[0][0]).toContain('rien à changer')
  })

  it('un autre refus du serveur (403…) s\'affiche tel quel, sans confirmation', async () => {
    const wrapper = await levelView('province')
    http.post.mockReturnValueOnce(Promise.reject({ response: { status: 403, data: { success: false, message: 'Refusé', messages: { fr: 'Refusé par l\'Office.', en: 'Refused.' } } } }))
    await wrapper.find('[data-testid="registry-record"]').trigger('click')
    await flushPromises()
    expect(push.error).toHaveBeenCalledWith('Refusé par l\'Office.')
    expect(wrapper.find('[data-testid="registry-confirm"]').exists()).toBe(false)
  })

  it('l\'historique se charge dans le champ, daté en année du jeu', async () => {
    const wrapper = await levelView('province')
    const select = wrapper.find('[data-testid="registry-history"]')
    const options = select.findAll('option')
    expect(options[0].text()).toBe(fr.EconomyInventory.RegistryHistoryLoad)
    expect(options).toHaveLength(3)
    expect(options[1].text()).toMatch(/1474/) // 17/05/2026 → année du jeu
    await select.setValue('1')
    expect(textarea(wrapper).element.value).toBe('ancien')
  })

  it('l\'historique de la ville se charge de même', async () => {
    const wrapper = await levelView('city')
    const select = wrapper.find('[data-testid="registry-history"]')
    expect(select.findAll('option')).toHaveLength(2)
    await select.setValue('9')
    expect(textarea(wrapper).element.value).toBe('8Cailloux0')
  })

  it('le dirigeant (lecture seule) : l\'inventaire se consulte, rien ne s\'inscrit ni ne se corrige', async () => {
    const wrapper = await levelView('province', { scopes: SCOPES({ id: 3, name: 'Artois', can_write: false, can_read: true }) })
    expect(wrapper.find('[data-testid="inventory-readonly"]').text()).toBe(fr.EconomyInventory.ReadOnlyScope)
    expect(wrapper.find('[data-testid="registry-record"]').exists()).toBe(false)
    expect(wrapper.find('select[aria-label*="Miches de pain"]').exists()).toBe(false) // pas de correction de catégorie
    expect(wrapper.find('[data-testid="registry-history"]').exists()).toBe(true)
  })

  it('un registre sans inscription le dit, et le lien ouvre le Registre des stocks', async () => {
    const wrapper = await levelView('province', { snapshots: [] })
    expect(wrapper.find('[data-testid="registry-history-empty"]').text()).toBe(fr.EconomyInventory.RegistryHistoryEmpty)
    expect(textarea(wrapper).element.value).toBe('')
    expect(wrapper.find('[data-testid="registry-open"]').text()).toBe('Ouvrir le Registre des stocks')
  })
})
