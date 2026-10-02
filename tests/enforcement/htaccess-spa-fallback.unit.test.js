// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/*
  Garde-fou — le fallback SPA ne répond pas 200 à ce qui n'est pas une page (02/10/2026).

  Il renvoie index.html pour toute URL sans fichier : /access/api/v1/system/ping répondait 200 en
  prod, comme /assets/<nom absent>.js avant le 20/09. Trois préfixes en sont exclus. Le fallback
  lui-même doit rester : la SPA en a besoin pour ses liens directs et pour sa vue 404 (front #45).
*/

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const htaccess = readFileSync(resolve(root, 'public/.htaccess'), 'utf8')
const directives = htaccess.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'))

const fallbackIndex = directives.findIndex((line) => line === 'RewriteRule . /index.html [L]')
// Conditions propres au fallback : celles qui le précèdent depuis la règle précédente.
const previousRule = directives.slice(0, fallbackIndex).findLastIndex((line) => line.startsWith('RewriteRule'))
const conditions = directives.slice(previousRule + 1, fallbackIndex)

describe('public/.htaccess — fallback SPA', () => {
  it('sert toujours index.html aux chemins de page inconnus', () => {
    expect(fallbackIndex).toBeGreaterThan(-1)
    expect(conditions).toContain('RewriteCond %{REQUEST_FILENAME} !-f')
    expect(conditions).toContain('RewriteCond %{REQUEST_FILENAME} !-d')
  })

  it.each([
    ['les fichiers versionnés absents', 'RewriteCond %{REQUEST_URI} !^/assets/'],
    ['les chemins normalisés (RFC 8615)', 'RewriteCond %{REQUEST_URI} !^/\\.well-known/'],
    ['tout chemin contenant /api/', 'RewriteCond %{REQUEST_URI} !/api/'],
  ])('renvoie 404 pour %s', (_, condition) => {
    expect(conditions).toContain(condition)
  })

  // Une condition en [OR] ouvrirait le fallback dès que l'une est vraie, au lieu de toutes.
  it('n\'enchaîne ses conditions qu\'en ET', () => {
    expect(conditions.some((line) => /\[.*OR.*\]$/.test(line))).toBe(false)
  })
})
