import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import CharacterMandates from '../../src/components/mandates/CharacterMandates.vue'
import MandateRequestModal from '../../src/components/mandates/MandateRequestModal.vue'
import CityCascadeSelect from '../../src/components/forms/CityCascadeSelect.vue'
import { useMandateStore } from '../../src/stores/mandateStore'
import { useAuthStore } from '../../src/stores/authStore'
import { customsVersion } from '../../src/use/customsRefresh'
import { http } from '../../src/api.js'
import { push } from 'notivue'

/*
  Le rôle de DOUANIER se demande dans la modale « Demander un poste » du Profil, comme un poste (Greg, 22/11/2026). Le douanier n'existe pas en jeu : c'est un
  rôle de l'Office, validé par le trio de sécurité de la province. ⚠️ Aucune règle côté site : que la demande soit ouverte, le serveur le dit
  (GET characters/{id}/customs → can_request) ; ni date de début ni lien d'annonce, seulement une ville de rattachement.
*/
vi.mock('notivue', () => ({ push: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../src/api.js', () => ({ http: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))

const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const readLocale = lang => JSON.parse(fs.readFileSync(path.join(localesDir, `${lang}.json`), 'utf8'))
const fr = readLocale('fr')
const en = readLocale('en')

const ok = data => Promise.resolve({ data })
const refuse = (messages) => Promise.reject({ response: { status: 422, data: { success: false, message: messages.fr, errors: { character: [messages.fr] }, messages: { character: messages } } } })
const character = { id: 7, pseudo: 'Artifice', is_validated: true, city_id: 100 }
const OPEN = { success: true, officer: null, can_request: true, decider: null }
const BOTH = { mayor: { can_request: true, blocked_by: null }, council: { can_request: true, blocked_by: null } }
const NONE = { mayor: { can_request: false, blocked_by: 'active' }, council: { can_request: false, blocked_by: 'active' } }

function setup({ customs = OPEN, requestable = BOTH, locale = 'fr' } = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useMandateStore()
  store.mandates = []
  store.characters = [{ id: 7, requestable }]
  store.offices = []
  useAuthStore().$patch({ user: { characters: [character] }, token: 'jeton' })
  // La modale relit le référentiel des postes à l'ouverture : une réponse vide le viderait et casserait le choix « conseiller ».
  http.get.mockImplementation(url => (url.endsWith('/customs') ? ok(customs) : url.includes('council-offices') ? ok({ success: true, offices: [] }) : ok({})))
  http.post.mockImplementation(() => ok({ success: true }))
  return { pinia, i18n: createI18n({ legacy: false, locale, messages: { fr, en } }) }
}

const mountBlock = async (options) => {
  const { pinia, i18n } = setup(options)
  const wrapper = mount(CharacterMandates, { props: { character }, global: { plugins: [pinia, i18n], stubs: { CityCascadeSelect: true, 'v-icon': true } }, attachTo: document.body })
  await flushPromises()
  return wrapper
}
const mountModal = async (props, options) => {
  const { pinia, i18n } = setup(options)
  const wrapper = mount(MandateRequestModal, { props: { show: true, character, ...props }, global: { plugins: [pinia, i18n], stubs: { CityCascadeSelect: true, 'v-icon': true } }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

beforeEach(() => { vi.clearAllMocks(); document.body.innerHTML = '' })

describe('Modale « Demander un poste » — le choix Douanier', () => {
  it('le choix « Douanier » est proposé quand le serveur ouvre la demande', async () => {
    const w = await mountModal({ requestable: BOTH, customsOpen: true })

    expect(w.find('[data-testid="level-customs"]').exists()).toBe(true)
    expect(w.text()).toContain('Douanier')
  })

  it('sans demande ouverte (rôle ou demande déjà en cours, personnage non validé) : le choix n\'existe pas', async () => {
    const w = await mountModal({ requestable: BOTH, customsOpen: false })

    expect(w.find('[data-testid="level-customs"]').exists()).toBe(false)
  })

  it('douanier : une ville de rattachement, ni date de début ni lien d\'annonce, ni titre ; la cascade de validation est dite', async () => {
    const w = await mountModal({ requestable: BOTH, customsOpen: true })
    await w.find('[data-testid="level-customs"]').setValue(true)

    expect(w.find('[data-testid="started-at"]').exists()).toBe(false)
    expect(w.find('[data-testid="announcement-url"]').exists()).toBe(false)
    expect(w.find('[data-testid="office-select"]').exists()).toBe(false)
    expect(w.findComponent(CityCascadeSelect).props('stopAt')).toBe('city')
    const explain = w.find('[data-testid="customs-explain"]').text()
    expect(explain).toContain('Le douanier n\'est pas un poste In Game')
    expect(explain).toContain('L\'Office a choisi le terme douanier')
    expect(explain).toContain('personne n\'est inscrit d\'office')
    expect(explain).toContain('Le prévôt des maréchaux ou le connétable de la province la valide')
    expect(explain).toContain('le dirigeant de la province (Comte, Duc, …)')
    expect(explain).toContain('en dernier recours, l\'administrateur')
  })

  it('en anglais, le même texte', async () => {
    const w = await mountModal({ requestable: BOTH, customsOpen: true }, { locale: 'en' })
    await w.find('[data-testid="level-customs"]').setValue(true)

    expect(w.find('[data-testid="customs-explain"]').text()).toContain('The customs officer is not an in-game office')
    expect(w.find('[data-testid="customs-explain"]').text()).toContain('as a last resort, the administrator')
  })

  it('la ville de résidence est préremplie, comme pour le maire ; sans ville, rien n\'est envoyé', async () => {
    const w = await mountModal({ requestable: BOTH, customsOpen: true, character: { ...character, city_id: null } })
    await w.find('[data-testid="level-customs"]').setValue(true)
    await w.find('form').trigger('submit')
    await flushPromises()

    expect(http.post).not.toHaveBeenCalled()
    expect(w.find('[data-testid="error-place"]').exists()).toBe(true)
  })

  it('la demande part au serveur avec la ville choisie, la modale se ferme et dit « done » avec le niveau douanier', async () => {
    const w = await mountModal({ requestable: BOTH, customsOpen: true })
    const before = customsVersion.value
    await w.find('[data-testid="level-customs"]').setValue(true)
    w.findComponent(CityCascadeSelect).vm.$emit('update:modelValue', 5)
    await w.find('form').trigger('submit')
    await flushPromises()

    expect(http.post).toHaveBeenCalledWith('characters/7/customs', { city_id: 5 }, expect.anything())
    expect(w.emitted('done')[0]).toEqual(['customs'])
    expect(w.emitted('close')).toBeTruthy()
    expect(customsVersion.value).toBe(before + 1) // le Profil se relit
  })

  it('un refus du serveur s\'affiche tel quel, dans la langue de l\'interface, et la modale reste ouverte', async () => {
    const w = await mountModal({ requestable: BOTH, customsOpen: true }, { locale: 'en' })
    http.post.mockImplementation(() => refuse({ fr: 'Déjà une demande.', en: 'Already requested.' }))
    await w.find('[data-testid="level-customs"]').setValue(true)
    w.findComponent(CityCascadeSelect).vm.$emit('update:modelValue', 5)
    await w.find('form').trigger('submit')
    await flushPromises()

    expect(w.find('[data-testid="error-general"]').text()).toBe('Already requested.')
    expect(push.error).toHaveBeenCalledWith('Already requested.')
    expect(w.emitted('close')).toBeFalsy()
  })

  it('quand mandat de maire et conseil sont fermés, la modale s\'ouvre sur Douanier', async () => {
    const w = await mountModal({ requestable: NONE, customsOpen: true })

    expect(w.find('[data-testid="level-customs"]').element.checked).toBe(true)
  })

  it('un renouvellement ne propose jamais Douanier', async () => {
    const w = await mountModal({ requestable: BOTH, customsOpen: true, renewOf: { level: 'mayor', valid_until: '2026-05-30T22:00:00+00:00', place: { name: 'Arras' } } })

    expect(w.find('[data-testid="level-customs"]').exists()).toBe(false)
  })
})

describe('Profil — le bouton « Demander un poste » et le douanier', () => {
  it('le bouton existe pour demander un douanier même si maire et conseil sont fermés', async () => {
    const w = await mountBlock({ requestable: NONE })

    expect(w.find('[data-testid="request-office"]').exists()).toBe(true)
  })

  it('sans douanier possible et sans poste possible : pas de bouton (règle de l\'API)', async () => {
    const w = await mountBlock({ requestable: NONE, customs: { ...OPEN, can_request: false } })

    expect(w.find('[data-testid="request-office"]').exists()).toBe(false)
  })

  it('un douanier déjà demandé ferme le choix', async () => {
    const w = await mountBlock({ requestable: BOTH, customs: { ...OPEN, officer: { id: 4, status: 'pending' }, can_request: false } })
    await w.find('[data-testid="request-office"]').trigger('click')
    await flushPromises()

    expect(w.find('[data-testid="level-customs"]').exists()).toBe(false)
  })

  it('une panne de l\'API des douaniers ne bloque pas la demande de poste', async () => {
    const { pinia, i18n } = setup({ requestable: BOTH })
    http.get.mockImplementation(url => (url.endsWith('/customs') ? Promise.reject(new Error('panne')) : ok({})))
    const w = mount(CharacterMandates, { props: { character }, global: { plugins: [pinia, i18n], stubs: { CityCascadeSelect: true, 'v-icon': true } }, attachTo: document.body })
    await flushPromises()

    expect(w.find('[data-testid="request-office"]').exists()).toBe(true)
    await w.find('[data-testid="request-office"]').trigger('click')
    expect(w.find('[data-testid="level-customs"]').exists()).toBe(false)
  })

  it('le toast dit la demande de douanier, pas celle d\'un poste', async () => {
    const w = await mountBlock({ requestable: BOTH })
    await w.find('[data-testid="request-office"]').trigger('click')
    await flushPromises()
    await w.find('[data-testid="level-customs"]').setValue(true)
    w.findComponent(CityCascadeSelect).vm.$emit('update:modelValue', 5)
    await w.find('form').trigger('submit')
    await flushPromises()

    expect(push.success).toHaveBeenCalledWith('Votre demande est envoyée.')
    expect(push.success).not.toHaveBeenCalledWith(fr.Profil.Mandates.RequestSent)
  })
})

describe('Modale « Demander un poste » — le texte d\'information suit la case cochée', () => {
  const info = async (level, options = {}) => {
    const w = await mountModal({ requestable: BOTH, customsOpen: true }, options)
    await w.find(`[data-testid="level-${level}"]`).setValue(true)
    return w.find('[data-testid="mandate-info"]').text()
  }

  it('les deux premières phrases s\'affichent toujours, quelle que soit la case', async () => {
    for (const level of ['mayor', 'council', 'customs']) {
      const text = await info(level)
      expect(text).toContain('Votre demande sera vérifiée à la main. Vous recevrez un email à la décision.')
    }
  })

  it('maire : 30 jours seulement', async () => {
    const text = await info('mayor')
    expect(text).toContain('Un mandat de maire dure 30 jours, à compter de la date de début.')
    expect(text).not.toContain('60 jours')
    expect(text).not.toContain('Un nouveau conseiller')
    expect(text).toContain('Pensez à renouveler après chaque réélection.')
  })

  it('conseiller comtal : 60 jours, l\'entrée en fonction à l\'élection du dirigeant, rien sur le maire', async () => {
    const text = await info('council')
    expect(text).toContain('Un mandat de conseiller comtal dure 60 jours, à compter de la date de début.')
    expect(text).toContain('Un nouveau conseiller n\'entre en fonction qu\'à l\'élection du dirigeant de la province (Comte, Duc…)')
    expect(text).not.toContain('30 jours')
  })

  it('douanier : rien de plus que les deux premières phrases (ni durée de mandat ni renouvellement)', async () => {
    const text = await info('customs')
    expect(text).toBe('Votre demande sera vérifiée à la main. Vous recevrez un email à la décision.')
  })

  it('en anglais', async () => {
    const mayor = await info('mayor', { locale: 'en' })
    expect(mayor).toContain('A mayor\'s term lasts 30 days')
    expect(mayor).not.toContain('60 days')
  })

  it('l\'aide de la ville de rattachement dit qu\'on saisit les bilans de toute la province', async () => {
    const w = await mountModal({ requestable: BOTH, customsOpen: true })
    await w.find('[data-testid="level-customs"]').setValue(true)

    expect(w.text()).toContain('elle permet de proposer votre ville par défaut mais vous pourrez saisir les bilans de toutes les villes de cette province')
  })
})

