import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import EconomyInventoryBalance from '../../src/views/modules/economy/EconomyInventoryBalance.vue'
import { useAuthStore } from '../../src/stores/authStore'
import { useCookieStore } from '../../src/stores/cookieStore'
import { http } from '../../src/api.js'

/*
  La Balance des stocks (4ᵉ module de la Salle des comptes, 19/11/2026) : deux champs de
  collage (ancien, actuel), une comparaison automatique, « Récupérer » qui relit le dernier inventaire retenu par la Gestion des stocks
  (lecture pure), « Confier au scribe » qui exporte sans rien enregistrer. 🔴 Elle ne stocke RIEN : ni cookie, ni stockage local, ni serveur.
*/
vi.mock('notivue', () => ({ push: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock('../../src/api.js', () => ({ http: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }))

const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const fr = JSON.parse(readFileSync(resolve(localesDir, 'fr.json'), 'utf-8'))
const en = JSON.parse(readFileSync(resolve(localesDir, 'en.json'), 'utf-8'))

const PREVIOUS = `Encombrement : 100

 #NomEnc.Actions possibles1000,00 écus
10Miches de pain100
5Morceaux de viande50
3Cailloux9
2Épées20`

const CURRENT = `Encombrement : 120

 #NomEnc.Actions possibles1120,50 écus
13Miches de pain130
5Morceaux de viande50
1Cailloux3
4Planches40`

const ok = data => Promise.resolve({ data })
const SCOPES = (extra = {}) => ({
  success: true,
  personal: { id: 7, name: 'Artifice', can_write: true, can_read: true },
  city: null,
  province: null,
  ...extra,
})

/** Le serveur factice : niveaux, réglages (vides), dernier collage personnel / de ville, historique de la province. */
function serve({ scopes = SCOPES(), personal = { raw: PREVIOUS, saved_at: '2026-11-18T09:30:00Z' }, city = { raw: '3Cailloux0', saved_at: null }, snapshots = [], settings = {} } = {}) {
  http.get.mockImplementation(url => {
    if (url.endsWith('inventory-scopes')) return ok(scopes)
    if (url.includes('inventory-settings/')) return ok({ settings: { data: settings, version: 1, scope: {} } })
    if (url.endsWith('inventory/personal')) return ok({ inventory: personal })
    if (url.endsWith('inventory/city')) return ok({ inventory: city })
    if (url.endsWith('inventory/province')) return ok({ province: { id: 3, name: 'Artois' }, can_write: true, snapshots })
    return ok({})
  })
}

async function mountPage({ loggedIn = true, consent = false, browserPaste = null, locale = 'fr', ...serverOptions } = {}) {
  setActivePinia(createPinia())
  if (loggedIn) useAuthStore().$patch({ user: { characters: [{ id: 7, pseudo: 'Artifice' }] }, token: 'jeton' })
  const cookies = useCookieStore()
  if (consent) cookies.$patch({ consent: { preferences: true, choiceMadeAt: Date.now() } })
  if (browserPaste !== null) cookies.setComfortData('inventory_paste', browserPaste)
  serve(serverOptions)
  const i18n = createI18n({ legacy: false, locale, messages: { fr, en } })
  const w = mount(EconomyInventoryBalance, { global: { plugins: [i18n], stubs: { 'v-icon': true } } })
  await flushPromises()
  return w
}

const field = (w, name) => w.find(`[data-testid="balance-${name}"]`)
const fill = async (w, previous, current) => {
  if (previous !== null) await field(w, 'previous').setValue(previous)
  if (current !== null) await field(w, 'current').setValue(current)
  await flushPromises()
}
const exportBBCode = async w => {
  const written = []
  Object.assign(navigator, { clipboard: { writeText: t => { written.push(t); return Promise.resolve() } } })
  await field(w, 'export').trigger('click')
  await flushPromises()
  return written[0]
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})
afterEach(() => vi.restoreAllMocks())

describe('La Balance des stocks — comparaison', () => {
  it('sans ancien inventaire : « Aucun inventaire précédent à comparer », ni tableau ni export', async () => {
    const w = await mountPage({ loggedIn: false })
    expect(field(w, 'no-previous').text()).toBe('Aucun inventaire précédent à comparer')
    await fill(w, null, CURRENT)
    expect(field(w, 'no-previous').exists()).toBe(true)
    expect(w.findAll('[data-testid="balance-row"]')).toHaveLength(0)
    expect(field(w, 'export').exists()).toBe(false)
  })

  it('avec les deux inventaires : tout l\'actuel est listé, chaque ligne avec flèche ET signe', async () => {
    const w = await mountPage({ loggedIn: false })
    await fill(w, PREVIOUS, CURRENT)
    const rows = w.findAll('[data-testid="balance-row"]')
    expect(rows).toHaveLength(4)
    const diffOf = name => rows.find(r => r.text().includes(name)).find('[data-testid="balance-diff"]').text()
    expect(diffOf('Miches de pain')).toContain('▲')
    expect(diffOf('Miches de pain')).toContain('+3')
    expect(diffOf('Cailloux')).toContain('▼')
    expect(diffOf('Cailloux')).toContain('-2')
    // Quantité identique : aucune annotation, pas même un tiret.
    const same = rows.find(r => r.text().includes('Morceaux de viande'))
    expect(same.find('[data-testid="balance-diff"]').exists()).toBe(false)
    expect(same.text()).not.toContain('—')
    expect(field(w, 'summary').text()).toBe('En hausse : 1 · En baisse : 1 · Nouveaux : 1 · Disparus : 1')
  })

  it('un item nouveau porte le badge « Nouveau » à l\'écran', async () => {
    const w = await mountPage({ loggedIn: false })
    await fill(w, PREVIOUS, CURRENT)
    const badges = w.findAll('[data-testid="balance-new"]')
    expect(badges).toHaveLength(1)
    expect(badges[0].text()).toBe('Nouveau')
    expect(w.findAll('[data-testid="balance-row"]').find(r => r.text().includes('Planches')).find('[data-testid="balance-new"]').exists()).toBe(true)
  })

  it('un item disparu va dans une section séparée, ligne barrée', async () => {
    const w = await mountPage({ loggedIn: false })
    await fill(w, PREVIOUS, CURRENT)
    const section = field(w, 'disappeared')
    expect(section.text()).toContain('Disparus')
    const gone = section.findAll('[data-testid="balance-gone"]')
    expect(gone).toHaveLength(1)
    expect(gone[0].text()).toContain('Épées')
    expect(gone[0].html()).toContain('line-through')
    // Il ne pollue pas la liste principale.
    expect(w.findAll('[data-testid="balance-row"]').some(r => r.text().includes('Épées'))).toBe(false)
  })

  it('deux inventaires identiques : « Aucun changement entre les deux inventaires. »', async () => {
    const w = await mountPage({ loggedIn: false })
    await fill(w, CURRENT, CURRENT)
    expect(field(w, 'no-change').text()).toBe('Aucun changement entre les deux inventaires.')
    expect(w.findAll('[data-testid="balance-diff"]')).toHaveLength(0)
    expect(field(w, 'result').text()).not.toContain('—')
    expect(field(w, 'disappeared').exists()).toBe(false)
  })

  it('affiche l\'écart du trésor quand les deux inventaires en portent un', async () => {
    const w = await mountPage({ loggedIn: false })
    await fill(w, PREVIOUS, CURRENT)
    expect(field(w, 'ecus').text()).toContain('+120,50')
  })

  it('en anglais, les libellés suivent la langue de l\'interface', async () => {
    const w = await mountPage({ loggedIn: false, locale: 'en' })
    await fill(w, PREVIOUS, CURRENT)
    expect(field(w, 'summary').text()).toBe('Increased: 1 · Decreased: 1 · New: 1 · Disappeared: 1')
    expect(field(w, 'new').text()).toBe('New')
  })
})

describe('La Balance des stocks — « Récupérer »', () => {
  it('avec un compte : charge le dernier collage du niveau personnel, sur action volontaire seulement', async () => {
    const w = await mountPage()
    expect(field(w, 'previous').element.value).toBe('') // jamais de remplissage automatique
    await field(w, 'fetch').trigger('click')
    await flushPromises()
    expect(field(w, 'previous').element.value).toBe(PREVIOUS)
    expect(field(w, 'source').text()).toContain('18/11')
  })

  it('le niveau choisi décide de ce qui est repris : la ville, puis le dernier exemplaire inscrit de la province', async () => {
    const snapshots = [{ id: 2, taken_on: '2026-05-17', raw: '700Miches de pain3500', by_me: true }, { id: 1, taken_on: '2026-05-10', raw: 'ancien', by_me: false }]
    const w = await mountPage({
      scopes: SCOPES({ city: { id: 1, name: 'Arras', can_write: true, can_read: true }, province: { id: 3, name: 'Artois', can_write: true, can_read: true } }),
      snapshots,
    })
    expect(field(w, 'levels').exists()).toBe(true)

    await w.find('[data-testid="balance-level-city"]').trigger('click')
    await flushPromises()
    await field(w, 'fetch').trigger('click')
    await flushPromises()
    expect(field(w, 'previous').element.value).toBe('3Cailloux0')

    await w.find('[data-testid="balance-level-province"]').trigger('click')
    await flushPromises()
    await field(w, 'fetch').trigger('click')
    await flushPromises()
    expect(field(w, 'previous').element.value).toBe('700Miches de pain3500')
    expect(field(w, 'source').text()).toContain('historique de la province')
  })

  it('un seul niveau (le personnel) : aucun groupe de niveaux, la phrase est fixe', async () => {
    const w = await mountPage()
    expect(field(w, 'levels').exists()).toBe(false)
    expect(field(w, 'fetch-hint').text()).toBe('Reprenez votre dernier inventaire du Bilan des stocks.')
    expect(field(w, 'province-hint').exists()).toBe(false)
  })

  it('au moins deux niveaux : le choix est AU-DESSUS, avant les deux champs, comme dans le Bilan des stocks', async () => {
    const w = await mountPage({
      scopes: SCOPES({ city: { id: 1, name: 'Arras', can_write: true, can_read: true }, province: { id: 3, name: 'Artois', can_write: true, can_read: true } }),
    })
    const group = field(w, 'levels')
    expect(group.findAll('button').map(b => b.text())).toEqual(['Personnel', 'Ville : Arras', 'Province : Artois'])
    expect(group.find('[data-testid="balance-level-personal"]').attributes('aria-pressed')).toBe('true')
    // Le groupe précède les champs de collage dans la page.
    const html = w.html()
    expect(html.indexOf('data-testid="balance-levels"')).toBeLessThan(html.indexOf('data-testid="balance-previous"'))
    // La phrase de la plaque ne change pas avec le niveau ; la précision provinciale n'apparaît qu'au niveau province.
    expect(field(w, 'fetch-hint').text()).toBe('Reprenez votre dernier inventaire du Bilan des stocks.')
    expect(field(w, 'province-hint').exists()).toBe(false)
    await w.find('[data-testid="balance-level-province"]').trigger('click')
    await flushPromises()
    expect(field(w, 'province-hint').text()).toContain('dernier inventaire inscrit à l\'historique')
    expect(group.find('[data-testid="balance-level-province"]').attributes('aria-pressed')).toBe('true')
  })

  it('deux niveaux seulement (personnel et ville) : le groupe n\'en propose que deux', async () => {
    const w = await mountPage({ scopes: SCOPES({ city: { id: 1, name: 'Arras', can_write: true, can_read: true } }) })
    expect(field(w, 'levels').findAll('button').map(b => b.text())).toEqual(['Personnel', 'Ville : Arras'])
  })

  it('boutons de niveau : l\'actif est en or, les autres en violet (plus voyant que l\'ardoise)', async () => {
    const w = await mountPage({
      scopes: SCOPES({ city: { id: 1, name: 'Arras', can_write: true, can_read: true }, province: { id: 3, name: 'Artois', can_write: true, can_read: true } }),
    })
    const btn = lv => w.find(`[data-testid="balance-level-${lv}"]`)
    expect(btn('personal').classes()).toContain('odc--gold')
    expect(btn('city').classes()).toContain('odc--violet')
    expect(btn('province').classes()).toContain('odc--violet')
    await btn('city').trigger('click')
    await flushPromises()
    expect(btn('city').classes()).toContain('odc--gold')
    expect(btn('personal').classes()).toContain('odc--violet')
    expect(btn('personal').classes()).not.toContain('odc--slate')
  })

  it('le bouton de niveau actif porte une coche, les autres non', async () => {
    const w = await mountPage({
      scopes: SCOPES({ city: { id: 1, name: 'Arras', can_write: true, can_read: true }, province: { id: 3, name: 'Artois', can_write: true, can_read: true } }),
    })
    const btn = lv => w.find(`[data-testid="balance-level-${lv}"]`)
    expect(btn('personal').find('v-icon-stub[name="fa-check"]').exists()).toBe(true)
    expect(btn('city').find('v-icon-stub[name="fa-check"]').exists()).toBe(false)
    await btn('province').trigger('click')
    await flushPromises()
    expect(btn('province').find('v-icon-stub[name="fa-check"]').exists()).toBe(true)
    expect(btn('personal').find('v-icon-stub[name="fa-check"]').exists()).toBe(false)
  })

  it('rien de retenu pour le niveau : message, champ intact', async () => {
    const w = await mountPage({ personal: { raw: '', saved_at: null } })
    await field(w, 'fetch').trigger('click')
    await flushPromises()
    expect(field(w, 'fetch-none').text()).toBe('Aucun inventaire retenu pour ce niveau.')
    expect(field(w, 'previous').element.value).toBe('')
  })

  it('sans compte et sans consentement : bouton désactivé, sans ouvrir la bannière', async () => {
    const w = await mountPage({ loggedIn: false, browserPaste: PREVIOUS })
    expect(field(w, 'fetch').attributes('disabled')).toBeDefined()
    expect(field(w, 'no-consent').exists()).toBe(true)
    expect(useCookieStore().isPreferencesModalOpen).toBe(false)
  })

  it('sans compte, avec le consentement : reprend le cache de la Gestion des stocks, sans niveau', async () => {
    const w = await mountPage({ loggedIn: false, consent: true, browserPaste: PREVIOUS })
    expect(field(w, 'fetch').attributes('disabled')).toBeUndefined()
    expect(field(w, 'levels').exists()).toBe(false)
    await field(w, 'fetch').trigger('click')
    await flushPromises()
    expect(field(w, 'previous').element.value).toBe(PREVIOUS)
    expect(http.get).not.toHaveBeenCalled() // aucune requête sans compte
  })

  it('retoucher le champ efface l\'origine affichée de l\'ancien inventaire', async () => {
    const w = await mountPage()
    await field(w, 'fetch').trigger('click')
    await flushPromises()
    expect(field(w, 'source').exists()).toBe(true)
    await field(w, 'previous').setValue(PREVIOUS + '\n1Pomme10')
    expect(field(w, 'source').exists()).toBe(false)
  })

  it('« Récupérer » ne fait que LIRE : aucune écriture sur le serveur, aucune reprise du navigateur en base', async () => {
    // Un collage resté dans le navigateur et un serveur vide : `loadPaste` de la Gestion des stocks l'importerait en base ; ici, jamais.
    const w = await mountPage({ consent: true, browserPaste: PREVIOUS, personal: { raw: '', saved_at: null } })
    await field(w, 'fetch').trigger('click')
    await flushPromises()
    expect(http.put).not.toHaveBeenCalled()
    expect(http.post).not.toHaveBeenCalled()
    expect(useCookieStore().getComfortData('inventory_paste', '')).toBe(PREVIOUS)
  })
})

describe('La Balance des stocks — export', () => {
  it('« Confier au scribe » copie le BBCode annoté : flèches, section Disparus, sans badge « Nouveau »', async () => {
    const w = await mountPage({ loggedIn: false })
    await fill(w, PREVIOUS, CURRENT)
    const bbcode = await exportBBCode(w)
    expect(bbcode).toContain('▲ +3')
    expect(bbcode).toContain('▼ -2')
    expect(bbcode).toContain('[b]Disparus[/b]')
    expect(bbcode).toContain('Épées')
    expect(bbcode).not.toMatch(/nouveau/i)
  })

  it('suit les consignes au scribe de la Gestion des stocks (format de quantité)', async () => {
    const w = await mountPage({ settings: { exportQtyFormat: 'suffix' } })
    await fill(w, PREVIOUS, CURRENT)
    expect(await exportBBCode(w)).toContain('Miches de pain (x13)')
  })
})

describe('La Balance des stocks — ne stocke RIEN', () => {
  it('sans compte, avec le consentement : coller, comparer et exporter n\'écrit ni stockage local ni cookie', async () => {
    const w = await mountPage({ loggedIn: false, consent: true })
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem')
    const cookieWrites = []
    const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')
    Object.defineProperty(document, 'cookie', { configurable: true, get: () => descriptor.get.call(document), set: v => { cookieWrites.push(v) } })

    await fill(w, PREVIOUS, CURRENT)
    await exportBBCode(w)
    await field(w, 'clear').trigger('click')
    await flushPromises()

    expect(setItem).not.toHaveBeenCalled()
    expect(removeItem).not.toHaveBeenCalled()
    expect(cookieWrites).toEqual([])
    delete document.cookie
  })

  it('contrôle positif : le même détecteur voit une écriture quand un autre outil en fait une (la Gestion des stocks garde son collage)', async () => {
    await mountPage({ loggedIn: false, consent: true })
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    useCookieStore().setComfortData('inventory_paste', PREVIOUS)
    expect(setItem).toHaveBeenCalled()
  })

  it('avec un compte : coller, comparer et exporter n\'envoie rien au serveur (aucun PUT, aucun POST)', async () => {
    const w = await mountPage()
    await fill(w, PREVIOUS, CURRENT)
    await exportBBCode(w)
    await new Promise(r => setTimeout(r, 900)) // au-delà du délai d'écriture groupée de la Gestion des stocks (800 ms)
    expect(http.put).not.toHaveBeenCalled()
    expect(http.post).not.toHaveBeenCalled()
  })

  it('les champs ne sont pas mémorisés : un nouveau montage les retrouve vides', async () => {
    const w = await mountPage({ loggedIn: false, consent: true })
    await fill(w, PREVIOUS, CURRENT)
    w.unmount()
    const again = await mountPage({ loggedIn: false, consent: true })
    expect(field(again, 'previous').element.value).toBe('')
    expect(field(again, 'current').element.value).toBe('')
  })
})
