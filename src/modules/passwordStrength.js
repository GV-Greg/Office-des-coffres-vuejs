/*
  Force d'un mot de passe d'organisateur sans compte (Décode le code, D10, D28). LOGIQUE PURE, testée seule.

  ⚠️ C'est une AIDE : la seule règle de sécurité est celle du SERVEUR (10 caractères au moins, différent du slug et du pseudo —
  DecodePassword). Cette barre n'interdit rien, elle dit où l'on en est. Estimateur volontairement léger (aucune bibliothèque :
  le budget de bundle est surveillé) : longueur, variété des caractères, mots trop courants, répétitions et suites.

  Quatre niveaux : 0 insuffisant · 1 faible · 2 correct · 3 solide.
*/
export const MIN_PASSWORD_LENGTH = 10

// Ce qu'un tiers essaie en premier. Volontairement court : la longueur fait l'essentiel du travail.
const COMMON_WORDS = [
  'password', 'motdepasse', 'azerty', 'qwerty', 'azertyuiop', 'qwertyuiop', 'abcdef', 'soleil', 'coffre', 'coffres',
  'office', 'bonjour', 'renaissance', 'kingdoms', 'letmein', 'welcome', 'admin', 'iloveyou', 'dragon', 'monkey',
]

const SEQUENCES = ['0123456789', '9876543210', 'abcdefghijklmnopqrstuvwxyz', 'zyxwvutsrqponmlkjihgfedcba', 'azertyuiop', 'qwertyuiop']

function classesOf(password) {
  return [/[a-zà-ÿ]/, /[A-ZÀ-ß]/, /\d/, /[^A-Za-zÀ-ÿ\d]/].filter(re => re.test(password)).length
}

function hasSequence(lower) {
  // Quatre caractères consécutifs d'une suite connue (abcd, 1234, azer…).
  for (const seq of SEQUENCES) {
    for (let i = 0; i + 4 <= seq.length; i++) {
      if (lower.includes(seq.slice(i, i + 4))) return true
    }
  }
  return false
}

function isRepeated(password) {
  return /^(.{1,3})\1+$/.test(password)
}

/**
 * @param {string} password
 * @param {{ slug?: string, pseudo?: string }} context  ce qu'un tiers essaierait aussi
 * @returns {{ level: 0|1|2|3, meetsMinimum: boolean, reasons: string[] }}  `reasons` : codes, jamais du texte
 */
export function passwordStrength(password, { slug = '', pseudo = '' } = {}) {
  const value = String(password ?? '')
  const lower = value.toLowerCase()
  const reasons = []

  const meetsMinimum = value.length >= MIN_PASSWORD_LENGTH
  if (!meetsMinimum) reasons.push('too_short')
  if (slug && lower === slug.toLowerCase()) reasons.push('same_as_slug')
  if (pseudo && lower === pseudo.toLowerCase()) reasons.push('same_as_pseudo')
  if (COMMON_WORDS.some(word => lower.includes(word))) reasons.push('common')
  if (isRepeated(value)) reasons.push('repeated')
  else if (hasSequence(lower)) reasons.push('sequence')

  // Ce que le serveur refuse, ou le vide : insuffisant, sans appel.
  if (!meetsMinimum || reasons.includes('same_as_slug') || reasons.includes('same_as_pseudo')) {
    return { level: 0, meetsMinimum, reasons }
  }

  const classes = classesOf(value)
  let level
  // Une montée progressive : juste au minimum (10) on reste « faible » sans variété ; la variété (majuscules, minuscules, chiffres,
  // symboles) fait monter plus vite que la longueur seule, et dix caractères aux quatre familles suffisent à être solide.
  if (value.length >= 14 || (value.length >= 12 && classes >= 3) || (value.length >= 10 && classes >= 4)) level = 3
  else if (value.length >= 12 || (value.length >= 10 && classes >= 3)) level = 2
  else level = 1

  // Un mot courant, une suite ou une répétition plafonnent à « faible », quelle que soit la longueur.
  if (reasons.includes('common') || reasons.includes('repeated') || reasons.includes('sequence')) level = Math.min(level, 1)

  return { level, meetsMinimum, reasons }
}
