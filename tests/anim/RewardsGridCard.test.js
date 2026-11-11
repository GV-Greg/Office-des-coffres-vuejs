import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { push } from 'notivue'
import RewardsGridCard from '../../src/components/anim/RewardsGridCard.vue'

// L'écran de l'organisateur d'une grille, le MÊME pour les deux modes : la carte délègue à ses `gestures` sans connaître le mode. Aucune règle côté
// site (le serveur juge, ses refus s'affichent) ; les boutons suivent seulement l'état. Le tirage mène directement à `confirmed`.

vi.mock('notivue', () => ({ push: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const fr = JSON.parse(fs.readFileSync(path.join(localesDir, 'fr.json'), 'utf8'))
const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'))

const lot = (id, over = {}) => ({ id, place: null, name: `Lot ${id}`, player: null, is_taken: false, ...over })
const grid = (over = {}) => ({
  id: 4, slug: 'foire', name: 'Foire', status: 'incomplete', mode: 'private', width: 2, height: 2, lots: [lot(1), lot(2)], can_reopen: false, ...over,
})
const refusal = (messages, status = 422) => ({ response: { status, data: { success: false, messages, message: messages.fr, errors: {} } } })

function makeGestures(over = {}) {
  return {
    mode: 'private',
    addLots: vi.fn(async (g, names) => ({ ...g, lots: [...g.lots, ...names.map((name, i) => lot(g.lots.length + i + 1, { name }))] })),
    removeLot: vi.fn(async () => undefined),
    draw: vi.fn(async g => ({ ...g, status: 'confirmed' })),
    assign: vi.fn(async g => g),
    markTaken: vi.fn(async g => g),
    close: vi.fn(async g => ({ ...g, status: 'closed' })),
    reopen: vi.fn(async g => ({ ...g, status: 'confirmed' })),
    remove: vi.fn(async () => undefined),
    ...over,
  }
}

const mountCard = (g, gestures = makeGestures(), locale = 'fr') => mount(RewardsGridCard, {
  props: { grid: g, gestures },
  global: { plugins: [createI18n({ legacy: false, locale, messages: { fr, en } })], stubs: { 'v-icon': true } },
})
const byId = (w, id) => w.find(`[data-testid="${id}"]`)

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => undefined) } })
})

describe('RewardsGridCard — remplissage', () => {
  it('l\'en-tête dit le nom, les dimensions et l\'état de la grille', () => {
    const w = mountCard(grid())

    expect(byId(w, 'grid-title-4').text()).toBe('Ma grille de lots « Foire »')
    expect(byId(w, 'grid-status-4').text()).toBe(fr.Animation.GridStatus.incomplete)
    expect(w.text()).toContain('2 × 2')
  })

  it('ajoute un lot par son nom et remonte la grille renvoyée', async () => {
    const gestures = makeGestures()
    const w = mountCard(grid(), gestures)

    await byId(w, 'lot-name-input').setValue('  Épée en fer ')
    await w.find('form').trigger('submit')
    await flushPromises()

    expect(gestures.addLots).toHaveBeenCalledWith(expect.objectContaining({ id: 4 }), ['Épée en fer'])
    expect(w.emitted('update')[0][0].lots).toHaveLength(3)
    expect(push.success).toHaveBeenCalledWith(fr.Animation.Grid.LotAdded)
  })

  it('la quantité : 3 exemplaires = 3 lots du même nom, en UNE requête (le serveur ne connaît pas la quantité, il reçoit trois noms)', async () => {
    const gestures = makeGestures()
    const w = mountCard(grid({ width: 3, height: 3, lots: [] }), gestures)

    await byId(w, 'lot-name-input').setValue('50 écus')
    await byId(w, 'lot-quantity-input').setValue(3)
    await w.find('form').trigger('submit')
    await flushPromises()

    expect(gestures.addLots).toHaveBeenCalledTimes(1)
    expect(gestures.addLots.mock.calls[0][1]).toEqual(['50 écus', '50 écus', '50 écus'])
    expect(push.success).toHaveBeenCalledWith(fr.Animation.Grid.LotsAdded.replace('{count}', '3'))
    expect(byId(w, 'lot-name-input').element.value).toBe('')
    expect(byId(w, 'lot-quantity-input').element.value).toBe('1')
  })

  it('une quantité qui dépasse les cases libres est tronquée, et le surplus est dit', async () => {
    const gestures = makeGestures()
    const w = mountCard(grid(), gestures) // 2 × 2 avec 2 lots : 2 cases libres

    await byId(w, 'lot-name-input').setValue('Pain')
    await byId(w, 'lot-quantity-input').setValue(5)
    await w.find('form').trigger('submit')
    await flushPromises()

    expect(gestures.addLots.mock.calls[0][1]).toEqual(['Pain', 'Pain'])
    expect(push.success).toHaveBeenCalledWith(fr.Animation.Grid.LotsAddedWithSkipped.replace('{added}', '2').replace('{skipped}', '3'))
  })

  it('une quantité vide, nulle ou négative vaut 1 (forme seulement)', async () => {
    const gestures = makeGestures()
    const w = mountCard(grid({ width: 3, height: 3, lots: [] }), gestures)

    for (const value of ['', 0, -4]) {
      await byId(w, 'lot-name-input').setValue('Pain')
      await byId(w, 'lot-quantity-input').setValue(value)
      await w.find('form').trigger('submit')
      await flushPromises()
    }

    expect(gestures.addLots.mock.calls.map(c => c[1])).toEqual([['Pain'], ['Pain'], ['Pain']])
  })

  it('un refus du serveur sur une quantité : TOUT OU RIEN, rien n\'est ajouté, le nom est gardé, le refus est dit', async () => {
    const gestures = makeGestures({ addLots: vi.fn().mockRejectedValue(refusal({ fr: 'Grille pleine.', en: 'Grid full.' }, 409)) })
    const w = mountCard(grid({ width: 3, height: 3, lots: [] }), gestures)

    await byId(w, 'lot-name-input').setValue('Pain')
    await byId(w, 'lot-quantity-input').setValue(4)
    await w.find('form').trigger('submit')
    await flushPromises()

    expect(gestures.addLots).toHaveBeenCalledTimes(1)
    expect(push.error).toHaveBeenCalledWith('Grille pleine.')
    expect(push.success).not.toHaveBeenCalled()
    expect(byId(w, 'lot-name-input').element.value).toBe('Pain')
  })

  it('l\'ajout en liste n\'a pas de quantité : chaque ligne est un lot', async () => {
    const w = mountCard(grid())

    expect(byId(w, 'lot-quantity-input').exists()).toBe(true)
    await byId(w, 'show-bulk-btn').trigger('click')
    expect(byId(w, 'lot-quantity-input').exists()).toBe(false)
    expect(byId(w, 'bulk-textarea').exists()).toBe(true)
  })

  it('refus du serveur sur le nom : affiché sous le champ, rien n\'est remonté', async () => {
    const gestures = makeGestures({ addLots: vi.fn().mockRejectedValue({ response: { status: 422, data: { success: false, errors: { name: ['Nom refusé.'] }, codes: { name: 'x' }, messages: { name: { fr: 'Nom refusé.', en: 'Name refused.' } } } } }) })
    const w = mountCard(grid(), gestures)

    await byId(w, 'lot-name-input').setValue('x')
    await w.find('form').trigger('submit')
    await flushPromises()

    expect(w.find('[role="alert"]').text()).toBe('Nom refusé.')
    expect(w.emitted('update')).toBeUndefined()
  })

  it('une grille remplie : champ et boutons d\'ajout désactivés, le tirage apparaît', () => {
    const w = mountCard(grid({ status: 'filled', lots: [lot(1), lot(2), lot(3), lot(4)] }))

    expect(byId(w, 'grid-filled').exists()).toBe(true)
    expect(byId(w, 'add-lot-btn').attributes('disabled')).toBeDefined()
    expect(byId(w, 'lot-name-input').attributes('disabled')).toBeDefined()
    expect(byId(w, 'grid-draw-btn').exists()).toBe(true)
  })

  it('pas de tirage tant que la grille n\'est pas remplie', () => {
    expect(byId(mountCard(grid()), 'grid-draw-btn').exists()).toBe(false)
  })

  it('tirer : appelle le geste et remonte la grille tirée', async () => {
    const gestures = makeGestures()
    const w = mountCard(grid({ status: 'filled', lots: [lot(1), lot(2), lot(3), lot(4)] }), gestures)

    await byId(w, 'grid-draw-btn').trigger('click')
    await flushPromises()

    expect(gestures.draw).toHaveBeenCalled()
    expect(w.emitted('update')[0][0].status).toBe('confirmed')
  })

  it('retirer un lot : libellé accessible nommant le lot ; la grille repasse à « incomplète » (et à « nouvelle » au dernier lot)', async () => {
    const w = mountCard(grid({ status: 'filled', lots: [lot(1), lot(2), lot(3), lot(4)] }))
    const buttons = w.findAll('[data-testid="remove-lot-btn"]')

    expect(buttons[0].attributes('aria-label')).toBe('Retirer le lot « Lot 1 »')
    await buttons[0].trigger('click')
    await flushPromises()
    expect(w.emitted('update')[0][0]).toMatchObject({ status: 'incomplete' })
    expect(w.emitted('update')[0][0].lots).toHaveLength(3)

    const last = mountCard(grid({ lots: [lot(1)] }))
    await last.find('[data-testid="remove-lot-btn"]').trigger('click')
    await flushPromises()
    expect(last.emitted('update')[0][0]).toMatchObject({ status: 'new', lots: [] })
  })

  it('import en liste : une seule requête, un lot par nom, tronquée aux cases restantes', async () => {
    const gestures = makeGestures()
    const w = mountCard(grid({ lots: [lot(1), lot(2)] }), gestures)

    await byId(w, 'show-bulk-btn').trigger('click')
    await byId(w, 'bulk-textarea').setValue('Pain, Épée\nBouclier\tCasque')
    await byId(w, 'bulk-submit-btn').trigger('click')
    await flushPromises()

    expect(gestures.addLots).toHaveBeenCalledTimes(1)
    expect(gestures.addLots.mock.calls[0][1]).toEqual(['Pain', 'Épée'])
    expect(push.success).toHaveBeenCalledWith(fr.Animation.Grid.LotsAddedWithSkipped.replace('{added}', '2').replace('{skipped}', '2'))
  })

  it('import en liste refusé par le serveur : rien n\'a été ajouté, le texte collé est gardé, le refus est dit', async () => {
    const gestures = makeGestures({ addLots: vi.fn().mockRejectedValue(refusal({ fr: 'Grille pleine.', en: 'Grid full.' })) })
    const w = mountCard(grid({ lots: [] }), gestures)

    await byId(w, 'show-bulk-btn').trigger('click')
    await byId(w, 'bulk-textarea').setValue('Pain\nÉpée')
    await byId(w, 'bulk-submit-btn').trigger('click')
    await flushPromises()

    expect(push.error).toHaveBeenCalledWith('Grille pleine.')
    expect(byId(w, 'bulk-textarea').element.value).toBe('Pain\nÉpée')
    expect(push.success).not.toHaveBeenCalled()
  })
})

describe('RewardsGridCard — grille tirée', () => {
  const drawn = (over = {}) => grid({
    status: 'confirmed',
    lots: [lot(1, { place: 3 }), lot(2, { place: 1, player: 'Aldric' }), lot(3, { place: 4 }), lot(4, { place: 2 })],
    ...over,
  })

  it('plateau cliquable, lots attribués listés avec le numéro de case traduit, guide affiché', () => {
    const w = mountCard(drawn())

    expect(byId(w, 'grid-board').exists()).toBe(true)
    expect(byId(w, 'grid-confirmed-guide').exists()).toBe(true)
    expect(byId(w, 'grid-taken-section').text()).toContain('Case 1')
    expect(byId(w, 'grid-taken-section').text()).toContain('Aldric')
    expect(w.find('[data-testid="claimed-count"]').text()).toBe('1') // le nombre de lots attribués, en badge à côté du titre
    expect(w.find('[data-testid="claimed-count"]').classes()).toContain('rounded-full')
    expect(byId(w, 'grid-taken-section').find('h3').text()).toContain('Liste des lots')
    expect(byId(w, 'grid-draw-btn').exists()).toBe(false)
    expect(byId(w, 'add-lot-btn').exists()).toBe(false)
  })

  it('sur l\'écran de l\'organisateur, la liste des lots reste en UNE colonne, et les deux boutons d\'export sont centrés', () => {
    const w = mountCard(drawn())

    expect(byId(w, 'claimed-list').classes()).not.toContain('tablet:columns-2')
    expect(byId(w, 'grid-export-buttons').classes()).toContain('justify-center')
    expect(byId(w, 'grid-export-buttons').findAll('button')).toHaveLength(2)
  })

  it('sur l\'écran de l\'organisateur, la liste garde son cadre blanc (seule la page publique en est dépourvue)', () => {
    expect(byId(mountCard(drawn()), 'grid-taken-section').classes()).toContain('bg-white')
  })

  it('en anglais, « Case » vient de la locale (aucun texte en dur)', () => {
    const w = mountCard(drawn(), makeGestures(), 'en')

    expect(byId(w, 'grid-taken-section').text()).toContain(en.Animation.Grid.Cell.replace('{n}', '1'))
    expect(byId(w, 'grid-taken-section').text()).not.toContain('Case 1')
  })

  it('attribuer une case : le geste reçoit le lot et le joueur', async () => {
    const gestures = makeGestures()
    const w = mountCard(drawn(), gestures)

    await w.find('[data-testid="board-cells"] button:not([disabled])').trigger('click')
    await byId(w, 'assign-player-input').setValue('Bérénice')
    await w.find('[data-testid="assign-form"] form').trigger('submit')
    await flushPromises()

    expect(gestures.assign).toHaveBeenCalledWith(expect.objectContaining({ id: 4 }), expect.any(Number), { player: 'Bérénice' })
  })

  it('marquer un lot remis / non remis', async () => {
    const gestures = makeGestures()
    const w = mountCard(drawn(), gestures)

    await byId(w, 'grid-taken-section').find('button').trigger('click')
    await flushPromises()

    expect(gestures.markTaken).toHaveBeenCalledWith(expect.objectContaining({ id: 4 }), 2, { is_taken: true })
  })

  it('exports : « Confier au scribe » copie directement les règles ET les résultats dans le presse-papier, sans rien afficher', async () => {
    const w = mountCard(drawn())

    expect(byId(w, 'grid-export-rules').text()).toBe(fr.Animation.Grid.EntrustRules)
    expect(byId(w, 'grid-export-results').text()).toBe(fr.Animation.Grid.EntrustResults)
    // Exporter = vert (charte §6.7), les deux boutons centrés côte à côte.
    expect(byId(w, 'grid-export-rules').classes()).toContain('odc--green')
    expect(byId(w, 'grid-export-results').classes()).toContain('odc--green')

    await byId(w, 'grid-export-rules').trigger('click')
    await flushPromises()
    expect(navigator.clipboard.writeText.mock.calls.at(-1)[0]).toContain('Comment participer')

    await byId(w, 'grid-export-results').trigger('click')
    await flushPromises()
    const copied = navigator.clipboard.writeText.mock.calls.at(-1)[0]
    expect(copied).toContain('[*] [b]Case 1[/b] — Lot 2 → Aldric')
    expect(copied).not.toContain('non réclamé') // jamais le contenu d'une case non réclamée
    expect(copied).not.toContain('Lot 1')

    expect(push.success).toHaveBeenCalledTimes(2)
    expect(push.success).toHaveBeenCalledWith(fr.Animation.Mine.Copied)
    expect(w.find('[data-testid="grid-bbcode"]').exists()).toBe(false) // plus de zone de texte
  })

  it('exports : un refus du presse-papier est dit', async () => {
    navigator.clipboard.writeText.mockRejectedValueOnce(new Error('refusé'))
    const w = mountCard(drawn())

    await byId(w, 'grid-export-results').trigger('click')
    await flushPromises()

    expect(push.error).toHaveBeenCalledWith(fr.Animation.Mine.CopyFailed)
    expect(push.success).not.toHaveBeenCalled()
  })

  it('aucun titre visible au-dessus de la grille (un titre pour lecteurs d\'écran seulement)', () => {
    const w = mountCard(drawn())
    const heading = w.find('[data-testid="grid-board"] h2')

    expect(heading.classes()).toContain('sr-only')
    expect(heading.text()).toBe(fr.Animation.Grid.BoardTitle)
  })

  it('trois colonnes : la liste des résultats à gauche, le plateau au milieu, l\'explication et les exports à droite', () => {
    const w = mountCard(drawn())
    const columns = w.find('[data-testid="grid-board"]').element.parentElement.children

    // Dans le DOM : plateau, liste, outils — l'ordre visuel (laptop:order-1/2/3) met la liste à gauche, le plateau au centre, les outils à droite.
    expect(w.find('[data-testid="grid-board"]').classes()).toContain('laptop:order-2')
    expect(w.find('[data-testid="grid-taken-section"]').element.parentElement.className).toContain('laptop:order-1')
    expect(w.find('[data-testid="grid-confirmed-guide"]').element.parentElement.className).toContain('laptop:order-3')
    expect(w.find('[data-testid="grid-confirmed-guide"]').element.parentElement.contains(w.find('[data-testid="grid-export-rules"]').element)).toBe(true)
    expect(columns).toHaveLength(3)
  })

  it('une grille 10 × 10 garde les trois colonnes (liste à gauche, plateau au milieu, explication à droite) et sa hauteur est bornée pour tenir à l\'écran', () => {
    const w = mountCard(drawn({ width: 10, height: 10, lots: Array.from({ length: 100 }, (_, i) => lot(i + 1, { place: i + 1 })) }))

    expect(w.find('[data-testid="grid-board"]').classes()).toContain('laptop:order-2')
    expect(w.find('[data-testid="grid-board"]').classes()).not.toContain('laptop:col-span-2')
    expect(w.find('[data-testid="grid-taken-section"]').element.parentElement.className).toContain('laptop:order-1')
    expect(w.find('[data-testid="grid-confirmed-guide"]').element.parentElement.className).toContain('laptop:order-3')
    expect(w.find('[data-testid="board-cells"]').attributes('style')).toContain('calc((100vh - 24rem) / 10)')
  })

  it('le guide est ouvert tant qu\'aucune case n\'est attribuée, replié ensuite', () => {
    const none = mountCard(drawn({ lots: [lot(1, { place: 1 }), lot(2, { place: 2 })] }))
    const some = mountCard(drawn())

    expect(none.find('[data-testid="grid-confirmed-guide"]').attributes('open')).toBeDefined()
    expect(some.find('[data-testid="grid-confirmed-guide"]').attributes('open')).toBeUndefined()
    expect(none.find('[data-testid="grid-taken-empty"]').text()).toBe(fr.Animation.Grid.TakenEmpty)
  })

    it('pas d\'export tant que la grille n\'est pas tirée', () => {
    const w = mountCard(grid())

    expect(byId(w, 'grid-export-rules').exists()).toBe(false)
    expect(byId(w, 'grid-export-results').exists()).toBe(false)
  })

  it('un lien vers la page publique, seulement une fois la grille tirée', () => {
    expect(byId(mountCard(grid()), 'grid-view-public').exists()).toBe(false)
    expect(byId(mountCard(drawn()), 'grid-view-public').attributes('href')).toBe('/public/activite/grille/foire')
  })
})

describe('RewardsGridCard — clôture', () => {
  it('privé : un clic clôt', async () => {
    const gestures = makeGestures()
    const w = mountCard(grid({ status: 'confirmed', lots: [lot(1, { place: 1 })] }), gestures)

    await byId(w, 'grid-close-btn').trigger('click')
    await flushPromises()

    expect(gestures.close).toHaveBeenCalledTimes(1)
    expect(w.emitted('update')[0][0].status).toBe('closed')
  })

  it('sans compte : la clôture est définitive, donc confirmée avant d\'être envoyée', async () => {
    const gestures = makeGestures({ mode: 'anonymous' })
    const w = mountCard(grid({ mode: 'anonymous', status: 'confirmed' }), gestures)

    expect(byId(w, 'grid-close-btn').text()).toBe(fr.Animation.Grid.CloseDefinitive)
    await byId(w, 'grid-close-btn').trigger('click')
    expect(gestures.close).not.toHaveBeenCalled()

    await byId(w, 'grid-close-cancel').trigger('click')
    expect(byId(w, 'grid-close-btn').exists()).toBe(true)

    await byId(w, 'grid-close-btn').trigger('click')
    await byId(w, 'grid-close-confirm').trigger('click')
    await flushPromises()
    expect(gestures.close).toHaveBeenCalledTimes(1)
  })

  it('close : privé peut rouvrir (si le serveur le dit) et supprimer en deux temps ; sans compte, ni l\'un ni l\'autre', async () => {
    const gestures = makeGestures()
    const priv = mountCard(grid({ status: 'closed', can_reopen: true }), gestures)

    expect(byId(priv, 'grid-close-btn').exists()).toBe(false)
    await byId(priv, 'grid-reopen').trigger('click')
    await flushPromises()
    expect(gestures.reopen).toHaveBeenCalled()

    await byId(priv, 'grid-delete-4').trigger('click')
    expect(gestures.remove).not.toHaveBeenCalled()
    await byId(priv, 'grid-delete-4').trigger('click')
    await flushPromises()
    expect(gestures.remove).toHaveBeenCalled()
    expect(priv.emitted('removed')).toHaveLength(1)

    const anon = mountCard(grid({ mode: 'anonymous', status: 'closed', can_reopen: false }))
    expect(byId(anon, 'grid-reopen').exists()).toBe(false)
    expect(byId(anon, 'grid-delete-4').exists()).toBe(false)
  })

  it('une grille close montre le plateau', () => {
    expect(byId(mountCard(grid({ status: 'closed', lots: [lot(1, { place: 1 })] })), 'grid-board').exists()).toBe(true)
  })

  it('un refus du serveur est un message en toast, dans la langue', async () => {
    const gestures = makeGestures({ close: vi.fn().mockRejectedValue(refusal({ fr: 'Refusé.', en: 'Refused.' }, 403)) })
    const w = mountCard(grid({ status: 'confirmed' }), gestures, 'en')

    await byId(w, 'grid-close-btn').trigger('click')
    await flushPromises()

    expect(push.error).toHaveBeenCalledWith('Refused.')
  })
})

describe('RewardsGridCard — sans compte : état de l\'email', () => {
  it('confirmé ou en attente', () => {
    const confirmed = mountCard(grid({ mode: 'anonymous', email: { set: true, verified: true } }))
    const pending = mountCard(grid({ mode: 'anonymous', email: { set: true, verified: false } }))

    expect(byId(confirmed, 'grid-email-state').text()).toContain(fr.Animation.Mine.EmailConfirmed)
    expect(byId(pending, 'grid-email-state').text()).toContain(fr.Animation.Mine.EmailPending)
  })

  it('aucun état d\'email pour une grille privée', () => {
    expect(byId(mountCard(grid()), 'grid-email-state').exists()).toBe(false)
  })
})
