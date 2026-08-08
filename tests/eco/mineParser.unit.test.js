// @vitest-environment node
// Logique pure, aucun DOM à monter — voir README, section Tests.
import { describe, it, expect } from 'vitest'
import {
  detectResource, parseMinesText, mergeMinesData, computeBilan,
  mostRecentDate, filterToDate, getWeekBounds, checkWeekCompleteness,
  parseMineStates, formatDateFr,
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

describe('checkWeekCompleteness', () => {
  it('détecte une semaine complète', () => {
    const mines = [{
      number: 1, label: "Mine d'or", resource: 'OR',
      days: Object.fromEntries(['03', '04', '05', '06', '07', '08', '09'].map(d => [`2026-08-${d}`, { production: 1 }])),
    }]
    const check = checkWeekCompleteness(mines)
    expect(check.complete).toBe(true)
    expect(check.missingDates).toEqual([])
  })

  it('signale les jours manquants sans bloquer', () => {
    const mines = [{ number: 1, label: "Mine d'or", resource: 'OR', days: { '2026-08-04': { production: 1 } } }]
    const check = checkWeekCompleteness(mines)
    expect(check.complete).toBe(false)
    expect(check.missingDates).toHaveLength(6)
    expect(check.monday).toBe('2026-08-03')
  })
})

describe('computeBilan', () => {
  const prices = { PIERRE: 14.5, FER: 19.5, ARGILE: 4.5, SEL: 3 }

  it('calcule la valeur de production directement pour la mine d\'or (pas de prix appliqué)', () => {
    const mines = [{ number: 1, label: "Mine d'or", resource: 'OR', days: { '2026-08-01': { production: 597.47 } } }]
    const bilan = computeBilan(mines, prices, 0)
    expect(bilan.lines[0].valeurProduction).toBeCloseTo(597.47)
  })

  it('applique le prix unitaire pour les autres ressources', () => {
    const mines = [{ number: 2, label: 'Mine de fer', resource: 'FER', days: { '2026-08-01': { production: 10 } } }]
    const bilan = computeBilan(mines, prices, 0)
    expect(bilan.lines[0].valeurProduction).toBeCloseTo(195) // 10 * 19.5
  })

  it("calcule la valeur d'entretien à partir des ressources réellement consommées", () => {
    const mines = [{ number: 2, label: 'Mine de fer', resource: 'FER', days: { '2026-08-01': { pierre: 5, fer: 4 } } }]
    const bilan = computeBilan(mines, prices, 0)
    expect(bilan.lines[0].valeurEntretien).toBeCloseTo(5 * 14.5 + 4 * 19.5)
  })

  it('déduit le salaire saisi manuellement du total net', () => {
    const mines = [{ number: 1, label: "Mine d'or", resource: 'OR', days: { '2026-08-01': { production: 1000 } } }]
    const bilan = computeBilan(mines, prices, 200)
    expect(bilan.net).toBeCloseTo(800)
  })

  it('additionne plusieurs mines dans les totaux', () => {
    const mines = [
      { number: 1, label: "Mine d'or", resource: 'OR', days: { '2026-08-01': { production: 500 } } },
      { number: 2, label: 'Mine de fer', resource: 'FER', days: { '2026-08-01': { production: 10 } } },
    ]
    const bilan = computeBilan(mines, prices, 0)
    expect(bilan.totals.valeurProduction).toBeCloseTo(500 + 195)
  })
})
