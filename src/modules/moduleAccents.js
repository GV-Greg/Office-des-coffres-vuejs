/*
  Couleur de chaque module pour les illustrations de chargement (coffre, porte) : teinte claire (--c1 des boutons
  odc-*), lueur (même teinte en RGB) et face (--b1, le plancher de contraste). Mêmes couleurs que le menu circulaire
  (charte §3.3) : Économie or, Sécurité rose, Animation sarcelle, Ma province violet, Accueil bleu. `office` = neutre.
*/
export const MODULE_ACCENTS = {
  office: { tint: '#fde68a', rgb: '253, 230, 138', face: '#fbbf24' },
  gold: { tint: '#fde68a', rgb: '253, 230, 138', face: '#a16207' },
  rose: { tint: '#fda4af', rgb: '253, 164, 175', face: '#e11d48' },
  teal: { tint: '#99f6e4', rgb: '153, 246, 228', face: '#0f766e' },
  violet: { tint: '#c4b5fd', rgb: '196, 181, 253', face: '#7c3aed' },
  blue: { tint: '#93c5fd', rgb: '147, 197, 253', face: '#2563eb' },
  orange: { tint: '#fdba74', rgb: '253, 186, 116', face: '#c2410c' },
}
export const accentOf = (name) => MODULE_ACCENTS[name] ?? MODULE_ACCENTS.office
