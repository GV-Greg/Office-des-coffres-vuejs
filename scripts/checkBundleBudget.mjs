// Logique pure (aucun accès disque/réseau) — voir vite-bundle-budget.mjs pour le plugin Vite qui
// calcule les tailles réelles et appelle ces fonctions. Séparé pour rester testable sans build.

export const BUNDLE_BUDGETS = [
  { id: 'main', pattern: /^assets\/index-.*\.js$/, label: 'bundle principal', rawMaxBytes: 300 * 1024, brotliMaxBytes: 100 * 1024 },
  { id: 'vue-vendor', pattern: /^assets\/vue-vendor-.*\.js$/, label: 'vue-vendor', rawMaxBytes: 150 * 1024, brotliMaxBytes: 50 * 1024 },
]

// CSS : le budget "brut" (500 Ko) est déjà dépassé par une dette connue et distincte (Performance
// #4, audit Tailwind non fait) — seul le brotli (ce qui est réellement transféré, LiteSpeed
// compresse nativement en brotli, voir Performance #1/#3) bloque le build ici. Le brut reste un
// avertissement, à resserrer en erreur une fois #4 livré.
export const CSS_BUDGET = { label: 'CSS total', rawMaxBytes: 500 * 1024, brotliMaxBytes: 80 * 1024 }

export function formatKo(bytes) {
  return `${(bytes / 1024).toFixed(1)} Ko`
}

export function evaluateJsBudgets(files) {
  const failures = []
  for (const file of files) {
    const budget = BUNDLE_BUDGETS.find((b) => b.pattern.test(file.fileName))
    if (!budget) continue
    if (file.rawSize > budget.rawMaxBytes || file.brotliSize > budget.brotliMaxBytes) {
      failures.push(
        `${budget.label} (${file.fileName}) : ${formatKo(file.rawSize)} brut / ${formatKo(file.brotliSize)} brotli`
        + ` — budget ${formatKo(budget.rawMaxBytes)} / ${formatKo(budget.brotliMaxBytes)}`
      )
    }
  }
  return failures
}

export function evaluateCssBudget({ rawSize, brotliSize }) {
  const failures = []
  const warnings = []

  if (brotliSize > CSS_BUDGET.brotliMaxBytes) {
    failures.push(
      `${CSS_BUDGET.label} : ${formatKo(brotliSize)} brotli — budget ${formatKo(CSS_BUDGET.brotliMaxBytes)}`
      + ` (transfert réel, ce que sert LiteSpeed)`
    )
  }
  if (rawSize > CSS_BUDGET.rawMaxBytes) {
    warnings.push(
      `${CSS_BUDGET.label} : ${formatKo(rawSize)} brut — budget ${formatKo(CSS_BUDGET.rawMaxBytes)}`
      + ` (dette connue, voir admin/suivi/performance.md #4 — pas bloquant tant que le brotli reste sous budget)`
    )
  }

  return { failures, warnings }
}
