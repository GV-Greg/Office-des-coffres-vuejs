// Icônes d'items pour l'export BBCode de la Gestion des stocks. Logique pure, sans dépendance Vue.
//
// L'Office ne stocke, ne copie et ne proxifie AUCUNE image : les icônes sont la propriété de Celsius Online. Le serveur
// ne connaît que l'ID de l'icône d'un item (`GET item-icons`) ; le site en tire une URL du CDN public du jeu, qui ne sert
// qu'à écrire un `[img]` dans le BBCode collé ensuite sur le forum, comme un joueur le ferait à la main.
// 🔴 Décision de Greg (13/11/2026) : JAMAIS d'icône chargée dans l'interface (ni tableau, ni aperçu) — le navigateur du joueur
// transmettrait son adresse IP au CDN de Celsius, ce que `/legal/privacy` §6 exclut. Ce module ne construit que du texte.

/** ⚠️ JUMEAU de `ItemIcon::CDN_URL_PATTERN` (backend). Si le CDN change d'adresse, les deux se corrigent ensemble. */
export const ITEM_ICON_URL_PATTERN = 'https://lesroyaumes.cdn.oxv.fr/images/items/item%d.png'

/** Le serveur refuse plus de 200 noms par requête. */
export const MAX_NAMES_PER_REQUEST = 200

/**
 * Les noms voyagent dans l'URL : un serveur coupe volontiers au-delà de ~8 Ko (Apache : 8 190 octets de ligne de requête).
 * 200 noms accentués pouvaient s'en approcher ; on s'arrête bien avant.
 */
export const MAX_QUERY_CHARS = 6000

const PARAM_OVERHEAD = encodeURIComponent('names[]=').length + 1 // « names%5B%5D= » et le « & »

/** L'URL publique de l'icône d'un item, depuis son ID (entier positif) ; `null` si l'ID n'en est pas un. */
export function itemIconUrl(id) {
  return Number.isInteger(id) && id > 0 ? ITEM_ICON_URL_PATTERN.replace('%d', String(id)) : null
}

/** Les noms distincts, non vides, dans l'ordre de première apparition. */
export function uniqueNames(names) {
  return [...new Set(names.filter((name) => typeof name === 'string' && name.trim() !== ''))]
}

/** Découpe en lots : jamais plus de `maxNames` noms, ni plus de `maxChars` caractères d'URL (un nom seul passe toujours). */
export function batchNames(names, { maxNames = MAX_NAMES_PER_REQUEST, maxChars = MAX_QUERY_CHARS } = {}) {
  const batches = []
  let current = []
  let size = 0
  for (const name of uniqueNames(names)) {
    const cost = encodeURIComponent(name).length + PARAM_OVERHEAD
    if (current.length > 0 && (current.length >= maxNames || size + cost > maxChars)) {
      batches.push(current)
      current = []
      size = 0
    }
    current.push(name)
    size += cost
  }
  if (current.length > 0) batches.push(current)
  return batches
}

/** Ne garde de la réponse du serveur que des couples « nom → ID entier positif » : l'ID sert à écrire une URL, il ne passe pas tel quel. */
export function cleanIcons(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [name, id] of Object.entries(raw)) {
    if (Number.isInteger(id) && id > 0) out[name] = id
  }
  return out
}
