// @vitest-environment node
// Logique pure (aucun accès disque/zlib ici) — voir README, section Tests.
import { describe, it, expect } from 'vitest'
import { evaluateJsBudgets, evaluateCssBudget, BUNDLE_BUDGETS, CSS_BUDGET } from '../../scripts/checkBundleBudget.mjs'

describe('evaluateJsBudgets', () => {
  it('ne remonte rien pour des fichiers sous les deux budgets', () => {
    const failures = evaluateJsBudgets([
      { fileName: 'assets/index-abc123.js', rawSize: 250 * 1024, brotliSize: 90 * 1024 },
      { fileName: 'assets/vue-vendor-abc123.js', rawSize: 140 * 1024, brotliSize: 45 * 1024 },
    ])
    expect(failures).toEqual([])
  })

  it('remonte un échec si le poids brut dépasse le budget', () => {
    const failures = evaluateJsBudgets([
      { fileName: 'assets/index-abc123.js', rawSize: 350 * 1024, brotliSize: 90 * 1024 },
    ])
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('bundle principal')
  })

  it('remonte un échec si le poids brotli dépasse le budget, même si le brut passe', () => {
    const failures = evaluateJsBudgets([
      { fileName: 'assets/vue-vendor-abc123.js', rawSize: 100 * 1024, brotliSize: 60 * 1024 },
    ])
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('vue-vendor')
  })

  it('ignore les fichiers qui ne matchent aucun budget suivi', () => {
    const failures = evaluateJsBudgets([
      { fileName: 'assets/EconomyMines-abc123.js', rawSize: 999 * 1024, brotliSize: 999 * 1024 },
    ])
    expect(failures).toEqual([])
  })

  it('les budgets couvrent bien main et vue-vendor', () => {
    expect(BUNDLE_BUDGETS.map((b) => b.id)).toEqual(['main', 'vue-vendor'])
  })
})

describe('evaluateCssBudget', () => {
  it('aucun échec ni avertissement sous les deux budgets', () => {
    const { failures, warnings } = evaluateCssBudget({ rawSize: 400 * 1024, brotliSize: 70 * 1024 })
    expect(failures).toEqual([])
    expect(warnings).toEqual([])
  })

  it('avertit (sans échouer) si le brut dépasse mais le brotli reste sous budget', () => {
    const { failures, warnings } = evaluateCssBudget({ rawSize: 770 * 1024, brotliSize: 49 * 1024 })
    expect(failures).toEqual([])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('performance.md #4')
  })

  it('échoue si le brotli dépasse le budget, quel que soit le brut', () => {
    const { failures } = evaluateCssBudget({ rawSize: 100 * 1024, brotliSize: 90 * 1024 })
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('CSS total')
  })

  it('reflète les seuils documentés dans admin/suivi/performance.md #8', () => {
    expect(CSS_BUDGET.rawMaxBytes).toBe(500 * 1024)
    expect(CSS_BUDGET.brotliMaxBytes).toBe(80 * 1024)
  })
})
