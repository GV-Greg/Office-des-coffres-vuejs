import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import EconomyMines from '../../src/views/modules/economy/EconomyMines.vue'
import { useCookieStore } from '../../src/stores/cookieStore'

vi.mock('notivue', () => ({ push: { error: vi.fn(), success: vi.fn() } }))

const i18n = createI18n({
  locale: 'fr',
  messages: {
    fr: {
      EconomyMines: {
        Title: 'Bilan des mines',
        PasteLabel: 'Colle ici le texte complet de la page "mines" du jeu',
        PastePlaceholder: 'Copie-colle ici...',
        PastePrefilled: 'Fusionné avec ton dernier collage mémorisé sur cet appareil',
        WeekLabel: 'Semaine du {monday} au {sunday}',
        PreviousWeek: 'Semaine précédente',
        NextWeek: 'Semaine suivante',
        NoDataForWeekError: 'Aucune donnée pour cette semaine.',
        PriceStone: 'Pierre (quintal)',
        PriceIron: 'Fer (kg)',
        PriceClay: 'Argile (pain)',
        PriceSalt: 'Sel (boisseau)',
        SalaryLabel: 'Salaire des mineurs (à saisir toi-même)',
        GenerateButton: 'Générer le bilan hebdomadaire',
        ExportButton: 'Copier en BBcode',
        DayExportButton: 'Mise en forme du jour',
        WeekIncompleteWarning: '{count}/7 jours couverts (du {monday} au {sunday})',
        ColumnMine: 'Mine',
        ColumnHours: 'Heures',
        ColumnProduction: 'Production',
        ColumnStone: 'Pierre',
        ColumnIron: 'Fer',
        MaintenanceLabel: 'Entretien',
        TotalLabel: 'Total',
        NetLabel: 'Net',
        SyntheseTitle: 'Synthèse par ressource',
        ColumnResource: 'Ressource',
        ColumnUnitPrice: 'Prix unitaire',
        ColumnMaintenanceSalary: 'Entretien/Salaires',
        ColumnResultQuantity: 'Résultat (quantité)',
        ColumnResultValue: 'Résultat (valeur)',
        Resources: { OR: 'Or', FER: 'Fer', PIERRE: 'Pierre', ARGILE: 'Argile', SEL: 'Sel' },
        NoDataError: 'Aucune donnée reconnue.',
        CopiedSuccess: 'Copié dans le presse-papier.',
        CopyError: 'Impossible de copier.'
      }
    }
  }
})

const sampleText = `
Mine 1 : Mine d'or - Noeud 236
Nombre d'heures travaillées ces 7 derniers jours
Date	Heures
2026-08-01	100
Production des 7 derniers jours
Date	Rendement
2026-08-01	500
Ressources consommées par la mine ces 7 derniers jours
Date	Qx de pierre	Kg de fer
2026-08-01	10	5

Mine 2 : Mine de fer - Noeud 228
Nombre d'heures travaillées ces 7 derniers jours
Date	Heures
2026-08-01	50
Production des 7 derniers jours
Date	Rendement
2026-08-01	20
Ressources consommées par la mine ces 7 derniers jours
Date	Qx de pierre	Kg de fer
`

let pinia

beforeEach(() => {
  localStorage.clear()
  pinia = createPinia()
  setActivePinia(pinia)
  // Les dates du texte d'exemple (2026-08-01/02) tombent dans la semaine du
  // 2026-07-27 au 2026-08-02 — figer "aujourd'hui" dedans pour que la semaine
  // sélectionnée par défaut corresponde, sans dépendre de la date réelle du
  // jour où les tests s'exécutent.
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-01T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

function mountView() {
  return mount(EconomyMines, { global: { plugins: [pinia, i18n] } })
}

async function generate(wrapper, text = sampleText) {
  await wrapper.find('textarea').setValue(text)
  const buttons = wrapper.findAll('button')
  const generateButton = buttons.find(b => b.text() === 'Générer le bilan hebdomadaire')
  await generateButton.trigger('click')
}

describe('EconomyMines — calcul du bilan', () => {
  it('calcule le détail par mine et la synthèse par ressource à partir du texte collé', async () => {
    const wrapper = mountView()
    await generate(wrapper)

    const tables = wrapper.findAll('table')
    expect(tables).toHaveLength(2) // détail par mine + synthèse par ressource

    const mineRows = tables[0].findAll('tbody tr')
    expect(mineRows).toHaveLength(2) // 2 mines, pas de ligne total dans ce tableau-ci

    const text = wrapper.text()
    expect(text).toContain("Mine d'or")
    expect(text).toContain('Mine de fer')
    // OR : 500 (déjà en écus, pas de prix appliqué)
    // FER : (20 production − 5 entretien fer) × 19,5 = 292,5
    // PIERRE : (0 production − 10 entretien pierre) × 14,5 = -145
    // net = 500 + 292,5 - 145 = 647,5
    expect(text).toContain('647,5')
  })

  it("affiche une erreur si le texte collé n'est pas reconnu", async () => {
    const { push } = await import('notivue')
    const wrapper = mountView()
    await generate(wrapper, 'texte sans rapport avec le jeu')

    expect(push.error).toHaveBeenCalled()
    expect(wrapper.findAll('tbody tr')).toHaveLength(0)
  })
})

describe('EconomyMines — mise en forme du jour (aucun calcul)', () => {
  it("le bouton 'Mise en forme du jour' n'apparaît que si du texte est collé", () => {
    const wrapper = mountView()
    // Les flèches de navigation de semaine restent visibles même sans texte collé.
    expect(wrapper.findAll('button')).toHaveLength(2)
    expect(wrapper.text()).not.toContain('Mise en forme du jour')
  })

  it("affiche une erreur si aucun bloc d'état de mine n'est reconnu", async () => {
    const { push } = await import('notivue')
    const wrapper = mountView()
    // sampleText n'a que les tableaux de données, pas le bloc "Niveau : ..." de config.
    await wrapper.find('textarea').setValue(sampleText)

    const dayButton = wrapper.findAll('button').find(b => b.text() === 'Mise en forme du jour')
    await dayButton.trigger('click')

    expect(push.error).toHaveBeenCalled()
  })

  it("met en forme l'état de chaque mine (config), sans prix ni calcul, sans passer par \"Générer\"", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    const textWithState = `
Mine 1 : Mine d'or - Noeud 236
Niveau : 10
Rendement : 50.4 écus/22 heures
Créneaux horaires : 145/1100
Seuil de rupture : 20 qtx de pierre et 16 kg de fer

Entretien normal
(22 qtx de pierre et 17 kg de fer)
Entretien et amélioration
(62 qtx de pierre et 47 kg de fer)

Diminuer le niveau de la mine
Fermer la mine

Mine 2 : Mine de fer - Noeud 228
Niveau : 10
Rendement : 1.52 kilos de minerai de fer/22 heures
Créneaux horaires : 8/550
Seuil de rupture : 9 qtx de pierre et 7 kg de fer

Entretien normal
(5 qtx de pierre et 3 kg de fer)
Entretien et amélioration
(9 qtx de pierre et 6 kg de fer)

Diminuer le niveau de la mine
Fermer la mine
` + sampleText

    const wrapper = mountView()
    await wrapper.find('textarea').setValue(textWithState)

    const dayButton = wrapper.findAll('button').find(b => b.text() === 'Mise en forme du jour')
    expect(dayButton).toBeTruthy()

    await dayButton.trigger('click')

    expect(writeText).toHaveBeenCalledTimes(1)
    const copied = writeText.mock.calls[0][0]
    expect(copied).toContain('Rapport sur les Mines')
    expect(copied).toContain("#1 Mine d'or - Noeud 236")
    expect(copied).toContain('Niveau : 10')
    expect(copied).toContain('Entretien normal : 22 qtx de pierre et 17 kg de fer')
    // Les 3 tableaux journaliers doivent apparaître dans la partie visible...
    expect(copied).toContain("Nombre d'heures travaillées ces 7 derniers jours")
    expect(copied).toContain('2026-08-01 : 100')
    expect(copied).toContain('Production des 7 derniers jours')
    expect(copied).toContain('2026-08-01 : 500')
    expect(copied).toContain('Ressources consommées par la mine ces 7 derniers jours')
    expect(copied).toContain('2026-08-01 : 10 qtx de pierre, 5 kg de fer')
    // Mine 2 n'a aucune conso relevée sur la période : la section reste affichée avec "/".
    expect(copied).toContain('Ressources consommées par la mine ces 7 derniers jours : /')
    // ... mais sans la phrase explicative répétitive du jeu.
    expect(copied).not.toContain('Les valeurs relatives à un jour donné')
    // Les libellés de boutons du jeu ne sont pas de la donnée : exclus de la partie visible.
    expect(copied.split('[spoiler]')[0]).not.toContain('Diminuer le niveau de la mine')
    // Le texte brut complet reste disponible, lui, dans le spoiler/code.
    expect(copied).toContain('[spoiler][code]')
    expect(copied).toContain('Diminuer le niveau de la mine')
    // Pas de calcul de bilan (le "écus" du champ Rendement, lui, vient du jeu tel quel).
    expect(copied).not.toContain('Valeur production')
    expect(copied).not.toContain('Net :')
    // Pas de tableau de résultats : ce bouton ne calcule rien.
    expect(wrapper.findAll('tbody tr')).toHaveLength(0)
  })
})

describe('EconomyMines — mémorisation "confort" entre deux collages', () => {
  it("ne persiste rien en localStorage sans consentement 'comfort'", async () => {
    const wrapper = mountView()
    await generate(wrapper)

    // cookieStore documente : sans consentement, une valeur change en mémoire (dégradation
    // gracieuse pour la session en cours) mais n'est jamais écrite en localStorage — c'est
    // cette persistance réelle qu'on vérifie ici, pas l'état en mémoire (un second wrapper
    // partageant le même pinia verrait la valeur en mémoire, ce n'est pas ce qui est testé).
    expect(localStorage.getItem('comfort-cookies')).toBeNull()
  })

  it('fusionne un second collage avec le premier une fois "comfort" accepté', async () => {
    useCookieStore().acceptedCookies = ['comfort']
    const wrapper = mountView()
    await generate(wrapper)

    // Second collage : seule la mine 1 a de nouvelles données pour un autre jour.
    const secondPaste = `
Mine 1 : Mine d'or - Noeud 236
Nombre d'heures travaillées ces 7 derniers jours
Date	Heures
2026-08-02	80
Production des 7 derniers jours
Date	Rendement
2026-08-02	400
Ressources consommées par la mine ces 7 derniers jours
Date	Qx de pierre	Kg de fer
`
    const secondVisit = mountView()
    await secondVisit.vm.$nextTick()
    expect(secondVisit.text()).toContain('Fusionné avec ton dernier collage mémorisé')

    await generate(secondVisit, secondPaste)
    // La production cumulée de la mine d'or doit inclure les deux collages (500 + 400 = 900)
    expect(secondVisit.text()).toContain('900')
  })
})
