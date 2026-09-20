import { createI18n } from 'vue-i18n'

/*
  Instance i18n unique de l'application.

  Elle était auparavant dédoublée : `main.js` en créait une pour les composants, et ce
  fichier une seconde pour les consommateurs hors contexte composant (`Validators.js`,
  `authStore.js`, qui ne peuvent pas appeler `useI18n()`). Personne ne changeant jamais la
  locale de la seconde, tout ce qu'elle produisait — messages d'erreur de formulaire, toasts
  d'authentification — restait en français même après un passage en anglais. Une seule
  instance supprime la classe de bug entière.

  Les messages ne sont plus embarqués au démarrage : `fr.json` et `en.json` partaient tous
  deux dans le bundle d'entrée alors qu'un visiteur n'en lit qu'un. Ils sont désormais
  chargés à la demande, en chunks séparés.
*/

export const SUPPORTED_LOCALES = ['fr', 'en']
export const DEFAULT_LOCALE = 'fr'

const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  // Pas de `fallbackLocale` vers une autre langue : elle forcerait à charger les deux
  // fichiers, ce que ce découpage cherche précisément à éviter. La parité des clés FR/EN
  // est garantie par `tests/enforcement/i18n-parity.unit.test.js` — c'est ce test qui rend
  // le fallback inutile plutôt que de s'en remettre au hasard.
  fallbackLocale: false,
  missingWarn: false,
  fallbackWarn: false,
  messages: {}
})

const loaded = new Set()

export async function loadLocaleMessages(locale) {
  if (loaded.has(locale)) return
  // Chemin dynamique mais littéral : Vite doit pouvoir énumérer les fichiers à la
  // compilation pour produire un chunk par locale.
  const messages = await import(`../locales/${locale}.json`)
  i18n.global.setLocaleMessage(locale, messages.default ?? messages)
  loaded.add(locale)
}

export async function setLocale(locale) {
  const target = SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE
  await loadLocaleMessages(target)
  i18n.global.locale.value = target
  document.documentElement?.setAttribute('lang', target)
  return target
}

export default i18n
