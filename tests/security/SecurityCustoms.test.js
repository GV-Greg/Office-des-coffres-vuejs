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

function serve({ access = ACCESS(), report = REPORT(), days = ['2026-05-26', '2026-05-25'], entries = ENTRIES(), onReport = null } = {}) {
  http.get.mockImplementation((url) => {
    if (url.endsWith('customs-access')) return ok({ success: true, access })
    if (url.endsWith('customs-reports')) return onReport ? onReport() : ok({ success: true, days, report })
    if (url.endsWith('customs-lists')) return ok({ success: true, entries })
    return ok({})
  })
  http.post.mockImplementation(() => ok({ success: true, mode: 'created', id: 9 }))
  http.put.mockImplementation(() => ok({ success: true }))
  http.delete.mockImplementation(() => ok({ success: true }))
}

async function mountPage({ locale = 'fr', characterCity = null, props = {}, ...options } = {}) {
  setActivePinia(createPinia())
  useAuthStore().$patch({ user: { characters: [{ id: 7, pseudo: 'Artifice', city_id: characterCity }] }, token: 'jeton' })
  serve(options)
  const i18n = createI18n({ legacy: false, locale, messages: { fr, en } })
  const wrapper = mount(SecurityCustoms, { props, global: { plugins: [i18n], stubs: { RouterLink: { template: '<a><slot /></a>' }, 'v-icon': true } } })
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

    expect(find(w, 'customs-title').text()).toBe('Registre de douane') // plus la province dans le titre
    expect(find(w, 'province-select').text()).toBe('Artois') // elle précède la ville, avec le même rendu
    expect(find(w, 'province-select').element.disabled).toBe(true)
    expect(w.findAll('[data-testid="city-select"] option').map(o => o.text())).toEqual(['Arras', 'Béthune'])
    expect(reportCalls()[0][1].params).toEqual({ city_id: 1, date: '2026-05-26' })
    expect(find(w, 'no-trio-button').exists()).toBe(false)
  })

  it('la ville proposée est celle du personnage ; à défaut, la première lisible', async () => {
    expect(find(await mountPage({ access: ACCESS(), characterCity: 2 }), 'city-select').element.value).toBe('2')
    expect(find(await mountPage({ access: ACCESS(), characterCity: 99 }), 'city-select').element.value).toBe('1')
  })

  it('sans trio connu, l\'écran le dit : c\'est l\'état courant d\'une province', async () => {
    const w = await mountPage({ access: ACCESS({ has_security_trio: false, role: 'customs', correct_reports: false }) })

    expect(find(w, 'no-trio-button').exists()).toBe(true) // un « i » à côté du titre, plus d'encart orange
    expect(find(w, 'no-trio').exists()).toBe(false) // le texte est téléporté au <body>
    expect(document.body.querySelector('[data-testid="no-trio"]').textContent).toContain('Aucun membre de la sécurité')
  })

  it('en anglais', async () => {
    const w = await mountPage({ locale: 'en' })

    expect(find(w, 'customs-title').text()).toBe('Customs Register')
    expect(find(w, 'province-select').text()).toBe('Artois')
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

    expect(find(w, 'no-report').text()).toContain('Aucun bilan inscrit pour Arras')
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
  it('aucun formulaire de collage ni bouton « Saisir un relevé » ici (le menu mène au Relevé de guet)', async () => {
    const w = await mountPage()

    expect(find(w, 'enter-report').exists()).toBe(false)
    expect(find(w, 'customs-form').exists()).toBe(false)
    expect(w.find('textarea').exists()).toBe(false)
  })
})

describe('Registre de douane — listes rouge et verte', () => {
  async function openLists(options) {
    const w = await mountPage(options)
    await find(w, 'lists-open').trigger('click')
    await flushPromises()
    return w
  }

  it('même design que les modales d\'information (HelpModal) : fond sombre en thème sombre, filet, barre dégradée, titre avec le parchemin, textes par thème', async () => {
    const w = await openLists()
    const panel = find(w, 'lists-modal').find('[role="dialog"]')

    expect(panel.classes()).toEqual(expect.arrayContaining(['bg-white', 'dark:bg-slate-800', 'border-slate-200', 'dark:border-slate-700', 'rounded-2xl', 'shadow-2xl']))
    expect(panel.find('.bg-gradient-to-r').exists()).toBe(true) // la barre orange → rouge du haut
    expect(panel.find('h3 v-icon-stub').attributes('name')).toBe('gi-scroll-unfurled')
    expect(panel.find('h3').classes()).toContain('dark:text-slate-100')
    // aucun texte ne reste « sombre sur sombre » : les textes de la modale ont leur variante pour le thème sombre
    expect(panel.html()).not.toMatch(/dark:text-slate-800/)
  })

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

describe('Registre de douane — la mise en page du bilan (passe de design, 23/11/2026)', () => {
  it('une ligne de synthèse : seuls les pseudos marqués et les groupes à surveiller prennent une couleur', async () => {
    const w = await mountPage()
    const chips = w.findAll('[data-testid="report-summary"] li').map(li => ({ text: li.text(), tone: li.attributes('data-tone') }))

    expect(chips.find(c => c.tone === 'red').text).toBe('1 sur liste rouge')
    expect(chips.find(c => c.tone === 'green').text).toBe('1 sur liste verte')
    expect(chips.find(c => c.tone === 'alert').text).toBe('1 groupe à surveiller')
    // les autres badges ont chacun leur teinte (bleu, sarcelle, violet, rose) ; rouge, vert et orange gardent leur sens de marque et d'alerte
    expect(chips.filter(c => ['blue', 'teal', 'violet', 'rose'].includes(c.tone)).map(c => `${c.tone}: ${c.text}`)).toEqual(['blue: 3 habitants', 'teal: 1 arrivée', 'violet: 1 départ', 'rose: 3 groupes'])
  })

  it('aucune marque ni groupe à surveiller : aucun badge rouge, vert ni orange', async () => {
    const calm = REPORT()
    calm.sections.guet.villagers.forEach(v => { v.colour = null })
    calm.sections.armies_groups.groups.forEach(g => { g.alert = false })
    const w = await mountPage({ report: calm })

    expect(w.findAll('[data-testid="report-summary"] li').every(li => !['red', 'green', 'alert'].includes(li.attributes('data-tone')))).toBe(true)
  })

  it('une section non inscrite se VOIT : une carte grisée dit « Non inscrit » (visions, armées, groupes, zone)', async () => {
    const onlyGuet = REPORT()
    delete onlyGuet.sections.visions
    delete onlyGuet.sections.armies_groups
    const w = await mountPage({ report: onlyGuet })
    const muted = w.findAll('[data-tone="muted"]').map(c => c.text())

    expect(muted).toHaveLength(4)
    expect(muted.every(text => text.includes('Non inscrit'))).toBe(true)
    expect(find(w, 'report-guet').exists()).toBe(true) // le guet, lui, est inscrit
  })

  it('le détail d\'un groupe (« Fermé », « Admission libre ») n\'est plus montré', async () => {
    const w = await mountPage()

    expect(find(w, 'report-armies-groups').text()).not.toContain('Admission libre')
    expect(find(w, 'report-armies-groups').text()).not.toContain('Fermé')
  })

  it('au plus trois groupes : listés directement, sans dépliant', async () => {
    const w = await mountPage()

    expect(find(w, 'report-armies-groups').find('details').exists()).toBe(false)
    expect(find(w, 'report-armies-groups').findAll('li[data-alert]')).toHaveLength(3)
  })

  it('plus de trois groupes : seuls les groupes à surveiller restent visibles, les autres sont dans « Voir tous les groupes », comme les habitants', async () => {
    const many = REPORT()
    many.sections.armies_groups.groups = [
      { type: 'groupe', alert: true, members: [{ pseudo: 'Sefrian', colour: null }], status: '' },
      ...['Aldric', 'Brune', 'Cyrille', 'Doran'].map(pseudo => ({ type: 'lance', alert: false, members: [{ pseudo, colour: null }], status: '' })),
    ]
    const w = await mountPage({ report: many })
    const card = find(w, 'report-armies-groups')

    expect(card.find('details summary').text()).toBe('Voir tous les groupes (5)')
    expect(card.find('details').findAll('li[data-alert]')).toHaveLength(5)
    const visible = card.findAll('li[data-alert]').filter(li => !li.element.closest('details'))
    expect(visible).toHaveLength(1)
    expect(visible[0].attributes('data-alert')).toBe('true')
  })

  it('armées et contrôle de la zone sont sous les groupes, dans la même colonne', async () => {
    const w = await mountPage()
    const column = find(w, 'report-armies-groups').element.parentElement

    expect(column.contains(find(w, 'report-armies').element)).toBe(true)
    expect(column.contains(find(w, 'report-zone').element)).toBe(true)
    expect(find(w, 'report-guet').element.parentElement).not.toBe(column)
  })

  it('la carte des groupes passe à l\'alerte (liseré orange) quand un groupe est à surveiller', async () => {
    const w = await mountPage()

    expect(find(w, 'report-armies-groups').attributes('data-tone')).toBe('alert')
  })
})

describe('Registre de douane — le chargement au changement de ville ou de jour', () => {
  it('changer de jour : le petit loader de composant du Bilan des mines (le cadenas, aux couleurs de la Sécurité, aligné en haut) garde la place du bilan, plus un simple « Chargement… »', async () => {
    let release
    let calls = 0
    const onReport = () => (++calls === 1 ? ok({ success: true, days: ['2026-05-26', '2026-05-25'], report: REPORT() }) : new Promise((resolve) => { release = () => resolve({ data: { success: true, days: [], report: null } }) }))
    const w = await mountPage({ onReport })
    expect(find(w, 'access-loader').exists()).toBe(false)

    await find(w, 'older-day').trigger('click')
    const loader = find(w, 'access-loader')
    expect(loader.exists()).toBe(true)
    expect(loader.classes()).toContain('justify-start')
    expect(loader.find('v-icon-stub').attributes('name')).toBe('gi-padlock')
    expect(loader.find('v-icon-stub').classes()).toContain('text-rose-700')
    expect(find(w, 'customs-report').exists()).toBe(false) // l'ancien bilan n'est pas montré pendant l'attente
    expect(w.text()).not.toMatch(/Chargement…|Loading…/)

    release()
    await flushPromises()
    expect(find(w, 'access-loader').exists()).toBe(false)
  })
})

describe('Registre de douane — ouvert depuis la vue de la province (`?city=&day=`)', () => {
  it('la ville et le jour demandés sont préselectionnés, et le bilan de ce jour-là est lu', async () => {
    const w = await mountPage({ props: { initialCity: 2, initialDay: '2026-05-25' } })

    expect(find(w, 'city-select').element.value).toBe('2')
    expect(find(w, 'day-select').element.value).toBe('2026-05-25')
    expect(reportCalls()[0][1].params).toEqual({ city_id: 2, date: '2026-05-25' })
  })

  it('une ville que le serveur ne dit pas lisible, un jour mal formé ou futur : ignorés, on retombe sur la ville du personnage et le jour du jeu', async () => {
    const w = await mountPage({ props: { initialCity: 99, initialDay: 'demain' } })
    expect(find(w, 'city-select').element.value).toBe('1')
    expect(find(w, 'day-select').element.value).toBe('2026-05-26')

    const future = await mountPage({ props: { initialCity: 1, initialDay: '2026-06-30' } })
    expect(find(future, 'day-select').element.value).toBe('2026-05-26')
  })
})

describe('Registre de douane — pas d\'export ici (Greg, 23/11/2026)', () => {
  it('le Registre se LIT : « Confier au scribe » vit dans le Relevé de guet', async () => {
    const w = await mountPage()

    expect(find(w, 'customs-export').exists()).toBe(false)
    expect(find(w, 'customs-export-button').exists()).toBe(false)
    expect(w.text()).not.toContain('Confier au scribe')
  })
})
