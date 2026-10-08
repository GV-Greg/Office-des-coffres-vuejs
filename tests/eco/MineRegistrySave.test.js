import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { reactive } from 'vue'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import MineRegistrySave from '../../src/components/mines/MineRegistrySave.vue'
import { http } from '../../src/api.js'
import { push } from 'notivue'

// Registre des mines — écran d'enregistrement (PR 2 ; brief Registre §2, §6 ; fil registre-mines R3).
// Le droit d'écrire et la province viennent de l'API : l'écran les AFFICHE, il ne les calcule pas.

vi.mock('notivue', () => ({ push: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../src/api.js', () => ({ http: { get: vi.fn(), post: vi.fn() } }))

const auth = reactive({ isLoggedIn: true, activeCharacter: { id: 7, pseudo: 'Artifice' }, getToken: 'jeton' })
vi.mock('../../src/stores/authStore', () => ({ useAuthStore: () => auth }))

const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const readLocale = (lang) => JSON.parse(fs.readFileSync(path.join(localesDir, `${lang}.json`), 'utf8'))
const fr = readLocale('fr')
const en = readLocale('en')

const TEXT = `Mine 1 : Mine d'or - Noeud 236
Nombre d'heures travaillées ces 7 derniers jours
Date\tHeures
2026-05-08\t53
`

const writer = { success: true, write: { id: 1, name: 'Artois' }, read: { id: 1, name: 'Artois' } }

async function mountSave({ locale = 'fr', access = writer, text = TEXT } = {}) {
  http.get.mockResolvedValue({ data: access })
  const i18n = createI18n({ legacy: false, locale, messages: { fr, en } })
  const wrapper = mount(MineRegistrySave, {
    props: { text, prices: { OR: 1, PIERRE: 20 }, rate: 0.7 },
    global: { plugins: [i18n], stubs: { 'v-icon': true } },
  })
  await flushPromises()
  return wrapper
}

const conflict = (existing) => Object.assign(new Error('409'), {
  response: { status: 409, data: { code: 'mine_report_needs_confirmation', messages: { fr: 'Un relevé existe déjà pour le 10/05/2026 dans la province de Artois.', en: 'A report already exists.' }, existing } },
})

beforeEach(() => {
  vi.clearAllMocks()
  auth.isLoggedIn = true
  auth.activeCharacter = { id: 7, pseudo: 'Artifice' }
})

describe('MineRegistrySave', () => {
  it('dit la province du POSTE avant tout envoi', async () => {
    const wrapper = await mountSave()

    expect(http.get).toHaveBeenCalledWith('characters/7/mine-registry', { headers: { Authorization: 'Bearer jeton' } })
    // Titre en deux lignes, mais lu d'un seul tenant : un espace les sépare (lecteur d'écran).
    expect(wrapper.find('h3').text().replace(/\s+/g, ' ')).toBe('Registre des mines Artois')
    expect(wrapper.find('[data-testid="mine-registry"] button.odc-btn').text()).toBe('Inscrire au registre')
    expect(http.post).not.toHaveBeenCalled()
  })

  it('l\'icône d\'aide, nommée pour les lecteurs d\'écran, ouvre la modale qui explique l\'inscription', async () => {
    const wrapper = await mountSave()
    const help = wrapper.find('[data-testid="mine-registry-help"]')
    expect(help.attributes('aria-label')).toBe('Comment fonctionne le registre ?')

    await help.trigger('click')
    expect(wrapper.text()).toContain('Inscrire au registre')
    expect(wrapper.findAll('ol li')).toHaveLength(4)
    expect(http.post).not.toHaveBeenCalled()
  })

  it('reste caché sans droit d\'écrire — le dirigeant consulte mais n\'écrit pas — et sans collage reconnu', async () => {
    expect((await mountSave({ access: { success: true, write: null, read: { id: 1, name: 'Artois' } } })).find('[data-testid="mine-registry"]').exists()).toBe(false)
    expect((await mountSave({ text: 'rien du jeu' })).find('[data-testid="mine-registry"]').exists()).toBe(false)
  })

  it('reste caché et n\'appelle rien pour un visiteur sans compte', async () => {
    auth.isLoggedIn = false
    const wrapper = await mountSave()
    expect(http.get).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="mine-registry"]').exists()).toBe(false)
  })

  it('envoie le texte collé, le relevé analysé, les prix et le taux, sans confirmation au premier essai', async () => {
    http.post.mockResolvedValue({ data: { success: true, report: { province_name: 'Artois' }, replaced: null } })
    const wrapper = await mountSave()
    await wrapper.find('[data-testid="mine-registry"] button.odc-btn').trigger('click')
    await flushPromises()

    const [url, body] = http.post.mock.calls[0]
    expect(url).toBe('characters/7/mine-reports')
    expect(body.raw).toBe(TEXT.trim())
    expect(body.report.mines[0]).toMatchObject({ number: 1, noeud: '236', days: { '2026-05-08': { heures: 53 } } })
    expect(body).toMatchObject({ prices: { OR: 1, PIERRE: 20 }, rate: 0.7, confirm_replace: false })
    expect(push.success).toHaveBeenCalledWith('Relevé du jour inscrit au registre de Artois.')
  })

  it('409 : affiche le message de l\'API et l\'auteur en place, puis remplace SEULEMENT sur confirmation', async () => {
    http.post.mockRejectedValueOnce(conflict({ pseudo: 'Brunehaut', office_label: { fr: 'Bailli', en: 'Sheriff' } }))
    const wrapper = await mountSave()
    await wrapper.find('[data-testid="mine-registry"] button.odc-btn').trigger('click')
    await flushPromises()

    const box = wrapper.find('[data-testid="mine-registry-confirm"]')
    expect(box.attributes('role')).toBe('alert')
    expect(box.text()).toContain('Un relevé existe déjà pour le 10/05/2026')
    expect(box.text()).toContain('enregistré par Brunehaut (Bailli)')
    expect(http.post).toHaveBeenCalledTimes(1)

    http.post.mockResolvedValueOnce({ data: { success: true, report: { province_name: 'Artois' }, replaced: { pseudo: 'Brunehaut' } } })
    await box.findAll('button')[0].trigger('click')
    await flushPromises()

    expect(http.post.mock.calls[1][1].confirm_replace).toBe(true)
    expect(push.success).toHaveBeenCalledWith(expect.stringContaining('Il remplace celui de Brunehaut'))
    expect(wrapper.find('[data-testid="mine-registry-confirm"]').exists()).toBe(false)
  })

  it('Annuler ferme la confirmation sans rien envoyer', async () => {
    http.post.mockRejectedValueOnce(conflict({ pseudo: null, office_label: { fr: 'Commissaire aux mines', en: 'Mines Superintendent' } }))
    const wrapper = await mountSave({ locale: 'en' })
    await wrapper.find('[data-testid="mine-registry"] button.odc-btn').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="mine-registry-confirm"]').text()).toContain('saved by a deleted character (Mines Superintendent)')
    await wrapper.find('[data-testid="mine-registry-confirm"]').findAll('button')[1].trigger('click')
    expect(wrapper.find('[data-testid="mine-registry-confirm"]').exists()).toBe(false)
    expect(http.post).toHaveBeenCalledTimes(1)
  })

  it('un refus (identique, en dit moins) s\'affiche dans la langue de l\'interface, tel que l\'API le donne', async () => {
    http.post.mockRejectedValueOnce(Object.assign(new Error('422'), { response: { status: 422, data: {
      errors: { report: ['Ce relevé est déjà enregistré.'] }, codes: { report: 'mine_report_identical' },
      messages: { report: { fr: 'Ce relevé est déjà enregistré.', en: 'This report is already saved.' } },
    } } }))
    const wrapper = await mountSave({ locale: 'en' })
    await wrapper.find('[data-testid="mine-registry"] button.odc-btn').trigger('click')
    await flushPromises()

    expect(push.error).toHaveBeenCalledWith('This report is already saved.')
  })
})
