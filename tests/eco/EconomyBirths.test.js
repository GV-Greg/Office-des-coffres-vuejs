import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createTestingPinia } from '@pinia/testing'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import EconomyBirths from '../../src/views/modules/economy/EconomyBirths.vue'
import { http } from '../../src/api.js'

// Le Livre des naissances sans compte : un calculateur public, qui ne stocke rien et n'appelle pas le serveur (avec un poste : livestockPages.test.js).
vi.mock('../../src/api.js', () => ({ http: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }))

const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const fr = JSON.parse(readFileSync(resolve(localesDir, 'fr.json'), 'utf-8'))
const en = JSON.parse(readFileSync(resolve(localesDir, 'en.json'), 'utf-8'))

const mountPage = (locale = 'fr') => mount(EconomyBirths, {
  global: {
    plugins: [createI18n({ legacy: false, locale, messages: { fr, en } }), createTestingPinia({ createSpy: vi.fn, stubActions: false })],
    stubs: { 'v-icon': true, RouterLink: true },
  },
})
const find = (w, id) => w.find(`[data-testid="${id}"]`)
const click = (w, id) => find(w, id).trigger('click')

beforeEach(() => vi.clearAllMocks())

describe('EconomyBirths', () => {
  it('s\'ouvre sur une vache au maïs : 12 sacs, 0,75 perdu', () => {
    const w = mountPage()

    expect(find(w, 'births-real').text()).toBe('Pour 1 naissance, sortez 12 sacs de maïs.')
    expect(find(w, 'births-theoretical').text()).toContain('11,25')
    expect(find(w, 'births-waste').text()).toBe('Attention, vous allez gaspiller 0,75 sac de maïs pour 1 naissance.')
    expect(find(w, 'births-price').text()).toContain('45 écus')
  })

  it('3 cochons au blé : 5 sacs, rien ne se perd', async () => {
    const w = mountPage()
    await click(w, 'births-species-pig')
    await click(w, 'births-ingredient-wheat')
    await click(w, 'births-quantity-3')

    expect(find(w, 'births-real').text()).toContain('5')
    expect(find(w, 'births-waste').exists()).toBe(false)
    expect(find(w, 'births-no-waste').text()).toBe('Rien ne se perd.')
    expect(find(w, 'births-quantity-3').attributes('aria-pressed')).toBe('true')
  })

  it('les abeilles ont leurs ingrédients ; l\'ingrédient suit l\'espèce', async () => {
    const w = mountPage()
    await click(w, 'births-ingredient-wheat')
    await click(w, 'births-species-sheep')
    expect(find(w, 'births-ingredient-wheat').attributes('aria-pressed')).toBe('true')

    await click(w, 'births-species-bees')
    expect(find(w, 'births-ingredient-wheat').exists()).toBe(false)
    expect(find(w, 'births-ingredient-marjoram').attributes('aria-pressed')).toBe('true')
    expect(find(w, 'births-real').text()).toContain('69')
    await click(w, 'births-ingredient-elderberry')
    expect(find(w, 'births-real').text()).toContain('22')
  })

  it('les quatre lots se comparent côte à côte, et la colonne est le choix du nombre', async () => {
    const w = mountPage()
    await click(w, 'births-species-sheep')
    await click(w, 'births-ingredient-wheat')
    await click(w, 'births-quantity-2')

    expect(find(w, 'births-lost-label-3').text()).toBe('rien de perdu')
    expect(find(w, 'births-lost-label-4').text()).toBe('0,67 perdu')
    expect(find(w, 'births-quantity-2').attributes('aria-pressed')).toBe('true')
    // Le dernier sac se remplit de ce qui sert : plein quand rien ne se perd.
    expect(find(w, 'births-fill-3').attributes('height')).toBe('64')
    expect(Number(find(w, 'births-fill-1').attributes('height'))).toBeCloseTo(64 / 3)
  })

  it('parle anglais, et ne contacte jamais le serveur ni ne stocke rien', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const w = mountPage('en')
    await click(w, 'births-species-pig')

    expect(find(w, 'births-waste').text()).toBe('Beware, you will waste 0.75 sack of maize for 1 birth.')
    expect(http.get).not.toHaveBeenCalled()
    expect(http.post).not.toHaveBeenCalled()
    expect(setItem).not.toHaveBeenCalled()
  })
})
