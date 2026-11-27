import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import EconomyInventory from '../../src/views/modules/economy/EconomyInventory.vue'
import { useInventoryStore, normalizeDoc, SAVE_DELAY } from '../../src/stores/inventoryStore'
import { useAuthStore } from '../../src/stores/authStore'
import { useCookieStore } from '../../src/stores/cookieStore'
import { clearItemIconCache } from '../../src/use/itemIconsApi'
import { http } from '../../src/api.js'
import { push } from 'notivue'

/*
  Phase 2 des icônes d'items : l'interrupteur « Sans illustration / Avec illustration » de la Gestion des stocks. Il ne commande que
  l'EXPORT BBCode ; aucune image n'est jamais posée dans la page. 🔴 Réservé aux joueurs CONNECTÉS (Greg, 14/11/2026, option b) : demander
  une icône envoie au serveur le nom des objets, ce que « sans compte, tout reste dans votre navigateur » exclut. Réglage personnel,
  gardé dans le document de réglages du personnage.
*/
vi.mock('notivue', () => ({ push: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock('../../src/api.js', () => ({ http: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }))

const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const fr = JSON.parse(readFileSync(resolve(localesDir, 'fr.json'), 'utf-8'))
const en = JSON.parse(readFileSync(resolve(localesDir, 'en.json'), 'utf-8'))

const FIXTURE = `Encombrement : 29950

 #NomEnc.Actions possibles26865,51 écus
596Miches de pain2980
121Morceaux de viande605
1Objet inconnu et fantaisiste999`

const ROUTES = [{ path: '/app/mon-bureau/:section?', name: 'province', component: { template: '<div/>' } }]
const ok = data => Promise.resolve({ data })
const SCOPE = { level: 'personal', id: 7 }

/** Le serveur factice : niveaux, réglages (`settings`), texte, et `item-icons` (`icons`, ou une erreur). */
function serve({ settings = {}, icons = {}, iconsError = null } = {}) {
  http.get.mockImplementation(url => {
    if (url.endsWith('inventory-scopes')) return ok({ success: true, personal: { id: 7, can_write: true, can_read: true }, city: null, province: null })
    if (url.includes('inventory-settings/')) return ok({ settings: { data: settings, version: 1, updated_at: null, scope: SCOPE } })
    if (url.endsWith('inventory/personal')) return ok({ inventory: { raw: '' } })
    if (url === 'item-icons') return iconsError ? Promise.reject(iconsError) : ok({ success: true, icons })
    return ok({})
  })
  http.put.mockImplementation((url, body) => ok(url.includes('inventory-settings')
    ? { settings: { data: body.data, version: body.version + 1, updated_at: null, scope: SCOPE } }
    : { inventory: {} }))
}

async function mountPage({ locale = 'fr', loggedIn = true, ...serverOptions } = {}) {
  setActivePinia(createPinia())
  track(useInventoryStore())
  if (loggedIn) useAuthStore().$patch({ user: { characters: [{ id: 7, pseudo: 'Artifice' }] }, token: 'jeton' })
  serve(serverOptions)
  const i18n = createI18n({ legacy: false, locale, messages: { fr, en } })
  const router = createRouter({ history: createMemoryHistory(), routes: ROUTES })
  const w = mount(EconomyInventory, { global: { plugins: [i18n, router] } })
  await flushPromises()
  await w.find('[data-testid="inventory-paste"]').setValue(FIXTURE)
  return w
}

async function exportBBCode(w) {
  const written = []
  Object.assign(navigator, { clipboard: { writeText: t => { written.push(t); return Promise.resolve() } } })
  await w.find('[data-testid="export-btn"]').trigger('click')
  await flushPromises()
  return written[0]
}

const iconCalls = () => http.get.mock.calls.filter(([url]) => url === 'item-icons')

// Chaque changement de réglage programme une écriture différée (SAVE_DELAY, 800 ms, minuterie RÉELLE). Sans nettoyage, celles d'un test
// précédent partent PENDANT un test suivant et s'ajoutent à `http.put` : « called 1 times, but got 2 » selon la charge de la machine
// (constaté le 19/11/2026, intermittent sur main). Chaque test enregistre donc son store, et `afterEach` annule ses écritures en attente.
const stores = []
const track = store => { stores.push(store); return store }

beforeEach(() => {
  vi.clearAllMocks()
  clearItemIconCache()
  localStorage.clear()
})
afterEach(() => {
  for (const store of stores.splice(0)) store.reset()
})

describe('l\'interrupteur « Sans illustration / Avec illustration »', () => {
  it('est éteint par défaut, et l\'export part alors sans [img] ni requête d\'icônes', async () => {
    const w = await mountPage()
    const toggle = w.find('[data-testid="export-show-icons"]')
    expect(toggle.exists()).toBe(true)
    expect(toggle.attributes('role')).toBe('switch')
    expect(toggle.attributes('aria-checked')).toBe('false')
    // Un seul libellé, qui dit l'état.
    expect(w.find('[data-testid="export-icons-toggle"]').text()).toBe('Sans illustration')

    const bbcode = await exportBBCode(w)
    expect(bbcode).not.toContain('cdn.oxv.fr') // le badge de la signature, lui, reste
    expect(iconCalls()).toHaveLength(0)
  })

  it('allumé, l\'export demande les icônes des items exportés et les écrit en [img]', async () => {
    const w = await mountPage({ icons: { 'Miches de pain': 50 } })
    await w.find('[data-testid="export-show-icons"]').trigger('click')
    await flushPromises() // connecté : le réglage passe par le store (asynchrone)
    expect(w.find('[data-testid="export-show-icons"]').attributes('aria-checked')).toBe('true')

    const bbcode = await exportBBCode(w)
    expect(iconCalls()).toHaveLength(1)
    expect(iconCalls()[0][1].params.names).toEqual(expect.arrayContaining(['Miches de pain', 'Morceaux de viande']))
    expect(bbcode).toContain('[img]https://lesroyaumes.cdn.oxv.fr/images/items/item50.png[/img] 596 Miches de pain')
    expect(bbcode).toContain('[*][b]121 Morceaux de viande[/b]')
    expect(push.warning).not.toHaveBeenCalled()
  })

  it('ne demande que les items qui s\'exportent : un item masqué n\'est jamais envoyé', async () => {
    const w = await mountPage()
    await w.find('[data-testid="export-show-icons"]').trigger('click')
    await flushPromises() // connecté : le réglage passe par le store (asynchrone)
    // Masque la ligne « Morceaux de viande » (le dernier bouton de sa ligne).
    const row = w.findAll('li').find(li => li.text().includes('Morceaux de viande'))
    await row.findAll('button').at(-1).trigger('click')

    await exportBBCode(w)
    expect(iconCalls()[0][1].params.names).not.toContain('Morceaux de viande')
    expect(iconCalls()[0][1].params.names).toContain('Miches de pain')
  })

  it('une panne du serveur ne bloque pas l\'export : il part sans icônes, et le dit', async () => {
    const w = await mountPage({ iconsError: new Error('réseau') })
    await w.find('[data-testid="export-show-icons"]').trigger('click')
    await flushPromises() // connecté : le réglage passe par le store (asynchrone)

    const bbcode = await exportBBCode(w)
    expect(bbcode).toContain('596 Miches de pain')
    expect(bbcode).not.toContain('cdn.oxv.fr') // le badge de la signature, lui, reste
    expect(push.warning).toHaveBeenCalledTimes(1)
    expect(push.success).toHaveBeenCalled()
  })

  it('n\'affiche AUCUNE image dans la page, interrupteur allumé et icônes reçues comprises', async () => {
    const w = await mountPage({ icons: { 'Miches de pain': 50 } })
    await w.find('[data-testid="export-show-icons"]').trigger('click')
    await flushPromises() // connecté : le réglage passe par le store (asynchrone)
    await exportBBCode(w)

    expect(w.find('img').exists()).toBe(false)
    expect(w.html()).not.toContain('cdn.oxv.fr')
  })

  it('n\'a qu\'un libellé, qui suit l\'interrupteur, dans les deux langues', async () => {
    const wFr = await mountPage()
    const label = () => wFr.find('[data-testid="export-icons-toggle"]')
    expect(label().text()).toBe('Sans illustration')
    expect(label().attributes('title')).toBe(fr.EconomyInventory.Icons.TooltipOff)
    await wFr.find('[data-testid="export-show-icons"]').trigger('click')
    await flushPromises()
    expect(label().text()).toBe('Avec illustration')
    expect(label().attributes('title')).toBe(fr.EconomyInventory.Icons.TooltipOn)
    await wFr.find('[data-testid="export-show-icons"]').trigger('click')
    await flushPromises()
    expect(label().text()).toBe('Sans illustration')

    const wEn = await mountPage({ locale: 'en' })
    expect(wEn.find('[data-testid="export-icons-toggle"]').text()).toBe('Without illustration')
    await wEn.find('[data-testid="export-show-icons"]').trigger('click')
    await flushPromises()
    expect(wEn.find('[data-testid="export-icons-toggle"]').text()).toBe('With illustration')
    expect(wEn.find('[data-testid="export-icons-toggle"]').attributes('title')).toBe(en.EconomyInventory.Icons.TooltipOn)
  })

  it('SANS COMPTE : pas d\'interrupteur, et jamais un nom d\'objet envoyé au serveur (option b de Greg)', async () => {
    const w = await mountPage({ loggedIn: false })
    expect(w.find('[data-testid="export-show-icons"]').exists()).toBe(false)
    expect(w.find('[data-testid="export-icons-toggle"]').exists()).toBe(false)

    const bbcode = await exportBBCode(w)
    expect(bbcode).toContain('596 Miches de pain')
    expect(bbcode).not.toContain('cdn.oxv.fr') // le badge de la signature, lui, reste
    expect(http.get).not.toHaveBeenCalled()
  })

  it('SANS COMPTE : même un réglage resté allumé dans le navigateur n\'envoie rien', async () => {
    localStorage.setItem('comfort-cookies', JSON.stringify({ inventory_export_icons: true }))
    const w = await mountPage({ loggedIn: false })
    await exportBBCode(w)
    expect(http.get).not.toHaveBeenCalled()
  })
})

describe('le réglage « exportShowIcons » — personnel, éteint par défaut', () => {
  const setup = ({ loggedIn }) => {
    setActivePinia(createPinia())
    if (loggedIn) useAuthStore().$patch({ user: { characters: [{ id: 7, pseudo: 'Artifice' }] }, token: 'jeton' })
    return { store: track(useInventoryStore()), cookies: useCookieStore() }
  }

  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('vaut faux par défaut, et seul un vrai booléen l\'allume', () => {
    expect(normalizeDoc({}).exportShowIcons).toBe(false)
    expect(normalizeDoc({ exportShowIcons: true }).exportShowIcons).toBe(true)
    expect(normalizeDoc({ exportShowIcons: 'oui' }).exportShowIcons).toBe(false)
    expect(normalizeDoc(null).exportShowIcons).toBe(false)
  })

  it('sans compte : rien n\'est gardé dans le navigateur, le réglage n\'existe pas', async () => {
    const { store, cookies } = setup({ loggedIn: false })
    await store.update('personal', { exportShowIcons: true, exportWrapper: 'quote' })
    expect(cookies.getComfortData('inventory_export_icons')).toBeNull()
    expect(store.doc('personal').exportShowIcons).toBe(false)
    expect(store.doc('personal').exportWrapper).toBe('quote')
    expect(http.put).not.toHaveBeenCalled()
  })

  it('avec un compte : écrit dans le document de réglages du personnage, avec les autres options d\'export', async () => {
    const { store } = setup({ loggedIn: true })
    http.get.mockImplementation(() => ok({ settings: { data: { exportWrapper: 'quote' }, version: 3, updated_at: null, scope: { level: 'personal', id: 7 } } }))
    http.put.mockImplementation((url, body) => ok({ settings: { data: body.data, version: 4, updated_at: null, scope: { level: 'personal', id: 7 } } }))

    await store.update('personal', { exportShowIcons: true })
    await vi.advanceTimersByTimeAsync(SAVE_DELAY + 10)

    expect(http.put).toHaveBeenCalledTimes(1)
    expect(http.put.mock.calls[0][0]).toBe('characters/7/inventory-settings/personal')
    expect(http.put.mock.calls[0][1]).toMatchObject({ version: 3, data: { exportShowIcons: true, exportWrapper: 'quote' } })
    expect(store.doc('personal').exportShowIcons).toBe(true)
  })

  it('reste personnel : la ville et la province ne reçoivent jamais la clé', async () => {
    const { store } = setup({ loggedIn: true })
    http.get.mockImplementation(url => ok(url.endsWith('inventory-scopes')
      ? { personal: { id: 7, can_write: true }, city: { id: 1, name: 'Arras', can_write: true }, province: null }
      : { settings: { data: {}, version: 0, updated_at: null, scope: { level: 'city', id: 1 } } }))
    http.put.mockImplementation((url, body) => ok({ settings: { data: body.data, version: 1, updated_at: null, scope: {} } }))
    await store.loadScopes()

    await store.update('city', { order: ['divers'], exportShowIcons: true })
    await vi.advanceTimersByTimeAsync(SAVE_DELAY + 10)

    expect(Object.keys(http.put.mock.calls[0][1].data)).not.toContain('exportShowIcons')
  })
})
