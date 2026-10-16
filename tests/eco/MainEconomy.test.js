import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { reactive } from 'vue'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import MainEconomy from '../../src/views/modules/economy/MainEconomy.vue'
import { http } from '../../src/api.js'

// Aides du module Économie (lot 3 des prix) : l'aide du registre ouvre ses neuf étapes, celle du Bilan ses cinq.

vi.mock('../../src/api.js', () => ({ http: { get: vi.fn() } }))
const auth = reactive({ isLoggedIn: true, activeCharacter: { id: 7, pseudo: 'Artifice' }, getToken: 'jeton' })
vi.mock('../../src/stores/authStore', () => ({ useAuthStore: () => auth }))

const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const readLocale = lang => JSON.parse(fs.readFileSync(path.join(localesDir, `${lang}.json`), 'utf8'))
const fr = readLocale('fr')
const en = readLocale('en')

async function mountPage(locale = 'fr') {
  http.get.mockResolvedValue({ data: { success: true, read: { id: 1, name: 'Artois' }, write: null, prices: { write: null, read: null } } })
  const i18n = createI18n({ legacy: false, locale, messages: { fr, en } })
  const wrapper = mount(MainEconomy, {
    global: { plugins: [i18n], stubs: { NavMenu: true, RouterView: true, RouterLink: { template: '<a><slot /></a>' }, 'v-icon': true } },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => vi.clearAllMocks())

describe('MainEconomy — aides', () => {
  it('l\'aide du registre déroule ses neuf étapes, dont les prix et l\'export', async () => {
    const w = await mountPage()
    await w.find('[data-testid="registry-help"]').trigger('click')

    const items = w.findAll('ol li')
    expect(items).toHaveLength(9)
    expect(w.text()).toContain('Gérer les prix')
    expect(w.text()).toContain('Confier au scribe')
  })

  it('en anglais, avec les termes du jeu', async () => {
    const w = await mountPage('en')
    await w.find('[data-testid="registry-help"]').trigger('click')

    expect(w.findAll('ol li')).toHaveLength(9)
    expect(w.text()).toContain('Trade Minister')
    expect(w.text()).toContain('Entrust it to the scribe')
  })

  it('l\'aide du Bilan a cinq étapes, la dernière sur les prix en lecture seule d\'un gérant', async () => {
    const w = await mountPage()
    const help = w.findAll('button').find(b => b.attributes('aria-label') === 'Comment fonctionne le Bilan des mines ?' || b.attributes('title') === fr.EconomyMines.HelpButton)
    await help.trigger('click')

    expect(w.findAll('ol li')).toHaveLength(5)
    expect(w.text()).toContain('lecture seule')
  })
})
