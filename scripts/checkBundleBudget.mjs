// Logique pure (aucun accès disque/réseau) — voir vite-bundle-budget.mjs pour le plugin Vite qui
// calcule les tailles réelles et appelle ces fonctions. Séparé pour rester testable sans build.

export const BUNDLE_BUDGETS = [
  { id: 'main', pattern: /^assets\/index-.*\.js$/, label: 'bundle principal', rawMaxBytes: 300 * 1024, brotliMaxBytes: 100 * 1024 },
  { id: 'vue-vendor', pattern: /^assets\/vue-vendor-.*\.js$/, label: 'vue-vendor', rawMaxBytes: 150 * 1024, brotliMaxBytes: 50 * 1024 },
]

// CSS : seuils resserrés après Performance #4 (nettoyage du safelist Tailwind) — le CSS est passé
// de 771,9 Ko brut / 48,8 Ko brotli à 57,8 / 8,5. Les anciens seuils (500 Ko brut / 80 Ko brotli)
// ne protégeaient plus rien : le safelist massif pouvait revenir sans déclencher la moindre
// alerte. Les nouveaux laissent environ 2,5× la taille actuelle pour la croissance normale
// (nouvelles vues, nouveaux composants), tout en attrapant immédiatement un retour du safelist
// générique, qui ferait bondir le fichier d'un ordre de grandeur.
// Régime inchangé et aligné sur celui du JS (PR #37) : le brotli — ce qui est réellement
// transféré, LiteSpeed compressant nativement, voir Performance #1/#3 — bloque le build ; le brut
// avertit seulement.
export const CSS_BUDGET = { label: 'CSS total', rawMaxBytes: 150 * 1024, brotliMaxBytes: 25 * 1024 }

export function formatKo(bytes) {
  return `${(bytes / 1024).toFixed(1)} Ko`
}

// Même logique que evaluateCssBudget : le brotli est ce que LiteSpeed sert réellement
// (Performance #1/#3), donc seul lui bloque le build. Le brut reste un avertissement — un
// dépassement brut sans dépassement brotli (contenu très compressible, ex. gros blocs de texte
// i18n) ne justifie pas de bloquer un merge.
export function evaluateJsBudgets(files) {
  const failures = []
  const warnings = []
  for (const file of files) {
    const budget = BUNDLE_BUDGETS.find((b) => b.pattern.test(file.fileName))
    if (!budget) continue

    if (file.brotliSize > budget.brotliMaxBytes) {
      failures.push(
        `${budget.label} (${file.fileName}) : ${formatKo(file.brotliSize)} brotli — budget ${formatKo(budget.brotliMaxBytes)}`
        + ` (transfert réel, ce que sert LiteSpeed)`
      )
    }
    if (file.rawSize > budget.rawMaxBytes) {
      warnings.push(
        `${budget.label} (${file.fileName}) : ${formatKo(file.rawSize)} brut — budget ${formatKo(budget.rawMaxBytes)}`
        + ` (pas bloquant tant que le brotli reste sous budget)`
      )
    }
  }
  return { failures, warnings }
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
