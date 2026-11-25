import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import OfficerValidationSection from '../../src/components/customs/OfficerValidationSection.vue'
import { useAuthStore } from '../../src/stores/authStore'
import { http } from '../../src/api.js'
import { push } from 'notivue'

/*
  Valider les douaniers (module Sécurité) : le joueur DEMANDE le rôle depuis son PROFIL (Greg, 22/11/2026),
  le trio de la province le valide dans l'onglet « Douaniers » de MON BUREAU (tests/province/MonBureauOfficers.test.js), en cascade ; seule la saisie d'un bilan remet le compteur d'inactivité à zéro. ⚠️ Aucune règle côté site :
  tout vient de GET characters/{id}/customs.
*/
vi.mock('notivue', () => ({ push: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../src/api.js', () => ({ http: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() } }))

const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const fr = JSON.parse(readFileSync(resolve(localesDir, 'fr.json'), 'utf-8'))
const en = JSON.parse(readFileSync(resolve(localesDir, 'en.json'), 'utf-8'))

const ok = data => Promise.resolve({ data })

const ROW = (over = {}) => ({
  id: 4, status: 'approved', character_id: 9, pseudo: 'Douanier', province: { id: 3, name: 'Artois' }, city: { id: 1, name: 'Arras' },
  requested_at: '2026-05-01T10:00:00+00:00', in_office_from: '2026-05-02T10:00:00+00:00', last_report_at: null, lapses_at: '2026-08-02T10:00:00+00:00', inactive: false, ...over,
})
const DECIDER = (over = {}) => ({
  level: 1, province: { id: 3, name: 'Artois' }, has_security_trio: true, inactivity_days: 90, inactivity_default: 90, inactivity_min: 30, inactivity_max: 365,
  pending: [], officers: [], ...over,
})
const STATE = (over = {}) => ({ success: true, officer: null, can_request: true, decider: null, ...over })

function serve(state = STATE()) {
  http.get.mockImplementation((url) => {
    if (url.endsWith('/customs')) return ok(state)
    return ok({})
  })
  http.post.mockImplementation(() => ok({ success: true }))
  http.put.mockImplementation(() => ok({ success: true }))
  http.delete.mockImplementation(() => ok({ success: true }))
}

async function mountPage({ locale = 'fr', state = STATE() } = {}) {
  setActivePinia(createPinia())
  useAuthStore().$patch({ user: { characters: [{ id: 7, pseudo: 'Artifice' }] }, token: 'jeton' })
  serve(state)
  const wrapper = mount(OfficerValidationSection, {
    global: { plugins: [createI18n({ legacy: false, locale, messages: { fr, en } })], stubs: { RouterLink: { template: '<a><slot /></a>' }, 'v-icon': true } },
  })
  await flushPromises()
  return wrapper
}

const find = (w, id) => w.find(`[data-testid="${id}"]`)
beforeEach(() => vi.clearAllMocks())

describe('Douaniers — valider (niveau 1 ou 2)', () => {
  it('sans rôle de validation : rien n\'est affiché (l\'onglet n\'existe pas dans Mon bureau)', async () => {
    const w = await mountPage()

    expect(find(w, 'officer-decisions').exists()).toBe(false)
    expect(find(w, 'officer-request').exists()).toBe(false) // la demande se fait dans le Profil
    expect(w.text()).not.toContain('Pour devenir douanier')
  })

  it('en anglais', async () => {
    const w = await mountPage({ locale: 'en', state: STATE({ decider: DECIDER() }) })

    expect(w.text()).toContain('Pending applications (0)')
  })

  it('le niveau est dit tel que le serveur le donne : niveau 1, puis le repli de niveau 2', async () => {
    expect(find(await mountPage({ state: STATE({ decider: DECIDER() }) }), 'decider-level').text()).toContain('en tant que prévôt des maréchaux ou connétable')
    const fallback = await mountPage({ state: STATE({ decider: DECIDER({ level: 2, has_security_trio: false }) }) })
    expect(find(fallback, 'decider-level').text()).toContain('en repli, vous validez les douaniers en tant que capitaine, dirigeant ou maire')
    expect(find(fallback, 'decider-no-trio').text()).toContain('avis de 7 jours')
  })

  it('les demandes en attente : valider ou refuser appelle le serveur', async () => {
    const w = await mountPage({ state: STATE({ decider: DECIDER({ pending: [ROW({ id: 8, status: 'pending', pseudo: 'Candidat', in_office_from: null, lapses_at: null })] }) }) })

    expect(find(w, 'decider-pending').text()).toContain('Candidat')
    expect(find(w, 'decider-pending').text()).toContain('rattaché à Arras')
    await find(w, 'officer-approve').trigger('click')
    await flushPromises()
    expect(http.post).toHaveBeenCalledWith('customs-officers/8/approve', {}, expect.anything())
    expect(push.success).toHaveBeenCalledWith('Le douanier est validé.')

    await find(w, 'officer-reject').trigger('click')
    await flushPromises()
    expect(http.post).toHaveBeenCalledWith('customs-officers/8/reject', {}, expect.anything())
  })

  it('révoquer demande une confirmation', async () => {
    const w = await mountPage({ state: STATE({ decider: DECIDER({ officers: [ROW()] }) }) })
    await find(w, 'officer-revoke').trigger('click')
    expect(http.post).not.toHaveBeenCalled()

    await find(w, 'officer-revoke-confirm').trigger('click')
    await flushPromises()
    expect(http.post).toHaveBeenCalledWith('customs-officers/4/revoke', {}, expect.anything())
    expect(push.success).toHaveBeenCalledWith('L\'accès est retiré.')
  })

  it('un douanier inactif : avec un trio connu, c\'est SIGNALÉ ; sans trio, le retrait automatique est annoncé', async () => {
    const withTrio = await mountPage({ state: STATE({ decider: DECIDER({ officers: [ROW({ inactive: true })] }) }) })
    expect(find(withTrio, 'officer-inactive').text()).toContain('c\'est à vous de décider de le révoquer')

    const alone = await mountPage({ state: STATE({ decider: DECIDER({ has_security_trio: false, level: 2, officers: [ROW({ inactive: true })] }) }) })
    expect(find(alone, 'officer-inactive').text()).toContain('sera retiré automatiquement')
  })

  it('la durée d\'inactivité : bornes dites, hors bornes refusé à l\'écran, enregistrement par l\'API', async () => {
    const w = await mountPage({ state: STATE({ decider: DECIDER() }) })
    expect(w.text()).toContain('de 30 à 365 (par défaut 90)')

    await find(w, 'inactivity-days').setValue(10)
    expect(find(w, 'inactivity-save').attributes('disabled')).toBeDefined()
    await find(w, 'inactivity-days').setValue(120)
    expect(find(w, 'inactivity-save').attributes('disabled')).toBeUndefined()
    await find(w, 'officer-settings').trigger('submit')
    await flushPromises()

    expect(http.put).toHaveBeenCalledWith('characters/7/customs/settings', { inactivity_days: 120 }, expect.anything())
    expect(push.success).toHaveBeenCalledWith('La durée d\'inactivité est enregistrée.')
  })
})
