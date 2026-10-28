import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { reactive } from 'vue'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import DecodeStartPanel from '../../src/components/anim/DecodeStartPanel.vue'
import { http } from '../../src/api.js'

// « Votre activité » : ce que peut faire CE visiteur, selon qu'il est connecté, qu'il a un personnage et une activité, et que l'appareil
// se souvient (ou non) d'une activité sans compte. Six scénarios, aucune règle côté site : le serveur dit ce qui existe.

vi.mock('../../src/api.js', () => ({ http: { get: vi.fn() } }))
const router = { replace: vi.fn() }
vi.mock('vue-router', () => ({
  useRouter: () => router,
  RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' },
}))
const auth = reactive({ getToken: 'jeton', isLoggedIn: false, activeCharacter: null })
vi.mock('../../src/stores/authStore', () => ({ useAuthStore: () => auth }))
const cookies = reactive({ slug: '', accepted: false })
vi.mock('../../src/stores/cookieStore', () => ({
  useCookieStore: () => ({
    getComfortData: (key, fallback) => (key === 'anim_decode_slug' && cookies.slug ? cookies.slug : fallback),
    get hasAcceptedPreferences() { return cookies.accepted },
  }),
}))

const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const readLocale = lang => JSON.parse(fs.readFileSync(path.join(localesDir, `${lang}.json`), 'utf8'))
const fr = readLocale('fr')
const en = readLocale('en')

const mine = (over = {}) => ({ id: 1, slug: 'coffre-des-marches', name: 'Coffre des Marches', status: 'launched', mode: 'private', ...over })
const anon = (over = {}) => ({ slug: 'les-trois-coffres', name: 'Les Trois Coffres', status: 'launched', mode: 'anonymous', ...over })

// Le serveur répond selon l'adresse demandée : la liste privée, ou la lecture publique d'une activité.
function server({ list = [], shown = null, showStatus = 200 } = {}) {
  http.get.mockImplementation(async (url) => {
    if (url.startsWith('characters/')) return { data: { success: true, activities: list } }
    if (showStatus !== 200) throw { response: { status: showStatus, data: {} } }
    return { data: { success: true, activity: shown } }
  })
}

async function mountPanel(locale = 'fr') {
  const i18n = createI18n({ legacy: false, locale, messages: { fr, en } })
  const wrapper = mount(DecodeStartPanel, {
    global: { plugins: [i18n], stubs: { RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' } } },
  })
  await flushPromises()
  return wrapper
}

const scenario = w => w.find('[data-testid="decode-start"]').attributes('data-scenario')

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState(null, '')
  auth.isLoggedIn = false
  auth.activeCharacter = null
  cookies.slug = ''
  cookies.accepted = false
  server()
})

describe('DecodeStartPanel — connecté', () => {
  it('sans personnage : propose d\'en ajouter un, sans appeler l\'API privée', async () => {
    auth.isLoggedIn = true
    const w = await mountPanel()

    expect(scenario(w)).toBe('user-no-character')
    expect(w.find('[data-testid="decode-action-character"]').attributes('data-to')).toContain('character-new')
    expect(http.get).not.toHaveBeenCalled()
  })

  it('avec une activité en cours : la reprendre, avec son nom, son personnage et son statut', async () => {
    auth.isLoggedIn = true
    auth.activeCharacter = { id: 7, pseudo: 'Artifice' }
    server({ list: [mine()] })
    const w = await mountPanel()

    expect(http.get).toHaveBeenCalledWith('characters/7/decode-activities', { headers: { Authorization: 'Bearer jeton' } })
    expect(scenario(w)).toBe('user-resume')
    expect(w.find('[data-testid="start-mine-text"]').text()).toContain('Coffre des Marches')
    expect(w.find('[data-testid="start-mine-text"]').text()).toContain('Artifice')
    expect(w.find('[data-testid="start-mine-status"]').text()).toBe('En cours')
    expect(w.find('[data-testid="decode-action-mine"]').text()).toContain('Reprendre mon activité')
    expect(w.find('[data-testid="decode-action-mine"]').attributes('data-to')).toContain('animation-mine')
  })

  it('avec une activité en cours : va droit à sa page de gestion', async () => {
    auth.isLoggedIn = true
    auth.activeCharacter = { id: 7, pseudo: 'Artifice' }
    server({ list: [mine()] })
    await mountPanel()

    expect(router.replace).toHaveBeenCalledWith({ name: 'animation-mine' })
  })

  it('arrivé de l\'intérieur du module, on ne renvoie pas : la page reste lisible', async () => {
    window.history.replaceState({ back: '/app/anim/decode/ma-salle' }, '')
    auth.isLoggedIn = true
    auth.activeCharacter = { id: 7, pseudo: 'Artifice' }
    server({ list: [mine()] })
    await mountPanel()

    expect(router.replace).not.toHaveBeenCalled()
  })

  it('activité close seulement, aucune activité, ou sans personnage : pas de redirection', async () => {
    auth.isLoggedIn = true
    auth.activeCharacter = { id: 7, pseudo: 'Artifice' }
    server({ list: [mine({ status: 'closed' })] })
    await mountPanel()
    server({ list: [] })
    await mountPanel()
    auth.activeCharacter = null
    await mountPanel()

    expect(router.replace).not.toHaveBeenCalled()
  })

  it('l\'activité en cours passe avant une activité close', async () => {
    auth.isLoggedIn = true
    auth.activeCharacter = { id: 7, pseudo: 'Artifice' }
    server({ list: [mine({ id: 2, name: 'Ancien', status: 'closed' }), mine({ id: 3, name: 'Actuel' })] })
    const w = await mountPanel()

    expect(w.find('[data-testid="start-mine-text"]').text()).toContain('Actuel')
  })

  it('seulement des activités closes : « Voir mes activités » (on peut les rouvrir ou en créer une autre)', async () => {
    auth.isLoggedIn = true
    auth.activeCharacter = { id: 7, pseudo: 'Artifice' }
    server({ list: [mine({ status: 'closed' })] })
    const w = await mountPanel()

    expect(scenario(w)).toBe('user-resume')
    expect(w.find('[data-testid="decode-action-mine"]').text()).toContain('Voir mes activités')
  })

  it('aucune activité : propose de la créer, vers « Ma salle »', async () => {
    auth.isLoggedIn = true
    auth.activeCharacter = { id: 7, pseudo: 'Artifice' }
    server({ list: [] })
    const w = await mountPanel()

    expect(scenario(w)).toBe('user-create')
    expect(w.find('[data-testid="start-mine-none"]').text()).toContain('Artifice')
    expect(w.find('[data-testid="decode-action-mine"]').text()).toContain('Créer mon activité')
    expect(w.find('[data-testid="decode-action-mine"]').attributes('data-to')).toContain('animation-mine')
  })

  it('panne de la liste : on propose de créer, « Ma salle » dira la vérité', async () => {
    auth.isLoggedIn = true
    auth.activeCharacter = { id: 7, pseudo: 'Artifice' }
    http.get.mockRejectedValue(new Error('réseau'))
    const w = await mountPanel()

    expect(scenario(w)).toBe('user-create')
  })

  it('connecté ET une activité sans compte mémorisée : elle reste atteignable', async () => {
    auth.isLoggedIn = true
    auth.activeCharacter = { id: 7, pseudo: 'Artifice' }
    cookies.slug = 'les-trois-coffres'
    server({ list: [mine()], shown: anon() })
    const w = await mountPanel()

    expect(scenario(w)).toBe('user-resume')
    expect(w.find('[data-testid="start-also-remembered"]').text()).toContain('Les Trois Coffres')
    expect(w.find('[data-testid="start-also-remembered"] a').attributes('data-to')).toContain('animation-manage')
  })
})

describe('DecodeStartPanel — déconnecté', () => {
  it('adresse mémorisée et encore ouverte : la reprendre, ou voir sa page', async () => {
    cookies.slug = 'les-trois-coffres'
    server({ shown: anon() })
    const w = await mountPanel()

    expect(http.get).toHaveBeenCalledWith('anim/decode-activities/les-trois-coffres')
    expect(scenario(w)).toBe('guest-resume')
    expect(w.find('[data-testid="start-remembered-text"]').text()).toContain('Les Trois Coffres')
    expect(w.find('[data-testid="decode-action-manage"]').attributes('data-to')).toContain('animation-manage')
    expect(w.find('[data-testid="decode-action-page"]').attributes('data-to')).toContain('les-trois-coffres')
    expect(w.find('[data-testid="decode-action-create"]').exists()).toBe(false)
  })

  it('adresse mémorisée et activité ouverte : va droit à la page de gestion (adresse préremplie)', async () => {
    cookies.slug = 'les-trois-coffres'
    server({ shown: anon() })
    await mountPanel()

    expect(router.replace).toHaveBeenCalledWith({ name: 'animation-manage' })
  })

  it('rien de mémorisé, close ou inconnue : pas de redirection', async () => {
    await mountPanel()
    cookies.slug = 'x'
    server({ shown: anon({ status: 'closed' }) })
    await mountPanel()
    server({ showStatus: 404 })
    await mountPanel()

    expect(router.replace).not.toHaveBeenCalled()
  })

  it('adresse mémorisée mais activité close : traité comme rien de mémorisé', async () => {
    cookies.slug = 'les-trois-coffres'
    server({ shown: anon({ status: 'closed' }) })
    const w = await mountPanel()

    expect(scenario(w)).toBe('guest-start')
  })

  it('adresse mémorisée mais inconnue du serveur (404, page supprimée) : rien de mémorisé', async () => {
    cookies.slug = 'disparue'
    server({ showStatus: 404 })
    const w = await mountPanel()

    expect(scenario(w)).toBe('guest-start')
  })

  it('rien de mémorisé : créer sans compte, ou retrouver la sienne — sans appeler l\'API', async () => {
    const w = await mountPanel()

    expect(http.get).not.toHaveBeenCalled()
    expect(scenario(w)).toBe('guest-start')
    expect(w.find('[data-testid="decode-action-create"]').text()).toContain('Ouvrir votre salle')
    expect(w.find('[data-testid="decode-action-create"]').attributes('data-to')).toContain('animation-create')
    expect(w.find('[data-testid="decode-action-manage"]').text()).toContain('Retrouver ma salle')
    expect(w.find('[data-testid="start-guest-text"]').text()).toBe('Vous êtes dans l\'entrée des salles des coffres scellés.')
    // Pas d'invitation à se connecter dans la page : le bouton est dans le menu du haut.
    expect(w.find('[data-testid="decode-action-login"]').exists()).toBe(false)
    expect(w.text()).not.toContain('Connectez-vous')
  })

  it('préférences refusées : le dit, une fois ; acceptées : se tait', async () => {
    const refused = await mountPanel()
    expect(refused.find('[data-testid="start-cookie-hint"]').exists()).toBe(true)
    expect(refused.find('[data-testid="start-cookie-hint"]').classes()).toEqual(expect.arrayContaining(['italic', 'text-xs']))
    expect(refused.find('[data-testid="start-cookie-hint"]').text()).toContain('cookies de confort')

    cookies.accepted = true
    const accepted = await mountPanel()
    expect(accepted.find('[data-testid="start-cookie-hint"]').exists()).toBe(false)
  })

  it('une adresse mémorisée : pas d\'avertissement sur les préférences', async () => {
    cookies.slug = 'les-trois-coffres'
    server({ shown: anon() })
    const w = await mountPanel()

    expect(w.find('[data-testid="start-cookie-hint"]').exists()).toBe(false)
  })

  it('en anglais', async () => {
    const w = await mountPanel('en')

    expect(w.find('[data-testid="decode-start"] h3').text()).toBe('Your activity')
    expect(w.find('[data-testid="start-guest-text"]').text()).toContain('You are at the entrance to the halls of sealed chests.')
  })
})
