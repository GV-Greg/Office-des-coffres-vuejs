// @vitest-environment node
// Logique pure (aucun accès disque/zlib ici) — voir README, section Tests.
import { describe, it, expect } from 'vitest'
import { evaluateJsBudgets, evaluateCssBudget, BUNDLE_BUDGETS, CSS_BUDGET } from '../../scripts/checkBundleBudget.mjs'

describe('evaluateJsBudgets', () => {
  it('ne remonte rien pour des fichiers sous les deux budgets', () => {
    const { failures, warnings } = evaluateJsBudgets([
      { fileName: 'assets/index-abc123.js', rawSize: 250 * 1024, brotliSize: 90 * 1024 },
      { fileName: 'assets/vue-vendor-abc123.js', rawSize: 140 * 1024, brotliSize: 45 * 1024 },
      { fileName: 'assets/i18n-vendor-abc123.js', rawSize: 60 * 1024, brotliSize: 18 * 1024 },
    ])
    expect(failures).toEqual([])
    expect(warnings).toEqual([])
  })

  it('avertit (sans échouer) si le poids brut dépasse le budget mais le brotli reste sous budget', () => {
    const { failures, warnings } = evaluateJsBudgets([
      { fileName: 'assets/index-abc123.js', rawSize: 350 * 1024, brotliSize: 90 * 1024 },
    ])
    expect(failures).toEqual([])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('bundle principal')
  })

  it('remonte un échec si le poids brotli dépasse le budget, même si le brut passe', () => {
    const { failures } = evaluateJsBudgets([
      { fileName: 'assets/vue-vendor-abc123.js', rawSize: 100 * 1024, brotliSize: 60 * 1024 },
    ])
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('vue-vendor')
  })

  it('remonte un échec si le chunk i18n dépasse son budget brotli', () => {
    const { failures } = evaluateJsBudgets([
      { fileName: 'assets/i18n-vendor-abc123.js', rawSize: 80 * 1024, brotliSize: 26 * 1024 },
    ])
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('i18n-vendor')
  })

  it('ignore les fichiers qui ne matchent aucun budget suivi', () => {
    const { failures, warnings } = evaluateJsBudgets([
      { fileName: 'assets/EconomyMines-abc123.js', rawSize: 999 * 1024, brotliSize: 999 * 1024 },
    ])
    expect(failures).toEqual([])
    expect(warnings).toEqual([])
  })

  it('les budgets couvrent bien main, vue-vendor et i18n-vendor', () => {
    expect(BUNDLE_BUDGETS.map((b) => b.id)).toEqual(['main', 'vue-vendor', 'i18n-vendor'])
  })
})

describe('evaluateCssBudget', () => {
  it('aucun échec ni avertissement sous les deux budgets', () => {
    const { failures, warnings } = evaluateCssBudget({ rawSize: 60 * 1024, brotliSize: 9 * 1024 })
    expect(failures).toEqual([])
    expect(warnings).toEqual([])
  })

  it('avertit (sans échouer) si le brut dépasse mais le brotli reste sous budget', () => {
    const { failures, warnings } = evaluateCssBudget({ rawSize: 200 * 1024, brotliSize: 20 * 1024 })
    expect(failures).toEqual([])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('dette connue')
  })

  it('échoue si le brotli dépasse le budget, quel que soit le brut', () => {
    const { failures } = evaluateCssBudget({ rawSize: 100 * 1024, brotliSize: 30 * 1024 })
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('CSS total')
  })

  // Garde-fou de non-régression du nettoyage Tailwind (Performance #4) : un safelist générique
  // qui reviendrait ferait repasser le CSS bien au-dessus de ces seuils.
  it('attrape un retour du safelist générique (ordre de grandeur pré-#4)', () => {
    const { failures } = evaluateCssBudget({ rawSize: 770 * 1024, brotliSize: 49 * 1024 })
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('CSS total')
  })

  it('reflète les seuils documentés de la stratégie de performance', () => {
    expect(CSS_BUDGET.rawMaxBytes).toBe(150 * 1024)
    expect(CSS_BUDGET.brotliMaxBytes).toBe(25 * 1024)
  })
})
