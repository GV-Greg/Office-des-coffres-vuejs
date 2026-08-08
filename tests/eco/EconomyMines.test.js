import { describe, it, expect, vi, beforeEach } from 'vitest'
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
        ColumnProductionValue: 'Valeur production',
        ColumnStone: 'Pierre',
        ColumnIron: 'Fer',
        ColumnMaintenanceValue: 'Valeur entretien',
        MaintenanceLabel: 'Entretien',
        TotalLabel: 'Total',
        NetLabel: 'Net',
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
  it('calcule la valeur de production, l\'entretien et le net à partir du texte collé', async () => {
    const wrapper = mountView()
    await generate(wrapper)

    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(3) // 2 mines + total

    const text = wrapper.text()
    expect(text).toContain("Mine d'or")
    expect(text).toContain('Mine de fer')
    // Mine 1 (or) : valeur production = production brute = 500
    // entretien = 10 * 14.5 + 5 * 19.5 = 242.5
    expect(text).toContain('242,5')
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
  it("les boutons n'apparaissent que si du texte est collé", () => {
    const wrapper = mountView()
    expect(wrapper.findAll('button')).toHaveLength(0)
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
  it("ne mémorise rien sans consentement 'comfort'", async () => {
    const wrapper = mountView()
    await generate(wrapper)

    const secondVisit = mountView()
    expect(secondVisit.find('.italic').exists()).toBe(false)
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
