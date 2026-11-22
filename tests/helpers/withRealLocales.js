import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/*
  Messages d'un test d'i18n : les VRAIS textes de l'application (src/locales/*.json), sur lesquels le test pose ses propres valeurs.
  Pourquoi : un test qui monte un composant avec un jeu de textes PARTIEL fait afficher à vue-i18n un « [intlify] Not found '…' key » pour chaque clé
  qu'il n'a pas déclarée — des centaines d'avertissements qui noient les vrais problèmes. Ici, ce que le test déclare l'emporte (ses assertions ne
  changent pas) ; tout le reste vient des locales réelles. Une clé qui n'existe NI dans le test NI dans les locales réelles reste signalée : c'est
  alors une vraie clé manquante.

  Lecture par fs : un import de src/locales/*.json est précompilé par le plugin vue-i18n et rend des messages inutilisables en test.
*/
const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const read = lang => JSON.parse(readFileSync(resolve(localesDir, `${lang}.json`), 'utf8'))

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)

function merge(base, override) {
  if (!isObject(base) || !isObject(override)) return override === undefined ? base : override
  const out = { ...base }
  for (const [key, value] of Object.entries(override)) out[key] = key in base ? merge(base[key], value) : value
  return out
}

/** @param {Record<string, object>} partial ex. { fr: { Login: { … } }, en: { … } } — une langue absente reçoit sa locale réelle, une langue présente est complétée. */
export function withRealLocales(partial = {}) {
  const real = { fr: read('fr'), en: read('en') }
  const languages = new Set([...Object.keys(partial), 'fr'])
  return Object.fromEntries([...languages].map(lang => [lang, merge(real[lang] ?? {}, partial[lang] ?? {})]))
}
