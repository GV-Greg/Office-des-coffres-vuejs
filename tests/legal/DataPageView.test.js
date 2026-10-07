import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import DataPageView from '../../src/views/legal/DataPageView.vue'
import { DATA_PAGE_SECTIONS } from '../../src/modules/dataPageSections'

// Page « Vos données, outil par outil » (brief admin/content/brief-pages-donnees-joueur.md).
// Montée avec les VRAIS textes : un import de fr.json est précompilé par le plugin vue-i18n et rend
// undefined en test — lecture par fs.

vi.mock('../../src/api.js', () => ({ http: { post: vi.fn(), get: vi.fn() } }))

const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const locale = lang => JSON.parse(readFileSync(resolve(localesDir, `${lang}.json`), 'utf-8'))

const RouterLinkStub = {
  props: ['to'],
  template: '<a :href="typeof to === \'string\' ? to : JSON.stringify(to)"><slot /></a>',
}

function mountView(lang = 'fr') {
  const i18n = createI18n({ legacy: false, locale: lang, messages: { [lang]: locale(lang) } })
  return mount(DataPageView, { global: { plugins: [createPinia(), i18n], stubs: { RouterLink: RouterLinkStub } } })
}

describe('DataPageView', () => {
  it.each(['fr', 'en'])('%s : une section par outil, chacune avec son ancre, et un sommaire qui y mène', (lang) => {
    const wrapper = mountView(lang)
    for (const section of DATA_PAGE_SECTIONS) {
      expect(wrapper.find(`section#${section.id}`).exists(), section.id).toBe(true)
      expect(wrapper.find(`[data-testid="data-toc"] a[href="#${section.id}"]`).exists(), section.id).toBe(true)
    }
  })

  // Le Registre des mines est ouvert depuis le 08/10/2026 : plus aucun outil « à venir ».
  it('ne marque plus aucun outil « à venir »', () => {
    const wrapper = mountView()
    const upcoming = wrapper.findAll('[data-testid="upcoming"]')
    expect(upcoming).toHaveLength(0)
  })

  it('« Compte et personnages » renvoie à la politique sans recopier un seul fait', () => {
    const section = mountView().find('section#compte')
    expect(section.find('a').attributes('href')).toBe(JSON.stringify({ name: 'legal-privacy' }))
    // Les durées du compte, validées au mot près le 04/10, ne vivent que dans la politique.
    expect(section.text()).not.toContain('1 an')
    expect(section.text()).not.toContain('30 jours')
  })

  it('pose les six questions dans l’ordre du brief, et seulement celles qui concernent l’outil', () => {
    const dts = section => mountView().findAll(`section#${section} dt`).map(dt => dt.text())
    expect(dts('bilan-des-mines')).toEqual([
      "À quoi sert l'outil", 'Ce que vous y mettez', 'Ce qui est enregistré',
      'Combien de temps', 'Qui le voit', 'Si vous supprimez votre compte',
    ])
    expect(dts('carte')).toEqual(["À quoi sert l'outil", 'Ce qui est enregistré'])
  })

  it('renvoie à la politique pour les outils qui conservent chez nous — et pour eux seuls', () => {
    const wrapper = mountView()
    const withLink = DATA_PAGE_SECTIONS
      .filter(section => wrapper.find(`section#${section.id} [data-testid="see-policy"]`).exists())
      .map(section => section.id)
    expect(withLink).toEqual(['postes', 'registre-des-mines'])
    // Ni durée ni destinataires recopiés : la politique les énumère (version B).
    for (const id of withLink) {
      expect(wrapper.findAll(`section#${id} dt`).map(dt => dt.text())).not.toContain('Combien de temps')
      expect(wrapper.findAll(`section#${id} dt`).map(dt => dt.text())).not.toContain('Qui le voit')
    }
  })

  it('dit la condition d’accès du Registre et que déclarer un poste n’est pas toujours facultatif', () => {
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="data-access"]').text()).toContain('c\'est la condition d\'accès')
    expect(wrapper.find('section#registre-des-mines').text()).toContain('Sans cela, l\'outil n\'est pas accessible')
    expect(wrapper.find('section#postes').text()).toContain('sauf pour les outils qui en exigent un')
  })

  it.each(['fr', 'en'])('%s : un badge d’accès par outil, au titre de sa section, tiré de la table unique', (lang) => {
    const wrapper = mountView(lang)
    const labels = locale(lang).Legal.Data.Badges
    const titles = DATA_PAGE_SECTIONS.map(s => wrapper.find(`section#${s.id} [data-testid="access-badge"]`).text())

    expect(titles).toEqual(DATA_PAGE_SECTIONS.map(s => labels[s.access]))
    // Pas au sommaire (Greg, 06/10/2026).
    expect(wrapper.find('[data-testid="data-toc"] [data-testid="access-badge"]').exists()).toBe(false)
    // Les trois niveaux servent, pas un de plus (fil 07-badges).
    expect(new Set(DATA_PAGE_SECTIONS.map(s => s.access))).toEqual(new Set(['none', 'account', 'office']))
  })

  it('porte sa date de dernière modification', () => {
    expect(mountView().find('[data-testid="data-last-updated"]').text()).toMatch(/Dernière modification : \d{1,2} \S+ \d{4}/)
  })
})

describe('Route /legal/data', () => {
  it('est enregistrée, publique et pointe vers DataPageView', async () => {
    const { default: router } = await import('../../src/router/index.js')
    const resolved = router.resolve('/legal/data#guet')

    expect(resolved.name).toBe('legal-data')
    expect(resolved.meta.public).toBe(true)
    expect(resolved.hash).toBe('#guet')
  })
})
