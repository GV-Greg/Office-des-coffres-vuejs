import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import MonBureauView from '../../src/views/MonBureauView.vue'
import { http } from '../../src/api.js'

// « Mon bureau » en sections (onglets) : province (par défaut), prix des mines (si l'on gère les prix), catégories
// d'inventaire. Une section à la fois, chacune avec son adresse. Locales lues sur disque (un import de
// src/locales/*.json rend des messages précompilés).
vi.mock('notivue', () => ({ push: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../src/api.js', () => ({ http: { get: vi.fn() } }))

const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const fr = JSON.parse(fs.readFileSync(path.join(localesDir, 'fr.json'), 'utf8'))
const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'))

const HISTORY = {
  success: true,
  province: { id: 10, name: 'Franche-Comté', kingdom: 'SERG' },
  offices: [],
  mayors: [],
  cities_without_mandate: [],
}
const PRICE_ACCESS = { success: true, write: null, read: null, prices: { write: { id: 10, name: 'Franche-Comté' }, read: null } }
const NO_PRICE_ACCESS = { success: true, write: null, read: null, prices: { write: null, read: null } }

function respond(access) {
  http.get.mockImplementation(async (url) => {
    if (url.includes('mine-registry')) return { data: access }
    if (url.includes('mine-prices')) return { data: { success: true, prices: [] } }
    return { data: HISTORY }
  })
}

async function mountAt(url, { access = NO_PRICE_ACCESS, locale = 'fr' } = {}) {
  respond(access)
  localStorage.clear()
  const i18n = createI18n({ legacy: false, locale, messages: { fr, en } })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/app/mon-bureau/:section(province|prix|categories)?', name: 'province', component: { template: '<div/>' } },
      { path: '/app/eco/registre/prix', name: 'economy-prices', component: { template: '<div/>' } },
    ],
  })
  router.push(url)
  await router.isReady()
  const wrapper = mount(MonBureauView, {
    global: {
      plugins: [i18n, router, createTestingPinia({ createSpy: vi.fn, initialState: {}, stubActions: false })],
      stubs: { 'v-icon': true, NavMenu: true, MinePricesModal: true },
    },
  })
  const { useAuthStore } = await import('../../src/stores/authStore')
  useAuthStore().$patch({ user: { characters: [{ id: 7, pseudo: 'Artifice' }] }, token: 'jeton' })
  await flushPromises()
  return { wrapper, router }
}

const tab = (w, key) => w.find(`[data-testid="mon-bureau-tab-${key}"]`)
const visible = w => ({
  province: w.find('[aria-labelledby="panel-province"]').exists(),
  prix: w.find('[aria-labelledby="panel-prices"]').exists(),
  categories: w.find('[aria-labelledby="panel-cats-perso"]').exists(),
})

beforeEach(() => vi.clearAllMocks())

describe('Mon bureau — une section à la fois', () => {
  it("sans section dans l'adresse : « Ma province » seule, annoncée comme page courante", async () => {
    const { wrapper } = await mountAt('/app/mon-bureau')
    expect(visible(wrapper)).toEqual({ province: true, prix: false, categories: false })
    expect(tab(wrapper, 'province').attributes('aria-current')).toBe('page')
    expect(tab(wrapper, 'categories').attributes('aria-current')).toBeUndefined()
  })

  it("/categories : les catégories seules, avec leur lien courant", async () => {
    const { wrapper } = await mountAt('/app/mon-bureau/categories')
    expect(visible(wrapper)).toEqual({ province: false, prix: false, categories: true })
    expect(tab(wrapper, 'categories').attributes('aria-current')).toBe('page')
    expect(tab(wrapper, 'province').attributes('aria-current')).toBeUndefined()
  })

  it('le menu a un nom accessible et chaque entrée un vrai lien (adresse propre)', async () => {
    const { wrapper } = await mountAt('/app/mon-bureau')
    expect(wrapper.find('[data-testid="mon-bureau-tabs"]').attributes('aria-label')).toBe('Sections de Mon bureau')
    expect(tab(wrapper, 'province').attributes('href')).toBe('/app/mon-bureau/province')
    expect(tab(wrapper, 'categories').attributes('href')).toBe('/app/mon-bureau/categories')
    expect(tab(wrapper, 'province').text()).toBe('Ma province')
    expect(tab(wrapper, 'categories').text()).toBe('Catégories d\'inventaire')
  })

  it("cliquer une entrée change de section (et d'adresse)", async () => {
    const { wrapper, router } = await mountAt('/app/mon-bureau')
    await tab(wrapper, 'categories').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.params.section).toBe('categories')
    expect(visible(wrapper)).toEqual({ province: false, prix: false, categories: true })
  })

  it("l'entrée « Prix des mines » n'existe que pour qui gère les prix d'une province", async () => {
    const without = await mountAt('/app/mon-bureau')
    expect(tab(without.wrapper, 'prix').exists()).toBe(false)

    const withPrices = await mountAt('/app/mon-bureau', { access: PRICE_ACCESS })
    expect(tab(withPrices.wrapper, 'prix').exists()).toBe(true)
    expect(tab(withPrices.wrapper, 'prix').text()).toBe('Prix des mines')
  })

  it('/prix affiche les prix pour qui les gère', async () => {
    const { wrapper } = await mountAt('/app/mon-bureau/prix', { access: PRICE_ACCESS })
    expect(visible(wrapper)).toEqual({ province: false, prix: true, categories: false })
    expect(tab(wrapper, 'prix').attributes('aria-current')).toBe('page')
  })

  it("/prix sans droit sur les prix retombe sur « Ma province » (jamais une page vide)", async () => {
    const { wrapper } = await mountAt('/app/mon-bureau/prix')
    expect(visible(wrapper)).toEqual({ province: true, prix: false, categories: false })
    expect(tab(wrapper, 'province').attributes('aria-current')).toBe('page')
  })

  it("héros aux couleurs du module (violet) : grand titre, sous-titre, plus de bandeaux colorés par section", async () => {
    const { wrapper } = await mountAt('/app/mon-bureau/categories', { access: PRICE_ACCESS })
    expect(wrapper.find('[data-testid="mon-bureau-title"]').text()).toBe('Mon bureau')
    expect(wrapper.find('[data-testid="mon-bureau-title"]').classes()).toEqual(expect.arrayContaining(['text-violet-800', 'font-extrabold']))
    expect(wrapper.find('[data-testid="mon-bureau-subtitle"]').text()).toBe(fr.MonBureau.Subtitle)
    // les bandeaux pleins (bg-yellow-600 / dégradé violet) répétaient l'onglet actif : titres compacts à la place
    expect(wrapper.html()).not.toContain('bg-yellow-600')
    expect(wrapper.html()).not.toContain('from-violet-700')
    // un accordéon par inventaire géré (d'autres viendront : ville, province), ouvert par défaut
    expect(wrapper.find('#panel-cats-perso').text()).toBe(fr.MonBureau.CatPersoPanel)
    const accordion = wrapper.find('details[data-testid="cats-accordion"]')
    expect(accordion.exists()).toBe(true)
    expect(accordion.attributes('open')).toBeDefined()
    expect(accordion.find('summary #panel-cats-perso').exists()).toBe(true)
  })

  it("le héros est traduit", async () => {
    const { wrapper } = await mountAt('/app/mon-bureau', { locale: 'en' })
    expect(wrapper.find('[data-testid="mon-bureau-subtitle"]').text()).toBe(en.MonBureau.Subtitle)
  })

  it("chaque section prend la place de son contenu : prix et province en cartes bornées, catégories en pleine largeur", async () => {
    const province = await mountAt('/app/mon-bureau', { access: PRICE_ACCESS })
    expect(province.wrapper.find('[aria-labelledby="panel-province"]').classes()).toEqual(expect.arrayContaining(['max-w-4xl', 'mx-auto']))
    const prix = await mountAt('/app/mon-bureau/prix', { access: PRICE_ACCESS })
    expect(prix.wrapper.find('[aria-labelledby="panel-prices"]').classes()).toEqual(expect.arrayContaining(['max-w-xl', 'mx-auto']))
    const cats = await mountAt('/app/mon-bureau/categories')
    const classes = cats.wrapper.find('[aria-labelledby="panel-cats-perso"]').classes()
    expect(classes.some(c => c.startsWith('max-w-'))).toBe(false)
  })

  it("plus de panneaux repliables : aucun bouton Réduire/Développer, aucun état de repli mémorisé", async () => {
    const { wrapper } = await mountAt('/app/mon-bureau')
    expect(wrapper.findAll('button[aria-expanded]')).toHaveLength(0)
    expect(localStorage.getItem('comfort-cookies') ?? '').not.toContain('mon_bureau_panels')
  })

  it("en anglais : les entrées du menu sont traduites", async () => {
    const { wrapper } = await mountAt('/app/mon-bureau', { access: PRICE_ACCESS, locale: 'en' })
    expect(tab(wrapper, 'province').text()).toBe('My province')
    expect(tab(wrapper, 'prix').text()).toBe('Mine prices')
    expect(tab(wrapper, 'categories').text()).toBe('Inventory categories')
    expect(wrapper.find('[data-testid="mon-bureau-tabs"]').attributes('aria-label')).toBe('My desk sections')
  })

  it("sans personnage : le message d'invitation, pas de menu", async () => {
    respond(NO_PRICE_ACCESS)
    const i18n = createI18n({ legacy: false, locale: 'fr', messages: { fr, en } })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
      { path: '/app/mon-bureau/:section(province|prix|categories)?', name: 'province', component: { template: '<div/>' } },
      { path: '/app/eco/registre/prix', name: 'economy-prices', component: { template: '<div/>' } },
    ],
    })
    router.push('/app/mon-bureau')
    await router.isReady()
    const wrapper = mount(MonBureauView, {
      global: {
        plugins: [i18n, router, createTestingPinia({ createSpy: vi.fn, initialState: {}, stubActions: false })],
        stubs: { 'v-icon': true, NavMenu: true, MinePricesModal: true },
      },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="mon-bureau-no-character"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mon-bureau-tabs"]').exists()).toBe(false)
  })
})
