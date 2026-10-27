import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import SlugField from '../../src/components/anim/SlugField.vue'
import { http } from '../../src/api.js'

// L'adresse d'une activité (D3, D14, D26, D27) : proposée depuis le nom, modifiable, jamais modifiée en silence. AUCUNE règle de slug côté
// site — l'aperçu, la validité et la disponibilité viennent du serveur (GET anim/decode-slug).

vi.mock('../../src/api.js', () => ({ http: { get: vi.fn() } }))
vi.mock('../../src/stores/authStore', () => ({ useAuthStore: () => ({ getToken: 'jeton' }) }))

const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const readLocale = lang => JSON.parse(fs.readFileSync(path.join(localesDir, `${lang}.json`), 'utf8'))
const messages = { fr: readLocale('fr'), en: readLocale('en') }

const answer = (over = {}) => ({ data: { success: true, proposal: 'les-trois-coffres', slug: 'les-trois-coffres', valid: true, taken: false, min: 3, max: 20, ...over } })

function mountField(props = {}) {
  return mount(SlugField, {
    props: { name: '', modelValue: '', delay: 0, ...props },
    global: { plugins: [createI18n({ legacy: false, locale: 'fr', messages })] },
  })
}

beforeEach(() => vi.clearAllMocks())

describe('SlugField', () => {
  it('le nom change : le SERVEUR propose l\'adresse, le champ la reçoit', async () => {
    http.get.mockResolvedValue(answer())
    const w = mountField()

    await w.setProps({ name: 'Les Trois Coffres' })
    await flushPromises()

    expect(http.get).toHaveBeenCalledWith('anim/decode-slug', { params: { name: 'Les Trois Coffres' } })
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['les-trois-coffres'])
  })

  it('dit en toutes lettres qu\'une adresse est libre, prise ou refusée — la couleur ne porte jamais seule le sens', async () => {
    http.get.mockResolvedValue(answer())
    const w = mountField({ modelValue: 'les-trois-coffres' })
    await w.setProps({ name: 'Les Trois Coffres' })
    await flushPromises()
    expect(w.find('[data-testid="slug-status"]').text()).toContain('Cette adresse est libre.')

    http.get.mockResolvedValue(answer({ taken: true }))
    await w.find('[data-testid="slug-input"]').setValue('les-trois-coffres')
    await flushPromises()
    expect(w.find('[data-testid="slug-status"]').text()).toContain('déjà prise')

    http.get.mockResolvedValue(answer({ valid: false }))
    await w.find('[data-testid="slug-input"]').setValue('abc1')
    await flushPromises()
    // Les bornes viennent du serveur (min 3, max 20), pas du site.
    expect(w.find('[data-testid="slug-status"]').text()).toContain('de 3 à 20 lettres minuscules')
  })

  it('corrigée à la main, l\'adresse ne suit plus le nom ; le serveur en dit la validité', async () => {
    http.get.mockResolvedValue(answer())
    const w = mountField({ modelValue: 'ma-version' })

    await w.find('[data-testid="slug-input"]').setValue('ma-version')
    await flushPromises()
    expect(http.get).toHaveBeenLastCalledWith('anim/decode-slug', { params: { slug: 'ma-version' } })

    http.get.mockClear()
    await w.setProps({ name: 'Un tout autre nom' })
    await flushPromises()

    expect(http.get).not.toHaveBeenCalled() // le nom ne réécrit pas une adresse corrigée à la main
  })

  it('jamais de suffixe automatique : une adresse prise reste telle quelle', async () => {
    http.get.mockResolvedValue(answer({ taken: true }))
    const w = mountField({ modelValue: 'les-trois-coffres' })

    await w.find('[data-testid="slug-input"]').setValue('les-trois-coffres')
    await flushPromises()

    expect(w.emitted('update:modelValue').at(-1)).toEqual(['les-trois-coffres'])
    expect(w.find('[data-testid="slug-status"]').text()).toContain('déjà prise')
  })

  it('annonce son état au parent (valide, prise, vérifiée)', async () => {
    http.get.mockResolvedValue(answer({ taken: true }))
    const w = mountField({ modelValue: 'les-trois-coffres' })

    await w.find('[data-testid="slug-input"]').setValue('les-trois-coffres')
    await flushPromises()

    expect(w.emitted('state').at(-1)).toEqual([{ valid: true, taken: true, checked: true }])
  })

  it('une réponse périmée n\'écrase pas la plus récente', async () => {
    let resolveFirst
    http.get
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
      .mockResolvedValueOnce(answer({ taken: true }))
    const w = mountField({ modelValue: 'ab' })

    await w.find('[data-testid="slug-input"]').setValue('abc')       // 1re question, en attente
    await w.find('[data-testid="slug-input"]').setValue('abcd')      // 2e, répondue tout de suite
    await flushPromises()
    resolveFirst(answer({ taken: false }))                           // la 1re arrive après
    await flushPromises()

    expect(w.emitted('state').at(-1)).toEqual([{ valid: true, taken: true, checked: true }])
  })

  it('une panne du serveur n\'invente pas une adresse valable', async () => {
    http.get.mockRejectedValue(new Error('réseau'))
    const w = mountField({ modelValue: 'les-trois-coffres' })

    await w.find('[data-testid="slug-input"]').setValue('les-trois-coffres')
    await flushPromises()

    expect(w.emitted('state').at(-1)[0].checked).toBe(false)
  })

  it('champ vide : l\'invite à partir du nom', () => {
    const w = mountField()

    expect(w.find('[data-testid="slug-status"]').text()).toContain('proposée à partir du nom')
  })
})
