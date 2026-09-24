/** @type {import('tailwindcss').Config} */
import colors from "tailwindcss/colors"

export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  // Safelist réduit au strict nécessaire : Tailwind détecte seul toute classe écrite
  // littéralement dans les fichiers de `content`. Seules les classes **construites
  // dynamiquement** lui échappent, et il n'y en a qu'une source dans tout le projet :
  // `NavMenu.vue` (menu circulaire), qui compose `btn-${page.color}` et
  // `text-${page.color}-100` à partir des 5 couleurs de son tableau `pages`.
  // ⚠️ Les deux patterns sont nécessaires, pour deux raisons différentes :
  //   - `text-<couleur>-100` : utilitaire Tailwind, jamais écrit en toutes lettres.
  //   - `btn-<couleur>` : classe composant définie dans `assets/style.css` (@apply). Être
  //     définie dans le CSS source ne suffit PAS à la préserver — une règle d'un `@layer
  //     components` est purgée si la classe n'est détectée nulle part dans `content`. Les
  //     retirer d'ici fait disparaître les couleurs du menu circulaire (constaté en prod-build,
  //     les 5 pastilles ressortent uniformément bleues). Le warning « doesn't match any Tailwind
  //     CSS classes » que Tailwind émet sur ce pattern est trompeur : il parle de la génération
  //     d'utilitaires, pas de la préservation des classes composant.
  // ⚠️ Ajouter une entrée de menu d'une nouvelle couleur impose d'ajouter cette couleur ici.
  safelist: [
    {
      pattern: /text-(blue|yellow|rose|teal|slate)-100/,
    },
    {
      pattern: /btn-(blue|yellow|rose|teal|slate)/,
    },
  ],
  theme: {
    screens: {
      'tablet': '640px',
      // => @media (min-width: 640px) { ... }
      'laptop': '1024px',
      // => @media (min-width: 1024px) { ... }
      'desktop': '1280px',
      // => @media (min-width: 1280px) { ... }
    },
    container: {
      center: true,
    },
    colors: {
      transparent: "transparent",
      current: "currentColor",
      black: colors.black,
      white: colors.white,
      slate: colors.slate,
      gray: colors.gray,
      red: colors.red,
      orange: colors.orange,
      yellow: colors.yellow,
      lime: colors.lime,
      green: colors.green,
      teal: colors.teal,
      cyan: colors.cyan,
      blue: colors.blue,
      indigo: colors.indigo,
      violet: colors.violet,
      fuchsia: colors.fuchsia,
      rose: colors.rose,
    },
    fontSize: {
      'xs': '.75rem',
      'sm': '.875rem',
      'base': '1rem',
      'lg': '1.125rem',
      'xl': '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
      '5xl': '3rem',
      '6xl': '3.75rem',
      '7xl': '4.5rem',
      '8xl': '6rem',
      '9xl': '8rem',
      '10xl': '10rem',
    },
    rotate: {
      '-180': '-180deg',
      '-90': '-90deg',
      '-45': '-45deg',
      '0': '0',
      '45': '45deg',
      '90': '90deg',
      '135': '135deg',
      '180': '180deg',
      '225': '225deg',
      '270': '270deg',
    },
    extend: {
      gridTemplateColumns: {
        // Simple 15 column grid
        '15': 'repeat(15, minmax(0, 1fr))',
      },
      gridTemplateRows: {
        // Simple 15 row grid
        '15': 'repeat(15, minmax(0, 1fr))',
      },
      // Rebond FINI pour l'invite « cliquez » de l'accueil. L'`animate-bounce` natif boucle à
      // l'infini : un mouvement automatique de PLUS de 5 s sans moyen de l'arrêter est un écart
      // WCAG 2.2.2 (niveau A). DEUX NOMBRES, pas un :
      //   - BUDGET DE CONCEPTION : 3 s (ici 3 × 1 s) — ce que le test fait respecter ; attirer
      //     l'œil sur « cliquez » n'en demande pas plus ;
      //   - PLAFOND RÉGLEMENTAIRE : 5 s — ce qu'on n'approche JAMAIS.
      // L'écart entre les deux EST la marge : un cycle allongé, un délai, un arrondi de
      // navigateur ne doivent pas suffire à basculer dans un écart de niveau A.
      // `forwards` : la flèche s'arrête EN HAUT du mouvement (demande de Greg, 25/09/2026).
      // À n'employer que derrière `motion-safe:`.
      animation: {
        'bounce-hint': 'bounce 1s 3 forwards',
      },
    },
  },
  plugins: [],
}
