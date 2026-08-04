// Les noms de royaumes viennent de la base (MapSeeder), dans leur langue d'origine
// (anglais/espagnol/italien, comme dans le jeu). Traductions FR alignées sur celles
// déjà utilisées côté dashboard admin (backend/lang/fr.json).
const FR_TRANSLATIONS = {
  'Kingdom of France': 'Royaume de France',
  'Holy Roman German Empire': 'Saint Empire Romain Germanique',
  'Kingdom of England': "Royaume d'Angleterre",
  'Kingdom of Scotland': "Royaume d'Écosse",
  'Corona de Aragón': "Couronne d'Aragon",
  'Corona de Castilla y León': 'Couronne de Castille et Léon',
  'Regno delle Due Sicilie': 'Royaume des Deux-Siciles',
  'Reino de Portugal': 'Royaume du Portugal',
  'Ireland': 'Irlande',
  'Serenissima Repubblica di Venezia': 'Sérénissime république de Venise',
  'Kalmar Union': 'Union de Kalmar (Danemark, Finlande, Suède)',
}

export function translateKingdomName(name, locale) {
  if (locale === 'fr' && FR_TRANSLATIONS[name]) {
    return FR_TRANSLATIONS[name]
  }
  return name
}
