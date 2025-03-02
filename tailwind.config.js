/** @type {import('tailwindcss').Config} */
import colors from "tailwindcss/colors"

export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
    './node_modules/@ipaat/vue3-tailwind3-cookie-comply/dist/vue3-tailwind3-cookie-comply.umd.js',
  ],
  darkMode: 'class',
  safelist: [
    {
      pattern: /text-(black|white|slate|gray|red|orange|yellow|lime|green|teal|cyan|sky|violet|fuchsia|rose)-(100|200|300|400|500|600|700|800|900)/,
    },
    {
      pattern: /bg-(black|white|slate|gray|red|orange|yellow|lime|green|teal|cyan|sky|violet|fuchsia|rose)-(100|200|300|400|500|600|700|800|900)/,
    },
    {
      pattern: /border-(black|white|slate|gray|red|orange|yellow|lime|green|teal|cyan|sky|violet|fuchsia|rose)-(100|200|300|400|500|600|700|800|900)/,
    },
    {
      pattern: /hover:(text|bg|border)-(black|white|slate|gray|red|orange|yellow|lime|green|teal|cyan|sky|violet|fuchsia|rose)-(100|200|300|400|500|600|700|800|900)/,
    },
    {
      pattern: /(ring|ring-offset|hover:ring|hover:ring-offset)-(black|white|slate|gray|red|orange|yellow|lime|green|teal|cyan|sky|violet|fuchsia|rose)-(100|200|300|400|500|600|700|800|900)/,
    },
    {
      pattern: /btn-(black|white|slate|gray|red|orange|yellow|lime|green|teal|cyan|sky|violet|fuchsia|rose)/,
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
      transparent: 'transparent',
      current: 'currentColor',
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
      blue: colors.sky,
      indigo: colors.violet,
      pink: colors.fuchsia,
      salmon: colors.rose,
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
