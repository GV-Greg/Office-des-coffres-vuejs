import { describe, it, expect } from 'vitest'
import { parseLotList } from '../../src/modules/rewardsLotList.js'

// La liste de lots collée : séparateurs (ligne, virgule, tabulation), nombre collé au nom (espace insérée), nombre seul + tabulation (recollé).
// Un nombre au début d'un nom n'est JAMAIS une quantité : « 4 andouillettes » est un lot.

describe('parseLotList — séparateurs', () => {
  it('une ligne, une virgule ou une tabulation séparent les lots', () => {
    expect(parseLotList('Pain, Épée\nBouclier\tCasque')).toEqual(['Pain', 'Épée', 'Bouclier', 'Casque'])
  })

  it('ignore les lignes vides, les espaces autour et les fins de ligne Windows', () => {
    expect(parseLotList('  Pain  \r\n\r\n,, Épée ,\r\n')).toEqual(['Pain', 'Épée'])
  })

  it('un texte vide ou absent ne donne aucun lot', () => {
    expect(parseLotList('')).toEqual([])
    expect(parseLotList(null)).toEqual([])
    expect(parseLotList('  \n , \t ')).toEqual([])
  })
})

describe('parseLotList — un nombre au début du nom', () => {
  it('collé au nom (copie de l\'inventaire) : une espace est insérée, le lot reste UN lot', () => {
    expect(parseLotList('4Andouillettes gratinées au chèvre\n170Miches de pain\n1Élixir du Forçat'))
      .toEqual(['4 Andouillettes gratinées au chèvre', '170 Miches de pain', '1 Élixir du Forçat'])
  })

  it('« 4 andouillettes » n\'est pas une quantité : un seul lot, jamais quatre', () => {
    expect(parseLotList('4 andouillettes')).toEqual(['4 andouillettes'])
    expect(parseLotList('50 écus')).toEqual(['50 écus'])
  })

  it('un nombre seul suivi d\'une tabulation est recollé au nom, sans compter pour un lot de plus', () => {
    expect(parseLotList('4\tAndouillettes\n12\tMiches de pain')).toEqual(['4 Andouillettes', '12 Miches de pain'])
    expect(parseLotList('4\tPain\t5\tÉpée')).toEqual(['4 Pain', '5 Épée'])
  })

  it('un nombre sans tabulation ni nom derrière reste un lot (rien à recoller)', () => {
    expect(parseLotList('Pain\t7')).toEqual(['Pain', '7'])
    expect(parseLotList('7')).toEqual(['7'])
  })

  it('la valeur de l\'inventaire collée à la FIN du nom est retirée (lignes au format de l\'inventaire)', () => {
    expect(parseLotList("6Planches de bois d'ébène12\n1Sac de blé10\n3Sacs de farine30\n34Stères de bois170\n11Supports en bois"))
      .toEqual(["6 Planches de bois d'ébène", '1 Sac de blé', '3 Sacs de farine', '34 Stères de bois', '11 Supports en bois'])
  })

  it('une colonne de valeur seule, en dernier après une tabulation, n\'est pas un lot', () => {
    expect(parseLotList('4\tAndouillettes\t12\n5\tMiches de pain\t3')).toEqual(['4 Andouillettes', '5 Miches de pain'])
    // suivie d'un nom, c'est le début du lot suivant
    expect(parseLotList('4\tPain\t5\tÉpée')).toEqual(['4 Pain', '5 Épée'])
  })

  it('une liste écrite à la main n\'est JAMAIS touchée en fin de nom : « R2D2 », « Potion 50 », « Pierre12 »', () => {
    expect(parseLotList('R2D2\nPotion 50\nPierre12\n50 écus')).toEqual(['R2D2', 'Potion 50', 'Pierre12', '50 écus'])
  })

  it('une liste écrite à la main, sans nombre, est inchangée', () => {
    expect(parseLotList('Épée en fer\nPain\nBouclier en bois')).toEqual(['Épée en fer', 'Pain', 'Bouclier en bois'])
  })

  it('les lettres accentuées comptent comme des lettres (le nombre collé à « Élixir »)', () => {
    expect(parseLotList('2Élixirs\n3Œufs')).toEqual(['2 Élixirs', '3 Œufs'])
  })
})
