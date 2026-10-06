import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import EconomyMines from '../../src/views/modules/economy/EconomyMines.vue'
import { useCookieStore } from '../../src/stores/cookieStore'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Les clés que ce fichier ne fixe pas (unités, devise, libellés du BBcode) viennent du VRAI
// fr.json, lu par fs : un import est précompilé par le plugin vue-i18n et rend undefined en test.
// Les valeurs fixées plus bas restent prioritaires, les assertions qui les citent n'en dépendent pas.
const realFr = JSON.parse(readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales/fr.json'), 'utf-8'
)).EconomyMines

vi.mock('notivue', () => ({ push: { error: vi.fn(), success: vi.fn() } }))

const i18n = createI18n({
  locale: 'fr',
  messages: {
    fr: {
      EconomyMines: {
        ...realFr,
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
        PasteHelp: 'Collez les données avant de lancer un entretien.',
        RateLabel: 'Salaire horaire des mineurs (écus/heure)',
        RateNotStored: 'Taux horaire non mémorisé pour cette semaine.',
        GenerateButton: 'Générer le bilan hebdomadaire',
        ExportButton: 'Copier en BBcode',
        DayExportButton: 'Mise en forme du jour',
        WeekIncompleteWarning: '{count}/7 jours couverts (du {monday} au {sunday})',
        ColumnMine: 'Mine',
        ColumnHours: 'Heures',
        ColumnProduction: 'Production',
        ColumnValue: 'Valeur',
        ColumnSalary: 'Salaire',
        ColumnMaintenanceStoneIron: 'Entretien p/f',
        ColumnMaintenanceValue: 'Entretien (écus)',
        ColumnBalance: 'Solde',
        TotalLabel: 'Total',
        NetLabel: 'Net',
        IncompleteWeekTitle: 'Bilan provisoire — semaine incomplète',
        Convention: 'Coût d’opportunité, pas une dépense.',
        ThresholdReached: 'Au {date}, seuil atteint ({pierre} qtx de pierre / {fer} kg de fer).',
        ThresholdNear: 'Au {date}, à 2 unités ou moins du seuil.',
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
1474-08-01	100
Production des 7 derniers jours
Date	Rendement
1474-08-01	500
Ressources consommées par la mine ces 7 derniers jours
Date	Qx de pierre	Kg de fer
1474-08-01	10	5

Mine 2 : Mine de fer - Noeud 228
Nombre d'heures travaillées ces 7 derniers jours
Date	Heures
1474-08-01	50
Production des 7 derniers jours
Date	Rendement
1474-08-01	20
Ressources consommées par la mine ces 7 derniers jours
Date	Qx de pierre	Kg de fer
`

// Semaine COMPLÈTE construite, du lundi 27/07 au dimanche 02/08 (1474 en jeu), calculée à la main.
// Décalage d'un jour (brief §2.1) : la production du jour D s'apparie aux heures de D+1, donc les
// heures vont du 28/07 au LUNDI SUIVANT 03/08.
//   Mine 1 — or, nœud 236 : heures 10/jour → 70 h, salaire 70 × 0,70 = 49 ; production 50/jour →
//     valeur 350 ; consommation le 29/07 : 2 qtx de pierre, 1 kg de fer → 2×14,5 + 19,5 = 48,5 ;
//     solde 350 − 49 − 48,5 = 252,5
//   Mine 2 — fer, nœud 228 : heures 5/jour → 35 h, salaire 24,5 ; production 2/jour → 14 kg ×
//     19,5 = 273 ; solde 248,5
//   Net : 501
function weekText({ withNextMonday = true } = {}) {
  const prodDays = ['07-27', '07-28', '07-29', '07-30', '07-31', '08-01', '08-02']
  const hourDays = [...prodDays.slice(1), ...(withNextMonday ? ['08-03'] : [])]
  const series = (days, value) => days.map(d => `1474-${d}\t${value}`).join('\n')
  const mine = (n, label, noeud, hours, prod, conso) => `
Mine ${n} : ${label} - Noeud ${noeud}
Nombre d'heures travaillées ces 7 derniers jours
Date	Heures
${series(hourDays, hours)}
Production des 7 derniers jours
Date	Rendement
${series(prodDays, prod)}
Ressources consommées par la mine ces 7 derniers jours
Date	Qx de pierre	Kg de fer
${conso}
`
  return mine(1, "Mine d'or", 236, 10, 50, '1474-07-29\t2\t1') + mine(2, 'Mine de fer', 228, 5, 2, '')
}

let pinia

beforeEach(() => {
  localStorage.clear()
  pinia = createPinia()
  setActivePinia(pinia)
  // Les textes d'exemple sont datés en année de jeu (1474), comme un vrai collage depuis
  // l'interface du jeu — c'est le décalage entre des jeux de test en année réelle et la réalité
  // qui avait masqué le bug du sélecteur de semaine. On fige « aujourd'hui » au mardi 04/08/2026 :
  // la semaine proposée par défaut est la dernière ACHEVÉE (brief §2.4), celle du 27/07 au 02/08,
  // sans dépendre du jour où les tests s'exécutent.
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-04T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

function mountView() {
  return mount(EconomyMines, { global: { plugins: [pinia, i18n] } })
}

async function generate(wrapper, text = weekText()) {
  await wrapper.find('textarea').setValue(text)
  const buttons = wrapper.findAll('button')
  const generateButton = buttons.find(b => b.text() === 'Générer le bilan hebdomadaire')
  await generateButton.trigger('click')
}

const exportButton = wrapper => wrapper.findAll('button').find(b => b.text() === 'Copier en BBcode')

describe('EconomyMines — calcul du bilan', () => {
  it('propose par défaut la dernière semaine achevée (§2.4)', () => {
    expect(mountView().text()).toContain('Semaine du 27 juillet 1474 au 2 août 1474')
  })

  it('affiche UNE table par mine, avec sa ligne Total et la convention (§2.3, §2.5)', async () => {
    const wrapper = mountView()
    await generate(wrapper)

    const tables = wrapper.findAll('table')
    expect(tables).toHaveLength(1) // plus de synthèse par ressource
    expect(tables[0].findAll('tbody tr')).toHaveLength(3) // 2 mines + Total

    const [or, fer] = tables[0].findAll('tbody tr').map(row => row.findAll('td').map(td => td.text()))
    // mine | production | valeur | heures | salaire | entretien p/f | entretien écus | solde
    // La production porte son unité (écus pour l'or, kg pour le fer…) : Greg, 05/10/2026.
    expect(or).toEqual(["#1 Mine d'or", '350 écus', '350', '70', '49', '2 / 1', '48,5', '252,5'])
    expect(fer).toEqual(['#2 Mine de fer', '14 kg', '273', '35', '24,5', '0 / 0', '0', '248,5'])
    expect(wrapper.find('[data-testid="total-row"]').text()).toContain('501')
    expect(wrapper.find('[data-testid="convention"]').exists()).toBe(true)
  })

  it('le salaire suit le taux horaire saisi', async () => {
    const wrapper = mountView()
    await wrapper.find('textarea').setValue(weekText())
    const rateInput = wrapper.findAll('input[type="number"]').at(-1)
    await rateInput.setValue(1)
    await generate(wrapper)

    const or = wrapper.findAll('tbody tr')[0].findAll('td').map(td => td.text())
    expect(or[4]).toBe('70') // 70 h × 1
  })

  it("une semaine incomplète s'affiche marquée, mais ne s'exporte pas (Q10)", async () => {
    const wrapper = mountView()
    await generate(wrapper, weekText({ withNextMonday: false })) // le dimanche n'a pas ses heures

    expect(wrapper.find('[data-testid="incomplete-week"]').text()).toBe('Bilan provisoire — semaine incomplète')
    expect(wrapper.findAll('tbody tr')).toHaveLength(3)
    expect(exportButton(wrapper)).toBeUndefined()
  })

  it("affiche une erreur si le texte collé n'est pas reconnu", async () => {
    const { push } = await import('notivue')
    const wrapper = mountView()
    await generate(wrapper, 'texte sans rapport avec le jeu')

    expect(push.error).toHaveBeenCalled()
    expect(wrapper.findAll('tbody tr')).toHaveLength(0)
  })

  it('date le BBcode exporté avec la semaine couverte', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    const wrapper = mountView()
    await generate(wrapper)
    await exportButton(wrapper).trigger('click')

    const copied = writeText.mock.calls[0][0]
    // Semaine figée par les fake timers : lundi 27/07 → dimanche 02/08/2026, soit 1474
    // dans le calendrier du jeu — c'est cette année-là que lit un joueur sur le forum.
    // Un bilan repartagé doit rester datable sans le message qui l'accompagnait.
    expect(copied).toContain('Semaine du 27 juillet 1474 au 2 août 1474')
    expect(copied).not.toContain('2026')
    // Placé juste sous le titre, avant le détail par mine.
    expect(copied.indexOf('Semaine du')).toBeLessThan(copied.indexOf("Mine d'or"))
  })

  it("l'export reprend la table par mine et la convention, jamais la synthèse par ressource (Q11)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    const wrapper = mountView()
    await generate(wrapper)
    await exportButton(wrapper).trigger('click')

    const copied = writeText.mock.calls[0][0]
    // Format arrêté avec Greg le 05/10/2026 : un seul [quote], titre darkblue, semaine darkgreen,
    // une liste par mine, soldes et net en vert/rouge, net à gauche en grand.
    expect(copied.match(/\[quote\]/g)).toHaveLength(1)
    expect(copied).toContain('[color=darkblue]Bilan des mines[/color]')
    expect(copied).toContain('[color=darkgreen]Semaine du')
    expect(copied).toContain("Mine d'or[/size][/b][/color] [size=10](#1 - Noeud 236)[/size]\n[list][*]Production : 350 écus")
    expect(copied).toContain('[*]Production : 14 kg — valeur 273')
    expect(copied).toContain('[*][b]Solde : [color=green]+252,5[/color][/b]\n[/list]')
    expect(copied).toContain('[*]Salaires : 73,5 (105 h × 0,7)')
    expect(copied).toContain('[size=18][b]Net : [color=green]+501[/color] écus[/b][/size]')
    expect(copied).not.toContain('[center][size=18]')
    expect(copied).toContain('Coût d’opportunité, pas une dépense.')
    expect(copied).not.toContain('Synthèse')
  })
})

describe("EconomyMines — alerte de seuil (§4), à l'écran seulement", () => {
  const withState = (entretien, seuil) => `
Mine 4 : Mine de fer - Noeud 226
Niveau : 9
Seuil de rupture : ${seuil}

Entretien normal
(${entretien})
` + weekText()

  it('signale une mine dont le cumul a atteint son seuil, datée du jour du collage', async () => {
    const wrapper = mountView()
    await wrapper.find('textarea').setValue(withState('9 qtx de pierre et 7 kg de fer', '9 qtx de pierre et 7 kg de fer'))

    const alerts = wrapper.find('[data-testid="threshold-alerts"]')
    expect(alerts.text()).toContain('#4 Mine de fer')
    expect(alerts.text()).toContain('Au 04/08, seuil atteint (9 qtx de pierre / 7 kg de fer).')
  })

  it('prévient à 2 unités ou moins du seuil', async () => {
    const wrapper = mountView()
    await wrapper.find('textarea').setValue(withState('8 qtx de pierre et 3 kg de fer', '10 qtx de pierre et 8 kg de fer'))
    expect(wrapper.find('[data-testid="threshold-alerts"]').text()).toContain('Au 04/08, à 2 unités ou moins du seuil.')
  })

  it("ne part jamais dans l'export du bilan (Q9 bis)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    const wrapper = mountView()
    await generate(wrapper, withState('9 qtx de pierre et 7 kg de fer', '9 qtx de pierre et 7 kg de fer'))
    await exportButton(wrapper).trigger('click')

    expect(writeText.mock.calls[0][0]).not.toContain('seuil atteint')
  })
})

describe('EconomyMines — mise en forme du jour (aucun calcul)', () => {
  // Collage complet : le bloc de configuration des 2 mines (que sampleText n'a pas) suivi
  // des tableaux de relevés. Partagé par les cas qui vérifient le rendu BBcode.
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

  // Monte la vue, colle le relevé complet, déclenche "Mise en forme du jour" et renvoie la
  // partie visible du BBcode copié — le [spoiler] du texte brut est écarté, les assertions
  // de rendu ne doivent jamais matcher dedans par accident.
  async function copyVisibleReport() {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    const wrapper = mountView()
    await wrapper.find('textarea').setValue(textWithState)
    await wrapper.findAll('button').find(b => b.text() === 'Mise en forme du jour').trigger('click')
    return writeText.mock.calls[0][0].split('[spoiler]')[0]
  }

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
    // Les 3 tableaux journaliers doivent apparaître dans la partie visible, datés dans le
    // calendrier du jeu (le collage, lui, porte l'année réelle 2026).
    expect(copied).toContain("Nombre d'heures travaillées ces 7 derniers jours")
    expect(copied).toContain('1474-08-01 : 100')
    expect(copied).toContain('Production des 7 derniers jours')
    expect(copied).toContain('1474-08-01 : 500')
    expect(copied).toContain('Ressources consommées par la mine ces 7 derniers jours')
    expect(copied).toContain('1474-08-01 : 10 qtx de pierre, 5 kg de fer')
    // Mine 2 n'a aucune conso relevée sur la période : la section reste affichée avec "/".
    expect(copied).toContain('[b]Ressources consommées par la mine ces 7 derniers jours[/b] : /')
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

  it('encadre chaque mine dans son propre [quote]', async () => {
    const visible = await copyVisibleReport()
    // Le jeu de test décrit 2 mines : une paire [quote]...[/quote] par mine, pas un bloc global.
    expect(visible.match(/\[quote\]/g)).toHaveLength(2)
    expect(visible.match(/\[\/quote\]/g)).toHaveLength(2)
    // Le titre de mine ouvre le quote, il n'est jamais laissé en dehors du cadre.
    expect(visible).toContain("[quote][color=#574000][b][u]#1 Mine d'or")
  })

  it('colore le titre selon la matière première, en teintes lisibles sur le fond du forum', async () => {
    const visible = await copyVisibleReport()
    expect(visible).toContain('[color=#574000]') // or brun foncé, mine 1
    expect(visible).toContain('[color=#26414c]') // acier bleuté, mine 2 (fer)
    // Les anciennes teintes tombaient sous 2,5:1 sur le beige des [quote] : plus aucun usage.
    expect(visible).not.toContain('darkgoldenrod')
    expect(visible).not.toContain('darkgray')
  })

  it("n'insère pas de ligne vide entre les sections d'une même mine", async () => {
    const visible = await copyVisibleReport()
    // Chaque intertitre suit directement le [/list] de la section précédente : c'est ce
    // doublon d'espacement ([/list] pose déjà sa marge) qui étirait le rendu sur le forum.
    expect(visible).toContain("[/list]\n[b]Nombre d'heures travaillées")
    expect(visible).toContain('[/list]\n[b]Production des 7 derniers jours')
    expect(visible).not.toMatch(/\n\n\[b\]Nombre d'heures/)
    expect(visible).not.toMatch(/\n\n\[b\]Production des/)
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
    // Premier collage, pris dimanche : il manque les heures du lundi suivant → semaine incomplète.
    await generate(wrapper, weekText({ withNextMonday: false }))
    expect(exportButton(wrapper)).toBeUndefined()

    // Second collage, le lundi : seules les heures du 03/08 sont nouvelles (elles mesurent le dimanche).
    const secondPaste = `
Mine 1 : Mine d'or - Noeud 236
Nombre d'heures travaillées ces 7 derniers jours
Date	Heures
1474-08-03	10

Mine 2 : Mine de fer - Noeud 228
Nombre d'heures travaillées ces 7 derniers jours
Date	Heures
1474-08-03	5
`
    const secondVisit = mountView()
    await secondVisit.vm.$nextTick()
    expect(secondVisit.text()).toContain('Fusionné avec ton dernier collage mémorisé')

    await generate(secondVisit, secondPaste)
    // Les deux collages fusionnés font une semaine complète : soldes et export retrouvés.
    expect(secondVisit.findAll('tbody tr')[0].text()).toContain('252,5')
    expect(exportButton(secondVisit)).toBeDefined()
  })

  it('mémorise prix et taux AVEC la semaine, et les rend à sa réouverture (Q6)', async () => {
    useCookieStore().acceptedCookies = ['comfort']
    const wrapper = mountView()
    await wrapper.find('textarea').setValue(weekText())
    await wrapper.findAll('input[type="number"]').at(-1).setValue(0.99)
    await generate(wrapper)

    const reopened = mountView()
    await reopened.vm.$nextTick()
    expect(reopened.findAll('input[type="number"]').at(-1).element.value).toBe('0.99')
  })

  it('une semaine mémorisée avant ce changement le dit : son taux n’a pas été enregistré (Q6)', async () => {
    useCookieStore().acceptedCookies = ['comfort']
    // Ancien format : un simple tableau de mines, ni prix ni taux.
    useCookieStore().setComfortData('economy_mines_data_2026-07-27', JSON.stringify([]))

    const wrapper = mountView()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="rate-not-stored"]').exists()).toBe(true)
  })
})
