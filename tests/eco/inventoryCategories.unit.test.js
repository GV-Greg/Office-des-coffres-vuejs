// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { suggestCategory, orderCategoryKeys, DEFAULT_ITEM_CATEGORIES, CATEGORY_KEYS, CATEGORY_LABELS_FR } from '../../src/modules/inventoryCategories'
import { exportInventoryToBBCode } from '../../src/modules/inventoryBBcode'

describe('CATEGORY_KEYS', () => {
  it('contient les 9 catégories canoniques sans non_classe', () => {
    expect(CATEGORY_KEYS).toHaveLength(9)
    expect(CATEGORY_KEYS).not.toContain('non_classe')
    expect(CATEGORY_KEYS).toContain('fleurs_plantes')
  })
})

describe('suggestCategory — correspondance exacte', () => {
  it('classe les aliments en alimentation', () => {
    expect(suggestCategory('Miches de pain')).toBe('alimentation')
    expect(suggestCategory('Sacs de maïs')).toBe('alimentation')
    expect(suggestCategory('Bouteilles de lait')).toBe('alimentation')
  })

  it('distingue Bouteilles de lait (aliment) de Bouteille de lait de brebis (matière première)', () => {
    expect(suggestCategory('Bouteilles de lait')).toBe('alimentation')
    expect(suggestCategory('Bouteille de lait de brebis')).toBe('matieres_premieres')
  })

  it('classe les colorants en matières premières', () => {
    expect(suggestCategory('Dose de colorant beige')).toBe('matieres_premieres')
    expect(suggestCategory('Doses de colorant rouge')).toBe('matieres_premieres')
  })

  it('classe les soins en matériel médical', () => {
    expect(suggestCategory('Philtres Batoa')).toBe('materiel_medical')
    expect(suggestCategory('Onguents à la purée de cerise')).toBe('materiel_medical')
    expect(suggestCategory('Potion "Lavande"')).toBe('materiel_medical')
  })

  it('classe Clarabelle en animaux', () => {
    expect(suggestCategory('Clarabelle')).toBe('animaux')
  })

  it('classe les items divers', () => {
    expect(suggestCategory('Hiéroglyphes violets')).toBe('divers')
    expect(suggestCategory('Paniers du Bateleur')).toBe('divers')
  })

  it('renvoie null pour un item inconnu', () => {
    expect(suggestCategory('Objet fantaisiste')).toBeNull()
  })
})

describe('suggestCategory — noms tronqués (préfixe)', () => {
  it('classe les Essences curatives tronquées en matériel médical', () => {
    const truncated = 'Essences curatives "Essence Franc-Comtoise pour le commerce....'
    expect(suggestCategory(truncated)).toBe('materiel_medical')
  })

  it('classe un Philtre tronqué en matériel médical', () => {
    expect(suggestCategory('Philtres de guérison....')).toBe('materiel_medical')
  })

  it('classe une Potion tronquée en matériel médical', () => {
    expect(suggestCategory('Potion mystérieuse....')).toBe('materiel_medical')
  })

  it('classe un Brins tronqué en matières premières', () => {
    expect(suggestCategory("Brins d'une plante inconnue....")).toBe('matieres_premieres')
  })
})

describe('suggestCategory — customMappings prioritaires', () => {
  it('custom mappings l\'emportent sur les defaults', () => {
    const custom = { 'Miches de pain': 'divers' }
    expect(suggestCategory('Miches de pain', custom)).toBe('divers')
  })

  it('custom mappings ne perturbent pas les autres items', () => {
    const custom = { 'Miches de pain': 'divers' }
    expect(suggestCategory('Truites', custom)).toBe('alimentation')
  })
})

describe('DEFAULT_ITEM_CATEGORIES — cohérence de la fixture de référence', () => {
  const alimentation = [
    'Bière au cumin', 'Bière au safran', 'Bouteilles de lait', "Canne sucre d'orge",
    'Cerise', 'Chausson aux pommes', 'Jambon de Forêt Noire', 'Miches de pain',
    'Morceaux de viande', 'Oeuf en chocolat', 'Pâté en croûte au cumin', 'Poissons',
    'Sacs de maïs', 'Saucisson sec aux noisettes', 'Truites',
  ]
  const medical = [
    "Liqueurs d'Extrême-Onction", 'Liqueur Felix Felicis',
    'Onguents à la purée de cerise', 'Onguents à la purée de châtaigne',
    'Philtres Batoa', 'Potion "Lavande"',
  ]

  it('couvre les 15 items alimentation de la fixture', () => {
    for (const item of alimentation) {
      expect(DEFAULT_ITEM_CATEGORIES[item], item).toBe('alimentation')
    }
  })

  it('couvre les 6 items médicaux non-tronqués de la fixture', () => {
    for (const item of medical) {
      expect(DEFAULT_ITEM_CATEGORIES[item], item).toBe('materiel_medical')
    }
  })

  it('ne classe pas Cailloux en alimentation', () => {
    expect(DEFAULT_ITEM_CATEGORIES['Cailloux']).toBe('divers')
  })
})

describe('exportInventoryToBBCode', () => {
  const items = [
    { quantity: 596, name: 'Miches de pain' },
    { quantity: 1410, name: 'Kilos de minerai de fer' },
    { quantity: 3, name: 'Hiéroglyphes violets' },
    { quantity: 85, name: 'Philtres Batoa' },
    { quantity: 1, name: 'Objet inconnu' },
  ]
  const getCat = name => suggestCategory(name)
  const getCategoryLabel = key => CATEGORY_LABELS_FR[key] ?? key
  const bbcode = exportInventoryToBBCode(items, getCat, {
    categoryKeys: CATEGORY_KEYS,
    getCategoryLabel,
  })

  it('crée une section par catégorie non vide (format v2)', () => {
    expect(bbcode).toContain('[color=darkcyan][size=18][b]Alimentation[/b][/size][/color]')
    expect(bbcode).toContain('[color=darkcyan][size=18][b]Matières premières[/b][/size][/color]')
    expect(bbcode).toContain('[color=darkcyan][size=18][b]Matériel médical[/b][/size][/color]')
    expect(bbcode).toContain('[color=darkcyan][size=18][b]Divers[/b][/size][/color]')
  })

  it('ne crée pas de section vide (Animaux absent ici)', () => {
    expect(bbcode).not.toContain('Animaux')
  })

  it('formate chaque item avec [list][*][b] (suffix par défaut)', () => {
    expect(bbcode).toContain('[list]')
    expect(bbcode).toContain('[*][b]Miches de pain (x596)[/b]')
    expect(bbcode).toContain('[*][b]Kilos de minerai de fer (x1410)[/b]')
    expect(bbcode).toContain('[*][b]Philtres Batoa (x85)[/b]')
  })

  it('place les items sans catégorie dans Divers', () => {
    expect(bbcode).toContain('Objet inconnu')
    const diversIndex = bbcode.indexOf('[color=darkcyan][size=18][b]Divers[/b][/size][/color]')
    const obiIndex = bbcode.indexOf('Objet inconnu')
    expect(obiIndex).toBeGreaterThan(diversIndex)
  })

  it('respecte l\'ordre canonique des catégories', () => {
    const aliIdx = bbcode.indexOf('[color=darkcyan][size=18][b]Alimentation[/b][/size][/color]')
    const matIdx = bbcode.indexOf('[color=darkcyan][size=18][b]Matières premières[/b][/size][/color]')
    const medIdx = bbcode.indexOf('[color=darkcyan][size=18][b]Matériel médical[/b][/size][/color]')
    expect(aliIdx).toBeLessThan(matIdx)
    expect(matIdx).toBeLessThan(medIdx)
  })
})

describe('orderCategoryKeys — ordre choisi par le joueur', () => {
  const keys = ['alimentation', 'matieres_premieres', 'divers', 'perso']

  it('sans ordre, rend les clés telles quelles (ordre par défaut)', () => {
    expect(orderCategoryKeys(keys)).toEqual(keys)
    expect(orderCategoryKeys(keys, [])).toEqual(keys)
    expect(orderCategoryKeys(keys, undefined)).toEqual(keys)
  })

  it("applique l'ordre du joueur", () => {
    expect(orderCategoryKeys(keys, ['perso', 'divers', 'matieres_premieres', 'alimentation']))
      .toEqual(['perso', 'divers', 'matieres_premieres', 'alimentation'])
  })

  it("place d'abord les clés ordonnées, puis les nouvelles dans l'ordre d'origine", () => {
    // « divers » et « perso » ont été créées ou restaurées depuis : elles suivent.
    expect(orderCategoryKeys(keys, ['matieres_premieres', 'alimentation']))
      .toEqual(['matieres_premieres', 'alimentation', 'divers', 'perso'])
  })

  it("ignore les clés d'ordre qui n'existent plus (catégorie supprimée ou masquée) et les doublons", () => {
    expect(orderCategoryKeys(keys, ['supprimee', 'divers', 'divers', 'alimentation']))
      .toEqual(['divers', 'alimentation', 'matieres_premieres', 'perso'])
  })

  it("ne modifie ni la liste d'origine ni l'ordre reçu, et tolère un ordre invalide", () => {
    const order = ['divers']
    const copy = [...keys]
    orderCategoryKeys(keys, order)
    expect(keys).toEqual(copy)
    expect(order).toEqual(['divers'])
    expect(orderCategoryKeys(keys, 'pas-un-tableau')).toEqual(keys)
  })

  it("l'export BBCode suit cet ordre", () => {
    const items = [{ quantity: 2, name: 'Miches de pain' }, { quantity: 1, name: 'Cailloux' }]
    const cat = name => (name === 'Cailloux' ? 'divers' : 'alimentation')
    const label = key => ({ alimentation: 'Alimentation', divers: 'Divers' })[key]
    const asked = orderCategoryKeys(['alimentation', 'divers'], ['divers', 'alimentation'])
    const out = exportInventoryToBBCode(items, cat, { categoryKeys: asked, getCategoryLabel: label })
    expect(out.indexOf('Divers')).toBeLessThan(out.indexOf('Alimentation'))
  })
})
