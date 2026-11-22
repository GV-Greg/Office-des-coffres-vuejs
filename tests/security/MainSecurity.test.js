import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import MainSecurity from '../../src/views/modules/security/MainSecurity.vue'
import { useAuthStore } from '../../src/stores/authStore'
import { http } from '../../src/api.js'

/*
  Le menu de la Sécurité : le lien « Registre de douane » n'apparaît qu'à qui l'Office connaît un rôle dans la sécurité d'une province
  (GET characters/{id}/customs-access) — la règle vient de l'API, jamais recalculée ici. Sans compte : le Relevé de guet seul.
*/
vi.mock('../../src/api.js', () => ({ http: { get: vi.fn() } }))

const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const fr = JSON.parse(readFileSync(resolve(localesDir, 'fr.json'), 'utf-8'))
const en = JSON.parse(readFileSync(resolve(localesDir, 'en.json'), 'utf-8'))

async function mountMenu({ loggedIn = true, access = null, decider = null, locale = 'fr' } = {}) {
  setActivePinia(createPinia())
  if (loggedIn) useAuthStore().$patch({ user: { characters: [{ id: 7, pseudo: 'Artifice' }] }, token: 'jeton' })
  http.get.mockImplementation(url => Promise.resolve({ data: url.endsWith('/customs') ? { success: true, officer: null, can_request: true, decider } : { success: true, access } }))
  const wrapper = mount(MainSecurity, {
    global: {
      plugins: [createI18n({ legacy: false, locale, messages: { fr, en } })],
      stubs: { RouterLink: { template: '<a><slot /></a>' }, RouterView: true, NavMenu: true, 'v-icon': true },
    },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => vi.clearAllMocks())

describe('Menu de la Sécurité', () => {
  it('avec un rôle connu de l\'Office : « Registre de douane » apparaît à côté du Relevé de guet', async () => {
    const w = await mountMenu({ access: { province: { id: 3, name: 'Artois' } } })

    expect(w.find('[data-testid="customs-link"]').text()).toBe('Registre de douane')
    expect(w.text()).toContain('Relevé de guet')
    expect(w.text()).toContain('La Salle des gardes')
  })

  it('sans rôle : le lien n\'existe pas', async () => {
    expect((await mountMenu({ access: null })).find('[data-testid="customs-link"]').exists()).toBe(false)
  })

  it('sans compte : aucun appel à l\'API, le Relevé de guet seul', async () => {
    const w = await mountMenu({ loggedIn: false })

    expect(http.get).not.toHaveBeenCalled()
    expect(w.find('[data-testid="customs-link"]').exists()).toBe(false)
    expect(w.text()).toContain('Relevé de guet')
  })

  it('en anglais', async () => {
    const w = await mountMenu({ access: { province: { id: 3, name: 'Artois' } }, locale: 'en' })

    expect(w.find('[data-testid="customs-link"]').text()).toBe('Customs Register')
    expect(w.text()).toContain('The Guardroom')
  })

  it('« Douaniers » n\'est plus dans ce menu : la validation est un onglet de Mon bureau (Greg, 22/11/2026)', async () => {
    const decider = { level: 1, province: { id: 3, name: 'Artois' }, has_security_trio: true, pending: [], officers: [] }

    expect((await mountMenu({ decider })).find('[data-testid="officers-link"]').exists()).toBe(false)
    expect((await mountMenu({ decider })).text()).not.toContain('Douaniers')
  })
})
