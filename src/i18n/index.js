import { createI18n } from 'vue-i18n'
import fr from '../locales/fr.json'

/*
  Instance i18n unique de l'application.

  Elle était auparavant dédoublée : `main.js` en créait une pour les composants, et ce
  fichier une seconde pour les consommateurs hors contexte composant (`Validators.js`,
  `authStore.js`, qui ne peuvent pas appeler `useI18n()`). Personne ne changeant jamais la
  locale de la seconde, tout ce qu'elle produisait — messages d'erreur de formulaire, toasts
  d'authentification — restait en français même après un passage en anglais. Une seule
  instance supprime la classe de bug entière.

  Le français est embarqué dans le bundle d'entrée, l'anglais est chargé à la demande.
  Charger aussi le français à la demande gagnait ~40 Ko de plus, mais au prix d'un mode de
  défaillance que le site n'avait pas : si la requête de la locale échoue (réseau coupé,
  chunk absent après un déploiement, cache empoisonné), l'interface affiche ses clés brutes
  (`Welcome.Intro`…) — constaté en navigateur le 24/09/2026. Avec le français toujours
  présent, l'application parle toujours : au pire en français au lieu de l'anglais.
*/

export const SUPPORTED_LOCALES = ['fr', 'en']
export const DEFAULT_LOCALE = 'fr'

// Chemins littéraux : Vite doit pouvoir les énumérer à la compilation pour produire un
// chunk par locale chargée à la demande. Le français n'y figure pas, il est déjà là.
const loaders = {
  en: () => import('../locales/en.json'),
}

const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  // Le français étant toujours chargé, le fallback ne coûte plus rien : une clé oubliée
  // dans `en.json` s'affiche en français plutôt que brute. La parité des clés reste
  // vérifiée par `tests/enforcement/i18n-parity.unit.test.js`.
  fallbackLocale: DEFAULT_LOCALE,
  missingWarn: false,
  fallbackWarn: false,
  messages: { fr }
})

const loaded = new Set([DEFAULT_LOCALE])

export async function loadLocaleMessages(locale) {
  if (loaded.has(locale)) return
  const messages = await loaders[locale]()
  i18n.global.setLocaleMessage(locale, messages.default ?? messages)
  loaded.add(locale)
}

/*
  Ne rejette jamais : une langue qui ne se charge pas laisse l'application dans la langue
  courante, avec un avertissement lisible en console, plutôt qu'une promesse rejetée que
  personne n'attrape. Renvoie la locale effectivement active — l'appelant sait ainsi si la
  bascule a eu lieu (SelectorLanguage ne mémorise la préférence qu'en cas de succès).
*/
export async function setLocale(locale) {
  const target = SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE
  try {
    await loadLocaleMessages(target)
  } catch (error) {
    console.warn(`[i18n] Impossible de charger la langue « ${target} », l'interface reste en « ${i18n.global.locale.value} ».`, error)
    return i18n.global.locale.value
  }
  i18n.global.locale.value = target
  document.documentElement?.setAttribute('lang', target)
  return target
}

export default i18n
