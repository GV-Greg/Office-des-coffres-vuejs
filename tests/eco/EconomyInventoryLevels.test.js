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
vi.mock('notivue', () => ({ push: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
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

// Le jour du jeu en cours et la plus ancienne date permise, dits par le serveur (brief 10).
const DATES = { today: '2026-05-24', office_from: '2026-05-24', backdate_min: '2026-05-10' }
const CITY_SNAPSHOTS = [{ id: 9, taken_on: '2026-05-17', raw: '8Cailloux0', by_me: true, replaced: null }]

function serve({ scopes = SCOPES(), snapshots = [{ id: 2, taken_on: '2026-05-17', raw: PROVINCE_TEXT, by_me: true }, { id: 1, taken_on: '2026-05-10', raw: 'ancien', by_me: false }], citySnapshots = CITY_SNAPSHOTS } = {}) {
  http.get.mockImplementation(url => {
    if (url.endsWith('inventory-scopes')) return ok(scopes)
    if (url.includes('inventory-settings/')) return ok({ settings: { data: { itemCategories: { 'Miches de pain': 'alimentation' } }, version: 1, scope: {} } })
    if (url.endsWith('inventory/personal')) return ok({ inventory: { raw: PERSONAL_TEXT } })
    if (url.endsWith('inventory/city')) return ok({ inventory: { raw: '3Cailloux0' } })
    if (url.endsWith('inventory/city/registry')) return ok({ city: { id: 1, name: 'Arras' }, can_write: true, snapshots: citySnapshots, ...DATES })
    if (url.endsWith('inventory/province')) return ok({ province: { id: 3, name: 'Artois' }, can_write: true, snapshots, ...DATES })
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

  it('mise en page : colonne de gauche = niveau, champ, décompte et actions sur le champ ; colonne de droite = consignes au scribe et registre', async () => {
    const wrapper = await levelView('city')
    const left = textarea(wrapper).element.parentElement
    const inLeft = id => left.contains(wrapper.find(`[data-testid="${id}"]`).element)
    expect(inLeft('inventory-summary')).toBe(true) // le décompte, sur la ligne du libellé
    expect(wrapper.find('[data-testid="inventory-summary"]').text()).toMatch(/^\d+ article\(s\)/)
    expect(inLeft('clear-btn')).toBe(true) // Effacer, Tout masquer… sous le champ
    expect(inLeft('hide-all-btn')).toBe(true)
    expect(inLeft('registry-block')).toBe(false) // le registre est à droite
    expect(wrapper.find('[data-testid="registry-block"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="export-btn"]').exists()).toBe(true)
  })

  it('le champ date : le jour en cours par défaut, borné de 14 jours du jeu avant l\'entrée en fonction à aujourd\'hui, saisi en année du jeu', async () => {
    const wrapper = await levelView('province')
    const input = wrapper.find('[data-testid="registry-date"]')
    expect(input.element.value).toBe('1474-05-24')
    expect(input.attributes('min')).toBe('1474-05-10')
    expect(input.attributes('max')).toBe('1474-05-24')
  })

  it('le champ date est à GAUCHE de la première phrase (« Cet inventaire sera inscrit… »), sur la même ligne, au-dessus de la rangée de boutons', async () => {
    const wrapper = await levelView('province')
    const date = wrapper.find('[data-testid="registry-date"]').element
    const target = wrapper.find('[data-testid="registry-target"]').element
    expect(date.parentElement).toBe(target.parentElement)
    const row = [...target.parentElement.children]
    expect(row.indexOf(date)).toBeLessThan(row.indexOf(target))
    // la rangée des boutons ne porte plus la date : elle tient sur une ligne
    expect(wrapper.find('[data-testid="registry-record"]').element.parentElement.contains(date)).toBe(false)
  })

  it('sans choix, aucune date n\'est envoyée (le serveur prend le jour en cours) ; une date choisie part en date RÉELLE et change le lieu dit avant l\'envoi', async () => {
    const wrapper = await levelView('province')
    http.post.mockReturnValue(ok({ snapshot: { id: 5, taken_on: '2026-05-12' }, replaced: null, unchanged: false }))
    await wrapper.find('[data-testid="registry-record"]').trigger('click')
    await flushPromises()
    expect(http.post).toHaveBeenLastCalledWith('characters/7/inventory/province', { raw: PROVINCE_TEXT }, expect.anything())

    await wrapper.find('[data-testid="registry-date"]').setValue('1474-05-12')
    expect(wrapper.find('[data-testid="registry-target"]').text()).toBe('Cet inventaire sera inscrit au registre : Province : Artois, le 12/05/1474.')
    await wrapper.find('[data-testid="registry-record"]').trigger('click')
    await flushPromises()
    expect(http.post).toHaveBeenLastCalledWith('characters/7/inventory/province', { raw: PROVINCE_TEXT, date: '2026-05-12' }, expect.anything())
    expect(wrapper.find('[data-testid="registry-date"]').element.value).toBe('1474-05-24') // la date revient au jour en cours après l'inscription
  })

  it('« Aujourd\'hui » ramène la date au jour en cours, et n\'apparaît que lorsqu\'une autre date est choisie', async () => {
    const wrapper = await levelView('province')
    expect(wrapper.find('[data-testid="registry-date-today"]').exists()).toBe(false)
    await wrapper.find('[data-testid="registry-date"]').setValue('1474-05-12')
    await wrapper.find('[data-testid="registry-date-today"]').trigger('click')
    expect(wrapper.find('[data-testid="registry-date"]').element.value).toBe('1474-05-24')
    expect(wrapper.find('[data-testid="registry-date-today"]').exists()).toBe(false)
  })

  it('la confirmation de remplacement garde la date choisie', async () => {
    const wrapper = await levelView('province')
    await wrapper.find('[data-testid="registry-date"]').setValue('1474-05-15')
    http.post.mockReturnValueOnce(conflict({ id: 2, pseudo: 'Marchand', office_key: 'commissaire_commerce', office_label: { fr: 'Commissaire au commerce', en: 'Trade Minister' } }))
    await wrapper.find('[data-testid="registry-record"]').trigger('click')
    await flushPromises()
    http.post.mockReturnValueOnce(ok({ snapshot: { id: 6, taken_on: '2026-05-15' }, replaced: { pseudo: 'Marchand' }, unchanged: false }))
    await wrapper.find('[data-testid="registry-confirm-yes"]').trigger('click')
    await flushPromises()
    expect(http.post).toHaveBeenLastCalledWith('characters/7/inventory/province', { raw: PROVINCE_TEXT, confirm_replace: true, date: '2026-05-15' }, expect.anything())
  })

  it('inscription AVANT la prise de fonction déjà occupée : le message du serveur seul, « Fermer », jamais « Remplacer » ni le rédacteur', async () => {
    const wrapper = await levelView('province')
    await wrapper.find('[data-testid="registry-date"]').setValue('1474-05-11')
    http.post.mockReturnValueOnce(Promise.reject({ response: { status: 409, data: { success: false, code: 'registry_before_mandate_locked', message: 'Verrouillée.', messages: { fr: 'Une inscription existe déjà à cette date, antérieure à votre prise de fonction. Elle ne peut pas être remplacée.', en: 'An entry already exists on this date, before you took office. It cannot be replaced.' } } } }))
    await wrapper.find('[data-testid="registry-record"]').trigger('click')
    await flushPromises()

    const box = wrapper.find('[data-testid="registry-locked"]')
    expect(box.text()).toContain('antérieure à votre prise de fonction')
    expect(wrapper.find('[data-testid="registry-confirm"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="registry-confirm-yes"]').exists()).toBe(false)
    expect(push.error).not.toHaveBeenCalled()
    await wrapper.find('[data-testid="registry-locked-close"]').trigger('click')
    expect(wrapper.find('[data-testid="registry-locked"]').exists()).toBe(false)
  })

  it('une date hors plage (422) s\'affiche telle quelle', async () => {
    const wrapper = await levelView('province')
    await wrapper.find('[data-testid="registry-date"]').setValue('1474-05-12')
    http.post.mockReturnValueOnce(Promise.reject({ response: { status: 422, data: { success: false, errors: { date: ['Hors plage.'] }, codes: { date: 'registry_date_out_of_range' }, messages: { date: { fr: 'Cette date est hors de la plage permise : du 10/05/2026 au 24/05/2026.', en: 'Out of range.' } } } } }))
    await wrapper.find('[data-testid="registry-record"]').trigger('click')
    await flushPromises()
    expect(push.error).toHaveBeenCalledWith('Cette date est hors de la plage permise : du 10/05/2026 au 24/05/2026.')
  })

  it('le dirigeant (lecture seule) n\'a pas de champ date', async () => {
    const wrapper = await levelView('province', { scopes: SCOPES({ id: 3, name: 'Artois', can_write: false, can_read: true }) })
    expect(wrapper.find('[data-testid="registry-date"]').exists()).toBe(false)
  })

  it('le bouton « Inscrire au registre » porte la plume (le geste d\'écrire au registre)', async () => {
    const wrapper = await levelView('city')
    expect(wrapper.find('[data-testid="registry-record"] v-icon-stub').attributes('name')).toBe('gi-quill')
  })

  it('au niveau personnel : aucun registre (pas d\'inscription, pas d\'historique)', async () => {
    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="registry-block"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="registry-record"]').exists()).toBe(false)
  })

  it('le commissaire au commerce inscrit l\'inventaire du jour à la main (jamais automatiquement) ; l\'écran dit où AVANT l\'envoi', async () => {
    const wrapper = await levelView('province')
    http.post.mockReturnValue(ok({ snapshot: { id: 3, taken_on: '2026-05-24' }, replaced: null, unchanged: false }))
    expect(wrapper.find('[data-testid="registry-target"]').text()).toBe('Cet inventaire sera inscrit au registre : Province : Artois, le 24/05/1474.')

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
    expect(wrapper.find('[data-testid="registry-target"]').text()).toBe('Cet inventaire sera inscrit au registre : Ville : Arras, le 24/05/1474.')
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
    // Rien n'a été écrit : un toast d'information (bleu), ni vert (réussite) ni orange (dégradé)
    expect(push.info).toHaveBeenCalledWith(expect.stringContaining('rien à changer'))
    expect(push.success).not.toHaveBeenCalled()
  })

  it('un autre refus du serveur (403…) s\'affiche tel quel, sans confirmation', async () => {
    const wrapper = await levelView('province')
    http.post.mockReturnValueOnce(Promise.reject({ response: { status: 403, data: { success: false, message: 'Refusé', messages: { fr: 'Refusé par l\'Office.', en: 'Refused.' } } } }))
    await wrapper.find('[data-testid="registry-record"]').trigger('click')
    await flushPromises()
    expect(push.error).toHaveBeenCalledWith('Refusé par l\'Office.')
    expect(wrapper.find('[data-testid="registry-confirm"]').exists()).toBe(false)
  })

  it('le dirigeant (lecture seule) : l\'inventaire se consulte, rien ne s\'inscrit ni ne se corrige', async () => {
    const wrapper = await levelView('province', { scopes: SCOPES({ id: 3, name: 'Artois', can_write: false, can_read: true }) })
    expect(wrapper.find('[data-testid="inventory-readonly"]').text()).toBe(fr.EconomyInventory.ReadOnlyScope)
    expect(wrapper.find('[data-testid="registry-record"]').exists()).toBe(false)
    expect(wrapper.find('select[aria-label*="Miches de pain"]').exists()).toBe(false) // pas de correction de catégorie
    expect(wrapper.find('[data-testid="registry-open"]').exists()).toBe(true) // il peut ouvrir le registre en lecture
  })

  it('le bloc Registre : le lieu et la date, « Inscrire au registre » et « Ouvrir le registre » — plus de « Rouvrir une inscription » (le Registre montre le passé)', async () => {
    const wrapper = await levelView('province', { snapshots: [] })
    expect(textarea(wrapper).element.value).toBe('')
    expect(wrapper.find('[data-testid="registry-open"]').text()).toBe('Ouvrir le registre')
    expect(wrapper.find('[data-testid="registry-history"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="registry-block"]').text()).not.toContain('Rouvrir')
  })
})
