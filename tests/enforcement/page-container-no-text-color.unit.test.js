// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/*
  Garde-fou — `.page-container` ne déclare aucune couleur de texte.

  Elle imposait `text-white` à tout son contenu. Les <h3>, <li> et <strong> des pages légales en
  héritaient sur une carte blanche (thème clair) : le nom et l'adresse du responsable de
  traitement ne s'affichaient pas (PR #54). Une couleur héritée d'un conteneur de mise en page
  ignore le fond réel du bloc qui la reçoit ; chaque bloc déclare la sienne, par thème.
*/

const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../src/assets/style.css'), 'utf-8')

describe('.page-container', () => {
  it('ne déclare pas de couleur de texte', () => {
    const block = css.match(/\.page-container\s*\{([^}]*)\}/)
    expect(block, '.page-container introuvable dans style.css').not.toBeNull()
    const colors = block[1].match(/\b(?:dark:)?text-(?:white|black|[a-z]+-\d{2,3})\b/g) ?? []
    expect(colors, `.page-container ne doit imposer aucune couleur de texte à son contenu (trouvé : ${colors.join(', ')}) — voir le commentaire au-dessus de la règle dans style.css`).toEqual([])
  })
})
