/**
 * Les listes de villageois gardées dans le navigateur (stockage « Préférences », Greg, 23/11/2026) : chacune avec SON jour du jeu, jamais « la dernière »
 * (recharger la page le jour même rendait la liste d'aujourd'hui comme « liste d'hier »). On ne garde qu'AUJOURD'HUI et HIER ; la plus ancienne est effacée à
 * chaque écriture. Le texte légal (cookies §3, « Vos données ») le dit. Fonctions pures : le jour du jeu vient de l'appelant.
 */

/** Jour ISO décalé de `n` jours (calendrier UTC : il s'agit de dates, pas d'instants). */
export function shiftIso(iso, n) {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + n)
  return date.toISOString().slice(0, 10)
}

/** `{ 'AAAA-MM-JJ': texte }` réduit à aujourd'hui et hier, sans entrée vide. */
export function pruneLists(lists, today) {
  const keep = new Set([today, shiftIso(today, -1)])
  return Object.fromEntries(Object.entries(lists ?? {}).filter(([day, text]) => keep.has(day) && typeof text === 'string' && text.trim() !== ''))
}

/**
 * Ajoute ce qui vient d'être collé : la liste du jour `day` et, si elle est collée, celle de la veille de `day`. `today` = le jour du jeu RÉEL, qui décide
 * de ce qu'on garde (un prévôt qui corrige un jour ancien ne fait rien rester de plus).
 */
export function rememberLists(lists, { day, today, todayText = '', yesterdayText = '' }) {
  const next = { ...(lists ?? {}) }
  if (todayText.trim()) next[day] = todayText
  if (yesterdayText.trim()) next[shiftIso(day, -1)] = yesterdayText
  return pruneLists(next, today)
}

/** La liste d'hier, proposée comme « liste d'hier » ; null s'il n'y en a pas. */
export function yesterdaysList(lists, today) {
  return (lists ?? {})[shiftIso(today, -1)] ?? null
}
