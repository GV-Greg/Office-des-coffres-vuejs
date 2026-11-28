import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import EconomyBirths from '../../src/views/modules/economy/EconomyBirths.vue'
import MonBureauView from '../../src/views/MonBureauView.vue'
import { useAuthStore } from '../../src/stores/authStore'
import { http } from '../../src/api.js'

/*
  Le Livre des naissances avec un poste : espèces de la province, inscription, registre du jour (même page) et réglages dans Mon bureau.
  ⚠️ Aucune règle côté site : le serveur dit qui peut quoi (`can_record`, `can_price`, `can_withdraw`, `editable`).
*/
vi.mock('notivue', () => ({ push: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../src/api.js', () => ({ http: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const fr = JSON.parse(readFileSync(resolve(localesDir, 'fr.json'), 'utf-8'))
const en = JSON.parse(readFileSync(resolve(localesDir, 'en.json'), 'utf-8'))

const PRICE = { id: 4, effective_from: '2026-11-01', prices: { maize: 3, wheat: 10, marjoram: null, elderberry: null }, editable: true }
const BIRTH = { id: 9, born_on: '2026-11-20', species: 'pig', ingredient: 'wheat', quantity: 3, taken: 5, wasted: 0, can_withdraw: true }
const BOOK = {
  success: true, province: { id: 3, name: 'Artois' }, can_record: true, can_configure: true, can_price: true,
  today: '2026-11-27', first_day: '2026-11-03', species: ['pig', 'bees'], births: [BIRTH], prices: [PRICE], past_mandates: [],
}
const NOBODY = { ...BOOK, province: null, can_record: false, can_configure: false, can_price: false, first_day: null, species: null, births: [], prices: [] }

let book
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  book = BOOK
  http.get.mockImplementation(async (url) => {
    if (url.includes('/livestock/mandates/')) return { data: { success: true, province: { id: 5, name: 'Flandre' }, window: { from: '2026-01-01', to: '2026-03-01' }, births: [{ ...BIRTH, born_on: '2026-02-01', can_withdraw: false }], prices: [] } }
    if (url.endsWith('/livestock')) return { data: book }
    if (url.includes('mine-registry')) return { data: { success: true, write: null, read: null, prices: { write: null, read: null } } }
    if (url.endsWith('/customs')) return { data: { success: true, officer: null, decider: null } }
    return { data: { success: true, province: { id: 3, name: 'Artois' }, offices: [], mayors: [], cities_without_mandate: [] } }
  })
  http.post.mockResolvedValue({ data: { success: true, birth: BIRTH } })
  http.put.mockResolvedValue({ data: { success: true, species: ['pig'], price: PRICE } })
})

async function mountPage(component, url = '/', locale = 'fr') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/app/eco/naissances', name: 'economy-births', component: { template: '<div/>' } },
      { path: '/app/mon-bureau/:section?', name: 'province', component: { template: '<div/>' } },
      { path: '/app/eco/registre/prix', name: 'economy-prices', component: { template: '<div/>' } },
      { path: '/app/profil', name: 'profil', component: { template: '<div/>' } },
    ],
  })
  router.push(url)
  await router.isReady()
  const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
  useAuthStore(pinia).$patch({ user: { characters: [{ id: 7, pseudo: 'Intendant' }] }, token: 'jeton' })
  const wrapper = mount(component, {
    global: {
      plugins: [createI18n({ legacy: false, locale, messages: { fr, en } }), router, pinia],
      stubs: { 'v-icon': true, NavMenu: true, MinePricesModal: true, InventoryLevelsAccordion: true },
    },
  })
  await flushPromises()
  return wrapper
}
const find = (w, id) => w.find(`[data-testid="${id}"]`)

describe('le calculateur, avec un poste', () => {
  it('ne propose que les espèces de la province, ouvre sur la première et montre le registre', async () => {
    const w = await mountPage(EconomyBirths)

    expect(find(w, 'births-species-pig').attributes('aria-pressed')).toBe('true')
    expect(find(w, 'births-species-bees').exists()).toBe(true)
    expect(find(w, 'births-species-cow').exists()).toBe(false)
    expect(find(w, 'births-ledger').exists()).toBe(true)
  })

  it('province sans espèce : pas de calculateur, le chemin vers Mon bureau', async () => {
    book = { ...BOOK, species: null }
    const w = await mountPage(EconomyBirths)

    expect(find(w, 'births-not-configured').text()).toContain('Artois')
    expect(find(w, 'births-configure').attributes('href')).toBe('/app/mon-bureau/cheptel')
    expect(find(w, 'births-result').exists()).toBe(false)
  })

  it('le coût compte les unités entières au prix du jour choisi', async () => {
    book = { ...BOOK, prices: [{ ...PRICE, effective_from: '2026-11-25', prices: { ...PRICE.prices, wheat: 12 } }, PRICE] }
    const w = await mountPage(EconomyBirths)
    await find(w, 'births-ingredient-wheat').trigger('click')
    await find(w, 'births-quantity-3').trigger('click')

    expect(find(w, 'births-cost').text()).toBe('Coût : 5 sacs à 12 écus l\'unité, soit 60 écus')
    await find(w, 'births-record-day').setValue('1474-11-20')
    expect(find(w, 'births-cost').text()).toBe('Coût : 5 sacs à 10 écus l\'unité, soit 50 écus')
    await find(w, 'births-record-day').setValue('1474-10-01')
    expect(find(w, 'births-cost').text()).toBe('Aucun prix de la nourriture à cette date.')
  })

  it('le bailli inscrit le lot choisi, au jour du jeu, et le registre va au jour de la naissance', async () => {
    const w = await mountPage(EconomyBirths)
    await find(w, 'births-ingredient-wheat').trigger('click')
    await find(w, 'births-quantity-3').trigger('click')

    expect(find(w, 'births-record-day').element.value).toBe('1474-11-27')
    expect(find(w, 'births-record-day').attributes('min')).toBe('1474-11-03')
    await find(w, 'births-record').trigger('submit')
    await flushPromises()

    expect(http.post).toHaveBeenCalledWith('characters/7/livestock/births',
      { born_on: '2026-11-27', species: 'pig', ingredient: 'wheat', quantity: 3, taken: 5, wasted: 0 }, expect.anything())
    expect(find(w, 'births-record-done').exists()).toBe(true)
    // La réponse simulée date la naissance du 20/11 : le registre s'y place.
    expect(find(w, 'births-day').text()).toBe('20/11/1474')
  })

  it('le dirigeant calcule mais n\'inscrit rien ; sans poste, toutes les espèces et aucun registre', async () => {
    book = { ...BOOK, can_record: false }
    const leader = await mountPage(EconomyBirths)
    expect(find(leader, 'births-record').exists()).toBe(false)
    expect(find(leader, 'births-cost').text()).toContain('l\'unité')

    book = NOBODY
    const w = await mountPage(EconomyBirths)
    expect(find(w, 'births-species-cow').exists()).toBe(true)
    expect(find(w, 'births-ledger').exists()).toBe(false)
    expect(find(w, 'births-cost').exists()).toBe(false)
  })
})

describe('le registre des naissances, un jour à la fois', () => {
  it('s\'ouvre sur aujourd\'hui, puis les flèches vont aux jours qui ont des naissances', async () => {
    const w = await mountPage(EconomyBirths)

    expect(find(w, 'births-day').text()).toBe('27/11/1474')
    expect(find(w, 'births-empty').text()).toBe('Aucune naissance inscrite ce jour-là.')
    expect(find(w, 'births-newer').attributes('disabled')).toBeDefined()
    await find(w, 'births-older').trigger('click')

    expect(find(w, 'births-day').text()).toBe('20/11/1474')
    expect(find(w, 'births-row').text()).toContain('Cochon × 3')
    expect(find(w, 'births-total').text()).toBe('50 écus')
    expect(find(w, 'births-total-animals').text()).toBe('3 animaux nés')
    expect(find(w, 'births-unpriced').exists()).toBe(false)
    expect(find(w, 'births-current-prices').text()).toContain('1474')
  })

  it('retire une naissance après confirmation seulement', async () => {
    const w = await mountPage(EconomyBirths)
    await find(w, 'births-older').trigger('click')
    await find(w, 'births-withdraw').trigger('click')
    expect(http.post).not.toHaveBeenCalled()
    await find(w, 'births-withdraw-cancel').trigger('click')
    expect(find(w, 'births-withdraw-confirm').exists()).toBe(false)

    await find(w, 'births-withdraw').trigger('click')
    await find(w, 'births-withdraw-confirm').trigger('click')
    await flushPromises()

    expect(http.post).toHaveBeenCalledWith('characters/7/livestock/births/9/withdraw', {}, expect.anything())
  })

  it('un ancien titulaire s\'ouvre sur son mandat passé, en lecture seule, total partiel sans prix', async () => {
    book = { ...NOBODY, past_mandates: [{ id: 12, province: { id: 5, name: 'Flandre' }, in_office_from: '2026-01-01', holds_until: '2026-03-02' }] }
    const w = await mountPage(EconomyBirths)

    expect(find(w, 'births-read-only').exists()).toBe(true)
    expect(find(w, 'births-day').text()).toBe('01/02/1474')
    expect(find(w, 'births-withdraw').exists()).toBe(false)
    expect(find(w, 'births-unpriced').text()).toBe('Total partiel : 1 naissance sans prix.')
    expect(find(w, 'births-species-cow').exists()).toBe(true) // sans poste en cours : le calculateur reste public
  })
})

describe('Mon bureau — Cheptel', () => {
  const open = () => mountPage(MonBureauView, '/app/mon-bureau/cheptel')

  it('enregistre les espèces cochées', async () => {
    const w = await open()
    expect(find(w, 'mon-bureau-tab-cheptel').attributes('aria-current')).toBe('page')
    expect(find(w, 'livestock-species-save').attributes('disabled')).toBeDefined()

    await find(w, 'livestock-species-bees').trigger('click')
    await find(w, 'livestock-species-save').trigger('click')
    await flushPromises()

    expect(http.put).toHaveBeenCalledWith('characters/7/livestock/species', { species: ['pig'] }, expect.anything())
  })

  it('ajoute un jeu de prix à partir de celui en vigueur, et corrige un jeu existant', async () => {
    const w = await open()
    expect(find(w, 'livestock-price-wheat').element.value).toBe('10')
    await find(w, 'livestock-price-wheat').setValue('11')
    await find(w, 'livestock-price-form').trigger('submit')
    await flushPromises()
    expect(http.post).toHaveBeenCalledWith('characters/7/livestock/prices',
      { effective_from: '2026-11-27', prices: { maize: 3, wheat: 11, marjoram: null, elderberry: null } }, expect.anything())

    await find(w, 'livestock-price-edit-4').trigger('click')
    expect(find(w, 'livestock-price-date').element.value).toBe('1474-11-01')
    await find(w, 'livestock-price-form').trigger('submit')
    await flushPromises()
    expect(http.put).toHaveBeenCalledWith('characters/7/livestock/prices/4', expect.objectContaining({ effective_from: '2026-11-01' }), expect.anything())
  })

  it('le dirigeant lit les prix sans formulaire', async () => {
    book = { ...BOOK, can_price: false, prices: [{ ...PRICE, editable: false }] }
    const w = await open()

    expect(find(w, 'livestock-price-form').exists()).toBe(false)
    expect(find(w, 'livestock-price-edit-4').exists()).toBe(false)
    expect(find(w, 'livestock-price-row').exists()).toBe(true)
  })

  it('sans droit : pas d\'onglet', async () => {
    book = NOBODY
    const w = await open()

    expect(find(w, 'mon-bureau-tab-cheptel').exists()).toBe(false)
    expect(find(w, 'livestock-species').exists()).toBe(false)
  })
})
