import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import InventoryCategoryPanel from '../../src/components/economy/InventoryCategoryPanel.vue'
import { CATEGORY_KEYS } from '../../src/modules/inventoryCategories'

// Lecture par fs : un import de fr.json est précompilé par le plugin vue-i18n et rend undefined.
const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const fr = JSON.parse(readFileSync(resolve(localesDir, 'fr.json'), 'utf-8'))
const en = JSON.parse(readFileSync(resolve(localesDir, 'en.json'), 'utf-8'))

// Chantier 3 du brief « inventaire — améliorations » (Cowork, 11/11/2026) : réordonner les catégories, par flèches.

function mountPanel(catConfig = { custom: [] }, locale = 'fr') {
  setActivePinia(createPinia())
  const i18n = createI18n({ legacy: false, locale, messages: { fr, en } })
  return mount(InventoryCategoryPanel, { props: { catConfig }, global: { plugins: [i18n] } })
}

const items = w => w.findAll('[data-testid="cat-order-item"]')
const labels = w => items(w).map(li => li.find('span.flex-1').text())

beforeEach(() => setActivePinia(createPinia()))

describe('InventoryCategoryPanel — ordre des catégories', () => {
  it("liste toutes les catégories visibles dans l'ordre par défaut quand rien n'est choisi", () => {
    const w = mountPanel()
    expect(items(w)).toHaveLength(CATEGORY_KEYS.length)
    expect(labels(w)[0]).toBe('Alimentation')
    expect(labels(w).at(-1)).toBe('Divers')
  })

  it("« Descendre » émet un ordre complet avec la catégorie échangée avec sa voisine", async () => {
    const w = mountPanel()
    await w.find('[data-testid="cat-down-alimentation"]').trigger('click')
    const [config] = w.emitted('update:catConfig').at(-1)
    expect(config.order.slice(0, 3)).toEqual(['matieres_premieres', 'alimentation', 'materiel_medical'])
    expect(config.order).toHaveLength(CATEGORY_KEYS.length)
    expect(config.custom).toEqual([])
  })

  it("« Monter » remonte la catégorie, selon l'ordre déjà choisi", async () => {
    const w = mountPanel({ custom: [], order: ['divers', 'alimentation'] })
    expect(labels(w).slice(0, 2)).toEqual(['Divers', 'Alimentation'])
    await w.find('[data-testid="cat-up-alimentation"]').trigger('click')
    const [config] = w.emitted('update:catConfig').at(-1)
    expect(config.order.slice(0, 2)).toEqual(['alimentation', 'divers'])
  })

  it('la première ne monte pas, la dernière ne descend pas (boutons désactivés)', () => {
    const w = mountPanel()
    expect(w.find('[data-testid="cat-up-alimentation"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-testid="cat-down-alimentation"]').attributes('disabled')).toBeUndefined()
    expect(w.find('[data-testid="cat-down-divers"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-testid="cat-up-divers"]').attributes('disabled')).toBeUndefined()
  })

  it('les catégories masquées ne figurent pas dans l\'ordre ; les personnalisées suivent les prédéfinies', () => {
    const w = mountPanel({ custom: [{ key: 'curiosites', fr: 'Curiosités', en: 'Curios' }], hiddenBuiltIn: ['animaux', 'divers'] })
    expect(items(w)).toHaveLength(CATEGORY_KEYS.length - 2 + 1)
    expect(labels(w)).not.toContain('Animaux')
    expect(labels(w).at(-1)).toBe('Curiosités')
  })

  it("une catégorie personnalisée se déplace comme les autres, et l'ordre périmé est ignoré", async () => {
    const w = mountPanel({
      custom: [{ key: 'curiosites', fr: 'Curiosités', en: 'Curios' }],
      order: ['supprimee', 'curiosites'],
    })
    expect(labels(w)[0]).toBe('Curiosités')
    await w.find('[data-testid="cat-down-curiosites"]').trigger('click')
    const [config] = w.emitted('update:catConfig').at(-1)
    expect(config.order[1]).toBe('curiosites')
    expect(config.order).not.toContain('supprimee')
  })

  it('annonce le déplacement aux lecteurs d\'écran et nomme la catégorie dans le libellé des flèches', async () => {
    const w = mountPanel()
    expect(w.find('[data-testid="cat-down-alimentation"]').attributes('aria-label')).toBe('Descendre la catégorie Alimentation')
    await w.find('[data-testid="cat-down-alimentation"]').trigger('click')
    expect(w.find('[data-testid="cat-order-status"]').text()).toBe(`Alimentation : position 2 sur ${CATEGORY_KEYS.length}`)
  })

  it("deux colonnes : la gestion des catégories à gauche, l'ordre à droite — l'ordre est toujours visible", () => {
    const w = mountPanel()
    const manage = w.find('[data-testid="cat-manage"]')
    const order = w.find('[data-testid="cat-order"]')
    expect(manage.exists()).toBe(true)
    expect(order.exists()).toBe(true)
    // même conteneur, gestion avant ordre ; l'ordre n'est plus replié
    expect(manage.element.parentElement).toBe(order.element.parentElement)
    expect(manage.element.nextElementSibling).toBe(order.element)
    expect(w.find('details').exists()).toBe(false)
    expect(order.text()).toContain('Ordre des catégories')
    // la gestion (prédéfinies, personnalisées, ajout) est bien dans la colonne de gauche, pas l'ordre
    expect(manage.text()).toContain('Ajouter une catégorie')
    expect(manage.find('[data-testid="cat-order-item"]').exists()).toBe(false)
    expect(order.findAll('[data-testid="cat-order-item"]')).toHaveLength(CATEGORY_KEYS.length)
  })

  it('les libellés suivent la langue de l\'interface', () => {
    const w = mountPanel({ custom: [{ key: 'curiosites', fr: 'Curiosités', en: 'Curios' }] }, 'en')
    expect(w.find('[data-testid="cat-order"]').text()).toContain('Category order')
    expect(labels(w)[0]).toBe('Food')
    expect(labels(w).at(-1)).toBe('Curios')
    expect(w.find('[data-testid="cat-down-alimentation"]').attributes('aria-label')).toBe('Move category Food down')
  })
})
