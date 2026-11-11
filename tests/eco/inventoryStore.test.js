import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useInventoryStore, normalizeDoc, SAVE_DELAY } from '../../src/stores/inventoryStore'
import { useAuthStore } from '../../src/stores/authStore'
import { useCookieStore } from '../../src/stores/cookieStore'
import { http } from '../../src/api.js'

/*
  Store des inventaires : le NAVIGATEUR sans compte (comme avant), le SERVEUR avec un compte et un personnage actif — par personnage,
  et par poste pour la ville et la province. Fils inventaire-scopes et inventaire-bilans (Greg et Cowork, 11/11/2026).
*/
vi.mock('notivue', () => ({ push: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../src/api.js', () => ({ http: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }))

import { push } from 'notivue'

const SETTINGS = (data, version = 0, scope = { level: 'personal', id: 7, name: 'Artifice' }) => ({ data, version, updated_at: null, scope })
const ok = data => Promise.resolve({ data })

function setup({ loggedIn = true } = {}) {
  setActivePinia(createPinia())
  const auth = useAuthStore()
  if (loggedIn) auth.$patch({ user: { characters: [{ id: 7, pseudo: 'Artifice' }, { id: 8, pseudo: 'Second' }] }, token: 'jeton' })
  return { auth, cookies: useCookieStore(), store: useInventoryStore() }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
})
afterEach(() => vi.useRealTimers())

describe('normalizeDoc — un document complet, avec ses valeurs par défaut', () => {
  it('remplit les défauts et rend `{}` pour un objet PHP vide revenu en `[]`', () => {
    const doc = normalizeDoc({ itemCategories: [], custom: [{ key: 'a', fr: 'A' }] })
    expect(doc.itemCategories).toEqual({})
    expect(doc.custom).toEqual([{ key: 'a', fr: 'A', en: 'A' }])
    expect(doc).toMatchObject({ exportQtyFormat: 'prefix', exportShowEcus: true, exportWrapper: 'none', hiddenBuiltIn: [], order: [] })
    expect(doc.visibility).toEqual({ hiddenCategories: [], hiddenItems: [] })
    expect(normalizeDoc(null).custom).toEqual([])
  })
})

describe('sans compte : tout reste dans le navigateur, comme avant', () => {
  it('lit et écrit les mêmes clés de confort qu\'avant ce chantier', async () => {
    const { store, cookies } = setup({ loggedIn: false })
    expect(store.serverMode).toBe(false)
    expect(store.availableLevels).toEqual(['personal'])

    await store.update('personal', { itemCategories: { Pain: 'alimentation' }, order: ['divers'], exportWrapper: 'quote', exportColor: 'darkred' })
    expect(cookies.getComfortData('inventory_custom_cats')).toEqual({ Pain: 'alimentation' })
    expect(cookies.getComfortData('inventory_cat_config')).toMatchObject({ order: ['divers'], exportColor: 'darkred' })
    expect(cookies.getComfortData('inventory_export_wrapper')).toBe('quote')
    expect(store.doc('personal')).toMatchObject({ itemCategories: { Pain: 'alimentation' }, exportWrapper: 'quote', exportColor: 'darkred' })
    expect(http.put).not.toHaveBeenCalled()
  })

  it('le collage est gardé dans le navigateur, tout de suite', async () => {
    const { store, cookies } = setup({ loggedIn: false })
    store.savePaste('personal', '596Miches de pain2980')
    expect(cookies.getComfortData('inventory_paste')).toBe('596Miches de pain2980')
    expect(store.localPaste()).toBe('596Miches de pain2980')
    expect(await store.loadPaste('personal')).toBe('596Miches de pain2980')
    expect(http.put).not.toHaveBeenCalled()
  })

  it('ni ville ni province : aucun autre niveau sans compte', async () => {
    const { store } = setup({ loggedIn: false })
    await store.update('city', { order: ['x'] })
    expect(store.doc('city').order).toEqual([])
    expect(store.canWrite('city')).toBe(false)
  })
})

describe('avec un compte : le serveur, par personnage', () => {
  it('charge les niveaux que le personnage peut gérer, tels que le serveur les dit', async () => {
    const { store } = setup()
    http.get.mockReturnValue(ok({ personal: { id: 7, can_write: true }, city: null, province: { id: 3, name: 'Artois', can_write: false } }))
    await store.loadScopes()

    expect(http.get).toHaveBeenCalledWith('characters/7/inventory-scopes', expect.objectContaining({ headers: { Authorization: 'Bearer jeton' } }))
    expect(store.availableLevels).toEqual(['personal', 'province'])
    expect(store.canWrite('personal')).toBe(true)
    expect(store.canWrite('province')).toBe(false) // le dirigeant lit seulement
    expect(store.canWrite('city')).toBe(false)
  })

  it('lit les réglages du serveur, et les écrit groupés avec la version lue', async () => {
    const { store } = setup()
    http.get.mockReturnValue(ok({ settings: SETTINGS({ exportColor: 'darkcyan' }, 3) }))
    http.put.mockImplementation((url, body) => ok({ settings: SETTINGS(body.data, body.version + 1) }))

    await store.load('personal')
    expect(store.doc('personal').exportColor).toBe('darkcyan')

    await store.update('personal', { order: ['divers'] })
    await store.update('personal', { itemCategories: { Pain: 'alimentation' } })
    expect(http.put).not.toHaveBeenCalled() // groupées : une seule écriture après le délai

    await vi.advanceTimersByTimeAsync(SAVE_DELAY + 10)
    expect(http.put).toHaveBeenCalledTimes(1)
    const [url, body] = http.put.mock.calls[0]
    expect(url).toBe('characters/7/inventory-settings/personal')
    expect(body.version).toBe(3)
    expect(body.data).toMatchObject({ exportColor: 'darkcyan', order: ['divers'], itemCategories: { Pain: 'alimentation' } })
    // la version avance : l'écriture suivante porte 4
    await store.update('personal', { order: [] })
    await vi.advanceTimersByTimeAsync(SAVE_DELAY + 10)
    expect(http.put.mock.calls[1][1].version).toBe(4)
  })

  it('n\'envoie au serveur que les clés de son niveau : les options d\'export restent personnelles', async () => {
    const { store } = setup()
    http.get.mockImplementation(url => ok(url.endsWith('inventory-scopes')
      ? { personal: { id: 7, can_write: true }, city: { id: 1, name: 'Arras', can_write: true }, province: null }
      : { settings: SETTINGS({}, 0, { level: 'city', id: 1, name: 'Arras' }) }))
    http.put.mockImplementation((url, body) => ok({ settings: SETTINGS(body.data, 1) }))
    await store.loadScopes()

    await store.update('city', { order: ['divers'], exportWrapper: 'quote', visibility: { hiddenCategories: ['x'], hiddenItems: [] } })
    await vi.advanceTimersByTimeAsync(SAVE_DELAY + 10)

    expect(http.put.mock.calls[0][0]).toBe('characters/7/inventory-settings/city')
    expect(Object.keys(http.put.mock.calls[0][1].data)).not.toContain('exportWrapper')
    expect(Object.keys(http.put.mock.calls[0][1].data)).not.toContain('visibility')
    expect(http.put.mock.calls[0][1].data.order).toEqual(['divers'])
  })

  it('un niveau en lecture seule n\'écrit jamais', async () => {
    const { store } = setup()
    http.get.mockImplementation(url => ok(url.endsWith('inventory-scopes')
      ? { personal: { id: 7, can_write: true }, city: null, province: { id: 3, name: 'Artois', can_write: false } }
      : { settings: SETTINGS({ order: ['a'] }, 2, { level: 'province', id: 3, name: 'Artois' }) }))
    await store.loadScopes()
    await store.load('province')

    await store.update('province', { order: ['b'] })
    await vi.advanceTimersByTimeAsync(SAVE_DELAY + 10)
    expect(http.put).not.toHaveBeenCalled()
    expect(store.doc('province').order).toEqual(['a'])
  })

  it('un conflit (409) remplace notre état par celui du serveur et le dit', async () => {
    const { store } = setup()
    http.get.mockReturnValue(ok({ settings: SETTINGS({ exportColor: 'darkcyan' }, 1) }))
    await store.load('personal')
    http.put.mockRejectedValue({
      response: { status: 409, data: { code: 'version_conflict', messages: { fr: 'Modifié ailleurs.', en: 'Changed elsewhere.' }, current: SETTINGS({ exportColor: 'darkred' }, 5) } },
    })

    await store.update('personal', { exportColor: 'darkgreen' })
    await vi.advanceTimersByTimeAsync(SAVE_DELAY + 10)

    expect(store.doc('personal').exportColor).toBe('darkred')
    expect(push.error).toHaveBeenCalledWith('Modifié ailleurs.')
    // la version courante est reprise : l'écriture suivante repart de 5
    http.put.mockImplementation((url, body) => ok({ settings: SETTINGS(body.data, body.version + 1) }))
    await store.update('personal', { order: ['x'] })
    await vi.advanceTimersByTimeAsync(SAVE_DELAY + 10)
    expect(http.put.mock.calls.at(-1)[1].version).toBe(5)
  })

  it('changer de personnage repart de zéro : plus rien du précédent', async () => {
    const { store, auth } = setup()
    http.get.mockReturnValue(ok({ settings: SETTINGS({ exportColor: 'darkcyan' }, 1) }))
    await store.load('personal')
    expect(store.doc('personal').exportColor).toBe('darkcyan')

    auth.setActiveCharacter(8)
    await nextTick() // le store se remet à zéro par un `watch`, au tick suivant
    expect(store.characterId).toBe(8)
    expect(store.status('personal')).toBe('idle')
    expect(store.doc('personal').exportColor).toBeUndefined()
  })
})

describe('première connexion : les réglages du navigateur passent en base, puis s\'effacent', () => {
  it('reprend les réglages locaux si le personnage n\'a encore rien, et ne les efface qu\'APRÈS la sauvegarde', async () => {
    const { store, cookies } = setup()
    cookies.setComfortData('inventory_cat_config', { custom: [{ key: 'a', fr: 'A', en: 'A' }], hiddenBuiltIn: ['animaux'] })
    cookies.setComfortData('inventory_custom_cats', { Pain: 'alimentation' })
    http.get.mockReturnValue(ok({ settings: SETTINGS(null, 0) }))
    http.put.mockImplementation((url, body) => ok({ settings: SETTINGS(body.data, 1) }))

    await store.load('personal')

    expect(http.put).toHaveBeenCalledTimes(1)
    expect(http.put.mock.calls[0][1]).toMatchObject({ version: 0, data: { itemCategories: { Pain: 'alimentation' }, hiddenBuiltIn: ['animaux'] } })
    expect(cookies.getComfortData('inventory_custom_cats')).toBeNull()
    expect(cookies.getComfortData('inventory_cat_config')).toBeNull()
    expect(store.imported).toBe(true)
    expect(store.doc('personal').itemCategories).toEqual({ Pain: 'alimentation' })
    expect(push.success).toHaveBeenCalled()
  })

  it('si la sauvegarde échoue, le navigateur garde tout intact', async () => {
    const { store, cookies } = setup()
    cookies.setComfortData('inventory_custom_cats', { Pain: 'alimentation' })
    http.get.mockReturnValue(ok({ settings: SETTINGS(null, 0) }))
    http.put.mockRejectedValue({ response: { status: 500, data: {} } })

    await store.load('personal')

    expect(cookies.getComfortData('inventory_custom_cats')).toEqual({ Pain: 'alimentation' })
    expect(store.imported).toBe(false)
  })

  it('ne reprend rien si le personnage a déjà des réglages en base : la base fait foi', async () => {
    const { store, cookies } = setup()
    cookies.setComfortData('inventory_custom_cats', { Pain: 'alimentation' })
    http.get.mockReturnValue(ok({ settings: SETTINGS({ exportColor: 'darkcyan' }, 2) }))

    await store.load('personal')

    expect(http.put).not.toHaveBeenCalled()
    expect(store.doc('personal').itemCategories).toEqual({})
    expect(cookies.getComfortData('inventory_custom_cats')).toEqual({ Pain: 'alimentation' })
  })

  it('un document vide revenu du serveur en `[]` compte pour vide', async () => {
    const { store, cookies } = setup()
    cookies.setComfortData('inventory_custom_cats', { Pain: 'alimentation' })
    http.get.mockReturnValue(ok({ settings: SETTINGS([], 1) }))
    http.put.mockImplementation((url, body) => ok({ settings: SETTINGS(body.data, 2) }))

    await store.load('personal')
    expect(http.put).toHaveBeenCalledTimes(1)
    expect(http.put.mock.calls[0][1].version).toBe(1)
  })

  it('reprend aussi le collage du navigateur, sur le personnel seulement, quand rien n\'est enregistré', async () => {
    const { store, cookies } = setup()
    cookies.setComfortData('inventory_paste', '596Miches de pain2980')
    http.get.mockReturnValue(ok({ inventory: { raw: null, saved_at: null } }))
    http.put.mockReturnValue(ok({ inventory: {} }))

    const text = await store.loadPaste('personal')

    expect(text).toBe('596Miches de pain2980')
    expect(http.put).toHaveBeenCalledWith('characters/7/inventory/personal', { raw: '596Miches de pain2980' }, expect.anything())
    expect(cookies.getComfortData('inventory_paste')).toBeNull()
  })
})

describe('le texte collé, avec un compte', () => {
  it('relit le dernier inventaire enregistré, et l\'enregistre avec un délai (jamais vide)', async () => {
    const { store } = setup()
    http.get.mockReturnValue(ok({ inventory: { raw: '121Morceaux de viande605' } }))
    http.put.mockReturnValue(ok({ inventory: {} }))
    expect(await store.loadPaste('personal')).toBe('121Morceaux de viande605')

    store.savePaste('personal', '700Miches de pain3500')
    store.savePaste('personal', '800Miches de pain4000')
    expect(http.put).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(SAVE_DELAY + 10)
    expect(http.put).toHaveBeenCalledTimes(1)
    expect(http.put).toHaveBeenCalledWith('characters/7/inventory/personal', { raw: '800Miches de pain4000' }, expect.anything())

    store.savePaste('personal', '   ')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY + 10)
    expect(http.put).toHaveBeenCalledTimes(1) // vider le champ n'efface pas ce qui est enregistré
  })

  it('la province n\'enregistre jamais toute seule : son historique s\'inscrit à la main', async () => {
    const { store } = setup()
    http.get.mockImplementation(url => ok(url.endsWith('inventory-scopes')
      ? { personal: { id: 7, can_write: true }, city: null, province: { id: 3, name: 'Artois', can_write: true } } : {}))
    await store.loadScopes()

    store.savePaste('province', '700Miches de pain3500')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY + 10)
    expect(http.put).not.toHaveBeenCalled()
  })
})

describe('province : l\'historique', () => {
  it('relit le plus récent exemplaire, et inscrit l\'inventaire du jour puis recharge l\'historique', async () => {
    const { store } = setup()
    http.get.mockReturnValue(ok({ province: { id: 3, name: 'Artois' }, can_write: true, snapshots: [{ id: 2, taken_on: '2026-05-17', raw: 'récent' }, { id: 1, taken_on: '2026-05-10', raw: 'ancien' }] }))
    expect(await store.loadPaste('province')).toBe('récent')

    http.post.mockReturnValue(ok({ snapshot: { id: 3, taken_on: '2026-05-24' }, replaced: false, unchanged: false }))
    const result = await store.recordProvince('nouveau')

    expect(http.post).toHaveBeenCalledWith('characters/7/inventory/province', { raw: 'nouveau' }, expect.anything())
    expect(result.snapshot.taken_on).toBe('2026-05-24')
    expect(http.get).toHaveBeenCalledTimes(2) // l'historique est relu après l'inscription
  })
})

describe('copie vers un autre personnage', () => {
  it('copie les réglages du personnage actif vers la cible, sans confirmation par défaut', async () => {
    const { store } = setup()
    http.post.mockReturnValue(ok({ settings: SETTINGS({}, 1) }))
    await store.copyPersonalTo(8)
    expect(http.post).toHaveBeenCalledWith('characters/8/inventory-settings/personal/copy', { from_character_id: 7, confirm_replace: false }, expect.anything())
    await store.copyPersonalTo(8, true)
    expect(http.post.mock.calls[1][1]).toEqual({ from_character_id: 7, confirm_replace: true })
  })
})
