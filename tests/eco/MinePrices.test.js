import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { reactive } from 'vue'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import EconomyPrices from '../../src/views/modules/economy/EconomyPrices.vue'
import EconomyRegistry from '../../src/views/modules/economy/EconomyRegistry.vue'
import MinePricesModal from '../../src/components/mines/MinePricesModal.vue'
import MineRegistrySave from '../../src/components/mines/MineRegistrySave.vue'
import EconomyMines from '../../src/views/modules/economy/EconomyMines.vue'
import { http } from '../../src/api.js'
import { push } from 'notivue'
import { createPinia, setActivePinia } from 'pinia'
import { useCookieStore } from '../../src/stores/cookieStore'

// Prix des mines par période — écrans (lot 2 ; brief admin/content/brief-prix-registre.md). L'écran n'a
// aucune règle : qui peut ajouter ou corriger vient de l'API (`access.prices`, `editable`).

vi.mock('notivue', () => ({ push: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../src/api.js', () => ({ http: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }))
const auth = reactive({ isLoggedIn: true, activeCharacter: { id: 7, pseudo: 'Artifice' }, getToken: 'jeton' })
vi.mock('../../src/stores/authStore', () => ({ useAuthStore: () => auth }))

const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const readLocale = (lang) => JSON.parse(fs.readFileSync(path.join(localesDir, `${lang}.json`), 'utf8'))
const fr = readLocale('fr')
const en = readLocale('en')
const i18nFor = (locale = 'fr') => createI18n({ legacy: false, locale, messages: { fr, en } })
const stubs = { RouterLink: { template: '<a><slot /></a>' }, 'v-icon': true }

const set = (id, effective_from, over = {}) => ({
  id, province_id: 1, effective_from, prices: { OR: 1, FER: 10, PIERRE: 5, ARGILE: 3, SEL: 4 }, hourly_rate: 0.7,
  created_by: 'Marchand', updated_by: null, created_at: '2026-05-02T10:00:00+00:00', updated_at: '2026-05-02T10:00:00+00:00', editable: false, ...over,
})
const province = { id: 1, name: 'Artois' }
const accessOf = (over = {}) => ({ success: true, write: null, read: null, prices: { write: province, read: province }, ...over })

/** Route les GET/POST/PUT par URL. */
function api({ access = accessOf(), prices = [], registry = null, post = null, put = null } = {}) {
  http.get.mockImplementation(async (url) => {
    if (url.endsWith('/mine-registry')) return { data: access }
    if (url.endsWith('/mine-registry/reports')) { if (!registry) throw Object.assign(new Error('403'), { response: { status: 403, data: {} } }); return { data: registry } }
    if (url.endsWith('/mine-prices')) return { data: { success: true, prices } }
    throw new Error(`GET inattendu : ${url}`)
  })
  http.post.mockImplementation(async (url, body) => ({ data: { success: true, price: post ?? { ...set(99, body.effective_from), ...body } } }))
  http.put.mockImplementation(async (url, body) => ({ data: { success: true, price: put ?? { ...set(1, body.effective_from), ...body } } }))
}

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
  auth.activeCharacter = { id: 7, pseudo: 'Artifice' }
})

describe('page de l\'historique des prix', () => {
  async function mountPage(opts = {}) {
    api(opts)
    const w = mount(EconomyPrices, { global: { plugins: [i18nFor()], stubs } })
    await flushPromises()
    return w
  }

  it('liste les jeux de prix, le plus récent en haut, avec leur auteur', async () => {
    const w = await mountPage({ prices: [set(2, '2026-05-09', { created_by: 'Mineur' }), set(1, '2026-05-01')] })
    const items = w.findAll('[data-testid="prices-list"] li')
    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('Créé par Mineur')
    expect(items[0].text()).toContain('09/05/1474') // fait de jeu : année du jeu
  })

  it('« Modifier » seulement sur les jeux que le serveur dit modifiables ; les autres disent pourquoi', async () => {
    const w = await mountPage({ prices: [set(2, '2026-05-09', { editable: true }), set(1, '2026-05-01')] })
    expect(w.find('[data-testid="price-edit-2"]').exists()).toBe(true)
    expect(w.find('[data-testid="price-edit-1"]').exists()).toBe(false)
    expect(w.find('[data-testid="price-locked-1"]').text()).toContain('ne peut plus être modifié')
  })

  it('le dirigeant lit seulement : ni « Ajouter » ni « Modifier » ni message de verrou', async () => {
    const w = await mountPage({ access: accessOf({ prices: { write: null, read: province } }), prices: [set(1, '2026-05-01')] })
    expect(w.find('[data-testid="prices-add"]').exists()).toBe(false)
    expect(w.find('[data-testid="price-edit-1"]').exists()).toBe(false)
    expect(w.find('[data-testid="price-locked-1"]').exists()).toBe(false)
  })

  it('le retour au registre est un bouton à gauche de l\'en-tête, avant le titre', async () => {
    const w = await mountPage({ prices: [] })
    const header = w.find('header')
    expect(header.element.firstElementChild.firstElementChild.getAttribute('data-testid')).toBe('prices-back')
  })

  it('un personnage sans accès aux prix voit un refus, pas une page vide', async () => {
    const w = await mountPage({ access: accessOf({ prices: { write: null, read: null } }) })
    expect(w.find('[data-testid="prices-error"]').exists()).toBe(true)
  })

  it('alerte discrète quand des semaines du mandat n\'ont aucun prix', async () => {
    const registry = { today: '2026-05-20', mandate: { in_office_from: '2026-05-04' }, reports: [] }
    const w = await mountPage({ prices: [set(1, '2026-05-12')], registry })
    expect(w.find('[data-testid="prices-uncovered"]').text()).toContain('ne sont pas couvertes')
  })

  it('pas d\'alerte quand tout est couvert', async () => {
    const registry = { today: '2026-05-20', mandate: { in_office_from: '2026-05-04' }, reports: [] }
    const w = await mountPage({ prices: [set(1, '2026-05-01')], registry })
    expect(w.find('[data-testid="prices-uncovered"]').exists()).toBe(false)
  })

  it('« Ajouter un prix » ouvre la modale (pas de formulaire en ligne), sans lien vers l\'historique', async () => {
    const w = await mountPage({ prices: [set(1, '2026-05-01')] })
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    await w.find('[data-testid="prices-add"]').trigger('click')
    expect(w.find('[role="dialog"]').exists()).toBe(true)
    expect(w.find('[data-testid="prices-add-form"]').exists()).toBe(false)
    expect(w.find('[data-testid="price-history-link"]').exists()).toBe(false)
  })

  it('« Ajouter un prix » envoie un POST puis recharge la liste', async () => {
    const w = await mountPage({ prices: [set(1, '2026-05-01')] })
    await w.find('[data-testid="prices-add"]').trigger('click')
    for (const r of ['FER', 'PIERRE', 'ARGILE', 'SEL', 'RATE']) await w.find(`[data-testid="price-${r}"]`).setValue('2')
    await w.find('[data-testid="price-form"]').trigger('submit')
    await flushPromises()

    expect(http.post).toHaveBeenCalledTimes(1)
    expect(http.post.mock.calls[0][0]).toBe('provinces/1/mine-prices')
    expect(http.post.mock.calls[0][1].prices).toEqual({ OR: 1, FER: 2, PIERRE: 2, ARGILE: 2, SEL: 2 }) // l'or part à 1, jamais saisi
    expect(push.success).toHaveBeenCalled()
  })

  it('« Modifier » envoie un PUT sur le jeu choisi', async () => {
    const w = await mountPage({ prices: [set(5, '2026-05-09', { editable: true })] })
    await w.find('[data-testid="price-edit-5"]').trigger('click')
    await w.find('[data-testid="price-FER"]').setValue('12')
    await w.find('[data-testid="price-form"]').trigger('submit')
    await flushPromises()

    expect(http.put).toHaveBeenCalledTimes(1)
    expect(http.put.mock.calls[0][0]).toBe('provinces/1/mine-prices/5')
    expect(http.put.mock.calls[0][1].prices.FER).toBe(12)
  })

  it('un refus du serveur s\'affiche dans la langue de l\'interface, le formulaire reste ouvert', async () => {
    const w = await mountPage({ prices: [] })
    http.post.mockRejectedValue(Object.assign(new Error('422'), { response: { status: 422, data: { messages: { effective_from: { fr: 'Un jeu existe déjà.', en: 'A set already exists.' } }, errors: { effective_from: ['Un jeu existe déjà.'] } } } }))
    await w.find('[data-testid="prices-add"]').trigger('click')
    for (const r of ['FER', 'PIERRE', 'ARGILE', 'SEL', 'RATE']) await w.find(`[data-testid="price-${r}"]`).setValue('2')
    await w.find('[data-testid="price-form"]').trigger('submit')
    await flushPromises()

    expect(w.find('[data-testid="price-error"]').text()).toContain('Un jeu existe déjà')
    expect(w.find('[role="dialog"]').exists()).toBe(true) // la modale reste ouverte
  })
})

describe('modale rapide « Prix en vigueur »', () => {
  const mountModal = (prices) => {
    api({ prices })
    return mount(MinePricesModal, { props: { show: true, provinceId: 1, prices }, global: { plugins: [i18nFor()], stubs } })
  }

  it('affiche les prix actuels pré-remplis et la date du jour', async () => {
    const w = mountModal([set(1, '2026-05-01', { prices: { OR: 1, FER: 11, PIERRE: 5, ARGILE: 3, SEL: 4 } })])
    await flushPromises()
    expect(w.find('[data-testid="price-FER"]').element.value).toBe('11')
    expect(w.find('[data-testid="price-date"]').element.value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('« Mettre à jour » n\'apparaît que si un champ a changé', async () => {
    const w = mountModal([set(1, '2026-05-01')])
    await flushPromises()
    expect(w.find('[data-testid="price-submit"]').exists()).toBe(false)
    await w.find('[data-testid="price-SEL"]').setValue('5')
    expect(w.find('[data-testid="price-submit"]').exists()).toBe(true)
  })

  it('l\'envoi appelle POST, prévient la page et se ferme', async () => {
    const w = mountModal([set(1, '2026-05-01')])
    await flushPromises()
    await w.find('[data-testid="price-SEL"]').setValue('5')
    await w.find('[data-testid="price-form"]').trigger('submit')
    await flushPromises()

    expect(http.post).toHaveBeenCalledTimes(1)
    expect(http.post.mock.calls[0][1].prices.SEL).toBe(5)
    expect(w.emitted('saved')).toHaveLength(1)
    expect(w.emitted('close')).toBeTruthy()
  })

  it('un jeu existe déjà aujourd\'hui : on le corrige (PUT) au lieu d\'en créer un second', async () => {
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(new Date())
    const w = mountModal([set(3, today)])
    await flushPromises()
    await w.find('[data-testid="price-SEL"]').setValue('5')
    await w.find('[data-testid="price-form"]').trigger('submit')
    await flushPromises()

    expect(http.post).not.toHaveBeenCalled()
    expect(http.put.mock.calls[0][0]).toBe('provinces/1/mine-prices/3')
  })

  it('Échap ferme la modale et le lien mène à l\'historique', async () => {
    const w = mountModal([set(1, '2026-05-01')])
    await flushPromises()
    expect(w.find('[data-testid="price-history-link"]').exists()).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('close')).toBeTruthy()
  })
})

describe('aucun jeu en base : repli sur les prix du Bilan mémorisés (cookies)', () => {
  const remember = () => useCookieStore().setComfortData('economy_mines_settings', JSON.stringify({ prices: { PIERRE: 14.5, FER: 19.5, ARGILE: 4.5, SEL: 4.5 }, rate: 0.7 }))
  const mountModal = (prices = []) => {
    api({ prices })
    return mount(MinePricesModal, { props: { show: true, provinceId: 1, prices }, global: { plugins: [i18nFor()], stubs } })
  }

  it('la modale reprend les derniers prix du Bilan, l\'or à 1 écu, et propose d\'enregistrer sans rien modifier', async () => {
    remember()
    const w = mountModal()
    await flushPromises()
    expect(w.find('[data-testid="price-FER"]').element.value).toBe('19.5')
    expect(w.find('[data-testid="price-OR"]').exists()).toBe(false) // l'or n'a pas de prix
    expect(w.find('[data-testid="price-RATE"]').element.value).toBe('0.7')
    expect(w.find('[data-testid="price-note"]').text()).toContain('dernier Bilan')

    await w.find('[data-testid="price-form"]').trigger('submit')
    await flushPromises()
    expect(http.post).toHaveBeenCalledTimes(1)
    expect(http.post.mock.calls[0][1].prices).toEqual({ OR: 1, FER: 19.5, PIERRE: 14.5, ARGILE: 4.5, SEL: 4.5 })
  })

  it('sans cookies, le formulaire reste vide et sans note', async () => {
    const w = mountModal()
    await flushPromises()
    expect(w.find('[data-testid="price-FER"]').element.value).toBe('')
    expect(w.find('[data-testid="price-note"]').exists()).toBe(false)
    expect(w.find('[data-testid="price-submit"]').exists()).toBe(false)
  })

  it('un jeu en base l\'emporte sur les cookies', async () => {
    remember()
    const w = mountModal([set(1, '2026-05-01', { prices: { OR: 1, FER: 11, PIERRE: 5, ARGILE: 3, SEL: 4 } })])
    await flushPromises()
    expect(w.find('[data-testid="price-FER"]').element.value).toBe('11')
    expect(w.find('[data-testid="price-note"]').exists()).toBe(false)
  })

  it('la page des prix prérempli aussi « Ajouter un prix » quand la province n\'a rien', async () => {
    remember()
    api({ prices: [] })
    const w = mount(EconomyPrices, { global: { plugins: [i18nFor()], stubs } })
    await flushPromises()
    await w.find('[data-testid="prices-add"]').trigger('click')
    expect(w.find('[data-testid="price-FER"]').element.value).toBe('19.5')
  })

  it('« Ajouter un prix » avec des jeux existants part du plus récent, à la date du jour', async () => {
    api({ prices: [set(1, '2026-05-01', { prices: { OR: 1, FER: 11, PIERRE: 5, ARGILE: 3, SEL: 4 } })] })
    const w = mount(EconomyPrices, { global: { plugins: [i18nFor()], stubs } })
    await flushPromises()
    await w.find('[data-testid="prices-add"]').trigger('click')
    expect(w.find('[data-testid="price-FER"]').element.value).toBe('11')
    expect(w.find('[data-testid="price-date"]').element.value).not.toBe('2026-05-01')
  })
})

describe('registre : prix, navigation des semaines et export', () => {
  // Une mine de fer sur la semaine du 04/05 au 10/05, heures du lendemain comprises (règle A).
  const days = Object.fromEntries(Array.from({ length: 8 }, (_, i) => {
    const d = `2026-05-${String(4 + i).padStart(2, '0')}`
    return [d, { production: 10, heures: 10 }]
  }))
  const registry = () => ({
    success: true, province, today: '2026-05-20',
    mandate: { in_office_from: '2026-05-04', mid_at: '2026-06-03', end_at: '2026-07-03' },
    predecessor: [],
    reports: [{ id: 1, reported_at: '2026-05-12', active: true, replaced_by_id: null,
      author: { pseudo: 'Artifice', office_key: 'commissaire_mines', office_label: { fr: 'Commissaire aux mines', en: 'Mines Superintendent' } },
      prices: { FER: 1 }, rate: 1,
      report: { mines: [{ number: 4, noeud: '226', label: 'Mine de fer', resource: 'FER', days }], states: [{ number: 4, noeud: '226', label: 'Mine de fer', niveau: '9' }] } }],
  })

  async function mountRegistry(opts = {}) {
    api({ registry: registry(), ...opts })
    const w = mount(EconomyRegistry, { global: { plugins: [i18nFor()], stubs } })
    await flushPromises()
    return w
  }

  it('« Gérer les prix » n\'apparaît que pour qui peut écrire (le dirigeant ne l\'a pas)', async () => {
    expect((await mountRegistry()).find('[data-testid="manage-prices"]').exists()).toBe(true)
    const leader = await mountRegistry({ access: accessOf({ prices: { write: null, read: province } }) })
    expect(leader.find('[data-testid="manage-prices"]').exists()).toBe(false)
    expect(leader.find('[data-testid="prices-history-link"]').exists()).toBe(true)
  })

  it('les flèches changent la semaine, sans dépasser le début du mandat ni la semaine en cours', async () => {
    const w = await mountRegistry()
    const label = () => w.find('[data-testid="week-label"]').text()
    expect(label()).toBe('Période en cours')
    expect(w.find('[data-testid="week-next"]').attributes('disabled')).toBeDefined()

    await w.find('[data-testid="week-previous"]').trigger('click')
    expect(label()).toContain('18 mai 1474') // semaine en cours : lundi 18/05
    await w.find('[data-testid="week-previous"]').trigger('click')
    await w.find('[data-testid="week-previous"]').trigger('click')
    expect(label()).toContain('4 mai 1474')
    expect(w.find('[data-testid="week-previous"]').attributes('disabled')).toBeDefined() // pas avant le mandat

    await w.find('[data-testid="week-reset"]').trigger('click')
    expect(label()).toBe('Période en cours')
  })

  it('le bilan d\'une semaine se recalcule avec les prix de la table (ou, à défaut, ceux du relevé)', async () => {
    const withTable = await mountRegistry({ prices: [set(1, '2026-05-01', { prices: { OR: 1, FER: 100, PIERRE: 5, ARGILE: 3, SEL: 4 }, hourly_rate: 0 })] })
    for (let i = 0; i < 3; i++) await withTable.find('[data-testid="week-previous"]').trigger('click')
    const tableTotal = withTable.find('[data-testid="registry-week-total"]').text()

    const fallback = await mountRegistry({ prices: [] })
    for (let i = 0; i < 3; i++) await fallback.find('[data-testid="week-previous"]').trigger('click')
    const fallbackTotal = fallback.find('[data-testid="registry-week-total"]').text()

    expect(tableTotal).not.toBe(fallbackTotal)
    expect(withTable.find('[data-testid="week-unpriced"]').exists()).toBe(false)
  })

  it('exporte une semaine complète en BBCode dans le presse-papiers, avec un toast', async () => {
    const writeText = vi.fn().mockResolvedValue()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const w = await mountRegistry({ prices: [set(1, '2026-05-01')] })
    for (let i = 0; i < 3; i++) await w.find('[data-testid="week-previous"]').trigger('click')
    expect(w.find('[data-testid="week-incomplete"]').exists()).toBe(false)

    await w.find('[data-testid="week-export"]').trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText.mock.calls[0][0]).toMatch(/^\[quote\]\[center\]/)
    expect(writeText.mock.calls[0][0]).toContain('4 mai 1474')
    expect(push.success).toHaveBeenCalledWith('BBCode copié dans le presse-papiers.')
  })

  it('une semaine incomplète s\'affiche marquée et ne s\'exporte pas', async () => {
    const w = await mountRegistry({ prices: [set(1, '2026-05-01')] })
    await w.find('[data-testid="week-previous"]').trigger('click') // semaine du 18/05 : en cours
    expect(w.find('[data-testid="week-incomplete"]').exists()).toBe(true)
    expect(w.find('[data-testid="week-export"]').exists()).toBe(false)
  })
})

describe('enregistrement au registre : les prix ne se saisissent plus', () => {
  const TEXT = "Mine 1 : Mine d'or - Noeud 236\nNombre d'heures travaillées ces 7 derniers jours\nDate\tHeures\n2026-05-08\t53\n"
  const saveWith = async (props) => {
    http.get.mockResolvedValue({ data: { success: true, write: { id: 1, name: 'Artois' }, read: { id: 1, name: 'Artois' } } })
    http.post.mockResolvedValue({ data: { report: { province_name: 'Artois', reported_at: '2026-05-08' }, replaced: null } })
    const w = mount(MineRegistrySave, { props: { text: TEXT, ...props }, global: { plugins: [i18nFor()], stubs } })
    await flushPromises()
    await w.find('button.odc--gold:not(.odc-btn--sm):not(.plate-help)').trigger('click')
    await flushPromises()
    return http.post.mock.calls[0][1]
  }

  it('sans prix reçus, aucun prix n\'est envoyé : le serveur fige ceux de la table', async () => {
    const body = await saveWith({})
    expect(body).not.toHaveProperty('prices')
    expect(body).not.toHaveProperty('rate')
  })

  it('en repli (aucun jeu en base), les prix saisis partent encore', async () => {
    const body = await saveWith({ prices: { OR: 1 }, rate: 0.7 })
    expect(body.prices).toEqual({ OR: 1 })
    expect(body.rate).toBe(0.7)
  })
})

describe('enregistrement au registre : rappel des prix en vigueur', () => {
  const TEXT = "Mine 1 : Mine d'or - Noeud 236\nNombre d'heures travaillées ces 7 derniers jours\nDate\tHeures\n2026-05-08\t53\n"
  async function mountSave(prices) {
    api({ access: { success: true, write: province, read: province, prices: { write: province, read: province } }, prices })
    const w = mount(MineRegistrySave, { props: { text: TEXT }, global: { plugins: [i18nFor()], stubs } })
    await flushPromises()
    return w
  }

  it('affiche, sans rien demander de saisir, les prix du jeu en vigueur à la date du relevé', async () => {
    const w = await mountSave([set(2, '2026-05-10', { prices: { OR: 1, FER: 99, PIERRE: 5, ARGILE: 3, SEL: 4 } }), set(1, '2026-05-01', { prices: { OR: 1, FER: 11, PIERRE: 5, ARGILE: 3, SEL: 4 } })])
    const box = w.find('[data-testid="mine-registry-prices"]')
    expect(box.text()).toContain('11') // le jeu du 01/05, pas celui du 10/05 (postérieur au relevé du 08/05)
    expect(box.text()).not.toContain('99')
    expect(w.find('input').exists()).toBe(false)
  })

  it('sans prix pour cette date, le dit et mène à la page des prix', async () => {
    const w = await mountSave([set(1, '2026-05-10')])
    expect(w.find('[data-testid="mine-registry-no-prices"]').text()).toContain('sans prix')
  })
})

describe('Bilan public : prix en lecture seule pour qui gère le registre', () => {
  async function mountBilan({ writer, prices = [] }) {
    setActivePinia(createPinia())
    if (writer) {
      api({ access: { success: true, write: province, read: province, prices: { write: province, read: province } }, prices })
    } else {
      http.get.mockRejectedValue(new Error('hors ligne'))
    }
    auth.isLoggedIn = !!writer
    const w = mount(EconomyMines, { global: { plugins: [i18nFor()], stubs } })
    await flushPromises()
    return w
  }

  it('un gérant avec des prix en base les voit sans pouvoir les modifier', async () => {
    const w = await mountBilan({ writer: true, prices: [set(1, '2026-05-01')] })
    expect(w.find('[data-testid="managed-prices"]').exists()).toBe(true)
    expect(w.find('#price-FER').exists()).toBe(false)
    expect(w.find('#mines-rate').exists()).toBe(false)
  })

  it('un gérant sans aucun prix en base est prévenu et garde la saisie en repli', async () => {
    const w = await mountBilan({ writer: true, prices: [] })
    expect(w.find('[data-testid="no-price-set"]').exists()).toBe(true)
    expect(w.find('#price-FER').exists()).toBe(true)
  })

  it('sans poste qui gère le registre, la saisie des prix reste ce qu\'elle était', async () => {
    const w = await mountBilan({ writer: false })
    expect(w.find('[data-testid="managed-prices"]').exists()).toBe(false)
    expect(w.find('#price-FER').exists()).toBe(true)
    expect(w.find('#mines-rate').exists()).toBe(true)
  })
})

describe('textes', () => {
  const keys = (o, prefix = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]))

  it('chaque texte des prix existe dans les deux langues', () => {
    for (const group of ['ManagedPrices']) {
      expect(keys(fr.EconomyMines[group]).sort()).toEqual(keys(en.EconomyMines[group]).sort())
    }
    for (const group of ['Prices', 'Navigation', 'Export']) {
      expect(keys(fr.EconomyMines.RegistryPage[group]).sort()).toEqual(keys(en.EconomyMines.RegistryPage[group]).sort())
    }
  })
})
