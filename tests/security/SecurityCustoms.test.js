import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import SecurityCustoms from '../../src/views/modules/security/SecurityCustoms.vue'
import { useAuthStore } from '../../src/stores/authStore'
import { http } from '../../src/api.js'
import { push } from 'notivue'

/*
  Le Registre de douane (module Sécurité, PR 3-1 ; fil admin/echanges/module-securite) : bilans d'une ville jour par jour, saisie par collage, listes
  rouge et verte. ⚠️ Aucune règle côté site : qui lit, écrit, quelles villes et quels jours, le serveur le dit (`customs-access`). L'auteur d'un bilan
  n'est jamais nommé ; le brut n'est jamais servi. Le parseur est au frontend : l'écran envoie l'analyse ET le brut gardé.
*/
vi.mock('notivue', () => ({ push: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../src/api.js', () => ({ http: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() } }))

const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const fr = JSON.parse(readFileSync(resolve(localesDir, 'fr.json'), 'utf-8'))
const en = JSON.parse(readFileSync(resolve(localesDir, 'en.json'), 'utf-8'))

const ok = data => Promise.resolve({ data })
const refuse = (status, messages) => Promise.reject({ response: { status, data: { success: false, message: messages.fr, errors: { x: [messages.fr] }, messages: { x: messages } } } })

const CITIES = [{ id: 1, name: 'Arras' }, { id: 2, name: 'Béthune' }]
const ACCESS = (over = {}) => ({
  province: { id: 3, name: 'Artois' }, role: 'prevot_des_marechaux', has_security_trio: true, today: '2026-05-26', earliest_day: '2026-05-19',
  read_reports: true, write_reports: true, correct_reports: true, read_lists: true, write_lists: true, add_red_only: false,
  writable_cities: CITIES, readable_cities: CITIES, min_parser_version: 1, ...over,
})
const REPORT = (over = {}) => ({
  id: 5, city_id: 1, reported_on: '2026-05-26', by_me: false, can_complete: false, can_correct: true, sections_present: ['guet', 'armies_groups'],
  sections: {
    guet: {
      villagers: [
        { pseudo: 'Gregor.', noblesse: '', reputation: 255, colour: 'red' },
        { pseudo: 'Artifice', noblesse: 'de Dole', reputation: 255, colour: 'green' },
        { pseudo: 'Emmie....', noblesse: '', reputation: 255, colour: null },
      ],
      declared_total: 3, read_total: 3, total_matches: true,
      diff: { compared_to: '2026-05-25', arrivals: [{ pseudo: 'Nouveau', colour: null }], departures: [{ pseudo: 'Parti', colour: 'red' }] },
    },
    armies_groups: {
      armies: [{ name: 'Legio Aurea', commander: { pseudo: 'Lucas_', colour: null }, status: 'aux portes de la ville' }],
      groups: [
        { type: 'groupe', alert: true, members: [{ pseudo: 'Sefrian', colour: null }], status: 'Admission libre' },
        { type: 'corps_armes', alert: false, members: [{ pseudo: 'Damonkael', colour: null }, { pseudo: 'Thymotee_bilal', colour: null }], status: 'Fermé' },
        { type: 'milice', alert: false, members: [], status: '' },
      ],
      zone: 'La mairie est maîtresse du statu quo sur ce noeud.',
    },
  },
  ...over,
})
const ENTRIES = () => [
  { id: 1, colour: 'red', pseudo: 'Gregor.', reason: 'brigandage', added_on: '2026-05-20', by_me: false, added_by: 'Le_prevot', can_remove: true, can_edit: true },
  { id: 2, colour: 'green', pseudo: 'Artifice', reason: null, added_on: '2026-05-21', by_me: true, added_by: null, can_remove: true, can_edit: false },
]

function serve({ access = ACCESS(), report = REPORT(), days = ['2026-05-26', '2026-05-25'], entries = ENTRIES() } = {}) {
  http.get.mockImplementation((url) => {
    if (url.endsWith('customs-access')) return ok({ success: true, access })
    if (url.endsWith('customs-reports')) return ok({ success: true, days, report })
    if (url.endsWith('customs-lists')) return ok({ success: true, entries })
    return ok({})
  })
  http.post.mockImplementation(() => ok({ success: true, mode: 'created', id: 9 }))
  http.put.mockImplementation(() => ok({ success: true }))
  http.delete.mockImplementation(() => ok({ success: true }))
}

async function mountPage({ locale = 'fr', ...options } = {}) {
  setActivePinia(createPinia())
  useAuthStore().$patch({ user: { characters: [{ id: 7, pseudo: 'Artifice' }] }, token: 'jeton' })
  serve(options)
  const i18n = createI18n({ legacy: false, locale, messages: { fr, en } })
  const wrapper = mount(SecurityCustoms, { global: { plugins: [i18n], stubs: { RouterLink: { template: '<a><slot /></a>' }, 'v-icon': true } } })
  await flushPromises()
  return wrapper
}

const find = (w, id) => w.find(`[data-testid="${id}"]`)
const reportCalls = () => http.get.mock.calls.filter(([url]) => url.endsWith('customs-reports'))

beforeEach(() => vi.clearAllMocks())

describe('Registre de douane — accès', () => {
  it('sans rôle : les portes restent closes, aucun appel aux bilans', async () => {
    const w = await mountPage({ access: null })

    expect(find(w, 'customs-denied').text()).toContain('Les portes du registre restent closes')
    expect(reportCalls()).toHaveLength(0)
    expect(find(w, 'customs-form').exists()).toBe(false)
  })

  it('un rôle : le titre dit la province, la ville et le jour du jeu sont proposés, le bilan du jour est lu', async () => {
    const w = await mountPage()

    expect(w.text()).toContain('Registre de douane : Artois')
    expect(w.findAll('[data-testid="city-select"] option').map(o => o.text())).toEqual(['Arras', 'Béthune'])
    expect(reportCalls()[0][1].params).toEqual({ city_id: 1, date: '2026-05-26' })
    expect(find(w, 'no-trio').exists()).toBe(false)
  })

  it('sans trio connu, l\'écran le dit : c\'est l\'état courant d\'une province', async () => {
    const w = await mountPage({ access: ACCESS({ has_security_trio: false, role: 'customs', correct_reports: false }) })

    expect(find(w, 'no-trio').text()).toContain('Aucun membre de la sécurité')
  })

  it('en anglais', async () => {
    const w = await mountPage({ locale: 'en' })

    expect(w.text()).toContain('Customs Register: Artois')
    expect(w.text()).toContain('Report of')
  })
})

describe('Registre de douane — lecture du bilan', () => {
  it('les pseudos colorés disent leur liste par le TEXTE, pas seulement par la couleur ; les autres restent neutres', async () => {
    const w = await mountPage()
    const coloured = find(w, 'coloured-villagers')

    expect(coloured.text()).toContain('Gregor.')
    expect(coloured.text()).toContain('(liste rouge)')
    expect(coloured.text()).toContain('(liste verte)')
    expect(coloured.find('[data-colour="red"]').text()).toContain('Gregor.')
    expect(coloured.text()).not.toContain('Emmie....')
  })

  it('le différentiel dit à quel bilan il se compare ; sans bilan antérieur, il le dit aussi', async () => {
    const w = await mountPage()
    expect(find(w, 'guet-diff').text()).toContain('Comparé au bilan du 25/05/1474')
    expect(find(w, 'guet-diff').text()).toContain('Nouveau')
    expect(find(w, 'guet-diff').text()).toContain('Parti')

    const bare = REPORT()
    bare.sections.guet.diff = null
    expect(find(await mountPage({ report: bare }), 'guet-diff').text()).toContain('Aucun bilan antérieur')
  })

  it('un collage tronqué est signalé : total annoncé et lignes lues', async () => {
    const truncated = REPORT()
    truncated.sections.guet = { ...truncated.sections.guet, declared_total: 45, read_total: 44, total_matches: false }
    const w = await mountPage({ report: truncated })

    expect(find(w, 'total-mismatch').text()).toContain('45 villageois')
    expect(find(w, 'total-mismatch').text()).toContain('44')
  })

  it('seul « Groupe de » alerte (« groupe à surveiller »), tous les membres d\'un groupe sont lus, la milice n\'a aucun pseudo', async () => {
    const w = await mountPage()
    const groups = w.findAll('[data-testid="report-armies-groups"] li[data-alert]')

    expect(w.findAll('[data-testid="group-alert"]')).toHaveLength(1)
    expect(groups[0].text()).toContain('Groupe à surveiller')
    expect(groups[1].text()).toContain('Damonkael')
    expect(groups[1].text()).toContain('Thymotee_bilal')
    expect(groups[2].find('[data-testid="customs-pseudo"]').exists()).toBe(false)
    expect(w.text()).toContain('chef d\'armée')
    expect(w.text()).not.toMatch(/brigand(?!age)/i)
    expect(w.text()).toContain('La mairie est maîtresse du statu quo')
  })

  it('l\'auteur d\'un bilan n\'est jamais nommé, le brut jamais servi', async () => {
    const w = await mountPage()

    expect(w.html()).not.toContain('Le_prevot')
    expect(w.html()).not.toContain('by_me')
    expect(w.html()).not.toContain('"raw"')
  })

  it('un jour sans bilan : le message le dit', async () => {
    const w = await mountPage({ report: null })

    expect(find(w, 'no-report').text()).toContain('Aucun bilan n\'a été inscrit pour Arras')
  })

  it('les chevrons passent d\'un jour à l\'autre et relisent le bilan de ce jour', async () => {
    const w = await mountPage({ days: ['2026-05-26', '2026-05-25'] })
    await find(w, 'older-day').trigger('click')
    await flushPromises()

    expect(reportCalls().at(-1)[1].params).toEqual({ city_id: 1, date: '2026-05-25' })
    expect(find(w, 'today-button').attributes('disabled')).toBeUndefined()
  })
})

describe('Registre de douane — la saisie vit dans le Relevé de guet', () => {
  it('qui peut saisir voit un lien vers le Relevé de guet ; aucun formulaire de collage ici', async () => {
    const w = await mountPage()

    expect(find(w, 'enter-report').exists()).toBe(true)
    expect(find(w, 'enter-report').text()).toContain('Saisir un relevé')
    expect(find(w, 'customs-form').exists()).toBe(false)
    expect(w.find('textarea').exists()).toBe(false)
  })

  it('qui ne fait que lire (le dirigeant) n\'a pas le lien', async () => {
    const w = await mountPage({ access: ACCESS({ write_reports: false, correct_reports: false, role: 'leader', writable_cities: [] }) })

    expect(find(w, 'enter-report').exists()).toBe(false)
  })
})

describe('Registre de douane — listes rouge et verte', () => {
  async function openLists(options) {
    const w = await mountPage(options)
    await find(w, 'lists-open').trigger('click')
    await flushPromises()
    return w
  }

  it('la modale lit les entrées ; « ajouté par » n\'apparaît que si le serveur le sert (le trio)', async () => {
    const w = await openLists()

    expect(find(w, 'lists-entries').text()).toContain('Gregor.')
    expect(find(w, 'lists-entries').text()).toContain('brigandage')
    expect(w.findAll('[data-testid="added-by"]')).toHaveLength(1)
    expect(find(w, 'lists-entries').text()).toContain('ajouté par vous')
    expect(find(w, 'lists-entries').text()).toContain('depuis le 20/05/1474')
  })

  it('ajouter une entrée envoie pseudo, couleur et raison, puis recharge les listes', async () => {
    const w = await openLists()
    await find(w, 'lists-pseudo').setValue('Nouveau_pseudo')
    await find(w, 'lists-colour').setValue('green')
    await find(w, 'lists-reason').setValue('marchand')
    await find(w, 'lists-add').trigger('submit')
    await flushPromises()

    expect(http.post).toHaveBeenCalledWith('characters/7/customs-lists', { pseudo: 'Nouveau_pseudo', colour: 'green', reason: 'marchand' }, expect.anything())
    expect(push.success).toHaveBeenCalledWith('L\'entrée est ajoutée.')
  })

  it('retirer une entrée appelle la suppression', async () => {
    const w = await openLists()
    await w.findAll('[data-testid="lists-remove"]')[0].trigger('click')
    await flushPromises()

    expect(http.delete).toHaveBeenCalledWith('characters/7/customs-lists/1', expect.anything())
  })

  it('le juge n\'ajoute qu\'au rouge, le dit, et ne voit ni modifier ni retirer sur les entrées des autres', async () => {
    const w = await openLists({
      access: ACCESS({ role: 'juge', write_reports: false, read_reports: false, correct_reports: false, write_lists: false, add_red_only: true, writable_cities: [], readable_cities: [] }),
      entries: [{ id: 1, colour: 'red', pseudo: 'Gregor.', reason: null, added_on: '2026-05-20', by_me: false, added_by: null, can_remove: false, can_edit: false }],
    })

    expect(find(w, 'lists-readonly').text()).toContain('Le juge ajoute à la liste rouge')
    expect(w.findAll('[data-testid="lists-colour"] option')).toHaveLength(1)
    expect(find(w, 'lists-remove').exists()).toBe(false)
  })

  it('en lecture seule (procureur) : aucun formulaire d\'ajout, le message dit qui tient les listes', async () => {
    const w = await openLists({ access: ACCESS({ role: 'procureur', write_reports: false, write_lists: false, correct_reports: false }), entries: [] })

    expect(find(w, 'lists-add').exists()).toBe(false)
    expect(find(w, 'lists-readonly').text()).toContain('tenues par le prévôt, le connétable et le capitaine')
    expect(find(w, 'lists-empty').exists()).toBe(true)
  })

  it('un refus du serveur s\'affiche dans la modale', async () => {
    const w = await openLists()
    http.post.mockImplementation(() => refuse(422, { fr: 'Ce pseudo figure déjà.', en: 'Already listed.' }))
    await find(w, 'lists-pseudo').setValue('Gregor.')
    await find(w, 'lists-add').trigger('submit')
    await flushPromises()

    expect(find(w, 'lists-error').text()).toBe('Ce pseudo figure déjà.')
  })
})

describe('Registre de douane — « Confier au scribe »', () => {
  let written
  beforeEach(() => {
    written = null
    Object.defineProperty(globalThis.navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(text => { written = text; return Promise.resolve() }) } })
  })

  it('le bilan affiché part au presse-papiers en BBCode (français fixe, année du jeu), avec un toast', async () => {
    const w = await mountPage({ locale: 'en' })
    await find(w, 'customs-export-button').trigger('click')
    await flushPromises()

    expect(written).toContain('[b][size=20]Bilan de défense du 26/05/1474 — Ville : Arras[/size][/b]')
    expect(written).toContain('Comparé au bilan du 25/05/1474.')
    expect(written).toContain('⚠ [char]Parti[/char]')
    expect(written).not.toContain('Liste des villageois') // le brut n'existe pas côté écran
    expect(push.success).toHaveBeenCalledWith('The report is copied, ready to paste on the forum.')
  })

  it('l\'écran dit qu\'un bilan n\'est jamais public avant d\'exporter ; rien n\'est enregistré', async () => {
    const w = await mountPage()

    expect(find(w, 'export-public-warning').text()).toContain('Un bilan n\'est jamais public')
    expect(find(w, 'export-public-warning').text()).toContain('rien n\'est enregistré')
  })

  it('les options changent le BBCode : la liste complète des habitants sur demande, les marques à retirer', async () => {
    const w = await mountPage()
    await find(w, 'opt-villagers').setValue(true)
    await find(w, 'opt-colours').setValue(false)
    await find(w, 'customs-export-button').trigger('click')
    await flushPromises()

    expect(written).toContain('[char]Emmie....[/char]')
    expect(written).not.toContain('⚠ [char]') // plus de marque devant un pseudo (l'alerte « Groupe à surveiller » reste : ce n'est pas une liste)
    expect(written).not.toContain('✔')
    expect(written).toContain('⚠ Groupe à surveiller')
  })

  it('sans bilan ce jour-là : pas d\'export', async () => {
    const w = await mountPage({ report: null })

    expect(find(w, 'customs-export').exists()).toBe(false)
  })
})
