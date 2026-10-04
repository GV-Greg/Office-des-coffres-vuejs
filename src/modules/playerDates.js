import { gameYear } from '@/modules/gameCalendar'

/**
 * Le calendrier appartient au CHAMP DE DATE, pas à l'écran (fil admin/echanges/mandats-historique,
 * 06 et 09) : une date se montre toujours dans la même année sur toutes les surfaces joueur.
 * Ce tableau est la SEULE déclaration de cette règle côté frontend — aucun composant ne choisit
 * lui-même entre 1474 et 2026.
 *
 * `game` : un fait de jeu (élection, prise de fonction, durée d'un mandat) → année du jeu.
 * `real` : un acte de l'Office (décision, révocation, vérification) → année réelle.
 *
 * Un champ absent d'ici lève une erreur : une date nouvelle doit être classée avant d'être affichée,
 * sans quoi elle prendrait en silence la convention de sa voisine.
 */
export const DATE_FIELDS = Object.freeze({
  // Mandats (API /mandates)
  declared_started_at: 'game',
  started_at: 'game',
  in_office_from: 'game',
  valid_until: 'game',
  holds_until: 'game',
  // Périodes de poste (office_history)
  period_started_at: 'game',
  period_ended_at: 'game',
  // Historique des postes d'une province (« Ma province » — API characters/{id}/province)
  history_started_at: 'game',
  history_ended_at: 'game',
  // Gestes de l'Office
  processed_at: 'real',
  revoked_at: 'real',
})

const formatters = new Map()
const formatterFor = (locale) => {
  if (!formatters.has(locale)) {
    formatters.set(locale, new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-BE', {
      timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric',
    }))
  }
  return formatters.get(locale)
}

/**
 * Date d'un champ, jour civil de Paris, dans l'année que le champ déclare. `value` : ISO 8601 ou
 * AAAA-MM-JJ (forme de l'API). Vide si la valeur l'est.
 */
export function formatFieldDate(field, value, locale) {
  const calendar = DATE_FIELDS[field]
  if (!calendar) {
    throw new Error(`Champ de date non classé : « ${field} ». Déclarez-le dans src/modules/playerDates.js (jeu ou réel).`)
  }
  if (!value) return ''

  const parts = formatterFor(locale).formatToParts(new Date(value))
  return parts
    .map(part => (part.type === 'year' && calendar === 'game' ? String(gameYear(Number(part.value))) : part.value))
    .join('')
}
