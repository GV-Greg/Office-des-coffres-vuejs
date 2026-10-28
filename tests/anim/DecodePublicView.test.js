import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import DecodePublicView from '../../src/views/modules/animation/DecodePublicView.vue'

// L'enveloppe de la page publique : menu propre (logo centré, « Organiser ma propre activité » vers l'accueil, thème et langue) et une ligne
// de pied qui tient lieu de footer (mention « site non officiel »). Le contenu de l'activité est testé dans DecodeActivityView.

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: {} }),
  useRouter: () => ({ push: vi.fn() }),
  RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' },
}))

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const fr = JSON.parse(fs.readFileSync(path.join(dir, 'fr.json'), 'utf8'))
const en = JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf8'))

const mountPage = (locale = 'fr') => mount(DecodePublicView, {
  global: {
    plugins: [createI18n({ legacy: false, locale, messages: { fr, en } })],
    stubs: { DecodeActivityView: true, SelectorMenu: true },
  },
})

describe('DecodePublicView', () => {
  it('le pied de page dit que le site est non officiel, dans la langue', () => {
    expect(mountPage().find('[data-testid="public-footer"]').text()).toBe('Site d\'aide à la communauté des joueurs du jeu Renaissance Kingdoms - Site non officiel')
    expect(mountPage('en').find('[data-testid="public-footer"]').text()).toBe('Community help site for Renaissance Kingdoms players - Unofficial site')
  })

  it('le menu porte le logo et « Organiser ma propre activité », qui mène à l\'accueil du site', () => {
    const w = mountPage()

    expect(w.find('[data-testid="public-logo"]').attributes('data-to')).toContain('welcome')
    expect(w.find('[data-testid="public-organize"]').text()).toBe('Organiser ma propre activité')
    expect(w.find('[data-testid="public-organize"]').attributes('data-to')).toContain('welcome')
  })
})
