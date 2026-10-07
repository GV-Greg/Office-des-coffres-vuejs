// @vitest-environment node
// Logique pure, aucun DOM à monter — voir README, section Tests.
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  detectResource, parseMinesText, mergeMinesData, computeBilan,
  mostRecentDate, filterToDate, getWeekBounds, checkWeekCompleteness,
  parseMineStates, formatDateFr, filterToWeek, shiftWeek, todayIso,
  lastCompletedWeek, thresholdAlert,
} from '../../src/modules/mineParser'

describe('detectResource', () => {
  it('détecte chaque type de ressource depuis le libellé de la mine', () => {
    expect(detectResource("Mine d'or")).toBe('OR')
    expect(detectResource('Mine de fer')).toBe('FER')
    expect(detectResource('Carrière de pierre')).toBe('PIERRE')
    expect(detectResource("Mine d'argile")).toBe('ARGILE')
    expect(detectResource('Mine de sel')).toBe('SEL')
    expect(detectResource('Ressource inconnue')).toBe(null)
  })
})

describe('parseMinesText — collage avec retours à la ligne (format attendu d\'un vrai copier-coller)', () => {
  const text = `
Mine 1 : Mine d'or - Noeud 236
Niveau : 10
Rendement : 50.4 écus/22 heures

Mine 1 : Mine d'or - Noeud 236
Nombre d'heures travaillées ces 7 derniers jours
Date	Heures
2026-07-30	83
2026-07-31	142
Production des 7 derniers jours
Date	Rendement
2026-07-30	335,39
2026-07-31	297,54
Ressources consommées par la mine ces 7 derniers jours
Date	Qx de pierre	Kg de fer
2026-07-31	21	16

Mine 2 : Mine de fer - Noeud 228
Nombre d'heures travaillées ces 7 derniers jours
Date	Heures
2026-07-30	15
2026-07-31	11
Production des 7 derniers jours
Date	Rendement
2026-07-30	1
2026-07-31	0
Ressources consommées par la mine ces 7 derniers jours
Date	Qx de pierre	Kg de fer
`

  it('reconnaît chaque mine avec sa ressource', () => {
    const mines = parseMinesText(text)
    expect(mines).toHaveLength(2)
    expect(mines[0]).toMatchObject({ number: 1, resource: 'OR' })
    expect(mines[1]).toMatchObject({ number: 2, resource: 'FER' })
  })

  it('associe les bonnes valeurs à chaque date', () => {
    const mines = parseMinesText(text)
    const mine1 = mines[0]
    expect(mine1.days['2026-07-30']).toMatchObject({ heures: 83, production: 335.39 })
    expect(mine1.days['2026-07-31']).toMatchObject({ heures: 142, production: 297.54, pierre: 21, fer: 16 })
  })

  it("n'invente pas de conso pour un jour sans consommation réelle", () => {
    const mines = parseMinesText(text)
    expect(mines[0].days['2026-07-30'].pierre).toBeUndefined()
  })
})

describe('parseMinesText — collage à plat (sans retours à la ligne, tabulations conservées)', () => {
  // Reproduit fidèlement un cas réel observé : le texte copié depuis le jeu peut
  // perdre ses sauts de ligne en transit, mais garde les tabulations entre
  // colonnes. Le parseur s'appuie sur les dates comme repères, pas sur les lignes.
  const flat = "Mine 1 : Mine d'or - Noeud 236Niveau : 10Rendement : 50.4 écus/22 heuresCréneaux horaires : 130/1100Seuil de rupture : 20 qtx de pierre et 16 kg de ferEntretien normal(6 qtx de pierre et 5 kg de fer)Entretien et amélioration(46 qtx de pierre et 35 kg de fer)Diminuer le niveau de la mineFermer la mineMine 1 : Mine d'or - Noeud 236Nombre d'heures travaillées ces 7 derniers joursLes valeurs relatives à un jour donné sont prises de minuit à minuit (heure de Paris, France).Date\tHeures\t2026-07-30\t832026-07-31\t142Production des 7 derniers joursLes valeurs relatives à un jour donné sont prises de minuit à minuit (heure de Paris, France).Date\tRendement2026-07-30\t335,392026-07-31\t297,54Ressources consommées par la mine ces 7 derniers joursLes valeurs relatives à un jour donné sont prises de minuit à minuit (heure de Paris, France).Date\tQx de pierre\tKg de fer2026-07-31\t21\t16"

  it('retrouve quand même les mines et leurs relevés', () => {
    const mines = parseMinesText(flat)
    expect(mines).toHaveLength(1)
    expect(mines[0].resource).toBe('OR')
    expect(mines[0].days['2026-07-30']).toMatchObject({ heures: 83, production: 335.39 })
    expect(mines[0].days['2026-07-31']).toMatchObject({ heures: 142, production: 297.54, pierre: 21, fer: 16 })
  })
})

// Brief Bilan §6c : l'« Entretien normal » de l'écran est un CUMUL depuis le dernier entretien, pas
// un coût journalier (dossier mines §2.3.1). Le sommer sur une semaine compterait plusieurs fois les
// mêmes quintaux. Le coût d'une semaine se lit dans « Ressources consommées », et nulle part
// ailleurs. Le code est juste aujourd'hui : ce test le fige, un commentaire ne suffirait pas.
describe("le bilan ne somme jamais l'« Entretien normal » (§6c)", () => {
  it('seule la consommation réelle entre dans le bilan', () => {
    const flat = "Mine 1 : Mine d'or - Noeud 236Niveau : 10Seuil de rupture : 20 qtx de pierre et 16 kg de ferEntretien normal(6 qtx de pierre et 5 kg de fer)Entretien et amélioration(46 qtx de pierre et 35 kg de fer)Mine 1 : Mine d'or - Noeud 236Nombre d'heures travaillées ces 7 derniers joursDate\tHeures\t2026-07-30\t83\t2026-07-31\t90Production des 7 derniers joursDate\tRendement2026-07-30\t335,39Ressources consommées par la mine ces 7 derniers joursDate\tQx de pierre\tKg de fer2026-07-30\t21\t16"
    const states = parseMineStates(flat)
    const mines = parseMinesText(flat)
    // Même si un appelant fusionnait l'état de la mine dans ses relevés, rien ne doit changer.
    const withState = mines.map(m => ({ ...m, ...states.find(s => s.number === m.number) }))

    for (const input of [mines, withState]) {
      // Heures du 31/07 : elles mesurent le 30/07 (décalage d'un jour), sans quoi le jour est écarté.
      const { lines } = computeBilan(input, { PIERRE: 14.5, FER: 19.5 }, 0.7, '2026-07-27')
      expect(lines[0]).toMatchObject({ pierre: 21, fer: 16 })
    }
  })
})

describe('mergeMinesData', () => {
  it('fusionne sans perdre les données déjà connues', () => {
    const existing = [
      { number: 1, label: "Mine d'or", resource: 'OR', days: { '2026-08-01': { heures: 10, production: 100 } } },
    ]
    const incoming = [
      { number: 1, label: "Mine d'or", resource: 'OR', days: { '2026-08-01': { pierre: 5 }, '2026-08-02': { heures: 20 } } },
    ]
    const merged = mergeMinesData(existing, incoming)
    expect(merged[0].days['2026-08-01']).toMatchObject({ heures: 10, production: 100, pierre: 5 })
    expect(merged[0].days['2026-08-02']).toMatchObject({ heures: 20 })
  })

  it('ajoute une mine totalement nouvelle', () => {
    const merged = mergeMinesData(
      [{ number: 1, label: 'A', resource: 'OR', days: {} }],
      [{ number: 2, label: 'B', resource: 'FER', days: {} }]
    )
    expect(merged.map(m => m.number)).toEqual([1, 2])
  })
})

// Brief Bilan §6b (fil admin/echanges/bilan-mines, Q7) : le numéro « Mine N » est une numérotation
// d'affichage qui glisse quand une mine ouvre ou ferme, et le nom n'est pas unique (deux « Mine de
// fer », nœuds 226 et 228). Le nœud est l'identifiant stable : la fusion se clavette sur lui. Le
// Registre en héritera — persister avant ce correctif voudrait dire migrer des données.
describe('clavetage sur le nœud (§6b)', () => {
  const collage = (number, noeud, label, day, heures) => `
Mine ${number} : ${label} - Noeud ${noeud}
Niveau : 10

Mine ${number} : ${label} - Noeud ${noeud}
Nombre d'heures travaillées ces 7 derniers jours
Date	Heures
${day}	${heures}
`

  it('porte le nœud de chaque mine sur ses relevés', () => {
    const [mine] = parseMinesText(collage(4, 226, 'Mine de fer', '2026-09-28', 90))
    expect(mine).toMatchObject({ number: 4, noeud: '226', resource: 'FER' })
  })

  it('deux mines de même numéro mais de nœuds différents ne fusionnent pas', () => {
    // La mine 3 ferme entre deux collages : la « Mine 4 » d'hier devient la « Mine 3 » d'aujourd'hui.
    const lundi = parseMinesText(collage(3, 232, 'Carrière de pierre', '2026-09-28', 50) + collage(4, 226, 'Mine de fer', '2026-09-28', 90))
    const mardi = parseMinesText(collage(3, 226, 'Mine de fer', '2026-09-29', 95))
    const merged = mergeMinesData(lundi, mardi)

    const fer = merged.find(m => m.noeud === '226')
    const carriere = merged.find(m => m.noeud === '232')
    expect(merged).toHaveLength(2)
    expect(fer.days).toEqual({ '2026-09-28': { heures: 90 }, '2026-09-29': { heures: 95 } })
    expect(carriere.days).toEqual({ '2026-09-28': { heures: 50 } })
  })

  it("deux mines de même nom (deux « Mine de fer ») restent distinctes", () => {
    const mines = parseMinesText(collage(2, 228, 'Mine de fer', '2026-09-28', 40) + collage(4, 226, 'Mine de fer', '2026-09-28', 90))
    expect(mines.map(m => m.noeud)).toEqual(['228', '226'])
  })

  it("dans un même collage, un bloc sans nœud prend celui du bloc de même numéro", () => {
    const text = `
Mine 4 : Mine de fer - Noeud 226
Niveau : 9

Mine 4 : Mine de fer
Nombre d'heures travaillées ces 7 derniers jours
Date	Heures
2026-09-28	90
`
    expect(parseMinesText(text)).toEqual([
      expect.objectContaining({ number: 4, noeud: '226', days: { '2026-09-28': { heures: 90 } } }),
    ])
  })

  it('sans aucun nœud dans le collage, le numéro reste la clé (repli)', () => {
    const text = "Mine 1 : Mine d'or\nNombre d'heures travaillées\n2026-09-28\t10\n"
    const merged = mergeMinesData(parseMinesText(text), parseMinesText(text.replace('2026-09-28', '2026-09-29')))
    expect(merged).toHaveLength(1)
    expect(Object.keys(merged[0].days)).toEqual(['2026-09-28', '2026-09-29'])
  })

  // Q7 : les semaines déjà mémorisées (confort) n'ont pas de nœud. Une entrée ancienne se rattache
  // UNE fois, par son numéro, à l'entrée nouvelle de même numéro, puis prend son nœud.
  it('une entrée mémorisée sans nœud se rattache par son numéro, puis prend le nœud', () => {
    const ancienne = [{ number: 4, label: 'Mine de fer', resource: 'FER', days: { '2026-09-28': { heures: 90 } } }]
    const nouvelle = parseMinesText(collage(4, 226, 'Mine de fer', '2026-09-29', 95))
    const merged = mergeMinesData(ancienne, nouvelle)

    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ number: 4, noeud: '226' })
    expect(Object.keys(merged[0].days)).toEqual(['2026-09-28', '2026-09-29'])
  })

  it('…et une fois le nœud posé, la clé est le nœud, définitivement', () => {
    const ancienne = [{ number: 4, label: 'Mine de fer', resource: 'FER', days: { '2026-09-28': { heures: 90 } } }]
    const rattachee = mergeMinesData(ancienne, parseMinesText(collage(4, 226, 'Mine de fer', '2026-09-29', 95)))
    // Le lendemain, la numérotation a glissé : la « Mine 4 » est une autre mine (nœud 320).
    const merged = mergeMinesData(rattachee, parseMinesText(collage(4, 320, "Mine d'argile", '2026-09-30', 12)))

    expect(merged).toHaveLength(2)
    expect(merged.find(m => m.noeud === '226').days['2026-09-30']).toBeUndefined()
  })
})

describe('mostRecentDate / filterToDate', () => {
  const mines = [
    { number: 1, label: "Mine d'or", resource: 'OR', days: { '2026-08-01': { production: 1 }, '2026-08-03': { production: 2 } } },
    { number: 2, label: 'Mine de fer', resource: 'FER', days: { '2026-08-02': { production: 3 } } },
  ]

  it('trouve la date la plus récente tous mines confondues', () => {
    expect(mostRecentDate(mines)).toBe('2026-08-03')
  })

  it('retourne null sans aucune donnée', () => {
    expect(mostRecentDate([])).toBe(null)
  })

  it('ne garde que les relevés de la date demandée', () => {
    const filtered = filterToDate(mines, '2026-08-01')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].number).toBe(1)
    expect(filtered[0].days).toEqual({ '2026-08-01': { production: 1 } })
  })
})

describe('getWeekBounds', () => {
  it('retrouve le lundi et le dimanche englobants', () => {
    // 2026-08-04 est un mardi
    expect(getWeekBounds('2026-08-04')).toEqual({ monday: '2026-08-03', sunday: '2026-08-09' })
  })

  it('gère le dimanche comme dernier jour de sa propre semaine', () => {
    expect(getWeekBounds('2026-08-09')).toEqual({ monday: '2026-08-03', sunday: '2026-08-09' })
  })
})

describe('filterToWeek', () => {
  const mines = [
    {
      number: 1, label: "Mine d'or", resource: 'OR',
      days: { '2026-08-02': { production: 1 }, '2026-08-04': { production: 2 }, '2026-08-10': { production: 3 } },
    },
    { number: 2, label: 'Mine de fer', resource: 'FER', days: { '2026-08-01': { production: 9 } } },
  ]

  it('ne garde que les jours dans [lundi, dimanche] inclus', () => {
    const filtered = filterToWeek(mines, '2026-08-03', '2026-08-09')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].number).toBe(1)
    expect(filtered[0].days).toEqual({ '2026-08-04': { production: 2 } })
  })

  it('retire une mine qui ne tombe entièrement hors de la semaine', () => {
    const filtered = filterToWeek(mines, '2026-08-03', '2026-08-09')
    expect(filtered.find(m => m.number === 2)).toBeUndefined()
  })

  it('ne filtre rien de perdu si toute la semaine est demandée', () => {
    const filtered = filterToWeek(mines, '2026-07-27', '2026-08-16')
    expect(filtered).toHaveLength(2)
  })
})

describe("parseMinesText — dates en année de jeu (format réel d'un collage)", () => {
  // Le texte collé depuis le jeu porte l'année du jeu (1474 = 2026), confirmé par Greg
  // le 08/08/2026. Non-régression du bug qui rendait le module inutilisable en réel :
  // `isValidDate` exigeait une année >= 2000, donc chaque ligne datée 1474 était écartée
  // dès le parsing et un collage authentique ressortait comme un texte non reconnu.
  const text = `
Mine 1 : Mine d'or - Noeud 236
Nombre d'heures travaillées ces 7 derniers jours
Date	Heures
1474-08-03	100
1474-08-04	120
Production des 7 derniers jours
Date	Rendement
1474-08-03	500
1474-08-04	600
Ressources consommées par la mine ces 7 derniers jours
Date	Qx de pierre	Kg de fer
1474-08-03	10	5
`

  it('convertit les dates du jeu en dates réelles dès le parsing', () => {
    const mines = parseMinesText(text)
    expect(mines).toHaveLength(1)
    expect(Object.keys(mines[0].days)).toEqual(['2026-08-03', '2026-08-04'])
    expect(mines[0].days['2026-08-03']).toMatchObject({
      heures: 100, production: 500, pierre: 10, fer: 5,
    })
  })

  it('accepte aussi le format FR en année de jeu', () => {
    const mines = parseMinesText(text.replace(/1474-08-(\d+)/g, (_, d) => `${d}/08/1474`))
    expect(Object.keys(mines[0].days)).toEqual(['2026-08-03', '2026-08-04'])
  })

  it('reste compatible avec un collage daté en année réelle', () => {
    const mines = parseMinesText(text.replace(/1474-/g, '2026-'))
    expect(Object.keys(mines[0].days)).toEqual(['2026-08-03', '2026-08-04'])
  })

  it('entre dans la semaine sélectionnée une fois parsé', () => {
    // Le bug de bout en bout : bornes calculées sur l'horloge du navigateur (2026)
    // comparées à des journées restées en 1474 — « 1474… < 2026… » en comparaison
    // lexicale, donc toutes les journées rejetées et « aucune donnée pour cette
    // semaine » affiché sur un collage pourtant valide.
    const { monday, sunday } = getWeekBounds('2026-08-05')
    const filtered = filterToWeek(parseMinesText(text), monday, sunday)
    expect(filtered).toHaveLength(1)
    expect(Object.keys(filtered[0].days)).toEqual(['2026-08-03', '2026-08-04'])
  })

  it('retrouve le bon lundi/dimanche pour la complétude de semaine', () => {
    // checkWeekCompleteness() dérive ses bornes de la date la plus récente des relevés :
    // sur une date restée en 1474, `new Date()` en tirait un jour de la semaine faux (le
    // 3 août 1474 grégorien n'est pas un lundi), donc un avertissement « X/7 jours »
    // décalé. Les relevés étant désormais en dates réelles, les bornes sont justes.
    const check = checkWeekCompleteness(parseMinesText(text), '2026-08-03')
    expect(check).toMatchObject({ monday: '2026-08-03', sunday: '2026-08-09', complete: false })
  })
})

describe('shiftWeek', () => {
  it('recule au lundi de la semaine précédente', () => {
    expect(shiftWeek('2026-08-03', -1)).toBe('2026-07-27')
  })

  it('avance au lundi de la semaine suivante', () => {
    expect(shiftWeek('2026-08-03', 1)).toBe('2026-08-10')
  })

  it('reste inchangé pour un décalage de 0', () => {
    expect(shiftWeek('2026-08-03', 0)).toBe('2026-08-03')
  })
})

describe('todayIso', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("renvoie la date du jour au format AAAA-MM-JJ", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-06T15:30:00Z'))
    expect(todayIso()).toBe('2026-08-06')
  })

  // Brief Bilan §6a : les dates du collage sont parisiennes (« de minuit à minuit, heure de Paris »).
  // En UTC, entre minuit et 2 h du matin en été, la semaine présélectionnée était la précédente.
  it("donne la date de Paris, pas celle d'UTC (00:30 à Paris = 22:30 UTC la veille)", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-05T22:30:00Z'))
    expect(todayIso()).toBe('2026-08-06')
  })

  it("…et en hiver, où Paris n'a qu'une heure d'avance (00:30 à Paris = 23:30 UTC)", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-12-31T23:30:00Z'))
    expect(todayIso()).toBe('2027-01-01')
  })
})

describe('parseMineStates — état de chaque mine (config), pas les tableaux', () => {
  const text = `
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

Mine 3 : Carrière de pierre - Noeud 232
Niveau : 17
Rendement : 2.73 quintaux de pierre/22 heures
Créneaux horaires : 95/1100
Seuil de rupture : 14 qtx de pierre et 10 kg de fer

Entretien normal
(12 qtx de pierre et 9 kg de fer)
Entretien et amélioration


Diminuer le niveau de la mine
Fermer la mine

Mine 1 : Mine d'or - Noeud 236
Nombre d'heures travaillées ces 7 derniers jours
Date	Heures
2026-08-03	114
`

  it('extrait niveau, rendement, créneaux, seuil et entretien pour chaque mine', () => {
    const states = parseMineStates(text)
    expect(states).toHaveLength(2)
    expect(states[0]).toMatchObject({
      number: 1,
      noeud: '236',
      resource: 'OR',
      niveau: '10',
      rendement: '50.4 écus/22 heures',
      creneaux: '145/1100',
      seuilRupture: '20 qtx de pierre et 16 kg de fer',
      entretienNormal: '22 qtx de pierre et 17 kg de fer',
      entretienAmelioration: '62 qtx de pierre et 47 kg de fer',
    })
  })

  it("laisse entretienAmelioration à null quand la mine n'a plus d'amélioration possible", () => {
    const states = parseMineStates(text)
    const mine3 = states.find(s => s.number === 3)
    expect(mine3.entretienAmelioration).toBe(null)
    expect(mine3.entretienNormal).toBe('12 qtx de pierre et 9 kg de fer')
  })

  it("n'utilise que le bloc de configuration, pas celui des tableaux (pas de doublon)", () => {
    const states = parseMineStates(text)
    expect(states.filter(s => s.number === 1)).toHaveLength(1)
  })
})

describe('formatDateFr', () => {
  it('formate une date ISO en français', () => {
    expect(formatDateFr('2026-08-03')).toBe('3 août 2026')
  })
})

// ─── Bilan hebdomadaire (brief Bilan §2.1 à §2.4 ; fil bilan-mines, Q2 à Q5, Q10) ──────────────
//
// Fixture CONSTRUITE (Greg : « les chiffres c'est des exemples »), calculée à la main.
// Semaine du lundi 28/09 au dimanche 04/10/2026 ; lundi suivant : 05/10.
// Règle A (décalage, Greg 05/10) : pour le jour D, production[D], consommation[D], heures[D+1].
//
// Mine 1 — or, nœud 236 :
//   heures 28/09 : 999  → mesurent le dimanche 27/09, HORS semaine : ne comptent pas
//   heures 29/09 → 04/10 : 10 par jour (mesurent 28/09 → 03/10)
//   heures 05/10 : 20   → mesurent le dimanche 04/10 : comptent
//   production 28/09 → 04/10 : 50 par jour ; consommation le 01/10 : 2 qtx de pierre, 1 kg de fer
//   → heures 6×10 + 20 = 80 ; salaire 80 × 0,70 = 56 ; valeur 350 ;
//     entretien 2×14,5 + 1×19,5 = 48,5 ; solde 350 − 56 − 48,5 = 245,5
//
// Mine 2 — fer, nœud 228 :
//   heures 29/09 → 05/10 : 5 par jour ; production 2 par jour, sauf un VRAI ZÉRO le 01/10
//   → heures 35 ; salaire 24,5 ; production 12 kg ; valeur 12 × 19,5 = 234 ; solde 209,5
//
// Total : valeur 584 ; heures 115 ; salaire 80,5 ; entretien 2 p / 1 f = 48,5 ; solde 455
const WEEK = '2026-09-28'
const BILAN_PRICES = { PIERRE: 14.5, FER: 19.5, ARGILE: 4.5, SEL: 4.5 }
const RATE = 0.7
const weekDays = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']

function weekFixture() {
  const or = { number: 1, noeud: '236', label: "Mine d'or", resource: 'OR', days: {} }
  const fer = { number: 2, noeud: '228', label: 'Mine de fer', resource: 'FER', days: {} }
  const set = (mine, day, values) => { mine.days[day] = { ...(mine.days[day] ?? {}), ...values } }

  set(or, '2026-09-28', { heures: 999 })
  for (const day of weekDays) set(or, day, { production: 50 })
  for (const day of weekDays.slice(1)) set(or, day, { heures: 10 })
  set(or, '2026-10-05', { heures: 20 })
  set(or, '2026-10-01', { pierre: 2, fer: 1 })

  for (const day of weekDays) set(fer, day, { production: day === '2026-10-01' ? 0 : 2 })
  for (const day of [...weekDays.slice(1), '2026-10-05']) set(fer, day, { heures: 5 })

  return [or, fer]
}

describe('computeBilan — table par mine (§2.1 à §2.3)', () => {
  it('apparie la production du jour D aux heures de D+1 (règle A), sur une semaine achevée', () => {
    const { lines } = computeBilan(weekFixture(), BILAN_PRICES, RATE, WEEK)
    // Les 999 h du lundi 28/09 (dimanche précédent) sont écartées, les 20 h du 05/10 comptent.
    expect(lines.find(l => l.noeud === '236').heures).toBe(80)
    expect(lines.find(l => l.noeud === '228').heures).toBe(35)
  })

  it('impute à chaque mine son propre salaire, heures × taux (§2.2)', () => {
    const { lines } = computeBilan(weekFixture(), BILAN_PRICES, RATE, WEEK)
    expect(lines.find(l => l.noeud === '236').salaire).toBeCloseTo(56)
    expect(lines.find(l => l.noeud === '228').salaire).toBeCloseTo(24.5)
  })

  it('donne pour chaque mine production, valeur, entretien propre et solde (§2.3)', () => {
    const { lines } = computeBilan(weekFixture(), BILAN_PRICES, RATE, WEEK)
    const or = lines.find(l => l.noeud === '236')
    const fer = lines.find(l => l.noeud === '228')

    expect(or).toMatchObject({ production: 350, pierre: 2, fer: 1 })
    expect(or.valeur).toBeCloseTo(350) // l'or produit des écus : pas de prix unitaire
    expect(or.entretien).toBeCloseTo(48.5)
    expect(or.solde).toBeCloseTo(245.5)

    expect(fer).toMatchObject({ production: 12, pierre: 0, fer: 0 }) // le vrai 0 du 01/10 est gardé
    expect(fer.valeur).toBeCloseTo(234)
    expect(fer.solde).toBeCloseTo(209.5)
  })

  it('la ligne Total met en commun la pierre et le fer de toutes les mines', () => {
    const { total, net } = computeBilan(weekFixture(), BILAN_PRICES, RATE, WEEK)
    expect(total).toMatchObject({ heures: 115, pierre: 2, fer: 1 })
    expect(total.valeur).toBeCloseTo(584)
    expect(total.salaire).toBeCloseTo(80.5)
    expect(total.entretien).toBeCloseTo(48.5)
    expect(total.solde).toBeCloseTo(455)
    expect(net).toBeCloseTo(455)
  })

  it('écarte un jour sans production (règle B) : ni ses heures ni sa consommation ne comptent', () => {
    const mines = weekFixture()
    delete mines[0].days['2026-10-01'].production // jour du 01/10 de la mine d'or, incomplet

    const or = computeBilan(mines, BILAN_PRICES, RATE, WEEK).lines.find(l => l.noeud === '236')
    expect(or.heures).toBe(70) // les 10 h du 02/10, qui mesurent le 01/10, partent avec lui
    expect(or).toMatchObject({ production: 300, pierre: 0, fer: 0 })
  })

  it("écarte aussi un jour dont les heures de D+1 manquent : le dimanche sans le lundi suivant", () => {
    const mines = weekFixture()
    for (const mine of mines) delete mine.days['2026-10-05']

    const or = computeBilan(mines, BILAN_PRICES, RATE, WEEK).lines.find(l => l.noeud === '236')
    expect(or.heures).toBe(60)
    expect(or.production).toBe(300) // la production du dimanche 04/10 n'a pas de salaire en face
  })

  it("le taux vient de l'appelant, jamais d'une constante (§3)", () => {
    const or = computeBilan(weekFixture(), BILAN_PRICES, 0.99, WEEK).lines.find(l => l.noeud === '236')
    expect(or.salaire).toBeCloseTo(79.2)
  })
})

describe('checkWeekCompleteness — les deux séries, et les heures du lundi suivant (§2.1, §2.4)', () => {
  it('une semaine dont chaque jour a sa production et ses heures de D+1 est complète', () => {
    const check = checkWeekCompleteness(weekFixture(), WEEK)
    expect(check).toMatchObject({ complete: true, monday: WEEK, sunday: '2026-10-04', missingDates: [] })
  })

  it('sans les heures du lundi suivant, le dimanche manque : la semaine n’est pas complète', () => {
    const mines = weekFixture()
    for (const mine of mines) delete mine.days['2026-10-05']
    expect(checkWeekCompleteness(mines, WEEK)).toMatchObject({ complete: false, missingDates: ['2026-10-04'] })
  })

  it("un jour qui a des heures mais pas de production n'est pas couvert (le garde-fou regardait à côté)", () => {
    const mines = weekFixture()
    delete mines[1].days['2026-10-02'].production
    expect(checkWeekCompleteness(mines, WEEK)).toMatchObject({ complete: false, missingDates: ['2026-10-02'] })
  })

  it('un jour sans aucune donnée manque', () => {
    const mines = weekFixture()
    for (const mine of mines) delete mine.days['2026-09-30']
    expect(checkWeekCompleteness(mines, WEEK).missingDates).toEqual(['2026-09-29', '2026-09-30'])
  })
})

describe('lastCompletedWeek — la semaine proposée par défaut (§2.4)', () => {
  it('est la semaine précédente, quel que soit le jour', () => {
    expect(lastCompletedWeek('2026-10-07')).toBe('2026-09-28') // mercredi
    expect(lastCompletedWeek('2026-10-05')).toBe('2026-09-28') // lundi
    expect(lastCompletedWeek('2026-10-04')).toBe('2026-09-21') // dimanche
  })
})

// ─── Alerte de seuil (brief §4 ; fil bilan-mines, Q8 et Q8 bis) ─────────────────────────────

describe('thresholdAlert — en constat, jamais en prédiction', () => {
  const state = (entretien, seuil) => ({ entretienNormal: entretien, seuilRupture: seuil })

  it("le seuil est atteint dès l'égalité, sur la pierre ou le fer", () => {
    expect(thresholdAlert(state('9 qtx de pierre et 7 kg de fer', '9 qtx de pierre et 7 kg de fer'))?.level).toBe('reached')
    expect(thresholdAlert(state('12 qtx de pierre et 9 kg de fer', '10 qtx de pierre et 8 kg de fer'))?.level).toBe('reached')
    expect(thresholdAlert(state('3 qtx de pierre et 8 kg de fer', '10 qtx de pierre et 8 kg de fer'))?.level).toBe('reached')
  })

  it('prévention à 2 unités ou moins sous le seuil, sur la pierre ou le fer', () => {
    expect(thresholdAlert(state('8 qtx de pierre et 3 kg de fer', '10 qtx de pierre et 8 kg de fer'))?.level).toBe('near')
    expect(thresholdAlert(state('1 qtx de pierre et 6 kg de fer', '10 qtx de pierre et 8 kg de fer'))?.level).toBe('near')
  })

  it('rien au-delà de 2 unités sous le seuil', () => {
    expect(thresholdAlert(state('5 qtx de pierre et 4 kg de fer', '24 qtx de pierre et 18 kg de fer'))).toBe(null)
    expect(thresholdAlert(state('7 qtx de pierre et 5 kg de fer', '10 qtx de pierre et 8 kg de fer'))).toBe(null)
  })

  it('porte les chiffres lus, pour que le message les cite', () => {
    expect(thresholdAlert(state('12 qtx de pierre et 9 kg de fer', '10 qtx de pierre et 8 kg de fer')))
      .toEqual({ level: 'reached', pierre: 12, fer: 9, seuilPierre: 10, seuilFer: 8 })
  })

  it('un champ absent ou illisible ne déclenche rien', () => {
    expect(thresholdAlert(state(null, '10 qtx de pierre et 8 kg de fer'))).toBe(null)
    expect(thresholdAlert(state('12 qtx de pierre et 9 kg de fer', null))).toBe(null)
    expect(thresholdAlert(state('illisible', '10 qtx de pierre et 8 kg de fer'))).toBe(null)
  })
})

// La synthèse par ressource (salaire entier sur l'or, entretien mis en commun par ressource) a été
// SUPPRIMÉE le 05/10/2026 (brief Bilan §1 défaut 2, §2.3) : elle désignait la mine d'or comme le
// gouffre de la province et le fer comme sa rente — l'inverse de la réalité. Ses tests, et ceux de la
// semaine réelle du 10/11/2025 (tests/fixtures/mines-2025-11-10.json — à retrouver dans le commit
// b220edb —, sans heures, donc
// incalculable avec le décalage d'un jour), figeaient précisément ce défaut : ils sont retirés.

// Brief Bilan §5 bis (Greg, 07/10/2026) : le parseur lit l'écran ANGLAIS — l'aide anglaise envoie le
// joueur sur « Management of the mines ». Libellés repris du collage réel de Greg (07/10, nœuds 236,
// 228, 232 ; admin/jeu/mines.md §7.12). 🔴 AUCUNE conversion d'unité : « tons of stone » et « ounces
// of iron » portent les MÊMES nombres que les quintaux et les kilos — une conversion introduirait un
// facteur 10 silencieux. D'où le jumeau français aux mêmes chiffres : les deux doivent donner le même
// relevé, le même état et le même bilan. Le point décimal anglais (139.97) est lu comme la virgule.
describe('collage anglais (§5 bis) — même relevé que le français, aucune conversion', () => {
  const english = `The maintenance cost increases as soon as a new miner enters the mine.

Mine 1 : Gold mine - Node 236
Level: 10
Output : 50.4 pounds/22 hours ago
Time slots : 172/1100
Deterioration threshold: 24 tons of stone and 18 ounces of iron

Normal maintenance
(13 tons of stone and 10 ounces of iron)
Maintenance and improvement
(62 tons of stone and 47 ounces of iron)

Reduce the level of the mine
Close the mine

Mine 3 : Stone quarry - Node 232
Level: 17
Output : 2.73 tons of stone/22 hours ago
Time slots : 50/1100
Deterioration threshold: 14 tons of stone and 10 ounces of iron

Normal maintenance
(14 tons of stone and 6 ounces of iron)
Maintenance and improvement


Reduce the level of the mine
Close the mine

Mine 1 : Gold mine - Node 236
Number of hours worked in the past 7 days
The values for each day were measured from midnight to midnight (Paris time).

Date\tHours\t
2026-10-01\t53
2026-10-02\t58

Output of the past seven days
The values for each day were measured from midnight to midnight (Paris time).

Date\tOutput
2026-10-01\t139.97
2026-10-02\t272.39

Resources consumed by the mine in the past seven days
The values for each day were measured from midnight to midnight (Paris time).

Date\tTons of stone\tOunces of iron
2026-10-02\t25\t19

Mine 2 : Iron mine - Node 228
Number of hours worked in the past 7 days
The values for each day were measured from midnight to midnight (Paris time).

Date\tHours\t
2026-10-01\t186

Output of the past seven days
The values for each day were measured from midnight to midnight (Paris time).

Date\tOutput
2026-10-01\t16

Resources consumed by the mine in the past seven days
The values for each day were measured from midnight to midnight (Paris time).

Date\tTons of stone\tOunces of iron
2026-09-30\t9\t7

Mine 5 : Clay mine - Node 320
Number of hours worked in the past 7 days
The values for each day were measured from midnight to midnight (Paris time).

Date\tHours\t
2026-10-01\t10
`

  const french = `Mine 1 : Mine d'or - Noeud 236
Niveau : 10
Rendement : 50,4 écus/22 heures
Créneaux horaires : 172/1100
Seuil de rupture : 24 qtx de pierre et 18 kg de fer

Entretien normal
(13 qtx de pierre et 10 kg de fer)
Entretien et amélioration
(62 qtx de pierre et 47 kg de fer)

Mine 3 : Carrière de pierre - Noeud 232
Niveau : 17
Rendement : 2,73 qtx de pierre/22 heures
Créneaux horaires : 50/1100
Seuil de rupture : 14 qtx de pierre et 10 kg de fer

Entretien normal
(14 qtx de pierre et 6 kg de fer)
Entretien et amélioration


Mine 1 : Mine d'or - Noeud 236
Nombre d'heures travaillées ces 7 derniers jours
Date\tHeures
2026-10-01\t53
2026-10-02\t58

Production des 7 derniers jours
Date\tRendement
2026-10-01\t139,97
2026-10-02\t272,39

Ressources consommées par la mine ces 7 derniers jours
Date\tQx de pierre\tKg de fer
2026-10-02\t25\t19

Mine 2 : Mine de fer - Noeud 228
Nombre d'heures travaillées ces 7 derniers jours
Date\tHeures
2026-10-01\t186

Production des 7 derniers jours
Date\tRendement
2026-10-01\t16

Ressources consommées par la mine ces 7 derniers jours
Date\tQx de pierre\tKg de fer
2026-09-30\t9\t7

Mine 5 : Mine d'argile - Noeud 320
Nombre d'heures travaillées ces 7 derniers jours
Date\tHeures
2026-10-01\t10
`

  // Le libellé reste celui du jeu, dans sa langue : seul ce qui est CALCULÉ doit coïncider.
  // eslint-disable-next-line no-unused-vars -- on retire le libellé, on ne s'en sert pas
  const withoutLabel = list => list.map(({ label, ...rest }) => rest)

  it('lit les trois tableaux, nœud et ressource compris, sans rien convertir', () => {
    const mines = parseMinesText(english)
    // La carrière (3) n'a que son bloc d'état ici : mine connue, sans relevé — comme en français.
    expect(mines.map(m => [m.number, m.noeud, m.resource])).toEqual([
      [1, '236', 'OR'], [2, '228', 'FER'], [3, '232', 'PIERRE'], [5, '320', 'ARGILE'],
    ])
    expect(mines[2].days).toEqual({})
    expect(mines[0].days).toEqual({
      '2026-10-01': { heures: 53, production: 139.97 },
      '2026-10-02': { heures: 58, production: 272.39, pierre: 25, fer: 19 },
    })
  })

  it('donne exactement le même relevé que son jumeau français', () => {
    expect(withoutLabel(parseMinesText(english))).toEqual(withoutLabel(parseMinesText(french)))
  })

  it("lit l'état des mines : seuil et entretien en tons/ounces, aux MÊMES nombres", () => {
    const states = parseMineStates(english)
    expect(states.map(s => [s.number, s.noeud, s.resource, s.niveau])).toEqual([
      [1, '236', 'OR', '10'], [3, '232', 'PIERRE', '17'],
    ])
    expect(thresholdAlert(states[0])).toBeNull()
    // Carrière : entretien 14 = seuil 14 → atteint, comme en français. Une conversion l'aurait masqué.
    expect(thresholdAlert(states[1])).toEqual(thresholdAlert(parseMineStates(french)[1]))
    expect(thresholdAlert(states[1])).toMatchObject({ level: 'reached', pierre: 14, seuilPierre: 14 })
  })

  it('le bloc « Maintenance and improvement » vide (niveau 17, plafond) reste vide', () => {
    expect(parseMineStates(english)[1].entretienAmelioration).toBeNull()
  })

  it('reconnaît les ressources sous leur nom anglais', () => {
    expect(['Gold mine', 'Iron mine', 'Stone quarry', 'Clay mine'].map(detectResource))
      .toEqual(['OR', 'FER', 'PIERRE', 'ARGILE'])
  })
})
