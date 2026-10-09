import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { reactive } from 'vue'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import EconomyRegistry from '../../src/views/modules/economy/EconomyRegistry.vue'
import { http } from '../../src/api.js'

// Registre des mines — page de lecture (PR 4b ; brief §7 ; fil registre-mines R4). Le serveur sert les
// faits ; la page les affiche et les lit avec le parseur. Le prédécesseur se dit comme un fait.

vi.mock('../../src/api.js', () => ({ http: { get: vi.fn() } }))
const auth = reactive({ isLoggedIn: true, activeCharacter: { id: 7, pseudo: 'Artifice' }, getToken: 'jeton' })
vi.mock('../../src/stores/authStore', () => ({ useAuthStore: () => auth }))

const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const readLocale = (lang) => JSON.parse(fs.readFileSync(path.join(localesDir, `${lang}.json`), 'utf8'))
const fr = readLocale('fr')
const en = readLocale('en')

const author = (pseudo, key = 'commissaire_mines', label = ['Commissaire aux mines', 'Mines Superintendent']) =>
  ({ pseudo, office_key: key, office_label: { fr: label[0], en: label[1] } })

const report = (overrides = {}) => ({
  id: 1, reported_at: '2026-05-09', active: true, replaced_by_id: null, author: author('Artifice'),
  report: { mines: [], states: [
    { number: 1, label: "Mine d'or", noeud: '236', niveau: '10', seuilRupture: '24 qtx de pierre et 18 kg de fer', entretienNormal: '13 qtx de pierre et 10 kg de fer' },
    { number: 4, label: 'Mine de fer', noeud: '226', niveau: '9', seuilRupture: '9 qtx de pierre et 7 kg de fer', entretienNormal: '9 qtx de pierre et 3 kg de fer' },
  ] },
  ...overrides,
})

const registry = (overrides = {}) => ({
  success: true, province: { id: 1, name: 'Franche-Comté' }, today: '2026-05-10',
  mandate: { in_office_from: '2026-05-07', mid_at: '2026-06-06', end_at: '2026-07-06' },
  predecessor: [{ ...author('Brunehaut', 'bailli', ['Bailli', 'Sheriff']), first: '2026-04-20', last: '2026-05-02', count: 3 }],
  reports: [report(), report({ id: 2, active: false, replaced_by_id: 1, author: author('Brunehaut', 'bailli', ['Bailli', 'Sheriff']) })],
  ...overrides,
})

// Un relevé porte des données pour les jours donnés (une mine, des heures).
const withDays = (r, days) => ({ ...r, report: { ...r.report, mines: [{ number: 1, noeud: '236', days: Object.fromEntries(days.map(d => [d, { heures: 5 }])) }] } })

async function mountPage({ locale = 'fr', data = registry(), reject = null } = {}) {
  reject ? http.get.mockRejectedValue(reject) : http.get.mockResolvedValue({ data })
  const i18n = createI18n({ legacy: false, locale, messages: { fr, en } })
  const wrapper = mount(EconomyRegistry, { global: { plugins: [i18n], stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.activeCharacter = { id: 7, pseudo: 'Artifice' }
})

describe('EconomyRegistry', () => {
  it('lit le registre du personnage actif et dit l\'âge du dernier relevé', async () => {
    const wrapper = await mountPage()
    expect(http.get).toHaveBeenCalledWith('characters/7/mine-registry/reports', { headers: { Authorization: 'Bearer jeton' } })
    expect(wrapper.find('h2').text()).toBe('Registre de Franche-Comté')
    expect(wrapper.find('[data-testid="registry-age"]').text()).toBe('Dernier relevé : hier, le 09/05.')
  })

  it('en tête : le bilan EN COURS du mois de mandat, provisoire, niveau compris (Greg, 09/10)', async () => {
    const days = { '2026-05-07': { production: 10, pierre: 1 }, '2026-05-08': { heures: 50 } }
    const withBilan = report({
      prices: { FER: 20, PIERRE: 15 }, rate: 0.5,
      report: { mines: [{ number: 4, noeud: '226', label: 'Mine de fer', resource: 'FER', days }], states: [{ number: 4, noeud: '226', label: 'Mine de fer', niveau: '9' }] },
    })
    const wrapper = await mountPage({ data: registry({ reports: [withBilan] }) })
    const section = wrapper.find('[data-testid="registry-current"]')

    expect(section.find('h3').text()).toBe('Bilan en cours — 1er mois de votre mandat, du 07/05 au 09/05 (provisoire)')
    const cells = section.findAll('tbody tr')[0].findAll('td').map(td => td.text())
    expect(cells).toEqual(['#4 Mine de fer', '9', '10 kg', '200', '50', '25', '15', '160'])
    expect(section.find('[data-testid="registry-current-total"]').text()).toContain('+160 écus')
    expect(section.text()).toContain('Un jour couvert sur 3')
  })


  it('compte les jours SANS DONNÉES depuis l\'entrée en fonction, jusqu\'à hier', async () => {
    // Entrée le 07/05, aujourd'hui le 10/05 : 07, 08, 09 attendus ; les relevés par défaut ne portent aucune donnée de jour.
    // Jours qui se suivent : une période « du … au … » (Greg, 09/10).
    expect((await mountPage()).find('[data-testid="registry-gaps"]').text()).toContain('3 jours sans données depuis le 07/05 : du 07/05 au 09/05')
  })

  it('un jour isolé reste seul, une suite de jours devient une période', async () => {
    // Entrée le 01/05, aujourd'hui le 10/05 ; relevés les 04/05 et 09/05 → 01–03, 05–08 sans relevé.
    const wrapper = await mountPage({ data: registry({
      mandate: { in_office_from: '2026-05-01', mid_at: '2026-05-31', end_at: '2026-06-30' },
      reports: [withDays(report(), ['2026-05-09']), withDays(report({ id: 7, reported_at: '2026-05-04' }), ['2026-05-04']), withDays(report({ id: 8, reported_at: '2026-05-06' }), ['2026-05-06'])],
    }) })
    expect(wrapper.find('[data-testid="registry-gaps"]').text()).toContain('du 01/05 au 03/05, 05/05, du 07/05 au 08/05')
  })

  it('le prédécesseur se dit comme un fait : qui a écrit, quand — jamais « votre prédécesseur était »', async () => {
    const text = (await mountPage()).find('[data-testid="registry-predecessor"]').text()
    expect(text).toContain('3 relevés de Brunehaut (Bailli), du 20/04 au 02/05.')
    expect(text).not.toMatch(/prédécesseur était/i)
  })

  it('l\'historique garde les relevés remplacés, marqués comme tels', async () => {
    const items = (await mountPage()).findAll('[data-testid="registry-history"] li').map(li => li.text())
    expect(items).toEqual(['09/05 — Artifice (Commissaire aux mines)', '09/05 — Brunehaut (Bailli) remplacé'])
  })

  it('sans aucun relevé : le dit, et renvoie au Bilan pour inscrire le premier', async () => {
    const wrapper = await mountPage({ data: registry({ reports: [], predecessor: [] }) })
    expect(wrapper.find('[data-testid="registry-age"]').text()).toContain('Aucun relevé inscrit pour l\'instant')
    expect(wrapper.find('[data-testid="registry-park"]').exists()).toBe(false)
  })

  it('avant la mi-mandat, le bilan dit « dans N jours » — jamais un bilan partiel', async () => {
    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="registry-bilan-mid"]').text()).toBe('Bilan de mi-mandat : disponible le 06/06, dans 27 jours.')
    expect(wrapper.find('[data-testid="registry-bilan-end"]').text()).toContain('dans 57 jours')
  })

  it('un −1 sans entretien après un seuil atteint s\'écrit comme un constat daté', async () => {
    const earlier = report({ id: 3, reported_at: '2026-05-07', report: { mines: [], states: [
      { number: 4, label: 'Mine de fer', noeud: '226', niveau: '10', seuilRupture: '9 qtx de pierre et 7 kg de fer', entretienNormal: '9 qtx de pierre et 3 kg de fer' },
    ] } })
    const wrapper = await mountPage({ data: registry({ reports: [report(), earlier] }) })
    expect(wrapper.find('[data-testid="level-failure"]').text())
      .toBe('Le 09/05 : niveau 10 → 9. Aucun entretien relevé depuis le 07/05, alors que le seuil était atteint ce jour-là.')
  })

  it('un refus de l\'API (pas de poste de lecture) s\'affiche tel quel, dans la langue de l\'interface', async () => {
    const wrapper = await mountPage({ locale: 'en', reject: Object.assign(new Error('403'), { response: { status: 403, data: {
      code: 'mine_not_reader', messages: { fr: 'Seuls le commissaire…', en: 'Only the province\'s Mines Superintendent…' },
    } } }) })
    expect(wrapper.find('[data-testid="registry-error"]').text()).toBe('Only the province\'s Mines Superintendent…')
  })
})
