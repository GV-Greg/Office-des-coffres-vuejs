import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import EconomyInventoryRegistry from '../../src/views/modules/economy/EconomyInventoryRegistry.vue'
import { useAuthStore } from '../../src/stores/authStore'
import { http } from '../../src/api.js'

/*
  Le Registre des stocks (PR 3a, fil admin/echanges/registre-stocks) : lecture de l'historique d'une ville ou d'une province, navigation
  dans le temps, comparaison de deux inscriptions. Aucune règle côté site : le serveur dit les niveaux ouverts. L'auteur d'une inscription
  en vigueur n'est jamais nommé ; seul le rédacteur d'une inscription REMPLACÉE l'est.
*/
vi.mock('notivue', () => ({ push: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../src/api.js', () => ({ http: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }))

const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const fr = JSON.parse(readFileSync(resolve(localesDir, 'fr.json'), 'utf-8'))
const en = JSON.parse(readFileSync(resolve(localesDir, 'en.json'), 'utf-8'))

const ok = data => Promise.resolve({ data })
const SCOPES = (over = {}) => ({
  success: true,
  personal: { id: 7, name: 'Artifice', can_write: true, can_read: true },
  city: { id: 1, name: 'Arras', can_write: true, can_read: true },
  province: { id: 3, name: 'Artois', can_write: true, can_read: true },
  ...over,
})
// Du plus récent au plus ancien, comme le serveur.
const PROVINCE_SNAPSHOTS = [
  { id: 3, taken_on: '2026-05-24', by_me: true, office_key: 'commissaire_commerce', replaced: { id: 9, pseudo: 'Marchand', office_key: 'commissaire_commerce', office_label: { fr: 'Commissaire au commerce', en: 'Trade Minister' }, replaced_at: '2026-05-24T10:00:00+02:00' }, raw: '#NomEnc.Actions possibles3500,00 écus\n700Miches de pain3500\n2Cailloux0' },
  { id: 2, taken_on: '2026-05-17', by_me: false, office_key: 'commissaire_commerce', replaced: null, raw: '#NomEnc.Actions possibles3000,00 écus\n500Miches de pain2500\n8Pommes0' },
  { id: 1, taken_on: '2026-05-10', by_me: false, office_key: 'commissaire_commerce', replaced: null, raw: '#NomEnc.Actions possibles3000,00 écus\n500Miches de pain2500' },
]
const CITY_SNAPSHOTS = [{ id: 20, taken_on: '2026-05-20', by_me: true, office_key: 'mayor', replaced: null, raw: '30Poissons900' }]

// `today` : le jour du jeu en cours, dit par le serveur (bascule à 04:00).
function serve({ scopes = SCOPES(), province = PROVINCE_SNAPSHOTS, city = CITY_SNAPSHOTS, canWrite = true, today = '2026-05-26' } = {}) {
  http.get.mockImplementation(url => {
    if (url.endsWith('inventory-scopes')) return ok(scopes)
    if (url.endsWith('inventory/province')) return ok({ province: { id: 3, name: 'Artois' }, can_write: canWrite, snapshots: province, today })
    if (url.endsWith('inventory/city/registry')) return ok({ city: { id: 1, name: 'Arras' }, can_write: true, snapshots: city, today })
    return ok({})
  })
}

async function mountPage({ locale = 'fr', ...options } = {}) {
  setActivePinia(createPinia())
  useAuthStore().$patch({ user: { characters: [{ id: 7, pseudo: 'Artifice' }] }, token: 'jeton' })
  serve(options)
  const i18n = createI18n({ legacy: false, locale, messages: { fr, en } })
  const wrapper = mount(EconomyInventoryRegistry, {
    global: { plugins: [i18n], stubs: { RouterLink: { template: '<a><slot /></a>' }, 'v-icon': true } },
  })
  await flushPromises()
  return wrapper
}

const find = (w, id) => w.find(`[data-testid="${id}"]`)
const plain = text => text.replace(/\s+/g, ' ').trim() // espaces insécables des milliers compris

beforeEach(() => vi.clearAllMocks())

describe('Registre des stocks — accès', () => {
  it('sans ville ni province : le registre le dit, aucun appel au registre', async () => {
    const w = await mountPage({ scopes: SCOPES({ city: null, province: null }) })
    expect(find(w, 'registry-no-access').text()).toBe(fr.EconomyInventoryRegistry.NoAccess)
    expect(find(w, 'registry-no-access').attributes('role')).toBe('alert') // le cadenas fermé et le message (AccessDenied), pas un simple texte
    expect(find(w, 'registry-no-access').find('v-icon-stub').attributes('name')).toBe('gi-padlock')
    expect(http.get.mock.calls.some(c => c[0].includes('registry') || c[0].endsWith('inventory/province'))).toBe(false)
  })

  it('un seul niveau : pas de sélecteur, le lieu est nommé ; deux niveaux : un bouton chacun, la ville d\'abord', async () => {
    const solo = await mountPage({ scopes: SCOPES({ city: null }) })
    expect(find(solo, 'registry-levels').exists()).toBe(false)
    expect(solo.find('h2').text()).toBe('Registre des stocks : Artois') // le lieu est dans le titre, comme « Registre de Franche-Comté »

    const both = await mountPage()
    expect(['city', 'province'].map(l => find(both, `registry-level-${l}`).text())).toEqual(['Ville : Arras', 'Province : Artois'])
    expect(find(both, 'registry-level-city').attributes('aria-pressed')).toBe('true')
  })

  it('changer de niveau ouvre le registre de ce niveau', async () => {
    const w = await mountPage()
    expect(http.get).toHaveBeenCalledWith('characters/7/inventory/city/registry', expect.anything())
    await find(w, 'registry-level-province').trigger('click')
    await flushPromises()
    expect(http.get).toHaveBeenCalledWith('characters/7/inventory/province', expect.anything())
    expect(find(w, 'registry-detail-title').text()).toContain('1474') // 24/05/2026 → année du jeu
  })

  it('le dirigeant (lecture seule) le sait', async () => {
    const w = await mountPage({ scopes: SCOPES({ city: null, province: { id: 3, name: 'Artois', can_write: false, can_read: true } }), canWrite: false })
    expect(find(w, 'registry-readonly').text()).toBe(fr.EconomyInventory.ReadOnlyScope)
  })

  it('une seule inscription : les chevrons restent avant et après le titre (comme les semaines du Registre des mines), grisés ; le chiffre n\'est dit qu\'une fois (« 1 article »)', async () => {
    const w = await mountPage({ scopes: SCOPES({ city: null }), province: [PROVINCE_SNAPSHOTS[2]] })
    expect(find(w, 'registry-older').attributes('disabled')).toBeDefined()
    expect(find(w, 'registry-newer').attributes('disabled')).toBeDefined()
    // « Comparer avec » reste là, grisée, et dit pourquoi (une seule inscription : rien à comparer)
    expect(find(w, 'registry-compare').attributes('disabled')).toBeDefined()
    expect(find(w, 'registry-compare-unavailable').text()).toBe('Il faut au moins deux inscriptions pour comparer.')
    const order = w.findAll('[data-testid="registry-older"], [data-testid="registry-detail-title"], [data-testid="registry-newer"]').map(n => n.attributes('data-testid'))
    expect(order).toEqual(['registry-older', 'registry-detail-title', 'registry-newer'])
    expect(plain(find(w, 'registry-summary').text())).toContain('1 article')
    expect(plain(find(w, 'registry-summary').text())).not.toContain('1 articles')
  })

  it('« Dernière inscription » au format du Registre des mines : « il y a 2 jours, le 24/05. », « hier », « aujourd\'hui » ; orange gras dès deux jours', async () => {
    const w = await mountPage({ scopes: SCOPES({ city: null }) }) // dernière inscription le 24/05, le serveur dit le 26/05
    expect(find(w, 'registry-last').text()).toBe('Dernière inscription : il y a 2 jours, le 24/05.')
    // Deux jours ou plus : orange et gras, comme « Dernier relevé » du Registre des mines
    expect(find(w, 'registry-last').classes()).toEqual(expect.arrayContaining(['italic', 'text-sm', 'font-bold', 'text-orange-800']))
    const yesterday = find(await mountPage({ scopes: SCOPES({ city: null }), today: '2026-05-25' }), 'registry-last')
    expect(yesterday.text()).toBe('Dernière inscription : hier, le 24/05.')
    expect(yesterday.classes()).toContain('text-slate-700') // moins de deux jours : texte normal
    expect(yesterday.classes()).not.toContain('font-bold')
    expect(find(await mountPage({ scopes: SCOPES({ city: null }), today: '2026-05-24' }), 'registry-last').text()).toBe('Dernière inscription : aujourd\'hui, le 24/05.')
    expect(find(await mountPage({ locale: 'en', scopes: SCOPES({ city: null }) }), 'registry-last').text()).toBe('Last entry: 2 days ago, on 24/05.')
  })

  it('aucune ligne séparatrice entre le titre de l\'inscription et sa liste d\'articles', async () => {
    const w = await mountPage({ scopes: SCOPES({ city: null }) })
    expect(find(w, 'registry-contents').classes()).not.toContain('registry-section')
  })

  it('un registre vide le dit et renvoie au Bilan des stocks', async () => {
    const w = await mountPage({ scopes: SCOPES({ city: null }), province: [] })
    expect(find(w, 'registry-empty').text()).toContain(fr.EconomyInventoryRegistry.Empty)
  })
})

describe('Registre des stocks — historique navigable', () => {
  it('liste du plus récent au plus ancien ; la plus récente est ouverte d\'office, avec son contenu', async () => {
    const w = await mountPage({ scopes: SCOPES({ city: null }) })
    const entries = w.findAll('[data-testid^="registry-entry-"]')
    expect(entries).toHaveLength(3)
    expect(entries[0].attributes('aria-current')).toBe('true')
    expect(w.findAll('[data-testid="registry-content-row"]').map(r => r.text())).toEqual(['2Cailloux', '700Miches de pain']) // par nom
    // Des centaines d'articles possibles : des colonnes compactes, ni tableau ni titre « Contenu ».
    expect(find(w, 'registry-contents').find('table').exists()).toBe(false)
    expect(find(w, 'registry-contents').find('h3').exists()).toBe(false)
    expect(find(w, 'registry-contents').find('ul').classes()).toContain('tablet:columns-2')
    expect(find(w, 'registry-count').text()).toBe('2')
    expect(plain(find(w, 'registry-ecus').text())).toBe('3 500')
    expect(plain(find(w, 'registry-summary').text())).toContain('2 articles')
    expect(plain(find(w, 'registry-summary').text())).toContain('3 500 écus au trésor')
    expect(plain(find(w, 'registry-summary').text())).toContain('écus au trésor')
  })

  it('les chevrons « inscription plus ancienne / plus récente » parcourent le temps, et se désactivent aux extrémités', async () => {
    const w = await mountPage({ scopes: SCOPES({ city: null }) })
    expect(find(w, 'registry-newer').attributes('disabled')).toBeDefined()
    await find(w, 'registry-older').trigger('click')
    expect(find(w, 'registry-entry-2').attributes('aria-current')).toBe('true')
    await find(w, 'registry-older').trigger('click')
    expect(find(w, 'registry-older').attributes('disabled')).toBeDefined()
    expect(find(w, 'registry-entry-1').attributes('aria-current')).toBe('true')
    await find(w, 'registry-newer').trigger('click')
    expect(find(w, 'registry-entry-2').attributes('aria-current')).toBe('true')
  })

  it('mise en page : la comparaison est à droite, AU-DESSUS des inscriptions ; le contenu reste à gauche', async () => {
    const w = await mountPage({ scopes: SCOPES({ city: null }) })
    await find(w, 'registry-compare').setValue('2')
    const side = find(w, 'registry-side').element
    const detail = find(w, 'registry-detail').element
    expect(side.contains(find(w, 'registry-compare').element)).toBe(true)
    expect(side.contains(find(w, 'registry-compare-result').element)).toBe(true)
    expect(side.contains(find(w, 'registry-list').element)).toBe(true)
    expect(detail.contains(find(w, 'registry-compare').element)).toBe(false)
    expect(detail.contains(find(w, 'registry-contents').element)).toBe(true)
    // au-dessus : le sélecteur précède la liste des inscriptions dans la colonne
    const order = [...side.querySelectorAll('[data-testid="registry-compare"], [data-testid="registry-list"]')].map(n => n.getAttribute('data-testid'))
    expect(order).toEqual(['registry-compare', 'registry-list'])
  })

  it('les infos de l\'inscription (rédacteur, remplacement, nombre d\'articles) sont sur la ligne du titre, après le chevron de droite', async () => {
    const w = await mountPage({ scopes: SCOPES({ city: null }) })
    const row = find(w, 'registry-newer').element.parentElement
    expect(row.contains(find(w, 'registry-detail-title').element)).toBe(true)
    for (const id of ['registry-info', 'registry-by-me', 'registry-replaced-note', 'registry-summary']) expect(row.contains(find(w, id).element), id).toBe(true)
    const children = [...row.children].map(el => el.getAttribute('data-testid'))
    expect(children.indexOf('registry-info')).toBeGreaterThan(children.indexOf('registry-newer'))
  })

  it('l\'auteur d\'une inscription en vigueur n\'est jamais nommé : « inscrit par vous » seulement ; le rédacteur REMPLACÉ l\'est', async () => {
    const w = await mountPage({ scopes: SCOPES({ city: null }) })
    expect(find(w, 'registry-by-me').text()).toBe('Inscrit par vous')
    expect(find(w, 'registry-replaced-note').text()).toBe('Remplace l\'inscription de Marchand (Commissaire au commerce)')
    await find(w, 'registry-entry-2').trigger('click')
    expect(find(w, 'registry-by-me').exists()).toBe(false)
    expect(find(w, 'registry-replaced-note').exists()).toBe(false)
    expect(w.text()).not.toContain('Artifice') // pas de pseudo d'auteur courant
  })

  it('un rédacteur remplacé dont le personnage a disparu se dit', async () => {
    const snaps = [{ ...PROVINCE_SNAPSHOTS[0], replaced: { ...PROVINCE_SNAPSHOTS[0].replaced, pseudo: null } }]
    const w = await mountPage({ scopes: SCOPES({ city: null }), province: snaps })
    expect(find(w, 'registry-replaced-note').text()).toContain('un personnage disparu')
  })

  it('en anglais', async () => {
    const w = await mountPage({ locale: 'en', scopes: SCOPES({ city: null }) })
    expect(find(w, 'registry-replaced-note').text()).toBe('Replaces the entry by Marchand (Trade Minister)')
    expect(find(w, 'registry-older').attributes('aria-label')).toBe('Older entry') // les chevrons portent un libellé accessible
  })
})

describe('Registre des stocks — comparaison de deux inscriptions', () => {
  it('compare l\'inscription ouverte à une autre : hausse, baisse, nouveau, disparu, trésor — l\'ancienne est « avant », peu importe l\'ordre', async () => {
    const w = await mountPage({ scopes: SCOPES({ city: null }) })
    await find(w, 'registry-compare').setValue('2') // 24/05 (ouverte) contre 17/05
    const result = find(w, 'registry-compare-result')
    expect(result.exists()).toBe(true)
    expect(find(w, 'registry-compare-summary').text()).toBe('En hausse : 1 · En baisse : 0 · Nouveaux : 1 · Disparus : 1')
    const rows = w.findAll('[data-testid="registry-compare-row"]').map(r => r.text().replace(/\s+/g, ' '))
    expect(rows.find(r => r.includes('Miches de pain'))).toContain('+200')
    expect(rows.find(r => r.includes('Cailloux'))).toContain('Nouveau')
    expect(find(w, 'registry-compare-gone').text()).toContain('Pommes')
    expect(plain(find(w, 'registry-compare-ecus').text())).toContain('3 500')
    expect(find(w, 'registry-contents').exists()).toBe(true) // le contenu reste à gauche : la comparaison vit à droite

    // Ouvrir l'ancienne et la comparer à la récente donne le même sens (avant = la plus ancienne) : « Disparus » devient « Nouveaux ».
    await find(w, 'registry-entry-2').trigger('click')
    expect(find(w, 'registry-compare-result').exists()).toBe(false) // changer d'inscription réinitialise la comparaison
    await find(w, 'registry-compare').setValue('3')
    expect(find(w, 'registry-compare-summary').text()).toBe('En hausse : 1 · En baisse : 0 · Nouveaux : 1 · Disparus : 1')
  })

  it('deux inscriptions identiques : « Aucun changement »', async () => {
    const same = [{ ...PROVINCE_SNAPSHOTS[2], id: 5, taken_on: '2026-05-12' }, PROVINCE_SNAPSHOTS[2]]
    const w = await mountPage({ scopes: SCOPES({ city: null }), province: same })
    await find(w, 'registry-compare').setValue('1')
    expect(find(w, 'registry-compare-nochange').text()).toBe(fr.EconomyBalance.NoChange)
  })

  it('« Aucune comparaison » revient au contenu', async () => {
    const w = await mountPage({ scopes: SCOPES({ city: null }) })
    await find(w, 'registry-compare').setValue('2')
    await find(w, 'registry-compare').setValue('')
    expect(find(w, 'registry-compare-result').exists()).toBe(false)
    expect(find(w, 'registry-contents').exists()).toBe(true)
  })
})

describe('Registre des stocks — ne stocke rien', () => {
  it('lecture seule : aucune écriture (post/put), rien dans le stockage du navigateur', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const w = await mountPage({ scopes: SCOPES({ city: null }) })
    await find(w, 'registry-older').trigger('click')
    await find(w, 'registry-compare').setValue('1')
    expect(http.post).not.toHaveBeenCalled()
    expect(http.put).not.toHaveBeenCalled()
    expect(setItem.mock.calls.filter(([key]) => /inventory|registry/i.test(String(key)))).toEqual([])
    setItem.mockRestore()
  })
})
