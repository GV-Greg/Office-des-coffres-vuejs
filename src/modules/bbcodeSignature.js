// La fin de chaque export BBCode de l'Office : le collage d'origine replié en spoiler, pour qu'un lecteur
// du forum puisse le reprendre, puis la signature, écrite dans le jeu (hors [hrp], sans mention « non officiel » : elle reste sur le
// site). Une activité d'Animation s'« organise » plutôt qu'elle ne se « rédige ». La signature ne s'écrit qu'ici : un message
// fabriqué par le serveur (Décode le code) la reçoit à son arrivée sur le site. Logique pure, sans dépendance Vue.
// `sources` : les collages que l'écran a RECONNUS (son lecteur y trouve des données), tels que le joueur les a collés — y compris les
// lignes qu'il masque du message. C'est à l'appelant d'écarter un collage illisible. Un bloc par collage.

const SITE = 'https://officedescoffres.creacube.be'
const BADGE = `[img]${SITE}/img/odc-badge.png[/img]`
// Le nom de l'Office en gras, dans un orangé-rouge sombre pris au dégradé de l'écu, lisible sur le fond clair du forum.
const LINK = `[url=${SITE}][b][color=#9a3412]Office des Coffres[/color][/b][/url]`

export const SIGNATURES = Object.freeze({
  fr: `${BADGE} [size=9][i]Rédigé avec l'aide de l'${LINK}[/i][/size]`,
  en: `${BADGE} [size=9][i]Written with the help of the ${LINK}[/i][/size]`,
})

/** La signature d'un export d'Animation : français seul, comme ses messages. */
export const ACTIVITY_SIGNATURE = `${BADGE} [size=9][i]Organisé avec l'aide de l'${LINK}[/i][/size]`

// Un collage qui porterait la balise fermante sortirait de son cadre.
const spoiler = raw => `[spoiler][code]${raw.trim().replace(/\[\/(code|spoiler)\]/gi, '(/$1)')}[/code][/spoiler]`

/**
 * @param {string} bbcode le message mis en forme
 * @param {{ sources?: Array<string|null|undefined>, locale?: string, activity?: boolean }} [options] `locale` : la langue du message
 *   (français par défaut) ; `activity` : un export d'Animation
 * @returns {string}
 */
export function signBBcode(bbcode, { sources = [], locale = 'fr', activity = false } = {}) {
  const pastes = sources.filter(raw => typeof raw === 'string' && raw.trim() !== '').map(spoiler)
  const signature = activity ? ACTIVITY_SIGNATURE : SIGNATURES[locale] ?? SIGNATURES.fr
  return [bbcode.trimEnd(), ...pastes, signature].filter(Boolean).join('\n\n')
}
