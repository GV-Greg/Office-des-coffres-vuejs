import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { reactive } from 'vue'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { push } from 'notivue'
import MyDecodeActivities from '../../src/views/modules/animation/MyDecodeActivities.vue'
import { http } from '../../src/api.js'

// Décode le code — « Mes activités » (mode PRIVÉ). Le formulaire de création est testé à part (DecodeCreateForm.test.js) : ici il est
// remplacé par une doublure qui émet « confirm ». Aucune règle côté site : on vérifie que l'écran envoie ce qu'il faut et affiche ce
// que l'API répond.

vi.mock('notivue', () => ({ push: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock('../../src/api.js', () => ({ http: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))
const auth = reactive({ isLoggedIn: true, activeCharacter: { id: 7, pseudo: 'Artifice' }, getToken: 'jeton' })
vi.mock('../../src/stores/authStore', () => ({ useAuthStore: () => auth }))

const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const readLocale = lang => JSON.parse(fs.readFileSync(path.join(localesDir, `${lang}.json`), 'utf8'))
const fr = readLocale('fr')
const en = readLocale('en')

const FormStub = {
  props: ['mode', 'errors', 'submitting'],
  emits: ['confirm'],
  template: '<div data-testid="form-stub" :data-mode="mode"><button data-testid="stub-confirm" @click="$emit(\'confirm\', { slug: \'nouveau-coffre\', name: \'Nouveau\' })">ok</button><span data-testid="stub-errors">{{ JSON.stringify(errors) }}</span></div>',
}

const activity = (over = {}) => ({
  id: 1, slug: 'coffre-des-marches', name: 'Coffre des Marches', type: 'decode', status: 'launched',
  mode: 'private', organizer: 'Artifice', place: null, launched_at: '2026-10-01T10:00:00Z', closed_at: null,
  current: { id: 11, number: 1, code: '48213', proposals: [] },
  opened: [], ranking: [], can_reopen: false,
  ...over,
})

const refusal = (status, code, message, extra = {}) => ({
  response: { status, data: { success: false, code, message: message.fr, messages: message, ...extra } },
})

async function mountPage({ list = [activity()], locale = 'fr' } = {}) {
  http.get.mockImplementation(async () => ({ data: { success: true, activities: list } }))
  const i18n = createI18n({ legacy: false, locale, messages: { fr, en } })
  const wrapper = mount(MyDecodeActivities, {
    global: { plugins: [i18n], stubs: { RouterLink: { template: '<a><slot /></a>' }, DecodeCreateForm: FormStub } },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.isLoggedIn = true
  auth.activeCharacter = { id: 7, pseudo: 'Artifice' }
})

describe('MyDecodeActivities — liste', () => {
  it('charge les activités du personnage actif, avec le jeton', async () => {
    const w = await mountPage()

    expect(http.get).toHaveBeenCalledWith('characters/7/decode-activities', { headers: { Authorization: 'Bearer jeton' } })
    expect(w.find('[data-testid="activity-1"]').text()).toContain('Coffre des Marches')
    expect(w.find('[data-testid="status-1"]').text()).toBe('En cours')
    expect(w.find('[data-testid="slug-1"]').exists()).toBe(false)
  })

  it('l\'organisateur voit la combinaison secrète du coffre en cours', async () => {
    const w = await mountPage()

    expect(w.find('[data-testid="code-1"]').text()).toBe('48213')
    expect(w.text()).toContain('Visible de vous seul')
  })

  it('sans personnage : un message, aucun appel', async () => {
    auth.activeCharacter = null
    const w = await mountPage()

    expect(w.find('[data-testid="mine-no-character"]').exists()).toBe(true)
    expect(http.get).not.toHaveBeenCalled()
  })

  it('aucune activité : le dit', async () => {
    const w = await mountPage({ list: [] })

    expect(w.find('[data-testid="mine-empty"]').exists()).toBe(true)
  })

  it('en anglais', async () => {
    const w = await mountPage({ locale: 'en' })

    expect(w.find('[data-testid="status-1"]').text()).toBe('In progress')
    expect(w.text()).toContain('Secret combination of chest #1')
  })

  it('le formulaire de création est celui du mode PRIVÉ', async () => {
    const w = await mountPage({ list: [] })

    expect(w.find('[data-testid="form-stub"]').attributes('data-mode')).toBe('private')
  })

  it('une activité non close : le formulaire s\'efface ; close, il revient', async () => {
    const open = await mountPage()
    expect(open.find('[data-testid="form-stub"]').exists()).toBe(false)

    const closed = await mountPage({ list: [activity({ status: 'closed', current: null })] })
    expect(closed.find('[data-testid="form-stub"]').exists()).toBe(true)
  })
})

describe('MyDecodeActivities — création', () => {
  it('envoie la charge du formulaire, ajoute l\'activité en tête, prévient', async () => {
    const w = await mountPage({ list: [] })
    http.post.mockResolvedValue({ data: { success: true, activity: activity({ id: 5, slug: 'nouveau-coffre', name: 'Nouveau', status: 'new', current: null }) } })

    await w.find('[data-testid="stub-confirm"]').trigger('click')
    await flushPromises()

    expect(http.post).toHaveBeenCalledWith('characters/7/decode-activities', { slug: 'nouveau-coffre', name: 'Nouveau' }, expect.anything())
    expect(w.find('[data-testid="activity-5"]').exists()).toBe(true)
    expect(push.success).toHaveBeenCalledWith('Activité créée.')
  })

  it('refus de l\'API (adresse prise) : le message de l\'API est passé au formulaire, dans la langue', async () => {
    const w = await mountPage({ list: [] })
    http.post.mockRejectedValue(refusal(422, 'slug_taken', { fr: 'Cette adresse est déjà prise.', en: 'This address is already taken.' }, { errors: { slug: ['Cette adresse est déjà prise.'] } }))

    await w.find('[data-testid="stub-confirm"]').trigger('click')
    await flushPromises()

    expect(JSON.parse(w.find('[data-testid="stub-errors"]').text())).toEqual({ slug: 'Cette adresse est déjà prise.' })
  })
})

describe('MyDecodeActivities — gestes', () => {
  it('sceller un coffre sur une activité neuve', async () => {
    const w = await mountPage({ list: [activity({ status: 'new', current: null })] })
    http.post.mockResolvedValue({ data: { success: true, activity: activity() } })

    await w.find('[data-testid="seal-1"]').trigger('click')
    await flushPromises()

    expect(http.post).toHaveBeenCalledWith('decode-activities/1/secrets', {}, expect.anything())
    expect(w.find('[data-testid="code-1"]').text()).toBe('48213')
  })

  it('inscrire une proposition : envoie combinaison et nom du personnage, affiche la note de l\'API', async () => {
    const w = await mountPage()
    const updated = activity({ current: { id: 11, number: 1, code: '48213', proposals: [{ combination: '12345', character_name: 'Aldric', points: 4 }] } })
    http.post.mockResolvedValue({ data: { success: true, score: 4, found: false, proposal: { combination: '12345', character_name: 'Aldric', points: 4 }, activity: updated } })

    await w.find('[data-testid="combination-1"]').setValue('12345')
    await w.find('[data-testid="character-1"]').setValue('Aldric')
    await w.find('[data-testid="proposal-form-1"]').trigger('submit')
    await flushPromises()

    expect(http.post).toHaveBeenCalledWith('decode-activities/1/secrets/11/proposals', { combination: '12345', character_name: 'Aldric' }, expect.anything())
    expect(w.find('[data-testid="result-1"]').text()).toBe('Combinaison 12345 de Aldric : 4 sur 10.')
    expect(w.text()).toContain('1 tentative sur ce coffre')
  })

  it('un coffre percé : le dit, et montre le nouveau coffre scellé', async () => {
    const w = await mountPage()
    const updated = activity({ status: 'relaunch', current: { id: 12, number: 2, code: '70251', proposals: [] }, opened: [{ number: 1, code: '48213', discoverer: 'Brunehaut' }] })
    http.post.mockResolvedValue({ data: { success: true, score: 10, found: true, proposal: { combination: '48213', character_name: 'Brunehaut', points: 20 }, activity: updated } })

    await w.find('[data-testid="combination-1"]').setValue('48213')
    await w.find('[data-testid="character-1"]').setValue('Brunehaut')
    await w.find('[data-testid="proposal-form-1"]').trigger('submit')
    await flushPromises()

    expect(w.find('[data-testid="result-1"]').text()).toContain('Coffre percé par Brunehaut')
    expect(w.find('[data-testid="status-1"]').text()).toBe('Relancé')
    expect(w.find('[data-testid="code-1"]').text()).toBe('70251')
  })

  it('une proposition refusée par l\'API : le message de l\'API en toast', async () => {
    const w = await mountPage()
    http.post.mockRejectedValue(refusal(422, 'combination_invalid', { fr: 'Une combinaison compte exactement cinq chiffres.', en: 'A combination is exactly five digits.' }))

    await w.find('[data-testid="combination-1"]').setValue('12345')
    await w.find('[data-testid="character-1"]').setValue('X')
    await w.find('[data-testid="proposal-form-1"]').trigger('submit')
    await flushPromises()

    expect(push.error).toHaveBeenCalledWith('Une combinaison compte exactement cinq chiffres.')
  })

  it('clore une activité PRIVÉE : directement, sans confirmation (elle se rouvre)', async () => {
    const w = await mountPage()
    http.post.mockResolvedValue({ data: { success: true, activity: activity({ status: 'closed', current: null, can_reopen: true }) } })

    await w.find('[data-testid="close-1"]').trigger('click')
    await flushPromises()

    expect(w.find('[data-testid="close-confirm-1"]').exists()).toBe(false)
    expect(http.post).toHaveBeenCalledWith('decode-activities/1/close', {}, expect.anything())
    expect(w.find('[data-testid="status-1"]').text()).toBe('Clos')
    expect(w.find('[data-testid="reopen-1"]').exists()).toBe(true)
  })

  it('rouvrir : le refus (une autre activité active) s\'affiche tel que l\'API le dit', async () => {
    const w = await mountPage({ list: [activity({ status: 'closed', current: null, can_reopen: true })] })
    http.post.mockRejectedValue(refusal(422, 'reopen_blocked', { fr: 'Vous avez une autre activité de ce type en cours.', en: 'You have another activity of this type in progress.' }))

    await w.find('[data-testid="reopen-1"]').trigger('click')
    await flushPromises()

    expect(push.error).toHaveBeenCalledWith('Vous avez une autre activité de ce type en cours.')
    expect(w.find('[data-testid="status-1"]').text()).toBe('Clos')
  })

  it('rouvrir réussit', async () => {
    const w = await mountPage({ list: [activity({ status: 'closed', current: null, can_reopen: true })] })
    http.post.mockResolvedValue({ data: { success: true, activity: activity() } })

    await w.find('[data-testid="reopen-1"]').trigger('click')
    await flushPromises()

    expect(w.find('[data-testid="status-1"]').text()).toBe('En cours')
  })

  it('« Supprimer » n\'existe que sur une activité close, et demande confirmation', async () => {
    const open = await mountPage()
    expect(open.find('[data-testid="delete-1"]').exists()).toBe(false)

    const w = await mountPage({ list: [activity({ status: 'closed', current: null, can_reopen: true })] })
    http.delete.mockResolvedValue({ data: { success: true } })
    await w.find('[data-testid="delete-1"]').trigger('click')

    expect(w.find('[data-testid="delete-confirm-1"]').text()).toContain('Supprimer « Coffre des Marches »')
    expect(http.delete).not.toHaveBeenCalled()

    await w.find('[data-testid="delete-yes-1"]').trigger('click')
    await flushPromises()

    expect(http.delete).toHaveBeenCalledWith('decode-activities/1', expect.anything())
    expect(w.find('[data-testid="activity-1"]').exists()).toBe(false)
  })

  it('annuler la confirmation ne supprime rien', async () => {
    const w = await mountPage({ list: [activity({ status: 'closed', current: null, can_reopen: true })] })

    await w.find('[data-testid="delete-1"]').trigger('click')
    await w.find('[data-testid="delete-confirm-1"] .odc--slate').trigger('click')

    expect(w.find('[data-testid="delete-confirm-1"]').exists()).toBe(false)
    expect(http.delete).not.toHaveBeenCalled()
  })

  it('un refus 403 (pas l\'organisateur) s\'affiche dans la langue de l\'interface', async () => {
    const w = await mountPage({ locale: 'en' })
    http.post.mockRejectedValue(refusal(403, 'not_owner', { fr: 'Seul l\'organisateur de cette activité peut la gérer.', en: 'Only the organizer of this activity can manage it.' }))

    await w.find('[data-testid="close-1"]').trigger('click')
    await flushPromises()

    expect(push.error).toHaveBeenCalledWith('Only the organizer of this activity can manage it.')
  })
})

describe('MyDecodeActivities — export BBCode', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis.navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue() }, configurable: true })
  })

  it('exporter les règles : copie le BBCode, l\'affiche et prévient', async () => {
    const w = await mountPage()
    http.get.mockResolvedValueOnce({ data: { success: true, bbcode: '[b]Coffre des Marches[/b]' } })

    await w.find('[data-testid="export-rules-1"]').trigger('click')
    await flushPromises()

    expect(http.get).toHaveBeenLastCalledWith('decode-activities/1/export/rules', expect.anything())
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('[b]Coffre des Marches[/b]')
    expect(w.find('[data-testid="export-text-1"]').element.value).toBe('[b]Coffre des Marches[/b]')
    expect(push.success).toHaveBeenCalledWith('BBCode copié dans le presse-papiers.')
  })

  it('exporter les résultats', async () => {
    const w = await mountPage()
    http.get.mockResolvedValueOnce({ data: { success: true, bbcode: '[b]Résultats[/b]' } })

    await w.find('[data-testid="export-results-1"]').trigger('click')
    await flushPromises()

    expect(http.get).toHaveBeenLastCalledWith('decode-activities/1/export/results', expect.anything())
    expect(w.find('[data-testid="export-text-1"]').element.value).toBe('[b]Résultats[/b]')
  })

  it('presse-papiers indisponible : le texte reste affiché et un avertissement le dit', async () => {
    navigator.clipboard.writeText.mockRejectedValue(new Error('refusé'))
    const w = await mountPage()
    http.get.mockResolvedValueOnce({ data: { success: true, bbcode: '[b]X[/b]' } })

    await w.find('[data-testid="export-rules-1"]').trigger('click')
    await flushPromises()

    expect(push.warning).toHaveBeenCalledWith('La copie a échoué : sélectionnez le texte ci-dessous.')
    expect(w.find('[data-testid="export-text-1"]').element.value).toBe('[b]X[/b]')
  })
})
