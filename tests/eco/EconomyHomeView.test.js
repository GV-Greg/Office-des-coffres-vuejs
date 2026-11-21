import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { ref } from 'vue'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import EconomyHomeView from '../../src/views/modules/economy/EconomyHomeView.vue'

// Accueil de la Salle des comptes : les cartes suivent les deux groupes du menu (Mines, Inventaires).

const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const readLocale = lang => JSON.parse(fs.readFileSync(path.join(localesDir, `${lang}.json`), 'utf8'))
const messages = { fr: readLocale('fr'), en: readLocale('en') }

function mountHome({ locale = 'fr', read = false, stockRegistry = false } = {}) {
  const i18n = createI18n({ legacy: false, locale, messages })
  return mount(EconomyHomeView, {
    global: {
      plugins: [i18n],
      provide: { economyAccess: ref(read ? { read: { id: 1 } } : null), economyAccessReady: ref(true), economyStockRegistryAccess: ref(stockRegistry) },
      stubs: { RouterLink: { template: '<a><slot /></a>' }, 'v-icon': true },
    },
  })
}

describe('EconomyHomeView — groupes de cartes', () => {
  it('Mines (Bilan des mines) puis Inventaires (Bilan et Balance des stocks), sans registre pour qui n\'y a pas droit', () => {
    const w = mountHome()
    expect(w.find('[data-testid="economy-group-mines"] h3').text()).toBe('Mines')
    expect(w.find('[data-testid="economy-group-inventories"] h3').text()).toBe('Inventaires')
    expect(w.findAll('[data-testid="economy-group-mines"] article').map(a => a.attributes('data-testid'))).toEqual(['card-mines'])
    expect(w.findAll('[data-testid="economy-group-inventories"] article').map(a => a.attributes('data-testid'))).toEqual(['card-inventory', 'card-balance'])
  })

  it('le Registre des mines rejoint le groupe Mines pour qui peut le lire', () => {
    const w = mountHome({ read: true })
    expect(w.findAll('[data-testid="economy-group-mines"] article').map(a => a.attributes('data-testid'))).toEqual(['card-mines', 'card-registry'])
  })

  it('la carte du Registre des stocks rejoint le groupe Inventaires pour qui peut le lire (maire, commissaire au commerce, dirigeant)', () => {
    expect(mountHome().find('[data-testid="card-inventoryRegistry"]').exists()).toBe(false)
    const w = mountHome({ stockRegistry: true })
    expect(w.findAll('[data-testid="economy-group-inventories"] article').map(x => x.attributes('data-testid'))).toEqual(['card-inventory', 'card-balance', 'card-inventoryRegistry'])
    expect(w.find('[data-testid="card-inventoryRegistry"]').text()).toContain('Feuilletez le livre des stocks de votre province ou de votre ville')
    expect(mountHome({ locale: 'en', stockRegistry: true }).find('[data-testid="card-inventoryRegistry"]').text()).toContain('Stock Registry')
  })

  it('les groupes sont en deux colonnes, les cartes empilées dans chacun', () => {
    const w = mountHome({ read: true })
    expect(w.find('[data-testid="economy-groups"]').classes()).toContain('tablet:grid-cols-2')
    for (const key of ['mines', 'inventories']) {
      const cards = w.find(`[data-testid="economy-home-cards-${key}"]`)
      expect(cards.classes()).toContain('grid-cols-1')
      expect(cards.classes()).not.toContain('desktop:grid-cols-3')
    }
  })

  it('la carte de la Balance s\'écrit sans « La », comme le lien du menu : « Balance des stocks » / « Stock Balance »', () => {
    expect(mountHome().find('[data-testid="card-balance"] h3').text()).toBe('Balance des stocks')
    expect(mountHome({ locale: 'en' }).find('[data-testid="card-balance"] h3').text()).toBe('Stock Balance')
  })

  it('la carte du module s\'appelle « Bilan des stocks » / « Stock Report »', () => {
    expect(mountHome().find('[data-testid="card-inventory"]').text()).toContain('Bilan des stocks')
    expect(mountHome({ locale: 'en' }).find('[data-testid="card-inventory"]').text()).toContain('Stock Report')
  })
})
