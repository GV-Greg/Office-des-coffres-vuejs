import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ChestLoader from '../../src/components/loading/ChestLoader.vue'
import { timing } from '../../src/modules/chestTiming'

// Coffre de chargement interne (charte §8, maquette admin/content/demo-animations-chargement.html). Les durées
// sont celles du VRAI module : tests/setup.js les rend instantanées, on les remet ici et on pilote le temps.

const dir = dirname(fileURLToPath(import.meta.url))
const read = (lang) => JSON.parse(readFileSync(resolve(dir, `../../src/locales/${lang}.json`), 'utf8'))
const i18n = createI18n({ legacy: false, locale: 'fr', messages: { fr: read('fr'), en: read('en') } })

const mountLoader = (props = {}) => mount(ChestLoader, {
  props: { loading: true, ...props },
  slots: { default: '<p data-testid="content">le tableau</p>' },
  global: { plugins: [i18n], stubs: { 'v-icon': true, Transition: false } },
})
const chest = (w) => w.find('[data-testid="chest-loader"]')
const content = (w) => w.find('[data-testid="content"]')
const tick = async (w, ms) => { vi.advanceTimersByTime(ms); await w.vm.$nextTick() }

beforeEach(() => { timing.instant = false; vi.useFakeTimers() })
afterEach(() => { timing.instant = true; vi.useRealTimers() })

describe('ChestLoader', () => {
  it("n'affiche aucun coffre quand le chargement finit avant le délai anti-flash", async () => {
    const w = mountLoader()
    await tick(w, 100)
    expect(chest(w).exists()).toBe(false)
    await w.setProps({ loading: false })
    expect(chest(w).exists()).toBe(false)
    expect(content(w).exists()).toBe(true)
  })

  it('montre le coffre après 150 ms, sans le contenu', async () => {
    const w = mountLoader()
    expect(content(w).exists()).toBe(false)
    await tick(w, 150)
    expect(chest(w).exists()).toBe(true)
    expect(w.find('[data-testid="chest-title"]').text()).toBe(fr('Chest.Opening'))
    expect(content(w).exists()).toBe(false)
  })

  it("n'affiche aucune étape : le coffre seul, et le contenu attend la fin de l'ouverture même si les données sont là", async () => {
    const w = mountLoader()
    await tick(w, 150)
    await w.setProps({ loading: false })
    expect(w.find('ul').exists()).toBe(false)
    expect(content(w).exists()).toBe(false)
    await tick(w, 1750)
    await tick(w, 1000)
    expect(content(w).exists()).toBe(true)
  })

  it("enchaîne : le coffre disparaît d'abord, le contenu n'apparaît qu'ensuite (jamais les deux)", async () => {
    const w = mountLoader()
    await tick(w, 150)
    await tick(w, 1750) // ouverture finie
    await w.setProps({ loading: false })
    let overlap = false
    for (let ms = 0; ms < 1400; ms += 50) {
      await tick(w, 50)
      if (chest(w).exists() && content(w).exists()) overlap = true
    }
    expect(overlap).toBe(false)
    expect(chest(w).exists()).toBe(false)
    expect(content(w).exists()).toBe(true)
  })

  it('un chargement raté referme le coffre, dit pourquoi et propose de réessayer', async () => {
    const w = mountLoader({ errorTestid: 'x-error' })
    await tick(w, 150)
    await w.setProps({ loading: false, error: 'Hors ligne' })
    expect(w.find('[data-testid="chest-title"]').text()).toBe(fr('Chest.Failed'))
    expect(w.find('[data-testid="x-error"]').text()).toBe('Hors ligne')
    expect(content(w).exists()).toBe(false)
    await w.find('[data-testid="chest-retry"]').trigger('click')
    expect(w.emitted('retry')).toHaveLength(1)
  })

  it('une erreur arrivée avant le délai anti-flash est quand même dite', async () => {
    const w = mountLoader({ loading: false, error: 'Hors ligne' })
    expect(w.find('[data-testid="chest-title"]').text()).toBe(fr('Chest.Failed'))
  })

  it('au-delà de 10 s, il propose de réessayer sans attendre le délai d\'axios', async () => {
    const w = mountLoader()
    await tick(w, 9900)
    expect(w.find('[data-testid="chest-retry"]').exists()).toBe(false)
    await tick(w, 200)
    expect(w.find('[data-testid="chest-title"]').text()).toBe(fr('Chest.Slow'))
    await w.find('[data-testid="chest-retry"]').trigger('click')
    expect(w.emitted('retry')).toHaveLength(1)
    expect(w.find('[data-testid="chest-retry"]').exists()).toBe(false) // le compte à rebours repart
  })

  it('garde le même titre jusqu\'au bout, sans changer de texte à la fin de l\'ouverture', async () => {
    const w = mountLoader()
    await tick(w, 150)
    const before = w.find('[data-testid="chest-title"]').text()
    await tick(w, 1800)
    await w.setProps({ loading: false })
    await tick(w, 300)
    expect(w.find('[data-testid="chest-title"]').text()).toBe(before)
  })

  it('annonce une seule fois (role=status)', async () => {
    const w = mountLoader()
    await tick(w, 150)
    expect(chest(w).attributes('role')).toBe('status')
  })

  it('en test (durées instantanées), le contenu suit tout de suite la fin du chargement', async () => {
    timing.instant = true
    const w = mountLoader()
    await w.setProps({ loading: false })
    expect(content(w).exists()).toBe(true)
  })

  it('pose la classe de placement reçue sur le coffre (cale-le sur le tableau, pas sur la page)', async () => {
    const w = mountLoader({ blockClass: 'laptop:w-3/5' })
    await tick(w, 150)
    expect(chest(w).classes()).toContain('laptop:w-3/5')
  })
})

function fr(key) {
  return key.split('.').reduce((o, k) => o[k], read('fr'))
}
