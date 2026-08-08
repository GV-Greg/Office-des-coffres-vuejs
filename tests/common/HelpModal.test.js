import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import HelpModal from '../../src/components/HelpModal.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'fr',
  messages: {
    fr: {
      Common: {
        HelpModal: {
          Purpose: 'But du coffre',
          Overview: 'Fonctionnement',
          Steps: 'Étapes à suivre',
          Close: 'Fermer',
        }
      }
    }
  }
})

function mountModal(props = {}) {
  return mount(HelpModal, {
    global: { plugins: [i18n] },
    props: {
      show: true,
      title: 'Comment ça marche ?',
      ...props,
    },
  })
}

describe('HelpModal', () => {
  it("ne rend rien si show est false", () => {
    const wrapper = mountModal({ show: false })
    expect(wrapper.find('h3').exists()).toBe(false)
  })

  it('affiche le titre', () => {
    const wrapper = mountModal()
    expect(wrapper.text()).toContain('Comment ça marche ?')
  })

  it("n'affiche la section but/fonctionnement que si fournie", () => {
    const withoutExtras = mountModal()
    expect(withoutExtras.text()).not.toContain('But du coffre')
    expect(withoutExtras.text()).not.toContain('Fonctionnement')

    const withExtras = mountModal({ purpose: 'Calculer un bilan.', overview: 'Colle, choisis, génère.' })
    expect(withExtras.text()).toContain('But du coffre')
    expect(withExtras.text()).toContain('Calculer un bilan.')
    expect(withExtras.text()).toContain('Fonctionnement')
    expect(withExtras.text()).toContain('Colle, choisis, génère.')
  })

  it('affiche chaque étape numérotée', () => {
    const wrapper = mountModal({ steps: ['Première étape', 'Deuxième étape'] })
    expect(wrapper.text()).toContain('Étapes à suivre')
    const items = wrapper.findAll('ol li')
    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('Première étape')
    expect(items[1].text()).toContain('Deuxième étape')
  })

  it('émet close au clic sur le bouton de fermeture', async () => {
    const wrapper = mountModal()
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('émet close au clic sur l\'overlay', async () => {
    const wrapper = mountModal()
    await wrapper.find('.fixed.inset-0.bg-black').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
