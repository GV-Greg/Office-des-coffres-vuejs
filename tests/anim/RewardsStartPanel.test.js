import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { reactive } from 'vue'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import RewardsStartPanel from '../../src/components/anim/RewardsStartPanel.vue'
import { http } from '../../src/api.js'

// « Votre grille » : ce que peut faire CE visiteur, selon qu'il est connecté, qu'il a un personnage et une grille, et que l'appareil se souvient
// (ou non) d'une grille sans compte. Six scénarios, aucune règle côté site : le serveur dit ce qui existe. Cas propre à la grille : une grille
// n'a pas de page publique avant son tirage — sans compte, on retrouve pourtant sa grille en cours de remplissage.

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
    getComfortData: (key, fallback) => (key === 'anim_rewards_slug' && cookies.slug ? cookies.slug : fallback),
    get hasAcceptedPreferences() { return cookies.accepted },
  }),
}))

const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const readLocale = lang => JSON.parse(fs.readFileSync(path.join(localesDir, `${lang}.json`), 'utf8'))
const fr = readLocale('fr')
const en = readLocale('en')

const mine = (over = {}) => ({ id: 1, slug: 'foire', name: 'Foire de Toulouse', status: 'incomplete', mode: 'private', ...over })
const anon = (over = {}) => ({ slug: 'foire-anonyme', name: 'Foire anonyme', status: 'confirmed', mode: 'anonymous', ...over })

// Le serveur répond selon l'adresse : la liste privée, la lecture publique (404 tant que la grille n'est pas tirée), l'aperçu du slug.
function server({ list = [], shown = null, showStatus = 200, taken = false } = {}) {
  http.get.mockImplementation(async (url) => {
    if (url.startsWith('characters/')) return { data: { success: true, grids: list } }
    if (url === 'anim/rewards-slug') return { data: { success: true, taken, valid: true } }
    if (showStatus !== 200) throw { response: { status: showStatus, data: {} } }
    return { data: { success: true, grid: shown } }
  })
}

async function mountPanel(locale = 'fr') {
  const i18n = createI18n({ legacy: false, locale, messages: { fr, en } })
  const wrapper = mount(RewardsStartPanel, { global: { plugins: [i18n] } })
  await flushPromises()
  return wrapper
}

const scenario = w => w.find('[data-testid="rewards-start"]').attributes('data-scenario')

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState(null, '')
  auth.isLoggedIn = false
  auth.activeCharacter = null
  cookies.slug = ''
  cookies.accepted = false
  server()
})

describe('RewardsStartPanel — connecté', () => {
  it('sans personnage : propose d\'en ajouter un, sans appeler l\'API privée', async () => {
    auth.isLoggedIn = true
    const w = await mountPanel()

    expect(scenario(w)).toBe('user-no-character')
    expect(w.find('[data-testid="rewards-action-character"]').attributes('data-to')).toContain('character-new')
    expect(http.get).not.toHaveBeenCalled()
  })

  it('avec une grille en cours : la reprendre, avec son nom, son personnage et son statut de grille', async () => {
    auth.isLoggedIn = true
    auth.activeCharacter = { id: 7, pseudo: 'Artifice' }
    server({ list: [mine()] })
    const w = await mountPanel()

    expect(http.get).toHaveBeenCalledWith('characters/7/rewards-grids', { headers: { Authorization: 'Bearer jeton' } })
    expect(scenario(w)).toBe('user-resume')
    expect(w.find('[data-testid="start-mine-text"]').text()).toContain('Foire de Toulouse')
    expect(w.find('[data-testid="start-mine-text"]').text()).toContain('Artifice')
    expect(w.find('[data-testid="start-mine-status"]').text()).toBe(fr.Animation.GridStatus.incomplete)
    expect(w.find('[data-testid="rewards-action-mine"]').attributes('data-to')).toContain('animation-rewards-mine')
    expect(router.replace).toHaveBeenCalledWith({ name: 'animation-rewards-mine' })
  })

  it('arrivé de l\'intérieur du module, on ne renvoie pas', async () => {
    window.history.replaceState({ back: '/app/anim/grille/ma-grille' }, '')
    auth.isLoggedIn = true
    auth.activeCharacter = { id: 7, pseudo: 'Artifice' }
    server({ list: [mine()] })
    await mountPanel()

    expect(router.replace).not.toHaveBeenCalled()
  })

  it('sans grille : propose d\'en créer une, sans redirection', async () => {
    auth.isLoggedIn = true
    auth.activeCharacter = { id: 7, pseudo: 'Artifice' }
    const w = await mountPanel()

    expect(scenario(w)).toBe('user-create')
    expect(w.find('[data-testid="rewards-action-mine"]').text()).toContain(fr.Animation.Rewards.Start.CreateMine)
    expect(router.replace).not.toHaveBeenCalled()
  })

  it('une grille close n\'envoie pas sur la page de gestion', async () => {
    auth.isLoggedIn = true
    auth.activeCharacter = { id: 7, pseudo: 'Artifice' }
    server({ list: [mine({ status: 'closed' })] })
    const w = await mountPanel()

    expect(router.replace).not.toHaveBeenCalled()
    expect(w.find('[data-testid="rewards-action-mine"]').text()).toContain(fr.Animation.Rewards.Start.SeeMine)
  })
})

describe('RewardsStartPanel — déconnecté', () => {
  it('rien de mémorisé : créer sans compte ou retrouver la sienne', async () => {
    const w = await mountPanel()

    expect(scenario(w)).toBe('guest-start')
    expect(w.find('[data-testid="rewards-action-create"]').attributes('data-to')).toContain('animation-rewards-create')
    expect(w.find('[data-testid="rewards-action-manage"]').attributes('data-to')).toContain('animation-rewards-manage')
    expect(http.get).not.toHaveBeenCalled()
  })

  it('sans préférences acceptées, le dit une fois', async () => {
    const w = await mountPanel()

    expect(w.find('[data-testid="start-cookie-hint"]').exists()).toBe(true)
  })

  it('adresse mémorisée et grille tirée : la reprendre, voir sa page, et aller droit à la gestion', async () => {
    cookies.slug = 'foire-anonyme'
    cookies.accepted = true
    server({ shown: anon() })
    const w = await mountPanel()

    expect(http.get).toHaveBeenCalledWith('anim/rewards-grids/foire-anonyme')
    expect(scenario(w)).toBe('guest-resume')
    expect(w.find('[data-testid="start-remembered-text"]').text()).toContain('Foire anonyme')
    expect(w.find('[data-testid="rewards-action-page"]').attributes('data-to')).toContain('animation-rewards-public')
    expect(router.replace).toHaveBeenCalledWith({ name: 'animation-rewards-manage' })
  })

  it('adresse mémorisée mais grille PAS ENCORE TIRÉE (page publique introuvable) : la reprise est proposée, sans lien vers une page absente', async () => {
    cookies.slug = 'foire-anonyme'
    cookies.accepted = true
    server({ showStatus: 404, taken: true })
    const w = await mountPanel()

    expect(scenario(w)).toBe('guest-resume')
    expect(w.find('[data-testid="rewards-action-manage"]').exists()).toBe(true)
    expect(w.find('[data-testid="rewards-action-page"]').exists()).toBe(false)
    expect(router.replace).toHaveBeenCalledWith({ name: 'animation-rewards-manage' })
  })

  it('adresse mémorisée mais inconnue du serveur : rien n\'est proposé à la reprise', async () => {
    cookies.slug = 'disparue'
    cookies.accepted = true
    server({ showStatus: 404, taken: false })
    const w = await mountPanel()

    expect(scenario(w)).toBe('guest-start')
    expect(router.replace).not.toHaveBeenCalled()
  })

  it('adresse mémorisée d\'une grille close : rien n\'est proposé à la reprise', async () => {
    cookies.slug = 'foire-anonyme'
    server({ shown: anon({ status: 'closed' }) })
    const w = await mountPanel()

    expect(scenario(w)).toBe('guest-start')
  })

  it('en anglais, les textes viennent de la locale anglaise', async () => {
    const w = await mountPanel('en')

    expect(w.find('[data-testid="rewards-start-title"], h3').text()).toBe(en.Animation.Rewards.Start.Title)
  })
})

describe('RewardsStartPanel — connecté avec une grille sans compte mémorisée', () => {
  it('elle reste atteignable', async () => {
    auth.isLoggedIn = true
    auth.activeCharacter = { id: 7, pseudo: 'Artifice' }
    cookies.slug = 'foire-anonyme'
    server({ list: [], shown: anon() })
    const w = await mountPanel()

    expect(w.find('[data-testid="start-also-remembered"]').exists()).toBe(true)
  })
})
