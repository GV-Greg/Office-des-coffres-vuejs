/*
  Couleurs du menu circulaire (variante X3 « équilibre » M1 + D2, choisie par Greg le 27/09/2026).
  Module à part pour que les garde-fous de contraste lisent les mêmes valeurs que le composant.

  PALETTE — par entrée de menu, trois dégradés du disque (clair → foncé) :
    rest (repos), hover (survol, un cran plus clair), current (page courante, plus sombre) ;
    icon : teinte `<couleur>-100` de l'icône.
  Converties en variables CSS par `paletteVars()` dans NavMenu.vue : aucune classe construite,
  donc aucun safelist (garde-fou tests/enforcement/tailwind-safelist.unit.test.js).
*/
export const PALETTE = {
  blue: {
    rest: ['#93c5fd', '#2563eb', '#1e3a8a'],
    hover: ['#bfdbfe', '#3b82f6', '#1e40af'],
    current: ['#60a5fa', '#1d4ed8', '#172554'],
    icon: '#dbeafe',
  },
  yellow: {
    rest: ['#fde68a', '#d97706', '#78350f'],
    hover: ['#fef3c7', '#f59e0b', '#92400e'],
    current: ['#fbbf24', '#b45309', '#451a03'],
    icon: '#fef9c3',
  },
  rose: {
    rest: ['#fda4af', '#e11d48', '#881337'],
    hover: ['#fecdd3', '#f43f5e', '#9f1239'],
    current: ['#fb7185', '#be123c', '#4c0519'],
    icon: '#ffe4e6',
  },
  teal: {
    rest: ['#99f6e4', '#0d9488', '#134e4a'],
    hover: ['#ccfbf1', '#14b8a6', '#115e59'],
    current: ['#5eead4', '#0f766e', '#042f2e'],
    icon: '#ccfbf1',
  },
  // Violet PROVISOIRE (Greg, 03/10/2026 : « on verra dans l'interface ») — « Ma province ».
  violet: {
    rest: ['#c4b5fd', '#7c3aed', '#4c1d95'],
    hover: ['#ddd6fe', '#8b5cf6', '#5b21b6'],
    current: ['#a78bfa', '#6d28d9', '#2e1065'],
    icon: '#ede9fe',
  },
  slate: {
    rest: ['#cbd5e1', '#475569', '#1e293b'],
    hover: ['#e2e8f0', '#64748b', '#334155'],
    current: ['#94a3b8', '#334155', '#0f172a'],
    icon: '#f1f5f9',
  },
}

/*
  Plaques du nom : dégradé du fond (arrêts, clair → foncé), bord et texte, par état.
  Le contraste se mesure contre l'arrêt le plus défavorable — c'est ce que lit
  tests/enforcement/navmenu-plate-contrast.unit.test.js. NavMenu.vue les reçoit en variables CSS
  (`plateVars`) : une seule source pour le rendu et pour le test.
  - rest : fond ardoise de M1 (préférence de Greg), bord ambre de D2.
  - current : plaque dorée CORRIGÉE — #d97706 en bas, jamais #b45309 (le texte y tombait à 3,82:1).
*/
export const PLATES = {
  rest: { stops: ['#4b5563', '#374151', '#1f2937'], border: '#d97706', text: '#fef3c7' },
  hover: { stops: ['#4b5563', '#374151', '#1f2937'], border: '#fbbf24', text: '#ffffff' },
  current: { stops: ['#fbbf24', '#d97706'], border: '#451a03', text: '#1c0a02' },
}
