// Sections de la page « Vos données, outil par outil » (/legal/data) — SOURCE UNIQUE de la liste
// des outils : le sommaire et les ancres de la page, et les liens « une ligne par outil » de la
// politique de confidentialité (§3), lisent tous cette liste. Un outil ajouté ici apparaît partout à la fois.
//
// `id` = ancre de la section (#bilan-des-mines…), stable : un lien donné à un joueur doit survivre.
// `key` = clé i18n sous Legal.Data. `upcoming: true` = outil pas encore ouvert, marqué « à venir »
// (le Registre des mines l'a porté jusqu'à son ouverture, le 08/10/2026).
// `access` = niveau d'accès, badge affiché au titre de chaque section — pas au sommaire (choix de
// Greg, 06/10/2026). Déclaré UNE fois ici (fil pages-donnees-joueur, 07-badges).
//   'none' = sans compte · 'account' = compte requis · 'office' = poste validé requis
export const ACCESS_LEVELS = ['none', 'account', 'office']

// Couleurs des badges : le sens est porté par le TEXTE, la couleur n'est qu'un repère. Classes
// écrites en entier (Tailwind ne voit pas une classe construite). Texte ≥ 4,5:1 sur le fond du
// badge, dans les deux thèmes : garde-fou `tests/legal/badgeContrast.unit.test.js`.
export const BADGE_CLASSES = {
  none: 'bg-green-100 text-green-900 border-green-300 dark:bg-green-950 dark:text-green-100 dark:border-green-700',
  account: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-100 dark:border-blue-700',
  office: 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950 dark:text-orange-100 dark:border-orange-700',
}

export const DATA_PAGE_SECTIONS = [
  { id: 'compte', key: 'Account', access: 'account' },
  { id: 'postes', key: 'Offices', access: 'account' },
  { id: 'bilan-des-mines', key: 'MinesReport', access: 'none' },
  { id: 'registre-des-mines', key: 'MineRegistry', access: 'office' },
  // Le Livre des naissances calcule sans rien conserver ; son historique (naissances et prix du grain d'une province) exige un poste.
  { id: 'livre-des-naissances', key: 'BirthRegister', access: 'none' },
  { id: 'historique-des-naissances', key: 'BirthHistory', access: 'office' },
  // Gestion des stocks (les inventaires) : sans compte tout reste dans le navigateur ; avec un compte, en base ; la ville et la province
  // exigent un poste, mais l'outil lui-même s'ouvre à tous — le badge dit l'accès à l'outil (fil inventaire-scopes, 11/11/2026).
  { id: 'gestion-des-stocks', key: 'Inventory', access: 'none' },
  // La Balance des stocks compare deux inventaires collés ; elle ne conserve rien (fil inventaire-comparaison, 19/11/2026).
  { id: 'balance-des-stocks', key: 'InventoryBalance', access: 'none' },
  // Le Registre des stocks : l'historique d'inventaires d'une ville (maire) ou d'une province (commissaire au commerce, dirigeant) ; un poste
  // validé est requis (fil registre-stocks, texte de Cowork du 20/11/2026).
  { id: 'registre-des-stocks', key: 'InventoryRegistry', access: 'office' },
  { id: 'guet', key: 'Watch', access: 'none' },
  // La Salle des gardes (module Sécurité) : listes rouge/verte et bilans de défense d'une province, saisis par le trio, les douaniers
  // validés et le maire (fil module-securite, v2 validée par Greg le 22/11/2026). Ouverte avec la PR 3-1 (écran du Registre de douane) : le texte
  // a précédé l'écriture (règle R5), le badge « à venir » est retiré. Un poste ou le statut de douanier validé est requis.
  { id: 'salle-des-gardes', key: 'Security', access: 'office' },
  { id: 'carte', key: 'Map', access: 'none' },
  // Une seule entrée pour toutes les activités d'Animation (Décode le code, Grille des lots) : une activité de plus
  // s'ajoute dans le texte de la section, pas ici (fil animation-textes-legaux, 11/11/2026).
  { id: 'animation', key: 'Animation', access: 'none' },
]
