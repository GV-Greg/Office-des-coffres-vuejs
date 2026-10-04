import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import CharacterMandates from '../../src/components/mandates/CharacterMandates.vue'
import CityCascadeSelect from '../../src/components/forms/CityCascadeSelect.vue'
import MandateRequestModal from '../../src/components/mandates/MandateRequestModal.vue'
import DeclareOfficeModal from '../../src/components/mandates/DeclareOfficeModal.vue'
import { useMandateStore, apiFieldErrors } from '../../src/stores/mandateStore'
import { http } from '../../src/api.js'
import { push } from 'notivue'

// Mandats, lot 2 (admin/content/brief-mandats.md ; arbitrages admin/echanges/mandats-lot2/).
// Les règles et les libellés (titres, motifs, causes) viennent de l'API : ces tests vérifient
// que l'interface les AFFICHE sans les recoder, dans la langue de l'interface.

vi.mock('notivue', () => ({ push: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../src/api.js', () => ({ http: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))

// Lecture brute : un import de src/locales/*.json rend des messages précompilés.
const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const readLocale = (lang) => JSON.parse(fs.readFileSync(path.join(localesDir, `${lang}.json`), 'utf8'))
const fr = readLocale('fr')
const en = readLocale('en')

const STATUSES = ['pending', 'elected', 'active', 'extended', 'expired', 'rejected', 'revoked']

const label = (fr, en) => ({ fr, en })
const mandate = (overrides = {}) => ({
  id: 1, level: 'mayor', character: { id: 7, pseudo: 'Artifice' },
  status: 'active', place: { id: 100, name: 'Arras' },
  office_key: null, office_label: null, office_change_pending: false, pending_office_label: null,
  office_history: [], valid_until: '2026-05-30T22:00:00+00:00', holds_until: '2026-05-30T22:00:00+00:00',
  renewable: false, decision_reason: null, decision_reason_label: null, decision_message: null,
  decision_message_locale: null, ...overrides,
})
const character = { id: 7, pseudo: 'Artifice', is_validated: true, city_id: 100 }

function mountBlock({ locale = 'fr', mandates = [], requestable = null, char = character } = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useMandateStore()
  store.mandates = mandates
  store.characters = [{ id: char.id, requestable: requestable ?? { mayor: { can_request: true, blocked_by: null }, council: { can_request: true, blocked_by: null } } }]
  store.offices = [
    { key: 'juge', position: 4, label: label('Juge', 'Judge') },
    { key: 'connetable', position: 7, label: label('Connétable', 'Sergeant') },
  ]
  const i18n = createI18n({ legacy: false, locale, messages: { fr, en } })

  return mount(CharacterMandates, {
    props: { character: char },
    global: { plugins: [pinia, i18n], stubs: { CityCascadeSelect: true, 'v-icon': true } },
    attachTo: document.body,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('Bloc « Postes »', () => {
  it('s\'affiche sur un personnage validé ; sur un non validé, c\'est la phrase d\'explication', () => {
    expect(mountBlock().find('[data-testid="request-office"]').exists()).toBe(true)

    const unvalidated = mountBlock({ char: { ...character, is_validated: false } })
    expect(unvalidated.find('[data-testid="mandates-not-validated"]').text()).toBe(fr.Profil.Mandates.NotValidated)
    expect(unvalidated.find('[data-testid="request-office"]').exists()).toBe(false)
  })

  it.each(['fr', 'en'])('les 7 statuts ont un libellé traduit (%s)', (locale) => {
    const wrapper = mountBlock({ locale, mandates: STATUSES.map((status, i) => mandate({ id: i + 1, status, place: { id: 100 + i, name: `Ville ${i}` } })) })
    const badges = wrapper.findAll('[data-testid="mandate-status"]').map(b => b.text())

    expect(badges).toHaveLength(STATUSES.length)
    badges.forEach(text => expect(text).not.toMatch(/Profil\.|Status\./))
    expect(badges).toContain((locale === 'fr' ? fr : en).Profil.Mandates.Status.expired)
  })

  it('affiche le titre, le motif et la cause de fin que l\'API envoie, dans la langue de l\'interface', () => {
    const wrapper = mountBlock({ locale: 'en', mandates: [
      mandate({ level: 'council', place: { id: 10, name: 'Artois' }, office_key: 'connetable', office_label: label('Connétable', 'Sergeant'),
        office_history: [{ office_label: label('Juge', 'Judge'), started_at: '2026-05-01T10:00:00+00:00', ended_at: '2026-05-05T10:00:00+00:00',
          end_reason: 'reattribue', end_reason_label: label('Poste réattribué…', 'Office reassigned by the leader of the province.') }] }),
      mandate({ id: 2, status: 'rejected', decision_reason: 'date_incoherente',
        decision_reason_label: label('La date…', 'The start date you entered does not match the announcement.'),
        decision_message: 'Wrong date', decision_message_locale: 'en' }),
    ] })

    expect(wrapper.text()).toContain('County council of Artois — Sergeant')
    // Dates en année du jeu : mai 2026 → 1474.
    expect(wrapper.find('[data-testid="office-period"]').text()).toContain('01/05/1474')
    expect(wrapper.find('[data-testid="office-period"]').text()).toContain('Office reassigned by the leader of the province.')
    expect(wrapper.find('[data-testid="mandate-reason"]').text()).toContain('does not match the announcement')
    expect(wrapper.find('[data-testid="mandate-reason"]').text()).toContain(en.Profil.Mandates.WrittenIn.en)
  })

  it('Q7 — après une expiration, « Renouveler » et « Demander un poste » coexistent : rien n\'est masqué', () => {
    const wrapper = mountBlock({ mandates: [mandate({ status: 'expired', renewable: true })] })

    expect(wrapper.find('[data-testid="renew"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="request-office"]').exists()).toBe(true)
  })

  it('« Demander un poste » suit can_request de l\'API, sans recoder la règle', () => {
    const blocked = { mayor: { can_request: false, blocked_by: 'active' }, council: { can_request: false, blocked_by: 'pending' } }
    expect(mountBlock({ requestable: blocked }).find('[data-testid="request-office"]').exists()).toBe(false)
  })

  it('« Annuler la demande » appelle DELETE puis recharge la liste', async () => {
    http.delete.mockResolvedValue({ data: { success: true } })
    http.get.mockResolvedValue({ data: { mandates: [], characters: [] } })
    const wrapper = mountBlock({ mandates: [mandate({ status: 'pending' })] })

    await wrapper.find('[data-testid="cancel-request"]').trigger('click')
    await flushPromises()

    expect(http.delete).toHaveBeenCalledWith('mandates/mayor/1', expect.anything())
    expect(http.get).toHaveBeenCalledWith('mandates', expect.anything())
  })

  it('l\'historique d\'un maire liste ses mandats précédents à la même mairie, sans les répéter dans « Mandats terminés »', () => {
    const wrapper = mountBlock({ mandates: [
      mandate({ id: 3, status: 'active', started_at: '2026-09-01' }),
      mandate({ id: 1, status: 'expired', started_at: '2026-07-01', holds_until: '2026-07-31T22:00:00+00:00' }),
      mandate({ id: 2, status: 'revoked', started_at: '2026-08-01', holds_until: '2026-08-15T22:00:00+00:00' }),
      mandate({ id: 4, status: 'expired', place: { id: 200, name: 'Dole' }, started_at: '2026-06-01' }),
    ] })
    const terms = wrapper.findAll('[data-testid="previous-term"]').map(li => li.text())

    expect(terms).toEqual([
      `du 01/08/1474 au 16/08/1474 — ${fr.Profil.Mandates.Status.revoked}`,
      `du 01/07/1474 au 01/08/1474 — ${fr.Profil.Mandates.Status.expired}`,
    ])
    const past = wrapper.findAll('[data-testid="mandate-past"]').map(li => li.text())
    expect(past).toHaveLength(1)
    expect(past[0]).toContain('Dole')
  })

  it('le bouton dit « Changer de poste » quand le conseiller a déjà un poste', () => {
    const wrapper = mountBlock({ mandates: [
      mandate({ id: 1, level: 'council', status: 'active', office_key: 'juge', office_label: label('Juge', 'Judge') }),
      mandate({ id: 2, level: 'council', status: 'active' }),
    ] })
    const labels = wrapper.findAll('[data-testid="declare-office"]').map(b => b.text())

    expect(labels).toEqual([fr.Profil.Mandates.ChangeOffice, fr.Profil.Mandates.DeclareOffice])
  })

  it('« Déclarer mon poste » n\'apparaît que sur un mandat de conseiller en fonction', () => {
    const wrapper = mountBlock({ mandates: [
      mandate({ id: 1, level: 'council', status: 'active' }),
      mandate({ id: 2, level: 'council', status: 'elected' }),
      mandate({ id: 3, level: 'mayor', status: 'active' }),
    ] })

    expect(wrapper.findAll('[data-testid="declare-office"]')).toHaveLength(1)
  })
})

function mountModal(component, props, locale = 'fr') {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useMandateStore()
  store.offices = [
    { key: 'juge', position: 4, label: label('Juge', 'Judge') },
    { key: 'connetable', position: 7, label: label('Connétable', 'Sergeant') },
  ]
  const i18n = createI18n({ legacy: false, locale, messages: { fr, en } })
  return mount(component, { props, global: { plugins: [pinia, i18n], stubs: { CityCascadeSelect: true, 'v-icon': true } }, attachTo: document.body })
}

describe('Modale de demande', () => {
  it('le titre n\'apparaît que pour le conseil, et la cascade s\'arrête à la province', async () => {
    const wrapper = mountModal(MandateRequestModal, { show: true, character })
    expect(wrapper.find('[data-testid="office-select"]').exists()).toBe(false)

    await wrapper.find('[data-testid="level-council"]').setValue(true)
    expect(wrapper.find('[data-testid="office-select"]').exists()).toBe(true)
    expect(wrapper.findComponent(CityCascadeSelect).props('stopAt')).toBe('province')
  })

  it('bloque une date future et exige le lien, sans appeler l\'API', async () => {
    const wrapper = mountModal(MandateRequestModal, { show: true, character })
    await wrapper.find('[data-testid="started-at"]').setValue('2999-01-01')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.find('[data-testid="error-started-at"]').text()).toBe(fr.Profil.Mandates.Form.Errors.DateFuture)
    expect(wrapper.find('[data-testid="error-url"]').text()).toBe(fr.Profil.Mandates.Form.Errors.UrlRequired)
    expect(http.post).not.toHaveBeenCalled()
  })

  it.each([['fr', 'Ce mandat est déjà terminé à la date indiquée.'], ['en', 'This term has already ended on the date given.']])(
    'une 422 s\'affiche sous le bon champ, dans la langue de l\'interface (%s)', async (locale, expected) => {
      http.post.mockRejectedValue({ response: { status: 422, data: {
        errors: { started_at: ['Ce mandat est déjà terminé à la date indiquée.'] },
        codes: { started_at: 'dead_born' },
        messages: { started_at: { fr: 'Ce mandat est déjà terminé à la date indiquée.', en: 'This term has already ended on the date given.' } },
      } } })
      const wrapper = mountModal(MandateRequestModal, { show: true, character }, locale)
      await wrapper.find('[data-testid="started-at"]').setValue('2020-01-01')
      await wrapper.find('[data-testid="announcement-url"]').setValue('https://forum.example/a')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(wrapper.find('[data-testid="error-started-at"]').text()).toBe(expected)
      expect(push.error).toHaveBeenCalledWith(expected)
    })

  it('« Renouveler » verrouille le niveau et le lieu, préremplit la date et ne propose aucun titre', () => {
    const renewOf = mandate({ level: 'council', place: { id: 10, name: 'Artois' }, valid_until: '2020-03-01T23:00:00+00:00' })
    const wrapper = mountModal(MandateRequestModal, { show: true, character, renewOf })

    expect(wrapper.find('[data-testid="level-council"]').element.closest('fieldset').disabled).toBe(true)
    expect(wrapper.find('[data-testid="locked-place"]').text()).toContain('Artois')
    expect(wrapper.find('[data-testid="office-select"]').exists()).toBe(false)
    // Année du jeu dans le champ (2020 → 1468).
    expect(wrapper.find('[data-testid="started-at"]').element.value).toBe('1468-03-02')
  })

  it('la date se saisit en année du jeu et part en année réelle', async () => {
    http.post.mockResolvedValue({ data: { success: true } })
    http.get.mockResolvedValue({ data: { mandates: [], characters: [] } })
    const wrapper = mountModal(MandateRequestModal, { show: true, character })
    const input = wrapper.find('[data-testid="started-at"]')
    expect(input.attributes('max')).toMatch(/^14\d\d-/)

    await wrapper.find('[data-testid="level-council"]').setValue(true)
    wrapper.findComponent(CityCascadeSelect).vm.$emit('update:modelValue', 10)
    await input.setValue('1474-09-23')
    await wrapper.find('[data-testid="announcement-url"]').setValue('https://forum.example/a')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(http.post).toHaveBeenCalledWith('characters/7/mandates', expect.objectContaining({ started_at: '2026-09-23' }), expect.anything())
  })

  it('Échap ferme la modale', async () => {
    const wrapper = mountModal(MandateRequestModal, { show: true, character })
    await flushPromises()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(wrapper.emitted('close')).toBeTruthy()
  })
})

describe('Modale « Déclarer mon poste »', () => {
  it('dit les trois temps avec le poste actuel, et envoie la déclaration', async () => {
    http.post.mockResolvedValue({ data: { success: true } })
    http.get.mockResolvedValue({ data: { mandates: [], characters: [] } })
    const current = mandate({ level: 'council', status: 'active', office_key: 'juge', office_label: label('Juge', 'Judge') })
    const wrapper = mountModal(DeclareOfficeModal, { show: true, mandate: current })

    expect(wrapper.find('[data-testid="declare-warning"]').text())
      .toBe(fr.Profil.Mandates.Declare.Warning.replace('{office}', 'Juge'))

    await wrapper.find('[data-testid="declare-select"]').setValue('connetable')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(http.post).toHaveBeenCalledWith('mandates/council/1/office', { council_office_key: 'connetable' }, expect.anything())
  })
})

describe('Messages d\'erreur de l\'API', () => {
  it('prend le message de la langue demandée, et retombe sur le message brut s\'il manque', () => {
    const error = { response: { data: { errors: { a: ['brut A'], b: ['brut B'] }, messages: { a: { fr: 'A fr', en: 'A en' } } } } }
    expect(apiFieldErrors(error, 'en')).toEqual({ a: 'A en', b: 'brut B' })
  })
})
