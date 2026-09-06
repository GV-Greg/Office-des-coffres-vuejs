import { brotliCompressSync } from 'node:zlib'
import { evaluateJsBudgets, evaluateCssBudget } from './checkBundleBudget.mjs'

// Performance #8 (admin/suivi/performance.md) : échoue le build si un chunk JS suivi dépasse son
// budget, avertit (sans bloquer) sur le poids brut du CSS. Lit directement le contenu en mémoire
// depuis `bundle` (writeBundle) plutôt que de relire dist/ sur disque — pas de course possible
// avec l'écriture des fichiers.
export function bundleBudgetPlugin() {
  return {
    name: 'bundle-budget-check',
    apply: 'build',
    writeBundle(_options, bundle) {
      const jsFiles = []
      let cssRawSize = 0
      let cssBrotliSize = 0

      for (const [fileName, output] of Object.entries(bundle)) {
        const content = output.type === 'chunk' ? output.code : output.source
        if (content == null) continue

        const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content)
        const rawSize = buffer.length
        const brotliSize = brotliCompressSync(buffer).length

        if (fileName.endsWith('.css')) {
          cssRawSize += rawSize
          cssBrotliSize += brotliSize
        } else if (fileName.endsWith('.js')) {
          jsFiles.push({ fileName, rawSize, brotliSize })
        }
      }

      const jsFailures = evaluateJsBudgets(jsFiles)
      const { failures: cssFailures, warnings: cssWarnings } = evaluateCssBudget({
        rawSize: cssRawSize,
        brotliSize: cssBrotliSize,
      })

      for (const warning of cssWarnings) {
        console.warn(`⚠️  Budget bundle (avertissement) : ${warning}`)
      }

      const failures = [...jsFailures, ...cssFailures]
      if (failures.length > 0) {
        throw new Error(
          `Budget bundle dépassé (admin/suivi/performance.md #8) :\n${failures.map((f) => `  - ${f}`).join('\n')}`
        )
      }
    },
  }
}
