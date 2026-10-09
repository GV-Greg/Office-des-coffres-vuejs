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

  it('l\'état du parc vient du dernier relevé EN VIGUEUR, avec le constat de seuil', async () => {
    const rows = (await mountPage()).findAll('[data-testid="registry-park"] tbody tr').map(tr => tr.text())
    expect(rows[0]).toContain('#1 Mine d\'or')
    expect(rows[0]).toContain('—')
    expect(rows[1]).toContain('seuil atteint') // 9 / 9 de pierre : atteint dès l'égalité
  })

  it('compte les jours sans relevé depuis l\'entrée en fonction, jusqu\'à hier', async () => {
    // Entrée le 07/05, aujourd'hui le 10/05 : 07, 08, 09 attendus ; seul le 09 est couvert.
    expect((await mountPage()).find('[data-testid="registry-gaps"]').text()).toContain('2 jours sans relevé depuis le 07/05 : 07/05, 08/05')
  })

  it('le prédécesseur se dit comme un fait : qui a écrit, quand — jamais « votre prédécesseur était »', async () => {
    const text = (await mountPage()).find('[data-testid="registry-predecessor"]').text()
    expect(text).toContain('3 relevés de Brunehaut (Bailli), du 20/04 au 02/05.')
    expect(text).toContain('Le registre sait qui a écrit, pas qui occupait le poste.')
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
