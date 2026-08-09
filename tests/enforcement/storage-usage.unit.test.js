// @vitest-environment node
// Logique pure (parcours de fichiers), aucun DOM à monter.
//
// Garde-fou de admin/strategies/cookies.md §9 : tout accès direct au stockage local doit passer
// par cookieStore.js, jamais être dispersé dans des composants ou d'autres stores. Le jeton
// d'auth (authStore.js) est l'unique exception documentée — strictement nécessaire au service
// demandé (login), exempté de consentement CNIL.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC_DIR = fileURLToPath(new URL('../../src', import.meta.url))

const ALLOWED_FILES = [
  path.join('stores', 'cookieStore.js'), // source de vérité du stockage local
  path.join('stores', 'authStore.js'),   // jeton d'auth exempté, voir commentaire dans le fichier
]

// src/services/* est du code mort confirmé (item #15 de admin/strategies/cookies.md, PR
// chore/remove-dead-services) : encore présent tant que cette PR n'est pas mergée. Exclu du
// scan plutôt que whitelisté fichier par fichier — l'exclusion devient sans objet une fois le
// dossier supprimé.
const EXCLUDED_DIRS = [path.join('services')]

const FORBIDDEN_PATTERNS = [/localStorage\./, /sessionStorage\./, /document\.cookie/]

function walk(dir) {
  let files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relativeFromSrc = path.relative(SRC_DIR, path.join(dir, entry.name))
    if (EXCLUDED_DIRS.some((excluded) => relativeFromSrc === excluded || relativeFromSrc.startsWith(excluded + path.sep))) {
      continue
    }
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files = files.concat(walk(full))
    } else if (/\.(js|vue)$/.test(entry.name)) {
      files.push(full)
    }
  }
  return files
}

describe('enforcement: stockage local centralisé dans cookieStore', () => {
  it('localStorage/sessionStorage/document.cookie absents hors de cookieStore.js (et authStore.js, exempté)', () => {
    const violations = []

    for (const file of walk(SRC_DIR)) {
      const relative = path.relative(SRC_DIR, file)
      if (ALLOWED_FILES.includes(relative)) continue

      const content = fs.readFileSync(file, 'utf-8')
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          violations.push(`${relative} — ${pattern}`)
        }
      }
    }

    expect(
      violations,
      `Stockage local direct détecté hors de cookieStore.js :\n${violations.join('\n')}`
    ).toEqual([])
  })
})
