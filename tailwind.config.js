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
  // `NavMenu.vue` (`:class="`text-${page.color}-100`"`, menu circulaire) avec les 5 couleurs
  // déclarées dans son tableau `pages`. Les classes `btn-*` du même composant n'ont pas besoin
  // d'y figurer : elles sont définies en dur dans `assets/style.css` (@apply), donc vues comme
  // du contenu source.
  // ⚠️ Ajouter une entrée de menu avec une nouvelle couleur impose d'ajouter cette couleur ici,
  // sinon l'icône sort sans sa teinte.
  safelist: [
    {
      pattern: /text-(blue|yellow|rose|teal|slate)-100/,
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
      }
    },
  },
  plugins: [],
}
