import { describe, it, expect } from 'vitest'
import { exportResults, exportRules } from '../../src/modules/rewardsBBcode.js'

// L'export BBCode de la Grille des lots : format LISTE `[list][*]` (testé sur le forum du jeu), toujours en français, lien vers la page publique. Les cases non réclamées ne sont jamais dévoilées.

const BASE = 'https://officedescoffres.creacube.be'
const grid = {
  name: 'Foire de Toulouse', slug: 'foire-de-toulouse', width: 4, height: 4, place: { kind: 'province', name: 'Toulouse' },
  lots: [
    { id: 3, place: 15, name: 'Bouclier en bois', player: 'JoueurZ' },
    { id: 1, place: 3, name: 'Épée en fer', player: 'JoueurX' },
    { id: 2, place: 12, name: 'Pain', player: null },
  ],
}

describe('exportResults', () => {
  const out = exportResults(grid, BASE)

  it('liste les lots attribués par numéro de case, en [list][*]', () => {
    expect(out).toContain('[b]Lots attribués :[/b]\n[list]\n[*] [b]Case 3[/b] — Épée en fer → JoueurX\n[*] [b]Case 15[/b] — Bouclier en bois → JoueurZ\n[/list]')
    expect(out).not.toContain('[table')
  })

  it('🔴 ne dévoile JAMAIS une case non réclamée : ni son lot, ni son numéro, ni une rubrique « non réclamés »', () => {
    expect(out).not.toContain('Pain')
    expect(out).not.toContain('Case 12')
    expect(out).not.toContain('non réclamé')
    // même une grille close, dont le serveur envoie tous les lots : l'export ne les reprend pas
    const closed = exportResults({ ...grid, status: 'closed' }, BASE)
    expect(closed).not.toContain('Pain')
    expect(closed).not.toContain('non réclamé')
  })

  it('titre, lieu en français et lien vers la page publique', () => {
    expect(out).toContain('[b]Grille « Foire de Toulouse »[/b]')
    expect(out).not.toContain('🎁') // pas d'icône dans le titre
    expect(out).toContain('[size=12]Comté de Toulouse[/size]')
    expect(out).toContain(`[url=${BASE}/public/activite/grille/foire-de-toulouse]Voir la grille complète[/url]`)
  })

  it('sans lot attribué : pas de rubrique vide, et toujours rien sur les cases non réclamées', () => {
    const none = exportResults({ ...grid, lots: grid.lots.filter(l => !l.player) }, BASE)

    expect(none).not.toContain('Lots attribués')
    expect(none).not.toContain('Pain')
    expect(none).toContain('Foire de Toulouse')
  })
})

describe('exportRules', () => {
  it('présente la grille et dit comment participer', () => {
    const out = exportRules(grid, BASE)

    expect(out).toContain('Grille des lots « Foire de Toulouse »')
    expect(out).toContain('[b]Grille 4 × 4 = 16 cases[/b]')
    expect(out).toContain('de 1 à 16')
    expect(out).toContain(`[url=${BASE}/public/activite/grille/foire-de-toulouse]`)
  })
})
