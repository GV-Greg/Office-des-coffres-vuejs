import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import InventoryLevelsAccordion from '../../src/components/economy/InventoryLevelsAccordion.vue'
import InventoryCategoryPanel from '../../src/components/economy/InventoryCategoryPanel.vue'
import { useAuthStore } from '../../src/stores/authStore'
import { useCookieStore } from '../../src/stores/cookieStore'
import { http } from '../../src/api.js'

/*
  « Catégories d'inventaire » de Mon bureau : un accordéon par inventaire géré (personnel ; ville si l'on est maire ; province si l'on
  est commissaire au commerce, le dirigeant en lecture seule), la copie vers un autre personnage. Fils inventaire-scopes et
  inventaire-bilans (Greg et Cowork, 11/11/2026). Locales lues sur disque (un import de fr.json rend des messages précompilés).
*/
vi.mock('notivue', () => ({ push: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../src/api.js', () => ({ http: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }))

import { push } from 'notivue'

const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const fr = JSON.parse(readFileSync(resolve(localesDir, 'fr.json'), 'utf-8'))
const en = JSON.parse(readFileSync(resolve(localesDir, 'en.json'), 'utf-8'))

const ok = data => Promise.resolve({ data })
const SCOPES = {
  success: true,
  personal: { id: 7, name: 'Artifice', can_write: true, can_read: true },
  city: { id: 1, name: 'Arras', can_write: true, can_read: true },
  province: { id: 3, name: 'Artois', can_write: false, can_read: true },
}

function routes({ scopes = SCOPES, personal = { data: { exportColor: 'darkcyan' }, version: 1 } } = {}) {
  http.get.mockImplementation(url => {
    if (url.endsWith('inventory-scopes')) return ok(scopes)
    const level = url.split('/').pop()
    if (level === 'personal') return ok({ settings: { ...personal, scope: {} } })
    return ok({ settings: { data: null, version: 0, scope: {} } })
  })
}

async function mountAccordion({ loggedIn = true, locale = 'fr', characters = [{ id: 7, pseudo: 'Artifice' }, { id: 8, pseudo: 'Second' }] } = {}) {
  setActivePinia(createPinia())
  const auth = useAuthStore()
  if (loggedIn) auth.$patch({ user: { characters }, token: 'jeton' })
  const i18n = createI18n({ legacy: false, locale, messages: { fr, en } })
  const wrapper = mount(InventoryLevelsAccordion, { global: { plugins: [i18n], stubs: { 'v-icon': true } } })
  await flushPromises()
  return wrapper
}

const levelsShown = w => w.findAll('details').map(d => d.attributes('data-testid').replace('cats-accordion-', ''))

beforeEach(() => vi.clearAllMocks())

describe('sans compte : le seul niveau personnel, dans le navigateur', () => {
  it('un seul accordéon « Personnel », ouvert, sans copie ; les modifications vont dans le navigateur', async () => {
    const wrapper = await mountAccordion({ loggedIn: false })
    expect(levelsShown(wrapper)).toEqual(['personal'])
    expect(wrapper.find('details').attributes('open')).toBeDefined()
    expect(wrapper.find('#panel-cats-perso').text()).toBe(fr.MonBureau.CatPersoPanel)
    expect(wrapper.find('[data-testid="cats-copy"]').exists()).toBe(false)
    expect(http.get).not.toHaveBeenCalled()

    wrapper.findComponent(InventoryCategoryPanel).vm.$emit('update:itemCategories', { Pain: 'alimentation' })
    await flushPromises()
    expect(useCookieStore().getComfortData('inventory_custom_cats')).toEqual({ Pain: 'alimentation' })
    expect(http.put).not.toHaveBeenCalled()
  })
})

describe('avec un compte : un accordéon par inventaire que le serveur ouvre', () => {
  it('personnel, ville et province dans cet ordre, avec leurs titres ; le personnel est ouvert, les autres fermés', async () => {
    routes()
    const wrapper = await mountAccordion()
    expect(levelsShown(wrapper)).toEqual(['personal', 'city', 'province'])
    expect(wrapper.find('#panel-cats-perso').text()).toBe('Catégories d\'inventaire — Personnel')
    expect(wrapper.find('#panel-cats-city').text()).toBe('Catégories d\'inventaire — Ville : Arras')
    expect(wrapper.find('#panel-cats-province').text()).toBe('Catégories d\'inventaire — Province : Artois')
    expect(wrapper.find('[data-testid="cats-accordion-personal"]').attributes('open')).toBeDefined()
    expect(wrapper.find('[data-testid="cats-accordion-city"]').attributes('open')).toBeUndefined()
  })

  it('sans poste, seul l\'inventaire personnel : ni ville ni province', async () => {
    routes({ scopes: { ...SCOPES, city: null, province: null } })
    const wrapper = await mountAccordion()
    expect(levelsShown(wrapper)).toEqual(['personal'])
  })

  it('le dirigeant devant la province : lecture seule, annoncée, et le panneau reçoit `readonly`', async () => {
    routes()
    const wrapper = await mountAccordion()
    const panels = wrapper.findAllComponents(InventoryCategoryPanel)
    expect(panels.map(p => p.props('readonly'))).toEqual([false, false, true])
    const provinceAccordion = wrapper.find('[data-testid="cats-accordion-province"]')
    expect(provinceAccordion.find('[data-testid="cats-readonly"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cats-accordion-city"] [data-testid="cats-readonly"]').exists()).toBe(false)
  })

  it('les réglages de chaque niveau viennent du serveur, niveau par niveau', async () => {
    routes()
    await mountAccordion()
    const urls = http.get.mock.calls.map(c => c[0])
    expect(urls).toEqual(expect.arrayContaining([
      'characters/7/inventory-scopes',
      'characters/7/inventory-settings/personal',
      'characters/7/inventory-settings/city',
      'characters/7/inventory-settings/province',
    ]))
  })

  it('un niveau qui ne se charge pas affiche l\'erreur et propose de réessayer', async () => {
    http.get.mockImplementation(url => (url.endsWith('inventory-scopes')
      ? ok(SCOPES)
      : Promise.reject({ response: { status: 500, data: {} } })))
    const wrapper = await mountAccordion()
    expect(wrapper.find('[data-testid="cats-accordion-personal"] [data-testid="cats-error"]').text()).toContain(fr.MonBureau.SettingsLoadError)
  })
})

describe('copie des réglages vers un autre personnage du compte', () => {
  it('propose les AUTRES personnages et copie ; la copie ne s\'offre qu\'au niveau personnel', async () => {
    routes()
    http.post.mockReturnValue(ok({ settings: { data: {}, version: 1 } }))
    const wrapper = await mountAccordion()

    const copy = wrapper.find('[data-testid="cats-accordion-personal"] [data-testid="cats-copy"]')
    expect(copy.exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="cats-copy"]')).toHaveLength(1)
    expect(copy.findAll('option').map(o => o.text())).toEqual([fr.MonBureau.CopyChoose, 'Second'])

    expect(copy.find('[data-testid="cats-copy-button"]').attributes('disabled')).toBeDefined()
    await copy.find('select').setValue('8')
    await copy.find('[data-testid="cats-copy-button"]').trigger('click')
    await flushPromises()

    expect(http.post).toHaveBeenCalledWith('characters/8/inventory-settings/personal/copy', { from_character_id: 7, confirm_replace: false }, expect.anything())
    expect(push.success).toHaveBeenCalledWith('Réglages copiés vers Second.')
  })

  it('si la cible a déjà des réglages, le serveur demande confirmation : on remplace ou on annule', async () => {
    routes()
    const needsConfirmation = {
      response: { status: 409, data: { code: 'copy_needs_confirmation', messages: { fr: 'Second a déjà des réglages : ils seront remplacés.', en: 'x' } } },
    }
    http.post.mockRejectedValueOnce(needsConfirmation).mockReturnValueOnce(ok({ settings: { data: {}, version: 2 } }))
    const wrapper = await mountAccordion()
    const copy = () => wrapper.find('[data-testid="cats-copy"]')

    await copy().find('select').setValue('8')
    await copy().find('[data-testid="cats-copy-button"]').trigger('click')
    await flushPromises()
    expect(copy().find('[data-testid="cats-copy-confirm"]').text()).toContain('Second a déjà des réglages')
    expect(push.success).not.toHaveBeenCalled()

    await copy().find('[data-testid="cats-copy-replace"]').trigger('click')
    await flushPromises()
    expect(http.post.mock.calls[1][1]).toEqual({ from_character_id: 7, confirm_replace: true })
    expect(copy().find('[data-testid="cats-copy-confirm"]').exists()).toBe(false)
    expect(push.success).toHaveBeenCalled()
  })

  it('un seul personnage : rien à copier', async () => {
    routes()
    const wrapper = await mountAccordion({ characters: [{ id: 7, pseudo: 'Artifice' }] })
    expect(wrapper.find('[data-testid="cats-copy"]').exists()).toBe(false)
  })
})
