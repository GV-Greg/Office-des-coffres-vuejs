/* eslint-env node */
require('@rushstack/eslint-patch/modern-module-resolution')

module.exports = {
  root: true,
  'extends': [
    'plugin:vue/vue3-essential',
    'eslint:recommended',
    'plugin:import/recommended',
    '@vue/eslint-config-prettier/skip-formatting'
  ],
  plugins: [
    'import',
  ],
  parserOptions: {
    ecmaVersion: 'latest'
  },
  settings: {
    'import/resolver': {
      alias: {
        map: [
          ['@', './src'], // Définition de l'alias @
        ],
        extensions: ['.js', '.vue', '.json'],
      },
    },
  },
}
