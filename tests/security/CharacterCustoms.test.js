import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import CharacterCustoms from '../../src/components/customs/CharacterCustoms.vue'
import { useAuthStore } from '../../src/stores/authStore'
import { http } from '../../src/api.js'
import { push } from 'notivue'

/*
  Le bloc « Douanier » du Profil : il n'apparaît qu'une fois la demande faite (en attente) ou l'accès accordé ; la demande se fait dans la modale
  « Demander un poste » (Greg, 22/11/2026, tests/mandates/MandateRequestCustoms.test.js). Le douanier n'existe pas en jeu : c'est un rôle de l'Office, validé
  par le trio de sécurité de la province. ⚠️ Aucune règle côté site : tout vient de GET characters/{id}/customs ; un refus s'affiche tel quel, en FR ou EN ;
  une panne laisse le bloc muet.
*/
vi.mock('notivue', () => ({ push: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../src/api.js', () => ({ http: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() } }))

const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const fr = JSON.parse(readFileSync(resolve(localesDir, 'fr.json'), 'utf-8'))
const en = JSON.parse(readFileSync(resolve(localesDir, 'en.json'), 'utf-8'))

const ok = data => Promise.resolve({ data })
const refuse = (messages) => Promise.reject({ response: { status: 422, data: { success: false, message: messages.fr, errors: { x: [messages.fr] }, messages: { x: messages } } } })

const ROW = (over = {}) => ({
  id: 4, status: 'approved', character_id: 7, pseudo: 'Artifice', province: { id: 3, name: 'Artois' }, city: { id: 1, name: 'Arras' },
  requested_at: '2026-05-01T10:00:00+00:00', in_office_from: '2026-05-02T10:00:00+00:00', last_report_at: null, lapses_at: '2026-08-02T10:00:00+00:00', inactive: false, ...over,
})
const STATE = (over = {}) => ({ success: true, officer: null, can_request: true, decider: null, ...over })

async function mountBlock({ locale = 'fr', state = STATE(), failing = false } = {}) {
  setActivePinia(createPinia())
  useAuthStore().$patch({ user: { characters: [{ id: 7, pseudo: 'Artifice' }] }, token: 'jeton' })
  http.get.mockImplementation(() => (failing ? Promise.reject(new Error('panne')) : ok(state)))
  http.post.mockImplementation(() => ok({ success: true }))
  http.delete.mockImplementation(() => ok({ success: true }))
  const wrapper = mount(CharacterCustoms, {
    props: { character: { id: 7, pseudo: 'Artifice', is_validated: true } },
    global: { plugins: [createI18n({ legacy: false, locale, messages: { fr, en } })], stubs: { RouterLink: { template: '<a><slot /></a>' }, 'v-icon': true } },
  })
  await flushPromises()
  return wrapper
}

const find = (w, id) => w.find(`[data-testid="${id}"]`)
beforeEach(() => { vi.clearAllMocks(); document.body.innerHTML = '' })

describe('Profil — Douanier : statut de la demande ou de l\'accès', () => {
  it('sans rôle ni demande : le bloc n\'existe pas (la demande se fait dans « Demander un poste »)', async () => {
    const w = await mountBlock()

    expect(find(w, 'customs-block').exists()).toBe(false)
    expect(find(w, 'officer-request').exists()).toBe(false)
  })

  it('demande en attente : elle est dite (la cascade est dans l\'infobulle « i »), on peut la retirer', async () => {
    const w = await mountBlock({ state: STATE({ officer: ROW({ status: 'pending', in_office_from: null, lapses_at: null }), can_request: false }) })

    expect(find(w, 'officer-pending').text()).toContain('rattaché à Arras')
    expect(find(w, 'officer-cascade-button').exists()).toBe(true)
    await find(w, 'officer-withdraw').trigger('click')
    await flushPromises()

    expect(http.delete).toHaveBeenCalledWith('characters/7/customs', expect.anything())
    expect(push.success).toHaveBeenCalledWith('Votre demande est retirée.')
  })

  it('douanier en vigueur : la province, la ville, l\'échéance, sans texte d\'explication', async () => {
    const w = await mountBlock({ state: STATE({ officer: ROW({ last_report_at: '2026-05-20T10:00:00+00:00' }), can_request: false }) })

    expect(find(w, 'officer-approved').text()).toContain('Rattaché à Arras, depuis le 02/05/2026.')
    expect(find(w, 'officer-lapse').text()).toContain('prendra fin le 02/08/2026')
    expect(find(w, 'officer-lapse').text()).toContain('Dernier bilan saisi le 20/05/2026')
    // carte épurée : ni phrases d'explication, ni bouton d'ouverture du Registre (le menu Sécurité y mène)
    expect(find(w, 'officer-open-register').exists()).toBe(false)
    expect(find(w, 'officer-status').text()).not.toContain('Vous saisissez les bilans')
    expect(find(w, 'officer-status').text()).not.toContain('remet ce compteur à zéro')
  })

  it('un accès échu est dit en TEXTE, pas seulement par la couleur', async () => {
    const w = await mountBlock({ state: STATE({ officer: ROW({ inactive: true }), can_request: false }) })

    expect(find(w, 'officer-lapse').text()).toContain('Votre accès est échu depuis le 02/08/2026')
  })

  it('renoncer demande une confirmation avant de retirer son propre accès', async () => {
    const w = await mountBlock({ state: STATE({ officer: ROW(), can_request: false }) })
    await find(w, 'officer-renounce').trigger('click')
    expect(http.delete).not.toHaveBeenCalled()
    expect(w.text()).toContain('Renoncer vraiment ?')

    await find(w, 'officer-renounce-confirm').trigger('click')
    await flushPromises()
    expect(http.delete).toHaveBeenCalledWith('characters/7/customs', expect.anything())
    expect(push.success).toHaveBeenCalledWith('Votre accès de douanier est retiré.')
  })

  it('un refus du serveur (renoncer) s\'affiche tel quel, dans la langue de l\'interface', async () => {
    const w = await mountBlock({ locale: 'en', state: STATE({ officer: ROW(), can_request: false }) })
    http.delete.mockImplementation(() => refuse({ fr: 'Impossible.', en: 'Not possible.' }))
    await find(w, 'officer-renounce').trigger('click')
    await find(w, 'officer-renounce-confirm').trigger('click')
    await flushPromises()

    expect(push.error).toHaveBeenCalledWith('Not possible.')
  })

  it('en anglais, avec le titre du bloc et en carte de poste', async () => {
    const w = await mountBlock({ locale: 'en', state: STATE({ officer: ROW({ status: 'pending', in_office_from: null, lapses_at: null }), can_request: false }) })

    expect(find(w, 'officer-title').text()).toBe('Customs officer of Artois')
    expect(find(w, 'officer-badge').text()).toBe('Awaiting verification')
    expect(find(w, 'customs-block').find('h4').exists()).toBe(false) // une carte de poste, pas de titre de rubrique
    expect(find(w, 'officer-pending').text()).toContain('Application of 01/05/2026, attached to Arras')
  })

  it('une panne du serveur laisse le bloc muet : le Profil n\'est pas bloqué', async () => {
    const w = await mountBlock({ failing: true })

    expect(find(w, 'customs-block').exists()).toBe(false)
  })

  // L'infobulle est téléportée au <body> (la carte du Profil rogne son contenu) : on la cherche dans le document.
  const tipEl = () => document.body.querySelector('[data-testid="officer-cascade"]')

  it('la cascade de validation est dans une infobulle « i », téléportée hors de la carte : cachée, ouverte au clic, fermée par Échap', async () => {
    const w = await mountBlock({ state: STATE({ officer: ROW({ status: 'pending', in_office_from: null, lapses_at: null }), can_request: false }) })

    expect(tipEl().getAttribute('role')).toBe('tooltip')
    expect(tipEl().style.display).toBe('none')
    expect(find(w, 'officer-status').element.contains(tipEl())).toBe(false) // hors de la carte : jamais rognée
    expect(tipEl().textContent).toContain('Le prévôt des maréchaux ou le connétable de la province la valide')
    expect(tipEl().textContent).toContain('le dirigeant de la province (Comte, Duc, …)')
    expect(find(w, 'officer-cascade-button').attributes('aria-label')).toBe('Qui valide ma demande ?')
    expect(find(w, 'officer-status').text()).not.toContain('Le prévôt') // plus de paragraphe permanent

    await find(w, 'officer-cascade-button').trigger('click')
    expect(tipEl().style.display).not.toBe('none')
    expect(tipEl().style.left).toMatch(/px$/)
    await find(w, 'officer-cascade-button').trigger('keydown', { key: 'Escape' })
    expect(tipEl().style.display).toBe('none')
    w.unmount()
  })

  it('l\'infobulle n\'existe pas pour un accès déjà accordé', async () => {
    const w = await mountBlock({ state: STATE({ officer: ROW(), can_request: false }) })

    expect(find(w, 'officer-cascade-button').exists()).toBe(false)
  })
})
