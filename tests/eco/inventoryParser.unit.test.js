// @vitest-environment node
// Logique pure — aucun DOM.
import { describe, it, expect } from 'vitest'
import { parseInventoryText, isTruncated, resolveItems } from '../../src/modules/inventoryParser'

// Copier-coller réel depuis le jeu (64 lignes d'items, 2 Essences curatives tronquées identiques).
const FIXTURE = `Encombrement : 29950

 #NomEnc.Actions possibles26865,51 écus
1Bière au cumin1
1Bière au safran1
100Bouteilles de lait500
1Canne sucre d'orge1
1Cerise1
1Chausson aux pommes1
2Essences curatives "Essence Franc-Comtoise pour le commerce....2
4Essences curatives "Essence Franc-Comtoise pour le commerce....4
1Jambon de Forêt Noire10
2Liqueurs d'Extrême-Onction10
1Liqueur Felix Felicis5
596Miches de pain2980
121Morceaux de viande605
1Oeuf en chocolat1
16Onguents à la purée de cerise16
14Onguents à la purée de châtaigne14
85Philtres Batoa85
16Poissons80
1Potion "Lavande"1
1Pâté en croûte au cumin5
1424Sacs de maïs4272
1Saucisson sec aux noisettes1
50Truites250
1Aune de soie2
13Baies de Sureau Noir13
1Bouteille de lait de brebis5
37Branches de Céleri37
15Branches de Thym15
19Brins d'Angélique19
125Brins de Lavande125
48Brins de Marjolaine48
17Brins de Romarin17
1Caillou coloré1
1Dose de colorant beige1
1Dose de colorant cyan1
1Dose de colorant gris1
68Doses de colorant pourpre68
800Doses de colorant rouge800
21Feuilles de Menthe21
38Feuilles de Tilleul38
107Fleurs d'Anis107
24Fleurs de Bourrache24
8Fleurs de Camomille8
45Fleurs de Partenelle45
25Fleurs Pavot Blanc25
2Graines de cumin2
3Hiéroglyphes violets0
1410Kilos de minerai de fer7050
8Morceaux d'écorce de Saule Blanc8
3Morceaux de verre9
1147Pains d'argile2294
992Quintaux de pierre7936
43Sacs de blé430
32Sacs de farine320
2Stigmates de safran2
280Stères de bois1400
4Éclats d'ambre4
5Cailloux50
4Charrettes160
1Jeu de cartes2
1Clarabelle3
1Coiffe fermière1
1Couronne de fleurs printanière10
2Paniers du Bateleur2`

describe('isTruncated', () => {
  it('détecte les noms tronqués (terminant par `....`)', () => {
    expect(isTruncated('Essences curatives "Essence Franc-Comtoise pour le commerce....')).toBe(true)
    expect(isTruncated('Miches de pain')).toBe(false)
    expect(isTruncated('')).toBe(false)
    expect(isTruncated(null)).toBe(false)
  })
})

describe('parseInventoryText', () => {
  it('extrait le total en écus depuis l\'en-tête', () => {
    const { totalEcus } = parseInventoryText(FIXTURE)
    expect(totalEcus).toBe(26865.51)
  })

  it('renvoie 64 items bruts (avant fusion)', () => {
    const { items } = parseInventoryText(FIXTURE)
    expect(items).toHaveLength(64)
  })

  it('parse correctement une ligne à grande quantité et grand encombrement', () => {
    const { items } = parseInventoryText(FIXTURE)
    const miches = items.find(i => i.name === 'Miches de pain')
    expect(miches).toMatchObject({ quantity: 596, name: 'Miches de pain', truncated: false })
  })

  it('parse correctement une ligne avec encombrement 0', () => {
    const { items } = parseInventoryText(FIXTURE)
    const hiero = items.find(i => i.name === 'Hiéroglyphes violets')
    expect(hiero).toMatchObject({ quantity: 3, name: 'Hiéroglyphes violets', truncated: false })
  })

  it('détecte les noms tronqués', () => {
    const { items } = parseInventoryText(FIXTURE)
    const truncated = items.filter(i => i.truncated)
    expect(truncated).toHaveLength(2)
    expect(truncated[0].quantity).toBe(2)
    expect(truncated[1].quantity).toBe(4)
    expect(truncated[0].name).toBe(truncated[1].name) // même nom tronqué
  })

  it('ne génère aucun item depuis les lignes d\'en-tête', () => {
    const { items } = parseInventoryText(FIXTURE)
    expect(items.every(i => /^\d/.test(String(i.quantity)))).toBe(true)
    expect(items.find(i => i.name.includes('Encombrement'))).toBeUndefined()
    expect(items.find(i => i.name.includes('écus'))).toBeUndefined()
  })

  it('renvoie { totalEcus: null, items: [] } sur texte vide', () => {
    expect(parseInventoryText('')).toEqual({ totalEcus: null, items: [] })
    expect(parseInventoryText(null)).toEqual({ totalEcus: null, items: [] })
  })

  it('parse l\'Éclats d\'ambre avec accent majuscule en début de nom', () => {
    const { items } = parseInventoryText(FIXTURE)
    const eclat = items.find(i => i.name === "Éclats d'ambre")
    expect(eclat).toMatchObject({ quantity: 4, truncated: false })
  })
})

describe('resolveItems', () => {
  it('fusionne les deux Essences curatives tronquées identiques → 1 item qty=6', () => {
    const { items } = parseInventoryText(FIXTURE)
    const resolved = resolveItems(items)
    const essences = resolved.filter(i => i.name.startsWith('Essences curatives'))
    expect(essences).toHaveLength(1)
    expect(essences[0].quantity).toBe(6)
    expect(essences[0].truncated).toBe(true)
  })

  it('donne 63 items après fusion (64 lignes − 1 doublon tronqué)', () => {
    const { items } = parseInventoryText(FIXTURE)
    expect(resolveItems(items)).toHaveLength(63)
  })

  it('applique la table de référence pour résoudre un nom tronqué', () => {
    const items = [
      { quantity: 2, name: 'Essences curatives "Essence Franc-Comtoise pour le commerce....', truncated: true },
      { quantity: 4, name: 'Essences curatives "Essence Franc-Comtoise pour le commerce....', truncated: true },
    ]
    const table = {
      'Essences curatives "Essence Franc-Comtoise pour le commerce....':
        'Essences curatives "Essence Franc-Comtoise pour le commerce de nourriture"',
    }
    const resolved = resolveItems(items, table)
    expect(resolved).toHaveLength(1)
    expect(resolved[0].name).toBe('Essences curatives "Essence Franc-Comtoise pour le commerce de nourriture"')
    expect(resolved[0].quantity).toBe(6)
    expect(resolved[0].truncated).toBe(false)
  })

  it('conserve truncated=true si le nom n\'est pas dans la table', () => {
    const items = [{ quantity: 1, name: 'Item tronqué....', truncated: true }]
    const resolved = resolveItems(items, {})
    expect(resolved[0].truncated).toBe(true)
  })

  it('ne modifie pas les items non tronqués', () => {
    const items = [
      { quantity: 596, name: 'Miches de pain', truncated: false },
      { quantity: 121, name: 'Morceaux de viande', truncated: false },
    ]
    const resolved = resolveItems(items)
    expect(resolved).toHaveLength(2)
    expect(resolved[0]).toEqual(items[0])
    expect(resolved[1]).toEqual(items[1])
  })
})
