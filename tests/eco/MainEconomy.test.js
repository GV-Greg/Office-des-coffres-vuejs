import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
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

// `scopes` : ce que l'API des inventaires répond (niveaux ouverts au personnage) ; sans ville ni province, pas de Registre des stocks.
const NO_SCOPES = { success: true, personal: { id: 7, can_write: true }, city: null, province: null }

async function mountPage(locale = 'fr', scopes = NO_SCOPES) {
  setActivePinia(createPinia())
  http.get.mockImplementation(url => Promise.resolve({
    data: url.endsWith('inventory-scopes')
      ? scopes
      : { success: true, read: { id: 1, name: 'Artois' }, write: null, prices: { write: null, read: null } },
  }))
  const i18n = createI18n({ legacy: false, locale, messages: { fr, en } })
  const wrapper = mount(MainEconomy, {
    global: { plugins: [i18n], stubs: { NavMenu: true, RouterView: true, RouterLink: { template: '<a><slot /></a>' }, 'v-icon': true } },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => vi.clearAllMocks())

describe('MainEconomy — menu', () => {
  it('le lien de la Balance des stocks s\'écrit sans « La », comme « Bilan des mines » et « Bilan des stocks »', async () => {
    const w = await mountPage()
    expect(w.find('[data-testid="balance-link"]').text()).toBe('Balance des stocks')
  })

  it('en anglais : « Stock Balance »', async () => {
    const w = await mountPage('en')
    expect(w.find('[data-testid="balance-link"]').text()).toBe('Stock Balance')
  })

  it('deux étiquettes non cliquables : Mines, puis Inventaires', async () => {
    const w = await mountPage()
    const mines = w.find('[data-testid="menu-group-mines"]')
    const inventories = w.find('[data-testid="menu-group-inventories"]')
    expect(mines.text()).toBe('Mines')
    expect(inventories.text()).toBe('Inventaires')
    expect(mines.element.tagName).toBe('SPAN')
  })

  it('le Registre des mines est dans le groupe Mines, le Bilan et la Balance des stocks dans le groupe Inventaires, le Livre des naissances dans Finances', async () => {
    const w = await mountPage()
    const labels = w.findAll('a, [data-testid^="menu-group-"]').map(n => n.text())
    expect(labels).toEqual(['Coffres Économie', 'Mines', 'Bilan des mines', 'Registre des mines', 'Inventaires', 'Bilan des stocks', 'Balance des stocks', 'Finances', 'Livre des naissances'])
  })

  it('le Registre des stocks : lien sous Inventaires, seulement pour le maire, le commissaire au commerce ou le dirigeant', async () => {
    expect((await mountPage()).find('[data-testid="stock-registry-link"]').exists()).toBe(false)

    const mayor = await mountPage('fr', { ...NO_SCOPES, city: { id: 1, name: 'Arras', can_write: true, can_read: true } })
    expect(mayor.find('[data-testid="stock-registry-link"]').text()).toBe('Registre des stocks')
    const labels = mayor.findAll('a, [data-testid^="menu-group-"]').map(n => n.text())
    expect(labels.slice(-6)).toEqual(['Inventaires', 'Bilan des stocks', 'Balance des stocks', 'Registre des stocks', 'Finances', 'Livre des naissances'])

    const leader = await mountPage('fr', { ...NO_SCOPES, province: { id: 3, name: 'Artois', can_write: false, can_read: true } })
    expect(leader.find('[data-testid="stock-registry-link"]').exists()).toBe(true)
  })

  it('l\'aide « i » du Registre des stocks ouvre ses cinq étapes (comme les autres liens du menu)', async () => {
    const w = await mountPage('fr', { ...NO_SCOPES, city: { id: 1, name: 'Arras', can_write: true, can_read: true } })
    const button = w.find('[data-testid="stock-registry-help"]')
    expect(button.attributes('aria-label')).toBe('Comment ça marche ?')
    await button.trigger('click')
    const modal = w.findAllComponents({ name: 'HelpModal' }).find(m => m.props('show'))
    expect(modal.props('title')).toBe('Comment fonctionne le Registre des stocks ?')
    expect(modal.props('steps')).toHaveLength(5)
    expect(modal.props('steps')[1]).toContain('Inscrire au registre')
  })

  it('pas de lien, donc pas d\'aide, sans poste de lecture', async () => {
    expect((await mountPage()).find('[data-testid="stock-registry-help"]').exists()).toBe(false)
  })

  it('en anglais : « Stock Registry »', async () => {
    const w = await mountPage('en', { ...NO_SCOPES, city: { id: 1, name: 'Arras', can_write: true, can_read: true } })
    expect(w.find('[data-testid="stock-registry-link"]').text()).toBe('Stock Registry')
  })

  it('en anglais : « Inventories » et « Stock Report », plus aucun « Stock Management »', async () => {
    const w = await mountPage('en')
    expect(w.find('[data-testid="menu-group-inventories"]').text()).toBe('Inventories')
    expect(w.text()).toContain('Stock Report')
    expect(w.text()).not.toContain('Stock Management')
  })
})

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
