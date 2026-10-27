import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { reactive } from 'vue'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import MainAnimation from '../../src/views/modules/animation/MainAnimation.vue'
import { http } from '../../src/api.js'

// Menu du module Animation : un lien par type d'activité OUVERT (le serveur le dit), « Mes activités » si connecté.

vi.mock('../../src/api.js', () => ({ http: { get: vi.fn() } }))
const auth = reactive({ isLoggedIn: true, getToken: 'jeton' })
vi.mock('../../src/stores/authStore', () => ({ useAuthStore: () => auth }))

const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const readLocale = lang => JSON.parse(fs.readFileSync(path.join(localesDir, `${lang}.json`), 'utf8'))
const fr = readLocale('fr')
const en = readLocale('en')

async function mountPage({ types = ['decode'], locale = 'fr', fail = false } = {}) {
  if (fail) http.get.mockRejectedValue(new Error('réseau'))
  else http.get.mockResolvedValue({ data: { success: true, types } })
  const i18n = createI18n({ legacy: false, locale, messages: { fr, en } })
  const wrapper = mount(MainAnimation, {
    global: { plugins: [i18n], stubs: { NavMenu: true, RouterView: true, RouterLink: { props: ['to'], template: '<a><slot /></a>' } } },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.isLoggedIn = true
})

describe('MainAnimation — menu', () => {
  it('liste le type ouvert avec son nom tiré des locales', async () => {
    const w = await mountPage()

    expect(http.get).toHaveBeenCalledWith('anim/activity-types')
    expect(w.find('[data-testid="anim-type-decode"]').text()).toContain('Les Coffres Scellés')
  })

  it('en anglais : The Sealed Chests', async () => {
    const w = await mountPage({ locale: 'en' })

    expect(w.find('[data-testid="anim-type-decode"]').text()).toContain('The Sealed Chests')
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

  it('« Mes activités » seulement connecté', async () => {
    expect((await mountPage()).find('[data-testid="anim-mine-link"]').exists()).toBe(true)

    auth.isLoggedIn = false
    expect((await mountPage()).find('[data-testid="anim-mine-link"]').exists()).toBe(false)
  })
})
