// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/*
  Garde-fou — origine canonique (29/09/2026).

  Le site répondait sous quatre origines (http/https × avec/sans www), deux en clair. Une seule
  peut être autorisée par CORS côté API : les autres doivent rediriger. Ce test ne remplace pas
  la vérification en prod (étape « origine canonique » de .github/workflows/deploy.yml, seule à
  voir le vrai serveur) ; il attrape avant le merge les erreurs de rédaction de la règle.
*/

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const htaccess = readFileSync(resolve(root, 'public/.htaccess'), 'utf8')
const directives = htaccess.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'))

const redirectIndex = directives.findIndex((line) => /^RewriteRule .*\[R=30[12],L\]$/.test(line))
const fallbackIndex = directives.findIndex((line) => line.startsWith('RewriteRule . /index.html'))

describe('public/.htaccess — origine canonique', () => {
  it('redirige vers https://officedescoffres.creacube.be en gardant le chemin', () => {
    expect(directives[redirectIndex]).toMatch(/^RewriteRule \^\(\.\*\)\$ https:\/\/officedescoffres\.creacube\.be\/\$1 \[R=30[12],L\]$/)
  })

  // Le fallback SPA s'arrête sur [L] : placée après, la redirection ne s'appliquerait qu'aux
  // fichiers existants, et toute page de l'application resterait servie sous chaque variante.
  it('passe avant le fallback SPA', () => {
    expect(redirectIndex).toBeGreaterThan(-1)
    expect(fallbackIndex).toBeGreaterThan(redirectIndex)
  })

  // Les conditions qui précèdent la règle, sans le [OR] mal placé qui redirigerait tout ou rien.
  it('redirige sur le schéma http OU un autre hôte, jamais /.well-known/', () => {
    expect(directives.slice(redirectIndex - 3, redirectIndex)).toEqual([
      'RewriteCond %{REQUEST_URI} !^/\\.well-known/',
      'RewriteCond %{HTTPS} !=on [OR]',
      'RewriteCond %{HTTP_HOST} !^officedescoffres\\.creacube\\.be$ [NC]',
    ])
  })

  // Irrévocable chez les clients : décision séparée, jamais « tant qu'on y est ».
  it('ne pose pas de HSTS', () => {
    expect(directives.some((line) => /Strict-Transport-Security/i.test(line))).toBe(false)
  })
})
