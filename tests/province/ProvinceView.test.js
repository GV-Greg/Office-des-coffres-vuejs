import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ProvinceView from '../../src/views/ProvinceView.vue'
import { provinceHistoryToBBcode } from '../../src/modules/provinceBBcode'
import { http } from '../../src/api.js'

// « Ma province » (fil admin/echanges/mandats-historique). Locales lues sur disque : un import
// de src/locales/*.json rend des messages précompilés.
vi.mock('notivue', () => ({ push: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../src/api.js', () => ({ http: { get: vi.fn() } }))

const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const fr = JSON.parse(fs.readFileSync(path.join(localesDir, 'fr.json'), 'utf8'))
const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'))

const label = (fr, en) => ({ fr, en })
const HISTORY = {
  success: true,
  province: { id: 10, name: 'Franche-Comté', kingdom: 'SERG' },
  offices: [
    { key: 'juge', label: label('Juge', 'Judge'), holders: [
      { pseudo: 'Artifice', started_at: '2026-05-03T10:00:00+00:00', ended_at: '2026-05-10T10:00:00+00:00', ongoing: false,
        end_reason: 'reattribue', end_reason_label: label('Poste réattribué par le dirigeant de la province.', 'Office reassigned by the leader of the province.') },
      { pseudo: 'Buldo', started_at: '2026-05-10T10:00:00+00:00', ended_at: '2026-07-01T22:00:00+00:00', ongoing: true, end_reason: null, end_reason_label: null },
    ] },
    { key: 'capitaine', label: label('Capitaine', 'Captain'), holders: [] },
  ],
  mayors: [{ city: { id: 100, name: 'Dole' }, holders: [
    { pseudo: 'Céleste', started_at: '2026-04-01T22:00:00+00:00', ended_at: '2026-05-01T22:00:00+00:00', ongoing: false,
      end_reason: 'retranchement', end_reason_label: label('Retranchement.', 'Retranchement.') },
  ] }],
  cities_without_mandate: ['Besançon', 'Vesoul'],
}

function mountView({ locale = 'fr' } = {}) {
  const i18n = createI18n({ legacy: false, locale, messages: { fr, en } })
  return mount(ProvinceView, {
    global: {
      plugins: [i18n, createTestingPinia({ createSpy: vi.fn, initialState: {} , stubActions: false })],
      stubs: { 'v-icon': true, RouterLink: { template: '<a><slot /></a>' } },
    },
  })
}

async function mountWithStore(options = {}, response = HISTORY) {
  http.get.mockResolvedValue({ data: response })
  const wrapper = mountView(options)
  const { useAuthStore } = await import('../../src/stores/authStore')
  const store = useAuthStore()
  const characters = options.characters ?? [{ id: 7, pseudo: 'Artifice' }]
  store.$patch({ user: { characters }, token: 'jeton' })
  await flushPromises()
  return wrapper
}

beforeEach(() => vi.clearAllMocks())

describe('« Ma province »', () => {
  it('l\'avertissement est en tête, avant tout historique', async () => {
    const wrapper = await mountWithStore()
    const html = wrapper.html()
    expect(wrapper.find('[data-testid="province-warning"]').text()).toBe(fr.Province.Warning)
    expect(html.indexOf('province-warning')).toBeLessThan(html.indexOf('province-office'))
  })

  it('charge la province du personnage actif et montre le conseil par titre, dates en 1474', async () => {
    const wrapper = await mountWithStore()

    expect(http.get).toHaveBeenCalledWith('characters/7/province', expect.anything())
    expect(wrapper.text()).toContain('Ma province : Franche-Comté')
    const holders = wrapper.findAll('[data-testid="province-holder"]').map(li => li.text())
    expect(holders[0]).toContain('du 03/05/1474 au 10/05/1474')
    expect(holders[0]).toContain('Poste réattribué')
    expect(holders[1]).toContain('depuis le 10/05/1474')
    // Les titres sans détenteur ne font pas une carte vide : ils sont nommés en une ligne.
    expect(wrapper.findAll('[data-testid="province-office"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Aucun détenteur déclaré : Capitaine.')
  })

  it('les villes sans mandat sont comptées, jamais masquées', async () => {
    const wrapper = await mountWithStore()
    expect(wrapper.find('[data-testid="province-cities-without"]').text()).toContain('2 villes sans mandat déclaré')
    expect(wrapper.find('[data-testid="province-cities-without"]').text()).toContain('Besançon, Vesoul')
  })

  it('sans personnage : renvoie vers l\'ajout d\'un personnage, sans appel à l\'API', async () => {
    const wrapper = await mountWithStore({ characters: [] })
    expect(wrapper.find('[data-testid="province-no-character"]').exists()).toBe(true)
    expect(http.get).not.toHaveBeenCalled()
  })

  it('résidence inconnue : dit ce qui manque', async () => {
    const wrapper = await mountWithStore({}, { success: true, province: null })
    expect(wrapper.find('[data-testid="province-no-residence"]').text()).toContain(fr.Province.NoResidence)
  })

  it('en anglais, les libellés suivent la langue', async () => {
    const wrapper = await mountWithStore({ locale: 'en' })
    expect(wrapper.text()).toContain('My province: Franche-Comté')
    expect(wrapper.text()).toContain('Judge')
  })
})

describe('export forum', () => {
  it('BBcode en français fixe, dates en année du jeu, cause de chaque fin', () => {
    const bb = provinceHistoryToBBcode(HISTORY)
    expect(bb).toContain('[b]Office des coffres — Historique des postes : Franche-Comté[/b]')
    expect(bb).toContain('[b]Juge[/b]')
    expect(bb).toContain('[*]Artifice : du 03/05/1474 au 10/05/1474 — Poste réattribué par le dirigeant de la province.')
    expect(bb).toContain('[*]Buldo : depuis le 10/05/1474 (en cours)')
    expect(bb).toContain('[*]Céleste : du 02/04/1474 au 02/05/1474 — Retranchement.')
    expect(bb).toContain('Villes sans mandat déclaré : Besançon, Vesoul.')
    expect(bb).not.toContain('Capitaine')   // titre sans détenteur : rien à publier
    expect(bb).not.toMatch(/2026/)
  })
})
