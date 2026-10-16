// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/*
  Garde-fou — CHARTE-GRAPHIQUE.md §6.7 (Greg, 15/10/2026) : « pas de bouton blanc ». Le niveau
  discret (`odc-btn--quiet`) se lit comme un bouton blanc ; la passe du 17/10/2026 a migré tous ses
  emplois. Aucune vue ni aucun composant ne le repose. Et `fa-reply` ne veut dire que « retour » :
  « Copier pour le forum » n'en prend pas (§6.7, un seul sens par icône).
*/

const src = resolve(dirname(fileURLToPath(import.meta.url)), '../../src')
const vueFiles = dir => readdirSync(dir).flatMap(f => {
  const p = join(dir, f)
  return statSync(p).isDirectory() ? vueFiles(p) : p.endsWith('.vue') ? [p] : []
})

describe('Charte §6.7 — boutons', () => {
  const files = vueFiles(src)

  it('contrôle positif : des fichiers sont lus', () => {
    expect(files.length).toBeGreaterThan(30)
  })

  it('aucune vue ne pose odc-btn--quiet', () => {
    const offenders = files.filter(f => readFileSync(f, 'utf-8').includes('odc-btn--quiet'))
    expect(offenders).toEqual([])
  })

  it('« Copier pour le forum » n\'emprunte pas fa-reply (réservée à Retour)', () => {
    const province = readFileSync(resolve(src, 'views/ProvinceView.vue'), 'utf-8')
    expect(province).toMatch(/fa-copy[^]*CopyForForum/)
    expect(province).not.toContain('fa-reply')
  })
})
