import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import EconomyInventory from '../../src/views/modules/economy/EconomyInventory.vue'
import { useAuthStore } from '../../src/stores/authStore'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

vi.mock('notivue', () => ({ push: { success: vi.fn(), error: vi.fn() } }))

const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const fr = JSON.parse(readFileSync(resolve(localesDir, 'fr.json'), 'utf-8'))
const en = JSON.parse(readFileSync(resolve(localesDir, 'en.json'), 'utf-8'))

// 7 lignes brutes → 6 items après fusion des deux Essences tronquées identiques.
const FIXTURE = `Encombrement : 29950

 #NomEnc.Actions possibles26865,51 écus
596Miches de pain2980
121Morceaux de viande605
2Essences curatives "Essence Franc-Comtoise pour le commerce....2
4Essences curatives "Essence Franc-Comtoise pour le commerce....4
3Hiéroglyphes violets0
1Clarabelle3
1Objet inconnu et fantaisiste999`

const ROUTER_ROUTES = [{ path: '/app/mon-bureau', name: 'province', component: { template: '<div/>' } }]

function mountPage(locale = 'fr') {
  setActivePinia(createPinia())
  const i18n = createI18n({ legacy: false, locale, messages: { fr, en } })
  const router = createRouter({ history: createMemoryHistory(), routes: ROUTER_ROUTES })
  return mount(EconomyInventory, { global: { plugins: [i18n, router] } })
}

function mountPageLoggedIn(locale = 'fr') {
  setActivePinia(createPinia())
  const auth = useAuthStore()
  auth.token = 'fake-token'  // isLoggedIn → true
  const i18n = createI18n({ legacy: false, locale, messages: { fr, en } })
  const router = createRouter({ history: createMemoryHistory(), routes: ROUTER_ROUTES })
  return mount(EconomyInventory, { global: { plugins: [i18n, router] } })
}

beforeEach(() => vi.clearAllMocks())

describe('EconomyInventory — interface vide', () => {
  it('affiche le textarea de collage', () => {
    const w = mountPage()
    expect(w.find('[data-testid="inventory-paste"]').exists()).toBe(true)
  })

  it('n\'affiche ni bouton d\'export ni message d\'erreur à vide', () => {
    const w = mountPage()
    expect(w.find('[data-testid="export-btn"]').exists()).toBe(false)
    expect(w.find('[data-testid="no-items-msg"]').exists()).toBe(false)
  })

  it('affiche le message "aucun article" sur texte sans format reconnu', async () => {
    const w = mountPage()
    await w.find('[data-testid="inventory-paste"]').setValue('Texte quelconque sans format inventaire')
    expect(w.find('[data-testid="no-items-msg"]').exists()).toBe(true)
  })
})

describe('EconomyInventory — résultat du parsing', () => {
  it('affiche le bouton d\'export une fois des items parsés', async () => {
    const w = mountPage()
    await w.find('[data-testid="inventory-paste"]').setValue(FIXTURE)
    expect(w.find('[data-testid="export-btn"]').exists()).toBe(true)
  })

  it('affiche les items groupés par catégorie', async () => {
    const w = mountPage()
    await w.find('[data-testid="inventory-paste"]').setValue(FIXTURE)
    expect(w.text()).toContain('Alimentation')
    expect(w.text()).toContain('Matériel médical')
    expect(w.text()).toContain('Animaux')
    expect(w.text()).not.toContain('Non classé')
  })

  it('place l\'item inconnu en "Divers" (pas de catégorie "Non classé")', async () => {
    const w = mountPage()
    await w.find('[data-testid="inventory-paste"]').setValue(FIXTURE)
    const headings = w.findAll('h3')
    const divers = headings.find(h => h.text().includes('Divers'))
    expect(divers).toBeDefined()
    const html = w.html()
    const diversIdx = html.indexOf('Divers')
    const itemIdx = html.indexOf('Objet inconnu et fantaisiste')
    expect(itemIdx).toBeGreaterThan(diversIdx)
  })

  it('marque les noms tronqués avec ✂', async () => {
    const w = mountPage()
    await w.find('[data-testid="inventory-paste"]').setValue(FIXTURE)
    expect(w.text()).toContain('✂')
  })

  it('fusionne les deux Essences tronquées : un seul item qty=6', async () => {
    const w = mountPage()
    await w.find('[data-testid="inventory-paste"]').setValue(FIXTURE)
    // 6 items au total (pas 7 : les deux Essences sont fusionnées)
    // On exclut les selects d'options d'export (qui ont un data-testid)
    const selects = w.findAll('select').filter(s => !s.attributes('data-testid'))
    expect(selects).toHaveLength(6)
  })

  it('affiche chaque item avec un select de catégorie', async () => {
    const w = mountPage()
    await w.find('[data-testid="inventory-paste"]').setValue(FIXTURE)
    const hieroSelect = w.findAll('select').find(s =>
      s.attributes('aria-label')?.includes('Hiéroglyphes violets'),
    )
    expect(hieroSelect).toBeDefined()
    expect(hieroSelect.element.value).toBe('divers')
  })

  it('en anglais, les catégories sont traduites', async () => {
    const w = mountPage('en')
    await w.find('[data-testid="inventory-paste"]').setValue(FIXTURE)
    expect(w.text()).toContain('Food')
    expect(w.text()).toContain('Medical supplies')
    expect(w.text()).toContain('Miscellaneous')
    expect(w.text()).not.toContain('Uncategorised')
  })
})

describe('EconomyInventory — export BBCode', () => {
  it('génère le BBCode au format v2 et le copie dans le presse-papier', async () => {
    const written = []
    Object.assign(navigator, { clipboard: { writeText: (t) => { written.push(t); return Promise.resolve() } } })
    const w = mountPage()
    await w.find('[data-testid="inventory-paste"]').setValue(FIXTURE)
    await w.find('[data-testid="export-btn"]').trigger('click')
    await w.vm.$nextTick()
    // Nouveau format : en-têtes colorés
    expect(written[0]).toContain('[color=darkcyan][size=18][b]Alimentation[/b][/size][/color]')
    // Format prefix par défaut
    expect(written[0]).toContain('596 Miches de pain')
    // Format liste
    expect(written[0]).toContain('[list]')
    expect(written[0]).toContain('[*][b]')
    // Divers
    expect(written[0]).toContain('[color=darkcyan][size=18][b]Divers[/b][/size][/color]')
    expect(written[0]).toContain('Objet inconnu et fantaisiste')
  })

  it('le BBCode export est en français fixe même si l\'UI est en anglais', async () => {
    const written = []
    Object.assign(navigator, { clipboard: { writeText: (t) => { written.push(t); return Promise.resolve() } } })
    const w = mountPage('en')
    await w.find('[data-testid="inventory-paste"]').setValue(FIXTURE)
    await w.find('[data-testid="export-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(written[0]).toContain('[color=darkcyan][size=18][b]Alimentation[/b][/size][/color]')
    expect(written[0]).not.toContain('Food')
  })

  it('le trésor s\'affiche par défaut quand présent', async () => {
    const written = []
    Object.assign(navigator, { clipboard: { writeText: (t) => { written.push(t); return Promise.resolve() } } })
    const w = mountPage()
    await w.find('[data-testid="inventory-paste"]').setValue(FIXTURE)
    await w.find('[data-testid="export-btn"]').trigger('click')
    await w.vm.$nextTick()
    // FIXTURE contient 26865,51 écus
    expect(written[0]).toContain('[b]Trésor :')
    expect(written[0]).toContain('écus[/b]')
  })

  it('le trésor est masqué quand le toggle est décochée', async () => {
    const written = []
    Object.assign(navigator, { clipboard: { writeText: (t) => { written.push(t); return Promise.resolve() } } })
    const w = mountPage()
    await w.find('[data-testid="inventory-paste"]').setValue(FIXTURE)
    await w.find('[data-testid="export-show-ecus"]').setValue(false)
    await w.find('[data-testid="export-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(written[0]).not.toContain('[b]Trésor :')
  })

  it('le format prefix affiche la quantité devant', async () => {
    const written = []
    Object.assign(navigator, { clipboard: { writeText: (t) => { written.push(t); return Promise.resolve() } } })
    const w = mountPage()
    await w.find('[data-testid="inventory-paste"]').setValue(FIXTURE)
    await w.find('[data-testid="export-qty-format"]').setValue('prefix')
    await w.find('[data-testid="export-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(written[0]).toContain('596 Miches de pain')
    expect(written[0]).not.toContain('Miches de pain (x596)')
  })

  it('le wrapper rp enveloppe tout le BBCode', async () => {
    const written = []
    Object.assign(navigator, { clipboard: { writeText: (t) => { written.push(t); return Promise.resolve() } } })
    const w = mountPage()
    await w.find('[data-testid="inventory-paste"]').setValue(FIXTURE)
    await w.find('[data-testid="export-wrapper"]').setValue('rp')
    await w.find('[data-testid="export-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(written[0]).toMatch(/^\[rp\]/)
    expect(written[0]).toMatch(/\[\/rp\]$/)
  })

  it('le wrapper quote encadre chaque catégorie', async () => {
    const written = []
    Object.assign(navigator, { clipboard: { writeText: (t) => { written.push(t); return Promise.resolve() } } })
    const w = mountPage()
    await w.find('[data-testid="inventory-paste"]').setValue(FIXTURE)
    await w.find('[data-testid="export-wrapper"]').setValue('quote')
    await w.find('[data-testid="export-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(written[0]).toContain('[quote][list]')
    expect(written[0]).toContain('[/list][/quote]')
    expect(written[0]).not.toMatch(/^\[rp\]/)
  })

  it('affiche un toast de succès après la copie', async () => {
    Object.assign(navigator, { clipboard: { writeText: () => Promise.resolve() } })
    const { push } = await import('notivue')
    const w = mountPage()
    await w.find('[data-testid="inventory-paste"]').setValue(FIXTURE)
    await w.find('[data-testid="export-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(push.success).toHaveBeenCalled()
  })

  it('les toggles d\'export sont visibles quand des items sont parsés', async () => {
    const w = mountPage()
    await w.find('[data-testid="inventory-paste"]').setValue(FIXTURE)
    expect(w.find('[data-testid="export-qty-format"]').exists()).toBe(true)
    expect(w.find('[data-testid="export-show-ecus"]').exists()).toBe(true)
    expect(w.find('[data-testid="export-wrapper"]').exists()).toBe(true)
  })

  it('les toggles d\'export sont masqués quand aucun item n\'est parsé', () => {
    const w = mountPage()
    expect(w.find('[data-testid="export-qty-format"]').exists()).toBe(false)
    expect(w.find('[data-testid="export-show-ecus"]').exists()).toBe(false)
    expect(w.find('[data-testid="export-wrapper"]').exists()).toBe(false)
  })
})

describe('EconomyInventory — changement de catégorie', () => {
  it('déplace un item dans une nouvelle catégorie après changement du select', async () => {
    const w = mountPage()
    await w.find('[data-testid="inventory-paste"]').setValue(FIXTURE)

    const hieroSelect = w.findAll('select').find(s =>
      s.attributes('aria-label')?.includes('Hiéroglyphes violets'),
    )
    // Initialement en Divers
    expect(hieroSelect.element.value).toBe('divers')

    // Déplacer vers Alimentation
    await hieroSelect.setValue('alimentation')

    // Le select a maintenant la nouvelle valeur
    expect(hieroSelect.element.value).toBe('alimentation')
  })

  it('Effacer remet le textarea et les catégories à zéro', async () => {
    const w = mountPage()
    await w.find('[data-testid="inventory-paste"]').setValue(FIXTURE)
    await w.find('[data-testid="export-btn"]').trigger('click')

    await w.find('[data-testid="clear-btn"]').trigger('click')

    expect(w.find('[data-testid="inventory-paste"]').element.value).toBe('')
    expect(w.find('[data-testid="export-btn"]').exists()).toBe(false)
  })
})

describe('EconomyInventory — visibilité (Phase A)', () => {
  it('boutons Tout masquer / Tout afficher présents dès qu\'il y a des items', async () => {
    const w = mountPage()
    await w.find('[data-testid="inventory-paste"]').setValue(FIXTURE)
    expect(w.find('[data-testid="hide-all-btn"]').exists()).toBe(true)
    expect(w.find('[data-testid="show-all-btn"]').exists()).toBe(true)
  })

  it('"Tout afficher" est désactivé quand rien n\'est masqué', async () => {
    const w = mountPage()
    await w.find('[data-testid="inventory-paste"]').setValue(FIXTURE)
    expect(w.find('[data-testid="show-all-btn"]').attributes('disabled')).toBeDefined()
  })

  it('"Tout masquer" active "Tout afficher"', async () => {
    const w = mountPage()
    await w.find('[data-testid="inventory-paste"]').setValue(FIXTURE)
    await w.find('[data-testid="hide-all-btn"]').trigger('click')
    expect(w.find('[data-testid="show-all-btn"]').attributes('disabled')).toBeUndefined()
  })

  it('après "Tout masquer", tous les items sont grisés (opacity-40)', async () => {
    const w = mountPage()
    await w.find('[data-testid="inventory-paste"]').setValue(FIXTURE)
    await w.find('[data-testid="hide-all-btn"]').trigger('click')
    const lis = w.findAll('li')
    expect(lis.length).toBeGreaterThan(0)
    expect(lis.every(li => li.classes('opacity-40'))).toBe(true)
  })

  it('"Tout afficher" après "Tout masquer" supprime le grisé', async () => {
    const w = mountPage()
    await w.find('[data-testid="inventory-paste"]').setValue(FIXTURE)
    await w.find('[data-testid="hide-all-btn"]').trigger('click')
    await w.find('[data-testid="show-all-btn"]').trigger('click')
    expect(w.findAll('li.opacity-40').length).toBe(0)
  })

  it('le BBCode export exclut les items des catégories masquées', async () => {
    const written = []
    Object.assign(navigator, { clipboard: { writeText: (t) => { written.push(t); return Promise.resolve() } } })
    const w = mountPage()
    await w.find('[data-testid="inventory-paste"]').setValue(FIXTURE)
    await w.find('[data-testid="hide-all-btn"]').trigger('click')
    await w.find('[data-testid="export-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(written[0]).not.toContain('Miches de pain')
    expect(written[0]).not.toContain('Hiéroglyphes violets')
  })

  it('masquer une catégorie grise uniquement ses items', async () => {
    const w = mountPage()
    await w.find('[data-testid="inventory-paste"]').setValue(FIXTURE)
    // Premier bouton œil de catégorie = masquer Alimentation (1re catégorie non vide)
    const hideBtn = w.findAll('button').find(b =>
      b.attributes('aria-label') === 'Masquer la catégorie',
    )
    expect(hideBtn).toBeDefined()
    await hideBtn.trigger('click')
    const grisedItems = w.findAll('li.opacity-40')
    const allItems = w.findAll('li')
    expect(grisedItems.length).toBeGreaterThan(0)
    expect(grisedItems.length).toBeLessThan(allItems.length)
  })

  it('Effacer remet la visibilité à zéro', async () => {
    const w = mountPage()
    await w.find('[data-testid="inventory-paste"]').setValue(FIXTURE)
    await w.find('[data-testid="hide-all-btn"]').trigger('click')
    // Recoller après clear
    await w.find('[data-testid="clear-btn"]').trigger('click')
    await w.find('[data-testid="inventory-paste"]').setValue(FIXTURE)
    // "Tout afficher" doit être à nouveau désactivé (rien de masqué)
    expect(w.find('[data-testid="show-all-btn"]').attributes('disabled')).toBeDefined()
  })
})

describe('EconomyInventory — select conditionnel (Phase B)', () => {
  it('non connecté : le select reste visible même après changement de catégorie', async () => {
    const w = mountPage()
    await w.find('[data-testid="inventory-paste"]').setValue(FIXTURE)
    const hieroSelect = w.findAll('select').find(s =>
      s.attributes('aria-label')?.includes('Hiéroglyphes violets'),
    )
    await hieroSelect.setValue('alimentation')
    // Non connecté → select toujours là
    const hieroSelectAfter = w.findAll('select').find(s =>
      s.attributes('aria-label')?.includes('Hiéroglyphes violets'),
    )
    expect(hieroSelectAfter).toBeDefined()
  })

  it('connecté : le select reste visible après un changement de catégorie (recatégorisation possible)', async () => {
    const w = mountPageLoggedIn()
    await w.find('[data-testid="inventory-paste"]').setValue(FIXTURE)
    const hieroSelect = w.findAll('select').find(s =>
      s.attributes('aria-label')?.includes('Hiéroglyphes violets'),
    )
    expect(hieroSelect).toBeDefined()
    await hieroSelect.setValue('alimentation')
    // Connecté + item dans customCats → select toujours présent pour permettre la recatégorisation
    const hieroSelectAfter = w.findAll('select').find(s =>
      s.attributes('aria-label')?.includes('Hiéroglyphes violets'),
    )
    expect(hieroSelectAfter).toBeDefined()
  })

  it('connecté : item non encore catégorisé garde son select', async () => {
    const w = mountPageLoggedIn()
    await w.find('[data-testid="inventory-paste"]').setValue(FIXTURE)
    // Aucun item dans customCats → tous les selects restent visibles
    const unknownSelect = w.findAll('select').find(s =>
      s.attributes('aria-label')?.includes('Objet inconnu et fantaisiste'),
    )
    expect(unknownSelect).toBeDefined()
  })
})
