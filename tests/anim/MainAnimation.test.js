import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import MainAnimation from '../../src/views/modules/animation/MainAnimation.vue'
import { http } from '../../src/api.js'

// Menu du module Animation : il ne porte QUE les liens des pages — « Décode le code » seule —, rien d'autre.
// Les gestes d'une activité (organiser, retrouver la sienne, mes activités) vivent sur la page de l'activité.

vi.mock('../../src/api.js', () => ({ http: { get: vi.fn() } }))
vi.mock('../../src/stores/authStore', () => ({ useAuthStore: () => ({ isLoggedIn: true, getToken: 'jeton' }) }))

const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const readLocale = lang => JSON.parse(fs.readFileSync(path.join(localesDir, `${lang}.json`), 'utf8'))
const fr = readLocale('fr')
const en = readLocale('en')

// Un enfant qui reçoit la liste des types par `provide` : prouve qu'elle n'est chargée qu'une fois, ici, puis passée à l'accueil.
const Child = { inject: ['animationTypes'], template: '<span data-testid="provided">{{ animationTypes.join(",") }}</span>' }

async function mountPage({ types = ['decode'], locale = 'fr', fail = false } = {}) {
  if (fail) http.get.mockRejectedValue(new Error('réseau'))
  else http.get.mockResolvedValue({ data: { success: true, types } })
  const i18n = createI18n({ legacy: false, locale, messages: { fr, en } })
  const wrapper = mount(MainAnimation, {
    global: { plugins: [i18n], stubs: { NavMenu: true, RouterView: Child, RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' } } },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => vi.clearAllMocks())

describe('MainAnimation — menu', () => {
  it('liste le type ouvert avec son nom tiré des locales', async () => {
    const w = await mountPage()

    expect(http.get).toHaveBeenCalledWith('anim/activity-types')
    expect(w.find('[data-testid="anim-type-decode"]').text()).toContain('Décode le code')
    expect(w.find('[data-testid="anim-type-decode"]').attributes('data-to')).toContain('animation-decode')
  })

  it('en anglais : Crack the Code', async () => {
    const w = await mountPage({ locale: 'en' })

    expect(w.find('[data-testid="anim-type-decode"]').text()).toContain('Crack the Code')
  })

  it('le menu ne porte QUE « Décode le code » : ni gestes sans compte, ni « Ma salle », ni texte d\'aide', async () => {
    const w = await mountPage()

    const links = w.findAll('a').filter(a => a.attributes('data-testid') !== 'anim-home-link')
    expect(links).toHaveLength(1)
    expect(w.find('[data-testid="anim-create-link"]').exists()).toBe(false)
    expect(w.find('[data-testid="anim-manage-link"]').exists()).toBe(false)
    expect(w.find('[data-testid="anim-mine-link"]').exists()).toBe(false)
    expect(w.text()).not.toContain('L\'Office n\'en garantit ni les règles ni les gains')
  })

  it('le titre du module ramène à son accueil', async () => {
    const w = await mountPage()

    expect(w.find('[data-testid="anim-home-link"]').attributes('data-to')).toContain('"animation"')
  })

  it('un type désactivé n\'est pas affiché', async () => {
    const w = await mountPage({ types: [] })

    expect(w.find('[data-testid="anim-type-decode"]').exists()).toBe(false)
  })

  it('un type que le site ne connaît pas n\'est pas affiché', async () => {
    const w = await mountPage({ types: ['grid'] })

    expect(w.find('[data-testid="anim-type-grid"]').exists()).toBe(false)
  })

  it('en cas de panne, on n\'affiche pas un type peut-être fermé', async () => {
    const w = await mountPage({ fail: true })

    expect(w.find('[data-testid="anim-type-decode"]').exists()).toBe(false)
  })

  it('passe la liste des types à la page par provide — une seule requête', async () => {
    const w = await mountPage({ types: ['decode', 'grid'] })

    expect(w.find('[data-testid="provided"]').text()).toBe('decode,grid')
    expect(http.get).toHaveBeenCalledTimes(1)
  })
})
