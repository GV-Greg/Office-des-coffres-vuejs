import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AccessDenied from '../../src/components/loading/AccessDenied.vue'

// Refus en ligne : un cadenas fermé et le message du serveur, annoncé comme une alerte — jamais de « Réessayer » (un refus n'est pas une panne).
describe('AccessDenied', () => {
  it('annonce le message en alerte, avec le cadenas, sans bouton', () => {
    const w = mount(AccessDenied, { props: { message: 'Seuls les commissaires consultent ses prix.' }, global: { stubs: { 'v-icon': { props: ['name'], template: '<i :data-icon="name" />' } } } })
    const box = w.find('[role="alert"]')
    expect(box.exists()).toBe(true)
    expect(box.text()).toBe('Seuls les commissaires consultent ses prix.')
    expect(w.find('[data-icon="gi-padlock"]').exists()).toBe(true)
    expect(w.find('button').exists()).toBe(false)
  })

  it('porte le data-testid demandé par la page (prices-error pour les prix)', () => {
    const w = mount(AccessDenied, { props: { message: 'Refus', testid: 'prices-error' }, global: { stubs: { 'v-icon': true } } })
    expect(w.find('[data-testid="prices-error"]').text()).toBe('Refus')
  })
})
