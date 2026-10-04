// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/*
  Garde-fou — le logo des emails est servi par le site des joueurs.

  Les emails du backend (resources/views/vendor/mail) le chargent depuis
  `${FRONTEND_URL}/images/email/logo-horizontal.png`, et jamais depuis le domaine de
  l'administration (odc-admin) : un lien ou une image vers un domaine « admin » dans un email de
  joueur ressemble à de l'hameçonnage (Greg, 05/10/2026). Le fichier vit donc ici, dans public/,
  copié tel quel dans dist/ et servi avant le repli SPA (RewriteCond !-f, public/.htaccess).

  PNG et non SVG : Gmail n'affiche pas le SVG. 480 px de large, affiché en 240 (écrans denses).
  Supprimer ou renommer ce fichier casse le logo de tous les emails déjà envoyés.
*/

const logo = resolve(dirname(fileURLToPath(import.meta.url)), '../../public/images/email/logo-horizontal.png')

describe('Logo des emails (public/images/email)', () => {
  it('est un PNG de 480 px de large', () => {
    const bytes = readFileSync(logo)
    expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG')
    expect(bytes.readUInt32BE(16)).toBe(480)
  })
})
