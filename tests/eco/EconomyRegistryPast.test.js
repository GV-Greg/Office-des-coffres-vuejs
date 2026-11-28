import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { reactive } from 'vue'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import EconomyRegistry from '../../src/views/modules/economy/EconomyRegistry.vue'
import EconomyHomeView from '../../src/views/modules/economy/EconomyHomeView.vue'
import { http } from '../../src/api.js'
import { createPinia, setActivePinia } from 'pinia'

/*
  Registre des mines — bilans de mandat PASSÉS (22/11/2026). Un ancien titulaire relit, EN LECTURE SEULE, les relevés de SON mandat : le serveur les fenêtre, l'écran affiche. ⚠️ Aucune règle côté
  site : les mandats lisibles viennent de `GET characters/{id}/mine-registry` (`past_mandates`) et le registre d'un mandat de `…/mandates/{id}`.
*/
vi.mock('../../src/api.js', () => ({ http: { get: vi.fn() } }))
const auth = reactive({ isLoggedIn: true, activeCharacter: { id: 7, pseudo: 'Artifice' }, getToken: 'jeton' })
vi.mock('../../src/stores/authStore', () => ({ useAuthStore: () => auth }))

const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const readLocale = lang => JSON.parse(fs.readFileSync(path.join(localesDir, `${lang}.json`), 'utf8'))
const fr = readLocale('fr')
const en = readLocale('en')

const author = (pseudo, key = 'commissaire_mines') => ({ pseudo, office_key: key, office_label: { fr: 'Commissaire aux mines', en: 'Mines Superintendent' } })
const withDays = (days) => ({ number: 1, noeud: '236', days: Object.fromEntries(days.map(d => [d, { production: 2, heures: 5 }])) })
const report = (id, reportedAt, days = []) => ({
  id, reported_at: reportedAt, active: true, replaced_by_id: null, author: author('Artifice'),
  report: { mines: days.length ? [withDays(days)] : [], states: [{ number: 1, label: "Mine d'or", noeud: '236', niveau: '10' }] },
})

// Mandat TERMINÉ le 30/04 (entré le 01/03 : mi-mandat 31/03, fin 30/04 — il finit le jour de sa fin théorique) ou plus tôt.
const PAST = (over = {}) => ({
  success: true, province: { id: 1, name: 'Franche-Comté' }, today: '2026-05-10', read_only: true,
  window: { from: '2026-01-30', to: '2026-04-30' },
  mandate: { id: 42, in_office_from: '2026-03-01', mid_at: '2026-03-31', end_at: '2026-04-30', ended_at: '2026-04-30' },
  predecessor: [], reports: [report(1, '2026-04-20', ['2026-04-18', '2026-04-19']), report(2, '2026-03-10', ['2026-03-09'])], ...over,
})
const CURRENT = () => ({
  success: true, province: { id: 1, name: 'Franche-Comté' }, today: '2026-05-10', read_only: false, window: null,
  mandate: { id: 50, in_office_from: '2026-05-07', mid_at: '2026-06-06', end_at: '2026-07-06', ended_at: null },
  predecessor: [], reports: [report(5, '2026-05-09', ['2026-05-08'])],
})
const PAST_MANDATE = { id: 42, province: { id: 1, name: 'Franche-Comté' }, office_key: 'commissaire_mines', office_label: { fr: 'Commissaire aux mines', en: 'Mines Superintendent' }, in_office_from: '2026-03-01', holds_until: '2026-04-30' }
const ACCESS = (over = {}) => ({ success: true, write: null, read: null, prices: { write: null, read: null }, past_mandates: [], ...over })

function serve({ access = ACCESS(), past = PAST(), current = CURRENT(), reportsStatus = null } = {}) {
  http.get.mockImplementation(async (url) => {
    if (url.endsWith('/mine-registry')) return { data: access }
    if (url.endsWith('/mine-registry/reports')) {
      if (reportsStatus) throw { response: { status: reportsStatus, data: { message: 'Refusé', messages: { fr: 'Refusé', en: 'Denied' } } } }
      return { data: current }
    }
    if (url.includes('/mine-registry/mandates/')) return { data: past }
    return { data: { success: true } }
  })
}

async function mountPage({ locale = 'fr', ...options } = {}) {
  serve(options)
  const i18n = createI18n({ legacy: false, locale, messages: { fr, en } })
  const wrapper = mount(EconomyRegistry, { global: { plugins: [i18n], stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
  await flushPromises()
  return wrapper
}
const find = (w, id) => w.find(`[data-testid="${id}"]`)
const calls = suffix => http.get.mock.calls.filter(([url]) => url.includes(suffix)).map(([url]) => url)

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
  auth.activeCharacter = { id: 7, pseudo: 'Artifice' }
})

describe('Registre — bilans de mandat passés : ancien titulaire sans mandat en cours', () => {
  const FORMER = () => ({ access: ACCESS({ past_mandates: [PAST_MANDATE] }) })

  it('le registre s\'ouvre sur le mandat passé, jamais sur « reports » (qui dirait 403) ; bandeau « lecture seule » avec la date de fin en année du jeu', async () => {
    const w = await mountPage(FORMER())

    expect(calls('mine-registry/reports')).toHaveLength(0)
    expect(calls('mine-registry/mandates/42')).toEqual(['characters/7/mine-registry/mandates/42'])
    expect(find(w, 'registry-readonly').text()).toBe('Bilan du mandat terminé le 30/04/1474 — lecture seule')
    expect(w.find('[data-testid="registry-mandate-select"]').text()).toContain('Franche-Comté') // la province d'un mandat passé se lit dans le sélecteur
  })

  it('le sélecteur dit le poste, la province et la période (année du jeu)', async () => {
    const w = await mountPage(FORMER())
    const options = w.findAll('[data-testid="registry-mandate-select"] option').map(o => o.text())

    expect(options).toEqual(['Commissaire aux mines — Franche-Comté, du 01/03/1474 au 30/04/1474'])
    expect(w.text()).toContain('Choisir un mandat')
  })

  it('lecture seule : pas de bilan « en cours », pas d\'âge du dernier relevé, pas de liens vers les prix', async () => {
    const w = await mountPage(FORMER())

    expect(find(w, 'registry-age').exists()).toBe(false)
    expect(find(w, 'prices-history-link').exists()).toBe(false)
    expect(find(w, 'manage-prices-link').exists()).toBe(false)
    expect(w.text()).not.toContain('Période en cours')
    expect(w.text()).not.toContain('en cours du')
  })

  it('le mandat terminé s\'ouvre sur sa DERNIÈRE semaine, parcourable, sans retour à une « période en cours »', async () => {
    const w = await mountPage(FORMER())

    expect(find(w, 'registry-week').exists()).toBe(true)
    expect(find(w, 'week-label').text()).toContain('27 avril 1474') // le mandat finit le 30/04 : sa dernière semaine est celle du lundi 27/04
    expect(find(w, 'week-reset').exists()).toBe(false)
    expect(find(w, 'week-next').attributes('disabled')).toBeDefined() // déjà sur la dernière semaine
    expect(find(w, 'week-previous').attributes('disabled')).toBeUndefined()

    await find(w, 'week-previous').trigger('click')
    expect(find(w, 'week-next').attributes('disabled')).toBeUndefined()
    await find(w, 'week-next').trigger('click')
    expect(find(w, 'week-next').attributes('disabled')).toBeDefined() // la borne est la dernière semaine du mandat
  })

  it('les bilans de mi-mandat et de fin sont LISIBLES (jamais « dans N jours ») même si le mandat a fini avant la date théorique', async () => {
    const earlyEnd = PAST({ mandate: { id: 42, in_office_from: '2026-03-01', mid_at: '2026-03-31', end_at: '2026-04-30', ended_at: '2026-04-12' }, window: { from: '2026-01-30', to: '2026-04-12' } })
    const w = await mountPage({ ...FORMER(), past: earlyEnd })

    expect(find(w, 'registry-bilan-mid').text()).not.toMatch(/dans \d+ jour/)
    expect(find(w, 'registry-bilan-end').text()).not.toMatch(/dans \d+ jour/)
    expect(find(w, 'registry-bilan-end').text()).toContain('Bilan de fin de mandat')
  })

  it('la dernière semaine, partielle, ne parle pas de bilan « provisoire » : elle dit pourquoi elle est incomplète', async () => {
    const w = await mountPage(FORMER())

    expect(find(w, 'week-incomplete').text()).toBe('Semaine incomplète : elle déborde du mandat, ou des jours n\'ont pas de données.')
    expect(find(w, 'week-incomplete').text()).not.toContain('provisoire')
  })

  it('l\'export d\'une semaine complète reste disponible', async () => {
    const full = PAST({ reports: [report(1, '2026-04-28', ['2026-04-20', '2026-04-21', '2026-04-22', '2026-04-23', '2026-04-24', '2026-04-25', '2026-04-26', '2026-04-27'])] })
    const w = await mountPage({ ...FORMER(), past: full })
    // la dernière semaine du mandat (27→29/04, mandat fini le 30) n'est pas complète ; la précédente (20→26/04) l'est
    await find(w, 'week-previous').trigger('click')

    expect(find(w, 'week-export').exists()).toBe(true)
  })

  it('en anglais : le sélecteur et le bandeau', async () => {
    const w = await mountPage({ ...FORMER(), locale: 'en' })

    expect(w.text()).toContain('Select a mandate')
    expect(find(w, 'registry-readonly').text()).toBe('Report for mandate ended 30/04/1474 — read only')
    expect(w.find('[data-testid="registry-mandate-select"] option').text()).toContain('from 01/03/1474 to 30/04/1474')
  })

  it('un refus du serveur (403) sur le mandat reste le cadenas fermé, sans « Réessayer »', async () => {
    http.get.mockImplementation(async (url) => {
      if (url.endsWith('/mine-registry')) return { data: ACCESS({ past_mandates: [PAST_MANDATE] }) }
      throw { response: { status: 403, data: { message: 'Refusé', messages: { fr: 'Refusé', en: 'Denied' } } } }
    })
    const wrapper = mount(EconomyRegistry, { global: { plugins: [createI18n({ legacy: false, locale: 'fr', messages: { fr, en } })], stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
    await flushPromises()

    expect(find(wrapper, 'registry-denied').exists()).toBe(true)
  })
})

describe('Registre — mandat en cours ET mandats passés', () => {
  const BOTH = () => ({ access: ACCESS({ read: { id: 1, name: 'Franche-Comté' }, past_mandates: [PAST_MANDATE] }) })

  it('le mandat en cours est le choix par défaut (comportement d\'avant), le mandat passé est dans le sélecteur', async () => {
    const w = await mountPage(BOTH())
    const options = w.findAll('[data-testid="registry-mandate-select"] option').map(o => o.text())

    expect(options[0]).toBe('Mandat en cours — Franche-Comté')
    expect(options).toHaveLength(2)
    expect(calls('mine-registry/reports')).toHaveLength(1)
    expect(find(w, 'registry-readonly').exists()).toBe(false)
    expect(find(w, 'prices-history-link').exists()).toBe(true) // le mandat en cours garde ses liens
    expect(find(w, 'registry-age').exists()).toBe(true)
  })

  it('choisir le mandat passé lit ce mandat, passe en lecture seule ; revenir au mandat en cours rétablit tout', async () => {
    const w = await mountPage(BOTH())
    await find(w, 'registry-mandate-select').setValue(42)
    await flushPromises()

    expect(calls('mine-registry/mandates/42')).toHaveLength(1)
    expect(find(w, 'registry-readonly').exists()).toBe(true)
    expect(find(w, 'prices-history-link').exists()).toBe(false)

    await find(w, 'registry-mandate-select').setValue('current')
    await flushPromises()
    expect(find(w, 'registry-readonly').exists()).toBe(false)
    expect(find(w, 'registry-age').exists()).toBe(true)
  })
})

describe('Registre — sans mandat passé, rien ne change', () => {
  it('pas de sélecteur ni de bandeau ; le mandat en cours se lit comme avant', async () => {
    const w = await mountPage({ access: ACCESS({ read: { id: 1, name: 'Franche-Comté' } }) })

    expect(find(w, 'registry-mandate-bar').exists()).toBe(false)
    expect(find(w, 'registry-readonly').exists()).toBe(false)
    expect(calls('mine-registry/reports')).toHaveLength(1)
  })

  it('sans aucun droit : le serveur refuse, le cadenas reste fermé', async () => {
    const w = await mountPage({ access: ACCESS(), reportsStatus: 403 })

    expect(find(w, 'registry-denied').exists()).toBe(true)
    expect(find(w, 'registry-mandate-bar').exists()).toBe(false)
  })
})

describe('Économie — le Registre apparaît pour un ancien titulaire', () => {
  const mountHome = (access) => mount(EconomyHomeView, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'fr', messages: { fr, en } })],
      provide: { economyAccess: reactive({ value: access }), economyAccessReady: true, economyStockRegistryAccess: reactive({ value: false }) },
      stubs: { RouterLink: { template: '<a><slot /></a>' }, ModuleHomeCards: { props: ['items'], template: '<div>{{ items.map(i => i.title).join(" | ") }}</div>' }, ChestLoader: { template: '<div><slot /></div>' } },
    },
  })

  it('une carte « Registre des mines » existe avec un mandat passé, pas sans', () => {
    const name = fr.Economy.Cards.registry.Name
    expect(mountHome(ACCESS({ past_mandates: [PAST_MANDATE] })).text()).toContain(name)
    expect(mountHome(ACCESS()).text()).not.toContain(name)
  })
})

describe('Registre — export BBCode des bilans de mi-mandat et de fin de mandat (forum)', () => {
  const FORMER = () => ({ access: ACCESS({ past_mandates: [PAST_MANDATE] }) })
  const writeText = vi.fn(() => Promise.resolve())
  beforeEach(() => { writeText.mockClear(); Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true }) })

  // Données sur TOUS les jours du mandat (01/03 → 29/04 : 60 jours) : un bilan complet.
  const allDays = () => Array.from({ length: 62 }, (_, i) => new Date(Date.UTC(2026, 2, 1 + i)).toISOString().slice(0, 10))

  it('un bilan de fin de mandat PRÊT s\'exporte, mis en page comme une semaine (un [quote], titre, période en dates du jeu), avec le net', async () => {
    const w = await mountPage({ ...FORMER(), past: PAST({ reports: [report(1, '2026-04-29', allDays())] }) })
    await find(w, 'registry-bilan-export-end').trigger('click')
    await flushPromises()

    const text = writeText.mock.calls[0][0]
    expect(text).toContain('[quote][center]')
    expect(text).toContain('Bilan de fin de mandat, du 1 mars 1474 au 29 avril 1474') // dates du jeu, comme l'export d'une semaine
    expect(text).toContain('Total de la province')
    expect(text).toContain('[/quote]')
  })

  it('un bilan COMPLET n\'a pas de ligne de couverture ; un bilan PARTIEL la porte, avec ses chiffres', async () => {
    const complete = await mountPage({ ...FORMER(), past: PAST({ reports: [report(1, '2026-04-29', allDays())] }) })
    await find(complete, 'registry-bilan-export-end').trigger('click')
    await flushPromises()
    expect(writeText.mock.calls[0][0]).not.toContain('Bilan partiel')

    writeText.mockClear()
    const partial = await mountPage({ ...FORMER(), past: PAST({ reports: [report(1, '2026-04-20', ['2026-04-18', '2026-04-19'])] }) })
    await find(partial, 'registry-bilan-export-end').trigger('click')
    await flushPromises()
    expect(writeText.mock.calls[0][0]).toMatch(/Bilan partiel : \d+ jours? couverts? sur 60/)
  })

  it('mi-mandat aussi ; le toast dit que le BBCode est copié ; en anglais le gabarit suit la langue', async () => {
    const w = await mountPage({ ...FORMER(), locale: 'en', past: PAST({ reports: [report(1, '2026-04-29', allDays())] }) })
    await find(w, 'registry-bilan-export-mid').trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledOnce()
    expect(writeText.mock.calls[0][0]).toContain('Mid-term report')
  })

  it('un bilan PAS ENCORE DISPONIBLE (« dans N jours ») n\'a pas de bouton ; ni un bilan sans aucun jour couvert', async () => {
    const current = await mountPage({ access: ACCESS({ read: { id: 1, name: 'Franche-Comté' } }) })
    expect(current.find('[data-testid="registry-bilan-export-end"]').exists()).toBe(false)

    const empty = await mountPage({ ...FORMER(), past: PAST({ reports: [] }) })
    expect(empty.find('[data-testid="registry-bilan-export-end"]').exists()).toBe(false)
  })
})

