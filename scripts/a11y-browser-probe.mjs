// Sonde de faisabilité — axe-core contre la page réellement rendue (roadmap-a11y, item 2).
// Ce n'est pas le futur test : elle mesure si le montage tient (runner) et s'il est stable.
//
// Usage : node a11y-browser-probe.mjs <baseURL> <runs> [executablePath]
// Chaque run : un navigateur neuf, les mêmes pages, axe complet (règles de niveau document
// comprises). Un run « instable » = une exception, ou un jeu de violations différent du 1er.
import { chromium } from 'playwright-core'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const AXE_SOURCE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf-8')
const AXE_VERSION = require('axe-core/package.json').version

const [BASE, RUNS = '10', EXE] = process.argv.slice(2)
const PAGES = ['/', '/login', '/register', '/legal/cookies', '/legal/privacy', '/legal/mentions', '/page-inexistante']

async function auditOnce() {
  const browser = await chromium.launch({ ...(EXE ? { executablePath: EXE } : {}), args: ['--no-sandbox'] })
  const results = {}
  try {
    for (const path of PAGES) {
      const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })
      const page = await ctx.newPage()
      // Aucune requête vers l'API de prod : le build pointe VITE_API_ENDPOINT_PROD.
      await page.route(/\/api\/v1\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: r.request().url().includes('/map') ? '[]' : '{}' }))
      await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForSelector('#app > *', { timeout: 10000 })
      await page.addScriptTag({ content: AXE_SOURCE })
      const violations = await page.evaluate(async () => {
        const r = await window.axe.run(document, { resultTypes: ['violations'] })
        return r.violations.map((v) => `${v.id}×${v.nodes.length}`).sort()
      })
      results[path] = violations
      await ctx.close()
    }
  } finally {
    await browser.close()
  }
  return results
}

const runs = Number(RUNS)
let reference = null
let crashed = 0
let divergent = 0
const durations = []
for (let i = 1; i <= runs; i++) {
  const t0 = Date.now()
  try {
    const res = await auditOnce()
    const sig = JSON.stringify(res)
    if (reference === null) {
      reference = sig
      console.log(`axe-core ${AXE_VERSION} — violations du run 1 :`)
      for (const [p, v] of Object.entries(res)) console.log(`  ${p.padEnd(18)} ${v.length ? v.join(', ') : 'aucune'}`)
    } else if (sig !== reference) {
      divergent++
      console.log(`run ${i}: DIVERGENT → ${sig}`)
    }
    durations.push(Date.now() - t0)
    console.log(`run ${i}/${runs}: ok (${((Date.now() - t0) / 1000).toFixed(1)} s)`)
  } catch (e) {
    crashed++
    console.log(`run ${i}/${runs}: ÉCHEC — ${e.message.split('\n')[0]}`)
  }
}
const avg = durations.length ? (durations.reduce((a, b) => a + b, 0) / durations.length / 1000).toFixed(1) : '—'
console.log(`\nBILAN: ${runs} runs · ${crashed} échec(s) · ${divergent} divergent(s) · durée moyenne ${avg} s/run (${PAGES.length} pages)`)
process.exit(crashed || divergent ? 1 : 0)
