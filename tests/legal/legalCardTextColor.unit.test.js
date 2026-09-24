// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/*
  Garde-fou — la carte de contenu des pages légales déclare sa couleur de texte, dans les
  DEUX thèmes.

  `.page-container` (style.css) impose `text-white` à tout son contenu. Les <p> ont leur propre
  règle de couleur, mais les <h3>, <li> et <strong> héritaient du blanc — sur la carte blanche du
  thème clair : 1:1, invisibles. Sur /legal/privacy, cela effaçait le nom et l'adresse postale du
  responsable de traitement (mention obligatoire, RGPD art. 13(1)(a)) — constaté en navigateur le
  24/09/2026. axe ne le classe qu'« à vérifier », jamais en violation.

  jsdom ne calcule pas les couleurs Tailwind : ce test vérifie la déclaration dans la source ; le
  rendu réel se vérifie en navigateur. Il reste nécessaire tant que `.page-container` impose le
  blanc (désamorçage prévu dans une PR distincte).
*/

const viewsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/views/legal')
const VIEWS = ['CookiesPolicyView.vue', 'PrivacyPolicyView.vue', 'MentionsLegalesView.vue']

describe('Pages légales — couleur de texte explicite sur la carte de contenu', () => {
  it.each(VIEWS)('%s', (file) => {
    const source = readFileSync(resolve(viewsDir, file), 'utf-8')
    const card = source.match(/class="([^"]*\bbg-white\b[^"]*\bdark:bg-gray-800\b[^"]*)"/)

    expect(card, `${file} : carte de contenu (bg-white dark:bg-gray-800) introuvable`).not.toBeNull()
    const classes = card[1].split(/\s+/)
    expect(
      classes.some((c) => /^text-(slate|gray|zinc|neutral|stone)-[6-9]00$/.test(c)),
      `${file} : la carte doit déclarer une couleur de texte FONCÉE pour le thème clair — sinon elle hérite du text-white de .page-container, invisible sur fond blanc`,
    ).toBe(true)
    expect(
      classes.some((c) => c.startsWith('dark:text-')),
      `${file} : la carte doit déclarer sa couleur de texte en thème sombre`,
    ).toBe(true)
  })
})
