import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'
import { includeIgnoreFile } from '@eslint/compat'
import globals from 'globals'
import { fileURLToPath } from 'node:url'

const gitignorePath = fileURLToPath(new URL('.gitignore', import.meta.url))

export default [
  includeIgnoreFile(gitignorePath),

  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  skipFormatting,

  {
    languageOptions: {
      globals: { ...globals.browser },
    },
  },

  // Fichiers exécutés par Node, pas par le navigateur : `module`, `process`
  // et consorts y sont légitimes.
  {
    files: ['*.cjs', '*.config.js', 'vitest.config.js', 'vite.config.js', 'scripts/**/*.mjs'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Les tests tournent sous Vitest, qui fournit ses propres globales.
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: { ...globals.node, global: 'readonly' },
    },
  },

  // Nom imposé par la route 404 : la règle « nom de composant en plusieurs
  // mots » n'a pas de sens ici.
  {
    files: ['src/views/404.vue'],
    rules: { 'vue/multi-word-component-names': 'off' },
  },
]
