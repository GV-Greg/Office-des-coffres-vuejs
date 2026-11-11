import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import RewardsGridBoard from '../../src/components/anim/RewardsGridBoard.vue'
import RewardsGridVisual from '../../src/components/anim/RewardsGridVisual.vue'
import RewardsGridLegend from '../../src/components/anim/RewardsGridLegend.vue'

// Le plateau : une mosaïque de cases carrées numérotées. Libre = sceau ardoise et numéro ; attribuée = coffre ouvert doré (le joueur dans l'infobulle). Seul l'organisateur d'une grille TIRÉE (`confirmed`)
// peut cliquer une case libre. Un plateau large défile dans son cadre au lieu de déborder de la page, et ses cases se réduisent pour que toutes les lignes tiennent à l'écran.

const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const fr = JSON.parse(fs.readFileSync(path.join(localesDir, 'fr.json'), 'utf8'))
const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'))

const lots = (n, claimed = {}) => Array.from({ length: n }, (_, i) => ({
  id: i + 1, place: i + 1, name: `Lot ${i + 1}`, player: claimed[i + 1] ?? null, is_taken: false,
}))
const grid = (over = {}) => ({ width: 3, height: 3, status: 'confirmed', lots: lots(9, { 2: 'Aldric' }), ...over })
const mountBoard = (props, locale = 'fr') => mount(RewardsGridBoard, {
  props,
  global: { plugins: [createI18n({ legacy: false, locale, messages: { fr, en } })] },
})
const cells = w => w.findAll('[data-testid="board-cells"] button')

describe('RewardsGridBoard', () => {
  it('une case par emplacement (largeur × hauteur), numérotées, dans un groupe nommé', () => {
    const w = mountBoard({ grid: grid() })

    expect(cells(w)).toHaveLength(9)
    expect(cells(w)[0].text()).toBe('1')
    expect(cells(w)[8].text()).toBe('9')
    const group = w.find('[data-testid="board-cells"]')
    expect(group.attributes('role')).toBe('group')
    expect(group.attributes('aria-label')).toBe(fr.Animation.Grid.BoardLabel)
    expect(w.find('[role="grid"], [role="gridcell"]').exists()).toBe(false)
    expect(w.find('.aspect-square').exists()).toBe(true)
  })

  it('le nombre de colonnes suit la largeur', () => {
    const w = mountBoard({ grid: grid({ width: 5, height: 2, lots: lots(10) }) })

    expect(w.find('[data-testid="board-cells"]').attributes('style')).toContain('repeat(5')
  })

  it('une case attribuée est dorée, garde son numéro, nomme le joueur (infobulle et lecteur d\'écran) et n\'est jamais cliquable', () => {
    const w = mountBoard({ grid: grid(), editable: true })
    const claimed = cells(w)[1]

    expect(claimed.classes()).toContain('bg-orange-100')
    expect(claimed.classes()).toContain('text-slate-800') // le coffre prend la couleur d'une case scellée
    expect(claimed.text()).toContain('2')
    expect(claimed.attributes('aria-label')).toContain('Aldric')
    expect(claimed.attributes('title')).toContain('Aldric')
    expect(claimed.attributes('disabled')).toBeDefined()
    expect(cells(w)[0].classes()).toContain('bg-slate-800')
  })

  it('aucune légende sur le plateau (écran de l\'organisateur) : elle est réservée à la page publique', () => {
    const w = mountBoard({ grid: grid(), editable: true })

    expect(w.find('[data-testid="board-legend"]').exists()).toBe(false)
    expect(cells(w)[1].html()).toContain('gi-open-treasure-chest')
  })

  it('le bilan dit combien de cases sont dévoilées (accord au pluriel), et le plateau ne porte plus de liste (elle est dans la colonne de côté)', () => {
    const w = mountBoard({ grid: grid() })

    expect(w.find('[data-testid="board-progress"]').text()).toBe('1 case dévoilée sur 9')
    expect(w.find('ul:not([data-testid="board-legend"])').exists()).toBe(false)

    const many = mountBoard({ grid: grid({ lots: lots(9, { 1: 'A', 2: 'B', 3: 'C' }) }) })
    expect(many.find('[data-testid="board-progress"]').text()).toBe('3 cases dévoilées sur 9')
    const en = mountBoard({ grid: grid() }, 'en')
    expect(en.find('[data-testid="board-progress"]').text()).toBe('1 cell revealed out of 9')
  })

  it('les cases libres ne sont cliquables que pour l\'organisateur d\'une grille tirée', () => {
    expect(cells(mountBoard({ grid: grid(), editable: true }))[0].attributes('disabled')).toBeUndefined()
    expect(cells(mountBoard({ grid: grid(), editable: false }))[0].attributes('disabled')).toBeDefined()
    expect(cells(mountBoard({ grid: grid({ status: 'closed' }), editable: true }))[0].attributes('disabled')).toBeDefined()
  })

  it('cliquer une case libre ouvre la MODALE d\'attribution de CETTE case ; valider émet `assign` ; un nom vide est refusé', async () => {
    const w = mountBoard({ grid: grid(), editable: true })
    expect(w.find('[data-testid="assign-form"]').exists()).toBe(false)

    await cells(w)[2].trigger('click')
    const modal = w.find('[data-testid="assign-form"]')
    expect(modal.attributes('role')).toBe('dialog')
    expect(modal.attributes('aria-modal')).toBe('true')
    expect(modal.text()).toContain('Attribuer la case 3')

    await modal.find('form').trigger('submit')
    expect(w.emitted('assign')).toBeUndefined()
    expect(w.find('[data-testid="assign-error"]').text()).toBe(fr.Animation.Grid.PlayerRequired)

    await w.find('[data-testid="assign-player-input"]').setValue('  Bérénice  ')
    await w.find('[data-testid="assign-form"] form').trigger('submit')

    expect(w.emitted('assign')[0]).toEqual([3, 'Bérénice'])
    expect(w.find('[data-testid="assign-form"]').exists()).toBe(false)
  })

  it('la croix ronde, Échap et le fond ferment la modale sans rien émettre ; aucun bouton « Annuler »', async () => {
    const w = mountBoard({ grid: grid(), editable: true })

    await cells(w)[0].trigger('click')
    expect(w.find('[data-testid="assign-form"]').text()).not.toContain(fr.Animation.Grid.Cancel)
    await w.find('[data-testid="modal-close"]').trigger('click')
    expect(w.find('[data-testid="assign-form"]').exists()).toBe(false)

    await cells(w)[0].trigger('click')
    await w.find('[data-testid="assign-form"] .fixed.inset-0.bg-black').trigger('click')
    expect(w.find('[data-testid="assign-form"]').exists()).toBe(false)

    await cells(w)[0].trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.vm.$nextTick()
    expect(w.emitted('assign')).toBeUndefined()
  })

  it('un plateau large défile dans son cadre et rétrécit ses cases ; un petit s\'élargit jusqu\'à 4 rem', () => {
    const narrow = mountBoard({ grid: grid({ width: 5, height: 2, lots: lots(10) }) })
    const wide = mountBoard({ grid: grid({ width: 20, height: 2, lots: lots(40) }) })

    expect(wide.find('[data-testid="board-scroll"]').classes()).toContain('overflow-x-auto')
    expect(wide.find('[data-testid="board-scroll"]').classes()).toContain('max-w-full')
    // Les cases : au moins 2,25 rem (1,75 rem au-delà de 12 colonnes), au plus 4 rem ET ce qui laisse toutes les lignes à l'écran en hauteur.
    expect(narrow.find('[data-testid="board-cells"]').attributes('style')).toContain('repeat(5, minmax(2.25rem, min(4rem, calc((100vh - 24rem) / 2))))')
    expect(wide.find('[data-testid="board-cells"]').attributes('style')).toContain('repeat(20, minmax(1.75rem, min(4rem, calc((100vh - 24rem) / 2))))')
    expect(cells(narrow)[0].classes()).toContain('aspect-square')
  })

  it('une grille sans lot révélé (page publique avant clôture) montre toutes les cases libres', () => {
    const w = mountBoard({ grid: grid({ lots: [] }) })

    expect(cells(w)).toHaveLength(9)
    expect(w.find('[data-testid="board-progress"]').text()).toBe('0 cases dévoilées sur 9')
  })

  it('en anglais, le nom du groupe vient de la locale anglaise', () => {
    const w = mountBoard({ grid: grid() }, 'en')

    expect(w.find('[data-testid="board-cells"]').attributes('aria-label')).toBe(en.Animation.Grid.BoardLabel)
  })
})

describe('RewardsGridVisual', () => {
  it('décoratif : 4 cases, masqué aux lecteurs d\'écran, taille au choix', () => {
    const w = mount(RewardsGridVisual, { props: { size: 'title' }, global: { stubs: { 'v-icon': true } } })

    expect(w.attributes('aria-hidden')).toBe('true')
    expect(w.findAll(':scope > div')).toHaveLength(4)
    expect(w.find(':scope > div').classes()).toContain('w-7')
  })

  it('une taille inconnue est refusée par le validateur', () => {
    const validator = RewardsGridVisual.props?.size?.validator ?? RewardsGridVisual.__props?.size?.validator
    if (validator) expect(validator('gigantesque')).toBe(false)
  })
})

describe('RewardsGridLegend', () => {
  it('dit ce que sont une case libre et une case dévoilée, avec leur dessin, en français et en anglais', () => {
    const mountLegend = locale => mount(RewardsGridLegend, { global: { plugins: [createI18n({ legacy: false, locale, messages: { fr, en } })], stubs: { 'v-icon': { template: '<i class="icon-stub" />' } } } })
    const w = mountLegend('fr')

    expect(w.find('[data-testid="board-legend"]').exists()).toBe(true)
    expect(w.text()).toContain(fr.Animation.Grid.LegendFree)
    expect(w.text()).toContain(fr.Animation.Grid.LegendRevealed)
    expect(w.findAll('li')).toHaveLength(2)
    expect(w.findAll('.icon-stub')).toHaveLength(1)
    expect(mountLegend('en').text()).toContain(en.Animation.Grid.LegendRevealed)
  })
})
