import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { reactive } from 'vue'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import DecodeActivityView from '../../src/views/modules/animation/DecodeActivityView.vue'
import { http } from '../../src/api.js'

// Décode le code — page publique en lecture seule (brief admin/modules/animation/brief-coffres-scelles.md, lot 2).

vi.mock('../../src/api.js', () => ({ http: { get: vi.fn() } }))
const auth = reactive({ getToken: 'jeton', isLoggedIn: false, activeCharacter: null })
vi.mock('../../src/stores/authStore', () => ({ useAuthStore: () => auth }))
vi.mock('../../src/stores/cookieStore', () => ({ useCookieStore: () => ({ getComfortData: (key, fallback) => fallback, hasAcceptedPreferences: false }) }))
const route = reactive({ params: {} })
const router = { push: vi.fn() }
vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => router,
  RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' },
}))

const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const readLocale = lang => JSON.parse(fs.readFileSync(path.join(localesDir, `${lang}.json`), 'utf8'))
const fr = readLocale('fr')
const en = readLocale('en')

const activity = (over = {}) => ({
  id: 1,
  name: 'Coffre des Marches',
  type: 'decode',
  status: 'launched',
  organizer: 'Artifice',
  place: { kind: 'province', id: 3, name: 'Artois' },
  launched_at: '2026-10-01T10:00:00Z',
  closed_at: null,
  current: { number: 2, proposals: [{ combination: '12345', character_name: 'Aldric', points: 4 }] },
  opened: [{ number: 1, code: '98765', discoverer: 'Brunehaut', found_at: '2026-10-05T10:00:00Z' }],
  ranking: [{ character_name: 'Brunehaut', points: 20 }, { character_name: 'Aldric', points: 4 }],
  slug: 'coffre-des-marches',
  mode: 'private',
  ...over,
})

async function mountPage({ name = 'coffre-des-marches', locale = 'fr', data = activity(), reject = null } = {}) {
  route.params = name ? { slug: name } : {}
  if (reject) http.get.mockRejectedValue(reject)
  else http.get.mockResolvedValue({ data: { success: true, activity: data } })
  const i18n = createI18n({ legacy: false, locale, messages: { fr, en } })
  const wrapper = mount(DecodeActivityView, { global: { plugins: [i18n] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => vi.clearAllMocks())

describe('DecodeActivityView — page publique', () => {
  it('appelle la route publique par le SLUG, sans jeton', async () => {
    await mountPage({ name: 'coffre-des-marches' })

    expect(http.get).toHaveBeenCalledWith('anim/decode-activities/coffre-des-marches')
  })

  it('un royaume s\'affiche avec son nom traduit', async () => {
    const w = await mountPage({ data: activity({ place: { kind: 'kingdom', id: 1, name: 'Royaume de Test' } }) })

    expect(w.text()).toContain('Royaume :')
  })

  it('une activité sans compte close se lit sur sa photo : résultats et classement, ni coffre en cours', async () => {
    const w = await mountPage({ data: activity({ mode: 'anonymous', status: 'closed', current: null }) })

    expect(w.find('[data-testid="decode-closed"]').exists()).toBe(true)
    expect(w.find('[data-testid="decode-opened"]').text()).toContain('Coffre n°1 : 98765')
    expect(w.find('[data-testid="decode-ranking"]').text()).toContain('Brunehaut')
    expect(w.find('[data-testid="decode-no-chest"]').exists()).toBe(true)
  })

  it('affiche le nom, le statut, l\'organisateur et le lieu', async () => {
    const w = await mountPage()

    expect(w.find('[data-testid="decode-name"]').text()).toBe('Coffre des Marches')
    expect(w.find('[data-testid="decode-status"]').text()).toBe('En cours')
    expect(w.text()).toContain('Organisateur : Artifice')
    expect(w.text()).toContain('Province de Artois')
  })

  it('affiche les règles tirées des locales', async () => {
    const w = await mountPage()

    expect(w.find('[data-testid="decode-rules"]').text()).toBe(fr.Animation.Types.decode.Rules)
  })

  it('montre le coffre en cours et ses tentatives avec leur note', async () => {
    const w = await mountPage()

    expect(w.find('[data-testid="decode-current"]').text()).toContain('Coffre n°2 à percer')
    const rows = w.findAll('[data-testid="decode-attempts"] tbody tr')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('12345')
    expect(rows[0].text()).toContain('Aldric')
    expect(rows[0].text()).toContain('4 pt')
  })

  it('révèle la combinaison des coffres ouverts avec leur découvreur, et le classement', async () => {
    const w = await mountPage()

    expect(w.find('[data-testid="decode-opened"]').text()).toContain('Coffre n°1 : 98765')
    expect(w.find('[data-testid="decode-opened"]').text()).toContain('percé par Brunehaut')
    const ranking = w.findAll('[data-testid="decode-ranking"] li')
    expect(ranking[0].text()).toContain('1. Brunehaut')
    expect(ranking[0].text()).toContain('20 pt')
    expect(ranking[1].text()).toContain('2. Aldric')
  })

  it('ne montre jamais un code scellé : la page n\'en reçoit pas, et n\'en affiche aucun', async () => {
    const w = await mountPage()

    // Le coffre en cours (n°2) ne porte que son numéro et ses tentatives : aucun code à afficher.
    expect(w.find('[data-testid="decode-current"]').text()).not.toMatch(/\b\d{5}\b(?!.*Aldric)/)
    expect(w.html()).not.toContain('data-testid="code-')
  })

  it('états vides : aucune tentative, aucun coffre ouvert, aucun classement', async () => {
    const w = await mountPage({ data: activity({ current: { number: 1, proposals: [] }, opened: [], ranking: [], status: 'new' }) })

    expect(w.find('[data-testid="decode-no-attempts"]').exists()).toBe(true)
    expect(w.find('[data-testid="decode-opened"]').text()).toContain('Aucun coffre n\'a encore été ouvert.')
    expect(w.find('[data-testid="decode-ranking"]').text()).toContain('Aucun personnage n\'a encore marqué de points.')
  })

  it('sans coffre scellé : le dit', async () => {
    const w = await mountPage({ data: activity({ current: null, status: 'closed' }) })

    expect(w.find('[data-testid="decode-no-chest"]').exists()).toBe(true)
  })

  it('une activité close porte un avis, mais reste lisible', async () => {
    const w = await mountPage({ data: activity({ status: 'closed' }) })

    expect(w.find('[data-testid="decode-closed"]').exists()).toBe(true)
    expect(w.find('[data-testid="decode-name"]').exists()).toBe(true)
  })

  it('organisateur supprimé : compte supprimé, sans nom', async () => {
    const w = await mountPage({ data: activity({ organizer: null }) })

    expect(w.text()).toContain('Organisateur : compte supprimé')
  })

  it('nom inconnu (404) : le message de l\'API dans la langue de l\'interface, sans « Réessayer »', async () => {
    const error = { response: { status: 404, data: { success: false, message: 'FR', messages: { fr: 'Cette activité n\'existe pas.', en: 'This activity does not exist.' } } } }
    const w = await mountPage({ reject: error })

    expect(w.find('[data-testid="decode-not-found"]').text()).toContain('Cette activité n\'existe pas.')
    expect(w.find('[data-testid="decode-name"]').exists()).toBe(false)
  })

  it('en anglais, avec les textes anglais', async () => {
    const w = await mountPage({ locale: 'en' })

    expect(w.find('[data-testid="decode-status"]').text()).toBe('In progress')
    expect(w.text()).toContain('Chest #2 to crack')
    expect(w.text()).toContain('cracked by Brunehaut')
    expect(w.find('[data-testid="decode-rules"]').text()).toBe(en.Animation.Types.decode.Rules)
  })

  it('sans nom : le panneau et les règles, aucun appel à l\'API, et plus de champ de recherche', async () => {
    const w = await mountPage({ name: '' })

    expect(http.get).not.toHaveBeenCalled()
    expect(w.find('[data-testid="decode-search"]').exists()).toBe(false)
    expect(w.find('[data-testid="decode-rules-intro"]').exists()).toBe(true)
  })

  it('sans adresse : le panneau « Votre activité » ouvre la page, avant les règles', async () => {
    const w = await mountPage({ name: '' })
    const html = w.html()

    expect(w.find('[data-testid="decode-start"]').exists()).toBe(true)
    expect(html.indexOf('decode-start')).toBeLessThan(html.indexOf('decode-rules-intro'))
  })

  it('sans adresse : les cinq cases de la carte accompagnent le titre de la page', async () => {
    const w = await mountPage({ name: '' })

    const title = w.find('[data-testid="decode-title"]')
    expect(title.text()).toBe('Décode le code')
    expect(title.element.parentElement.querySelector('[data-testid="decode-visual"]')).not.toBeNull()
    expect(w.findAll('[data-testid="decode-visual"] span')).toHaveLength(5)
  })

  it('sur la page d\'une activité : pas de panneau, c\'est la page de l\'activité', async () => {
    const w = await mountPage()

    expect(w.find('[data-testid="decode-start"]').exists()).toBe(false)
  })
})
