import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import SecurityProvince from '../../src/views/modules/security/SecurityProvince.vue'
import { useAuthStore } from '../../src/stores/authStore'
import { http } from '../../src/api.js'

/*
  Vue d'ensemble de la province (PR 5 ; fil admin/echanges/module-securite 18 et 19) : LECTURE SEULE. Le serveur agrège et dit qui la voit (au moins
  deux villes lisibles) ; l'écran affiche la couverture de chaque ville et, fusionnés, les pseudos des listes, les groupes à surveiller et les armées,
  chaque ligne datée de son jour de bilan. Aucune règle côté site, rien n'est gardé dans le navigateur.
*/
vi.mock('../../src/api.js', () => ({ http: { get: vi.fn() } }))

const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const fr = JSON.parse(readFileSync(resolve(localesDir, 'fr.json'), 'utf-8'))
const en = JSON.parse(readFileSync(resolve(localesDir, 'en.json'), 'utf-8'))

const CITIES = [{ id: 1, name: 'Arras' }, { id: 2, name: 'Béthune' }, { id: 3, name: 'Lens' }]
const ACCESS = (over = {}) => ({ province: { id: 3, name: 'Artois' }, role: 'prevot_des_marechaux', has_security_trio: true, today: '2026-05-26', readable_cities: CITIES, ...over })
const nulls = { guet_day: null, inhabitants: null, arrivals: null, departures: null, compared_to: null }
const PROVINCE = () => ({
  success: true,
  province: { id: 3, name: 'Artois' },
  today: '2026-05-26',
  cities: [
    { id: 1, name: 'Arras', last_report_day: '2026-05-25', guet_day: '2026-05-25', inhabitants: 3, arrivals: 1, departures: 0, compared_to: '2026-05-24' },
    { id: 2, name: 'Béthune', last_report_day: '2026-05-23', ...nulls },
    { id: 3, name: 'Lens', last_report_day: null, ...nulls },
  ],
  marks: [
    { pseudo: 'Gregor.', colour: 'red', as: 'villager', city: { id: 1, name: 'Arras' }, day: '2026-05-25' },
    { pseudo: 'Gregor.', colour: 'red', as: 'vision', city: { id: 2, name: 'Béthune' }, day: '2026-05-23' },
    { pseudo: 'Artifice', colour: 'green', as: 'group_member', city: { id: 1, name: 'Arras' }, day: '2026-05-25' },
  ],
  groups_to_watch: [{ type: 'groupe', members: [{ pseudo: 'Sefrian', colour: 'red' }], city: { id: 1, name: 'Arras' }, day: '2026-05-25' }],
  armies: [{ name: 'Legio', commander: { pseudo: 'Lucas_', colour: null }, city: { id: 1, name: 'Arras' }, day: '2026-05-25' }],
})

const ok = data => Promise.resolve({ data })
const refuse = (status, messages) => Promise.reject({ response: { status, data: { success: false, message: messages.fr, code: 'province_not_readable', messages } } })

async function mountPage({ access = ACCESS(), province = PROVINCE(), locale = 'fr', loggedIn = true } = {}) {
  setActivePinia(createPinia())
  if (loggedIn) useAuthStore().$patch({ user: { characters: [{ id: 7, pseudo: 'Artifice' }] }, token: 'jeton' })
  http.get.mockImplementation((url) => {
    if (url.endsWith('customs-access')) return ok({ success: true, access })
    if (url.endsWith('customs-province')) return typeof province === 'function' ? province() : ok(province)
    return ok({})
  })
  const wrapper = mount(SecurityProvince, {
    global: {
      plugins: [createI18n({ legacy: false, locale, messages: { fr, en } })],
      stubs: { RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' }, 'v-icon': true },
    },
  })
  await flushPromises()
  return wrapper
}
const find = (w, id) => w.find(`[data-testid="${id}"]`)
const provinceCalls = () => http.get.mock.calls.filter(([url]) => url.endsWith('customs-province'))

beforeEach(() => vi.clearAllMocks())

describe('Vue de la province — qui la voit', () => {
  it('avec au moins deux villes lisibles, la vue s\'ouvre et demande l\'agrégat du personnage actif', async () => {
    const w = await mountPage()

    expect(provinceCalls()).toHaveLength(1)
    expect(provinceCalls()[0][0]).toBe('characters/7/customs-province')
    expect(find(w, 'province-title').text()).toBe('Vue de la province')
    expect(find(w, 'province-select').text()).toBe('Artois')
  })

  it('avec UNE seule ville lisible (ou aucun rôle) : le cadenas, et aucun appel à la vue', async () => {
    const one = await mountPage({ access: ACCESS({ readable_cities: [CITIES[0]] }) })
    expect(find(one, 'province-denied').text()).toContain('aucun rôle qui lise les bilans de plusieurs villes')
    expect(provinceCalls()).toHaveLength(0)

    expect(find(await mountPage({ access: null }), 'province-denied').exists()).toBe(true)
  })

  it('un refus du serveur s\'affiche tel quel, dans la langue de l\'interface', async () => {
    const province = () => refuse(403, { fr: 'Refusé par l\'Office.', en: 'Refused by the Office.' })

    expect(find(await mountPage({ province }), 'province-error').text()).toBe('Refusé par l\'Office.')
    expect(find(await mountPage({ province, locale: 'en' }), 'province-error').text()).toBe('Refused by the Office.')
  })
})

describe('Vue de la province — la couverture', () => {
  it('une ligne par ville : l\'âge du dernier bilan (orange gras dès deux jours), les comptes, et « Aucun bilan » pour une ville sans bilan', async () => {
    const w = await mountPage()
    const row = id => find(w, `province-city-${id}`)

    expect(row(1).find('[data-testid="province-age"]').text()).toBe('hier')
    expect(row(1).find('[data-testid="province-age"]').classes()).not.toContain('font-bold')
    expect(row(2).find('[data-testid="province-age"]').text()).toBe('il y a 3 jours')
    expect(row(2).find('[data-testid="province-age"]').classes()).toContain('font-bold')
    expect(row(3).find('[data-testid="province-age"]').text()).toBe('Aucun bilan')
  })

  it('arrivées et départs : des comptes par ville, « — » sans bilan antérieur, jamais cumulés entre villes', async () => {
    const w = await mountPage()
    const moves = id => find(w, `province-city-${id}`).find('[data-testid="province-moves"]')

    expect(moves(1).text()).toBe('+1 / −0')
    expect(moves(1).attributes('title')).toBe('Comparé au bilan du 24/05/1474')
    expect(moves(2).text()).toBe('—')
    expect(moves(3).text()).toBe('—')
  })

  it('▸ ouvre le bilan DE LA VILLE, au jour de son dernier bilan, dans le Registre de douane ; pas de lien sans bilan', async () => {
    const w = await mountPage()
    const link = id => find(w, `province-city-${id}`).find('[data-testid="province-open"]')

    expect(JSON.parse(link(1).attributes('data-to'))).toEqual({ name: 'security-customs', query: { city: 1, day: '2026-05-25' } })
    expect(JSON.parse(link(2).attributes('data-to'))).toEqual({ name: 'security-customs', query: { city: 2, day: '2026-05-23' } })
    expect(link(3).exists()).toBe(false)
  })

  it('le jour du jeu vient du serveur (`today`), pas de l\'horloge du navigateur', async () => {
    const province = PROVINCE()
    province.today = '2026-05-30'
    const w = await mountPage({ province })

    expect(find(w, 'province-city-1').find('[data-testid="province-age"]').text()).toBe('il y a 5 jours')
  })
})

describe('Vue de la province — les pseudos des listes', () => {
  it('chaque ligne dit le pseudo, comment il a été vu, la ville et le jour du bilan ; le sens passe par le texte, pas la couleur seule', async () => {
    const w = await mountPage()
    const rows = find(w, 'province-marks-list').findAll('li').map(li => li.text())

    expect(rows).toHaveLength(3)
    expect(rows[0]).toContain('Gregor.')
    expect(rows[0]).toContain('liste rouge') // le texte lisible sans couleur (CustomsPseudo)
    expect(rows[0]).toContain('habitant · Arras')
    expect(rows[0]).toContain('25/05/1474')
    expect(rows[1]).toContain('croisé en chemin · Béthune')
    expect(rows[1]).toContain('23/05/1474')
    expect(rows[2]).toContain('liste verte')
    expect(rows[2]).toContain('membre d\'un groupe · Arras')
  })

  it('un pseudo vu dans deux villes apparaît DEUX fois, chacune avec son jour : on ne dit jamais qu\'il s\'est déplacé', async () => {
    const w = await mountPage()
    const gregor = find(w, 'province-marks-list').findAll('li').filter(li => li.text().includes('Gregor.'))

    expect(gregor).toHaveLength(2)
    expect(w.text()).not.toMatch(/déplac|est passé|vient de/i)
  })

  it('les filtres par liste et par ville ne changent que la présentation, et le compte suit', async () => {
    const w = await mountPage()
    expect(find(w, 'province-marks-count').text()).toBe('3 lignes')

    await find(w, 'province-filter-colour').setValue('green')
    expect(find(w, 'province-marks-count').text()).toBe('1 ligne')

    await find(w, 'province-filter-colour').setValue('')
    await find(w, 'province-filter-city').setValue('2')
    expect(find(w, 'province-marks-list').findAll('li')).toHaveLength(1)
    expect(find(w, 'province-marks-list').text()).toContain('Béthune')
    expect(provinceCalls()).toHaveLength(1) // aucun nouvel appel : le serveur a tout dit
  })

  it('aucune marque : une phrase, pas un tableau vide', async () => {
    const province = PROVINCE()
    province.marks = []
    const w = await mountPage({ province })

    expect(find(w, 'province-marks').text()).toContain('Aucun pseudo des listes dans les bilans.')
    expect(find(w, 'province-marks-list').exists()).toBe(false)
  })
})

describe('Vue de la province — groupes à surveiller et armées', () => {
  it('un groupe à surveiller : son type, ses membres avec leur couleur, la ville et le jour ; la carte passe à l\'alerte', async () => {
    const w = await mountPage()
    const card = find(w, 'province-watch')

    expect(card.attributes('data-tone')).toBe('alert')
    expect(card.text()).toContain('Groupe')
    expect(card.text()).toContain('Sefrian')
    expect(card.text()).toContain('Arras · 25/05/1474')
  })

  it('sans groupe à surveiller : une carte sobre qui le dit', async () => {
    const province = PROVINCE()
    province.groups_to_watch = []
    const w = await mountPage({ province })

    expect(find(w, 'province-watch').attributes('data-tone')).toBe('muted')
    expect(find(w, 'province-watch').text()).toContain('Aucun groupe à surveiller.')
  })

  it('les armées : le nom, le chef, la ville et le jour du bilan ; « Aucune armée. » s\'il n\'y en a pas', async () => {
    const w = await mountPage()
    expect(find(w, 'province-armies').text()).toContain('Legio')
    expect(find(w, 'province-armies').text()).toContain('Lucas_')
    expect(find(w, 'province-armies').text()).toContain('Arras · 25/05/1474')

    const none = PROVINCE()
    none.armies = []
    expect(find(await mountPage({ province: none }), 'province-armies').text()).toContain('Aucune armée.')
  })
})

describe('Vue de la province — lecture seule, rien n\'est gardé', () => {
  it('aucun bouton d\'écriture, aucun champ de collage, aucun stockage local', async () => {
    const write = vi.spyOn(Storage.prototype, 'setItem')
    const w = await mountPage()

    expect(w.find('textarea').exists()).toBe(false)
    expect(w.findAll('button')).toHaveLength(0)
    expect(write).not.toHaveBeenCalled()
    write.mockRestore()
  })

  it('en anglais', async () => {
    const w = await mountPage({ locale: 'en' })

    expect(find(w, 'province-title').text()).toBe('Province overview')
    expect(find(w, 'province-city-1').find('[data-testid="province-age"]').text()).toBe('yesterday')
    expect(find(w, 'province-city-2').find('[data-testid="province-age"]').text()).toBe('3 days ago')
    expect(find(w, 'province-marks-list').text()).toContain('inhabitant · Arras')
  })
})
