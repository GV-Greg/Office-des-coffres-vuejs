import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import SelectorCharacter from '../../src/components/SelectorCharacter.vue'
import { useAuthStore } from '../../src/stores/authStore'

// Sélecteur de personnage : liste dessinée par le site (motif listbox de l'APG W3C).
const i18n = createI18n({ legacy: false, locale: 'fr', messages: { fr: {
  NavBar: { CharacterSelector: 'Changer de personnage' }, Profil: { ActiveCharacter: 'Personnage actif à la connexion' },
} } })

function mountSelector() {
  const wrapper = mount(SelectorCharacter, {
    attachTo: document.body,
    global: { plugins: [i18n, createTestingPinia({ createSpy: vi.fn })], stubs: { 'v-icon': true } },
  })
  const store = useAuthStore()
  store.$patch({ user: { characters: [{ id: 1, pseudo: 'Artifice' }, { id: 2, pseudo: 'Buldo' }] }, token: 'jeton' })
  return { wrapper, store }
}

beforeEach(() => { document.body.innerHTML = '' })

describe('SelectorCharacter', () => {
  it('fermé par défaut ; le bouton annonce une liste et son état', async () => {
    const { wrapper } = mountSelector()
    await wrapper.vm.$nextTick()
    const button = wrapper.find('[data-testid="character-selector"]')
    expect(button.attributes('aria-haspopup')).toBe('listbox')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[data-testid="character-options"]').isVisible()).toBe(false)
  })

  it('s\'ouvre au clic, la liste prend le focus, l\'option active est annoncée', async () => {
    const { wrapper } = mountSelector()
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="character-selector"]').trigger('click')
    const list = wrapper.find('[data-testid="character-options"]')

    expect(list.isVisible()).toBe(true)
    expect(document.activeElement).toBe(list.element)
    expect(wrapper.findAll('[role="option"]')).toHaveLength(2)
    expect(list.attributes('aria-activedescendant')).toBe('character-option-0')
  })

  it('l\'option active porte un indicateur visible (liseré ≥ 3:1), pas seulement un fond pâle', async () => {
    const { wrapper } = mountSelector()
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="character-selector"]').trigger('click')
    const [active, other] = wrapper.findAll('[role="option"]')

    expect(active.classes()).toContain('border-orange-700')
    expect(other.classes()).toContain('border-transparent')
  })

  it('↓ puis Entrée choisit le personnage suivant, ferme et rend le focus au bouton', async () => {
    const { wrapper, store } = mountSelector()
    await wrapper.vm.$nextTick()
    const button = wrapper.find('[data-testid="character-selector"]')
    await button.trigger('click')
    const list = wrapper.find('[data-testid="character-options"]')
    await list.trigger('keydown', { key: 'ArrowDown' })
    await list.trigger('keydown', { key: 'Enter' })

    expect(store.setActiveCharacter).toHaveBeenCalledWith(2)
    expect(list.isVisible()).toBe(false)
    expect(document.activeElement).toBe(button.element)
  })

  it('Échap ferme sans rien changer', async () => {
    const { wrapper, store } = mountSelector()
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="character-selector"]').trigger('click')
    await wrapper.find('[data-testid="character-options"]').trigger('keydown', { key: 'Escape' })

    expect(store.setActiveCharacter).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="character-options"]').isVisible()).toBe(false)
  })

  it('un clic à l\'extérieur ferme la liste', async () => {
    const { wrapper } = mountSelector()
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="character-selector"]').trigger('click')
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="character-options"]').isVisible()).toBe(false)
  })
})
