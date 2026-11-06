// Parse un inventaire collé depuis Renaissance Kingdoms.
// Logique pure, sans dépendance Vue — voir inventoryCategories.js pour les catégories
// et inventoryBBcode.js pour l'export forum.
//
// Format d'entrée (copié depuis le jeu) :
//   Encombrement : 29950
//
//    #NomEnc.Actions possibles26865,51 écus
//   596Miches de pain2980
//   ...
//
// Chaque ligne d'item : {quantité}{nom}{encombrement total} sans séparateur.
// Le nom ne se termine jamais par un chiffre → regex greedy fiable.
// Les noms tronqués se terminent par "...." (4 points).

const ECUS_RE = /([\d\s]+(?:,\d+)?)\s*écus/i
const ITEM_LINE_RE = /^(\d+)(.*\D)(\d+)$/

function parseEcus(s) {
  return parseFloat(s.replace(/\s/g, '').replace(',', '.'))
}

/** Vrai si le nom est tronqué par le jeu (se termine par `....`). */
export function isTruncated(name) {
  return typeof name === 'string' && name.endsWith('....')
}

/**
 * Parse le texte brut de l'inventaire.
 * Renvoie { totalEcus: number|null, items: [{ quantity, name, truncated }] }.
 * Les lignes non reconnues sont ignorées silencieusement.
 */
export function parseInventoryText(text) {
  if (!text?.trim()) return { totalEcus: null, items: [] }

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  let totalEcus = null
  const items = []

  for (const line of lines) {
    // En-tête d'encombrement global — skip.
    if (/^Encombrement\s*:/i.test(line)) continue

    // Ligne d'en-tête portant le total en écus (ne commence pas par un chiffre).
    if (/écus/i.test(line) && !/^\d/.test(line)) {
      const m = line.match(ECUS_RE)
      if (m) totalEcus = parseEcus(m[1])
      continue
    }

    // Ligne d'item : {quantité}{nom}{encombrement}.
    const m = line.match(ITEM_LINE_RE)
    if (m) {
      const name = m[2].trim()
      items.push({ quantity: parseInt(m[1], 10), name, truncated: isTruncated(name) })
    }
  }

  return { totalEcus, items }
}

/**
 * Fusionne les items portant le même nom (quantités additionnées).
 * Applique d'abord la table de référence pour résoudre les noms tronqués :
 *   referenceTable : { 'Nom tronqué....': 'Nom complet' }
 * Deux items tronqués avec le même préfixe (même entrée dans la table)
 * sont réunis en un seul item avec le nom complet.
 * Un nom tronqué absent de la table reste tel quel (truncated = true).
 */
export function resolveItems(items, referenceTable = {}) {
  const byName = new Map()

  for (const item of items) {
    const resolved = item.truncated ? (referenceTable[item.name] ?? item.name) : item.name
    const stillTruncated = item.truncated && resolved === item.name

    const existing = byName.get(resolved)
    if (existing) {
      byName.set(resolved, { ...existing, quantity: existing.quantity + item.quantity })
    } else {
      byName.set(resolved, { quantity: item.quantity, name: resolved, truncated: stillTruncated })
    }
  }

  return [...byName.values()]
}
