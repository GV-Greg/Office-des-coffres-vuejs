/* eslint-env node */
require('@rushstack/eslint-patch/modern-module-resolution')

module.exports = {
  root: true,
  // `plugin:import/recommended` a été retiré : ses règles ont besoin de résoudre
  // chaque import, et le resolver d'alias disponible pour ESLint 8 utilise la
  // résolution CommonJS. Il plante sur tout paquet purement ESM déclarant un champ
  // `exports` sans `main` (notivue, entre autres) — ERR_PACKAGE_PATH_NOT_EXPORTED,
  // ESLint s'arrête net. La résolution des imports est de toute façon déjà vérifiée
  // par Vite au build. À reconsidérer lors du passage à ESLint 9 + flat config, où
  // un resolver compatible `exports` existe.
  'extends': [
    'plugin:vue/vue3-essential',
    'eslint:recommended',
    '@vue/eslint-config-prettier/skip-formatting'
  ],
  parserOptions: {
    ecmaVersion: 'latest'
  },
  overrides: [
    {
      // Fichiers de config exécutés par Node, pas par le navigateur : `module`,
      // `process` et consorts y sont légitimes.
      files: ['*.cjs', '*.config.js', 'vitest.config.js', 'vite.config.js'],
      env: { node: true },
    },
    {
      // Les tests tournent sous Vitest, qui fournit ses propres globales.
      files: ['tests/**/*.js'],
      env: { node: true },
      globals: { global: 'readonly' },
    },
    {
      // Nom imposé par la route 404 : la règle « nom de composant en plusieurs
      // mots » n'a pas de sens ici.
      files: ['src/views/404.vue'],
      rules: { 'vue/multi-word-component-names': 'off' },
    },
  ],
}
