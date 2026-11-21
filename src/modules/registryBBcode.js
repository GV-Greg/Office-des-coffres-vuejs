// Titres des exports BBCode du Registre des stocks (PR 3b ; fil registre-stocks, Q4 de Cowork). Logique pure, sans dépendance Vue.
// Le contenu forum est en FRANÇAIS FIXE, indépendant de la langue de l'interface. Le titre précède le BBCode du Bilan des stocks (une inscription)
// ou de La Balance (un bilan de mandat, la comparaison libre) : le Registre a des dates, le Bilan n'en a pas — c'est pourquoi le titre ne vit qu'ici.

const title = text => `[b][size=20]${text}[/size][/b]`

/** « Ville : Arras » / « Province : Artois » — fixe, français. */
export const placeLabelFr = (level, name) => `${level === 'city' ? 'Ville' : 'Province'} : ${name}`

/** Une inscription : « Inventaire du 20/11/1474 — Ville : Arras ». */
export const entryTitle = (dateFr, place) => title(`Inventaire du ${dateFr} — ${place}`)

/** Un bilan de mandat : « Bilan de mi-mandat, du 23/09/1474 au 22/10/1474 » (`kind` : 'mid' ou 'end'). */
export const bilanTitle = (kind, fromFr, toFr) => title(`Bilan de ${kind === 'mid' ? 'mi-mandat' : 'fin de mandat'}, du ${fromFr} au ${toFr}`)

/** La comparaison libre de deux inscriptions. */
export const comparisonTitle = (fromFr, toFr) => title(`Comparaison des inventaires du ${fromFr} au ${toFr}`)

/** Le titre, une ligne vide, puis le BBCode du Bilan ou de la Balance. */
export const withTitle = (heading, bbcode) => `${heading}\n\n${bbcode}`
