// Catégories d'inventaire — logique pure, sans dépendance Vue.
// Source des catégories par défaut : wiki RK + inventaire de référence (67 lignes,
// brief-inventaires-economie.md). Les niveaux (personnage, ville, province, structure)
// ont chacun leurs propres catégories : ce module fournit les VALEURS PAR DÉFAUT pour
// un niveau qui n'en a pas encore.
//
// Règle de priorité : si un item se mange → alimentation, même s'il sert aussi
// d'ingrédient (brief §Catégories). Les colorants → matières premières.

/** Clés canoniques des catégories, dans l'ordre d'affichage. */
export const CATEGORY_KEYS = [
  'alimentation',
  'matieres_premieres',
  'materiel_medical',
  'outils_equipement',
  'vetements_accessoires',
  'produits_luxe',
  'fleurs_plantes',
  'animaux',
  'divers',
]

/** Libellés français fixes (contenu forum, indépendant de la langue de l'UI). */
export const CATEGORY_LABELS_FR = {
  alimentation: 'Alimentation',
  matieres_premieres: 'Matières premières',
  materiel_medical: 'Matériel médical',
  outils_equipement: 'Outils & équipement',
  vetements_accessoires: 'Vêtements & accessoires',
  produits_luxe: 'Produits de luxe',
  fleurs_plantes: 'Fleurs & plantes',
  animaux: 'Animaux',
  divers: 'Divers',
}

/**
 * Correspondances nom exact → catégorie, établies sur l'inventaire de référence.
 * Inclut les noms tronqués (se terminant par `....`) pour suggestion immédiate
 * avant résolution. À enrichir au fil des retours d'utilisateurs.
 */
export const DEFAULT_ITEM_CATEGORIES = {
  // Alimentation
  'Bière au cumin': 'alimentation',
  'Bière au safran': 'alimentation',
  'Bouteilles de lait': 'alimentation',
  "Canne sucre d'orge": 'alimentation',
  'Cerise': 'alimentation',
  'Chausson aux pommes': 'alimentation',
  'Jambon de Forêt Noire': 'alimentation',
  'Miches de pain': 'alimentation',
  'Morceaux de viande': 'alimentation',
  'Oeuf en chocolat': 'alimentation',
  'Pâté en croûte au cumin': 'alimentation',
  'Poissons': 'alimentation',
  'Sacs de maïs': 'alimentation',
  'Saucisson sec aux noisettes': 'alimentation',
  'Truites': 'alimentation',

  // Matières premières
  'Aune de soie': 'matieres_premieres',
  'Baies de Sureau Noir': 'matieres_premieres',
  'Bouteille de lait de brebis': 'matieres_premieres',
  'Branches de Céleri': 'matieres_premieres',
  'Branches de Thym': 'matieres_premieres',
  "Brins d'Angélique": 'matieres_premieres',
  'Brins de Lavande': 'matieres_premieres',
  'Brins de Marjolaine': 'matieres_premieres',
  'Brins de Romarin': 'matieres_premieres',
  'Dose de colorant beige': 'matieres_premieres',
  'Dose de colorant cyan': 'matieres_premieres',
  'Dose de colorant gris': 'matieres_premieres',
  'Doses de colorant pourpre': 'matieres_premieres',
  'Doses de colorant rouge': 'matieres_premieres',
  'Feuilles de Menthe': 'matieres_premieres',
  'Feuilles de Tilleul': 'matieres_premieres',
  "Fleurs d'Anis": 'matieres_premieres',
  'Fleurs de Bourrache': 'matieres_premieres',
  'Fleurs de Camomille': 'matieres_premieres',
  'Fleurs de Partenelle': 'matieres_premieres',
  'Fleurs Pavot Blanc': 'matieres_premieres',
  'Graines de cumin': 'matieres_premieres',
  'Kilos de minerai de fer': 'matieres_premieres',
  "Morceaux d'écorce de Saule Blanc": 'matieres_premieres',
  "Pains d'argile": 'matieres_premieres',
  'Quintaux de pierre': 'matieres_premieres',
  'Sacs de blé': 'matieres_premieres',
  'Sacs de farine': 'matieres_premieres',
  'Stigmates de safran': 'matieres_premieres',
  'Stères de bois': 'matieres_premieres',
  'Éclats d\'ambre': 'matieres_premieres',

  // Matériel médical
  "Liqueurs d'Extrême-Onction": 'materiel_medical',
  'Liqueur Felix Felicis': 'materiel_medical',
  'Onguents à la purée de cerise': 'materiel_medical',
  'Onguents à la purée de châtaigne': 'materiel_medical',
  'Philtres Batoa': 'materiel_medical',
  'Potion "Lavande"': 'materiel_medical',

  // Outils & équipement
  'Charrettes': 'outils_equipement',
  'Jeu de cartes': 'outils_equipement',

  // Vêtements & accessoires
  'Coiffe fermière': 'vetements_accessoires',
  'Couronne de fleurs printanière': 'vetements_accessoires',

  // Produits de luxe
  'Anneau en argent': 'produits_luxe',
  'Anneau en or': 'produits_luxe',
  'Bague en argent': 'produits_luxe',
  'Bague en or': 'produits_luxe',
  'Bijou en argent': 'produits_luxe',
  'Bijou en or': 'produits_luxe',
  'Bougie de luxe': 'produits_luxe',
  'Bouteille de vin fin': 'produits_luxe',
  'Collier en argent': 'produits_luxe',
  'Collier en or': 'produits_luxe',
  'Fourrure de loup': 'produits_luxe',
  'Fourrure de renard': 'produits_luxe',
  'Fourrures de loup': 'produits_luxe',
  'Fourrures de renard': 'produits_luxe',
  'Gemme bleue': 'produits_luxe',
  'Gemme rouge': 'produits_luxe',
  'Gemme verte': 'produits_luxe',
  'Gemmes bleues': 'produits_luxe',
  'Gemmes rouges': 'produits_luxe',
  'Gemmes vertes': 'produits_luxe',
  'Parchemin orné': 'produits_luxe',
  'Pièces de monnaie commémoratives': 'produits_luxe',
  'Rubis': 'produits_luxe',
  'Saphir': 'produits_luxe',
  'Saphirs': 'produits_luxe',
  'Statuette': 'produits_luxe',
  'Statuettes': 'produits_luxe',

  // Fleurs & plantes
  'Bouquet de fleurs': 'fleurs_plantes',
  'Bouquet de roses': 'fleurs_plantes',
  'Bouquets de fleurs': 'fleurs_plantes',
  'Bouquets de roses': 'fleurs_plantes',
  'Iris': 'fleurs_plantes',
  'Jonquille': 'fleurs_plantes',
  'Jonquilles': 'fleurs_plantes',
  'Lavande en pot': 'fleurs_plantes',
  'Lys': 'fleurs_plantes',
  'Muguet': 'fleurs_plantes',
  'Narcisse': 'fleurs_plantes',
  'Narcisses': 'fleurs_plantes',
  'Plante en pot': 'fleurs_plantes',
  'Plantes en pot': 'fleurs_plantes',
  'Rose': 'fleurs_plantes',
  'Roses': 'fleurs_plantes',
  'Tournesol': 'fleurs_plantes',
  'Tournesols': 'fleurs_plantes',
  'Tulipe': 'fleurs_plantes',
  'Tulipes': 'fleurs_plantes',
  'Violette': 'fleurs_plantes',
  'Violettes': 'fleurs_plantes',

  // Animaux
  'Clarabelle': 'animaux',

  // Divers
  'Caillou coloré': 'divers',
  'Cailloux': 'divers',
  'Hiéroglyphes violets': 'divers',
  'Morceaux de verre': 'divers',
  'Paniers du Bateleur': 'divers',
}

// Correspondances par préfixe — familles d'items identifiables sans connaître
// le nom complet. Utilisées en dernier recours (après correspondance exacte),
// notamment pour les noms tronqués. Ordre du plus spécifique au plus général.
const PREFIX_CATEGORIES = [
  { prefix: 'Essences curatives', category: 'materiel_medical' },
  { prefix: 'Onguents', category: 'materiel_medical' },
  { prefix: 'Philtres', category: 'materiel_medical' },
  { prefix: 'Potion ', category: 'materiel_medical' },
  { prefix: 'Liqueur ', category: 'materiel_medical' },
  { prefix: 'Liqueurs ', category: 'materiel_medical' },
  { prefix: "Brins d'", category: 'matieres_premieres' },
  { prefix: 'Brins de ', category: 'matieres_premieres' },
  { prefix: 'Branches de ', category: 'matieres_premieres' },
  { prefix: "Fleurs d'", category: 'matieres_premieres' },
  { prefix: 'Fleurs de ', category: 'matieres_premieres' },
  { prefix: 'Feuilles de ', category: 'matieres_premieres' },
  { prefix: 'Dose de colorant ', category: 'matieres_premieres' },
  { prefix: 'Doses de colorant ', category: 'matieres_premieres' },
]

/**
 * Suggère une catégorie pour un item donné.
 * Cascade :
 *   1. customMappings  — définis par l'utilisateur pour ce niveau
 *   2. DEFAULT_ITEM_CATEGORIES — correspondance exacte
 *   3. PREFIX_CATEGORIES — correspondance par préfixe (noms tronqués, familles)
 * Renvoie null si aucune suggestion n'est possible.
 *
 * @param {string} itemName  Nom de l'item (peut être tronqué, se terminant par `....`)
 * @param {Object} customMappings  { 'Nom item': 'cle_categorie' }
 */
export function suggestCategory(itemName, customMappings = {}) {
  if (customMappings[itemName]) return customMappings[itemName]
  if (DEFAULT_ITEM_CATEGORIES[itemName]) return DEFAULT_ITEM_CATEGORIES[itemName]

  // Pour les noms tronqués : recherche sur le préfixe avant `....`
  const base = itemName.endsWith('....') ? itemName.slice(0, -4) : itemName
  for (const { prefix, category } of PREFIX_CATEGORIES) {
    if (base.startsWith(prefix)) return category
  }

  return null
}

/**
 * Applique l'ordre choisi par le joueur à une liste de clés de catégories (affichage ET export BBCode).
 * - les clés de `order` qui existent dans `keys` passent en premier, dans l'ordre du joueur ;
 * - les clés absentes de `order` (catégorie créée ou restaurée depuis) suivent, dans l'ordre d'origine ;
 * - les clés de `order` qui n'existent plus (catégorie supprimée ou masquée) sont ignorées.
 * Sans ordre, la liste est rendue telle quelle : l'ordre par défaut des catégories prédéfinies, puis les personnalisées.
 *
 * @param {string[]} keys   clés des catégories affichées, dans l'ordre par défaut
 * @param {string[]} [order] ordre choisi (`inventory_cat_config.order`)
 * @returns {string[]}
 */
export function orderCategoryKeys(keys, order = []) {
  const known = new Set(keys)
  const ordered = []
  for (const key of Array.isArray(order) ? order : []) {
    if (known.has(key) && !ordered.includes(key)) ordered.push(key)
  }
  for (const key of keys) {
    if (!ordered.includes(key)) ordered.push(key)
  }
  return ordered
}
