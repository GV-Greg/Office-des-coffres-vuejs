/*
  Contraste du texte contre son FOND RÉSOLU — mesuré dans un vrai navigateur (WCAG 1.4.3).

  Pourquoi ce contrôle existe à côté d'axe : axe classe « à vérifier » (incomplete), jamais
  « violation », les deux pires défauts relevés le 24/09/2026 — boutons en dégradé et texte
  juridique blanc sur blanc. Un garde-fou qui n'échouerait que sur les violations d'axe aurait
  été vert sur une politique de confidentialité dont le responsable de traitement ne s'affichait
  pas.

  Ce qu'il mesure — et ce qu'il ne mesure PAS :
  - le RATIO de chaque texte contre le fond réellement peint derrière lui, pas l'égalité des deux
    couleurs. Une première version comptait les textes « de la couleur de leur fond » (1:1) : elle
    affichait 0 défaut alors que des en-têtes de tableau orange-200 sur blanc (1,35:1) restaient
    illisibles. « Invisible » n'est pas « sous le seuil » ;
  - seuil 4,5:1, ou 3:1 pour le grand texte (≥ 24 px, ou ≥ 18,66 px en gras) ;
  - fond résolu en remontant les ancêtres et en composant les couleurs semi-transparentes
    jusqu'à un fond opaque ; l'opacité des ancêtres est appliquée au texte ;
  - NON MESURABLE, classé comme tel, jamais deviné :
    · texte transparent peint par `background-clip: text` (titres en dégradé) — sa `color`
      calculée vaut rgba(0,0,0,0) et ne dit rien de ce qui s'affiche ;
    · texte posé sur une IMAGE de fond (url()).
  - fond en DÉGRADÉ : mesuré contre CHACUN de ses arrêts, le pire décide — le contraste se juge
    sur l'arrêt le plus clair, jamais sur une moyenne. Une première version classait ces fonds
    « non mesurables » : elle laissait passer les en-têtes de tableau orange-200 sur un thead
    orange-400 → red-600 (1,67:1), qu'une autre mesure attribuait à tort à la carte blanche.
  - hors périmètre : l'empilement visuel sans lien de parenté DOM (un élément positionné par-dessus
    un autre). Le fond est lu dans la chaîne des ancêtres.

  RÉFÉRENCE FIGÉE (`textContrast.baseline.json`, à côté de ce fichier) : les textes sous le seuil
  ET les textes non mesurables connus. Tant qu'ils ne sont pas corrigés, un nouveau défaut se
  fondrait dans le tas ; le contrôle échoue donc dès que l'ENSEMBLE CHANGE — un défaut de plus,
  mais aussi un défaut corrigé sans mise à jour de la référence (un fait nouveau demande un coup
  d'œil humain, pas un silence). Même principe que l'« incomplete » d'axe, qui se fige et ne
  s'ignore pas.

  ⚠️ DISCIPLINE DE LA RÉFÉRENCE — c'est elle qui garde, pas le script :
  - chaque correction de contraste fait échouer la mesure avec « DISPARU », et c'est VOULU ;
  - la mise à jour de la référence va dans le MÊME COMMIT que la correction qui la motive ;
  - c'est le DIFF DE LA RÉFÉRENCE qui se relit : chaque ligne retirée doit correspondre à une
    correction du commit, chaque ligne ajoutée à un défaut assumé et expliqué ;
  - jamais de régénération « pour faire passer ». Le jour où la régénérer en bloc devient une
    habitude, le garde-fou est mort sans que rien ne le signale. `--update-baseline` affiche
    donc le diff avant d'écrire.

  Usage : node tests/browser/textContrast.mjs <baseURL> [cheminChrome] [--update-baseline]
  (build de prod servi par `vite preview` ; API simulée, aucune requête ne part vers la prod).
*/
import { chromium } from 'playwright-core'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BASELINE = fileURLToPath(new URL('./textContrast.baseline.json', import.meta.url))

export const PUBLIC_PAGES = ['/', '/login', '/register', '/legal/cookies', '/legal/privacy', '/legal/mentions', '/page-inexistante']
export const THEMES = ['light', 'dark']

// Exécutée DANS la page : aucune dépendance, tout ce qu'elle utilise est défini ici.
export function measureInPage() {
  const parse = (s) => {
    const m = s.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\)/)
    if (!m) return null
    let a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])
    return [+m[1], +m[2], +m[3], a]
  }
  const over = (top, bottom) => {
    const a = top[3]
    return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)).concat(1)
  }
  const lum = (c) => c.slice(0, 3).map((v) => v / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
    .reduce((s, x, i) => s + x * [0.2126, 0.7152, 0.0722][i], 0)
  const ratio = (a, b) => { const [h, l] = [lum(a), lum(b)].sort((x, y) => y - x); return (h + 0.05) / (l + 0.05) }
  const describe = (el) => {
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 4).join('.') : ''
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls ? '.' + cls : ''}`
  }

  const results = []
  for (const el of document.body.querySelectorAll('*')) {
    const ownText = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim()
    if (!ownText) continue
    const style = getComputedStyle(el)
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0 || style.visibility === 'hidden' || style.display === 'none') continue
    if (el.closest('[aria-hidden="true"]')) continue

    const text = ownText.replace(/\s+/g, ' ').slice(0, 60)
    const size = parseFloat(style.fontSize)
    const bold = parseInt(style.fontWeight, 10) >= 700
    const large = size >= 24 || (size >= 18.66 && bold)
    const threshold = large ? 3 : 4.5
    const base = { element: describe(el), text, size, large, threshold }

    // Texte peint par son fond (background-clip: text) : la couleur calculée ne dit rien.
    const fg0 = parse(style.color)
    const clipsText = [style.backgroundClip, style.webkitBackgroundClip].some((v) => v && v.includes('text'))
    if (!fg0 || fg0[3] === 0 || clipsText) {
      results.push({ ...base, status: 'unmeasurable', reason: clipsText ? 'texte en dégradé (background-clip: text)' : 'couleur de texte transparente' })
      continue
    }

    // Fond résolu : pile des fonds des ancêtres, du plus proche au plus lointain.
    // Pile des fonds des ancêtres, du plus proche au plus lointain. Un dégradé termine la pile
    // (ses arrêts sont opaques dans ce projet) et devient l'ensemble des fonds candidats.
    const layers = []
    let opacity = 1
    let blocked = null
    let gradientStops = null
    for (let node = el; node; node = node.parentElement) {
      const s = getComputedStyle(node)
      opacity *= parseFloat(s.opacity)
      if (s.backgroundImage && s.backgroundImage !== 'none') {
        if (/url\(/.test(s.backgroundImage) || !/gradient\(/.test(s.backgroundImage)) { blocked = `image de fond sur ${describe(node)}`; break }
        const stops = [...s.backgroundImage.matchAll(/rgba?\([^)]*\)/g)].map((m) => parse(m[0])).filter(Boolean)
        if (!stops.length) { blocked = `dégradé illisible sur ${describe(node)}`; break }
        gradientStops = stops
        break
      }
      const bg = parse(s.backgroundColor)
      if (bg && bg[3] > 0) { layers.push(bg); if (bg[3] >= 1) break }
    }
    if (blocked) { results.push({ ...base, status: 'unmeasurable', reason: blocked }); continue }

    // Fonds candidats : la couleur unie résolue, ou chaque arrêt du dégradé (composés, du plus
    // lointain au plus proche, avec les couches semi-transparentes au-dessus).
    const bottoms = gradientStops ? gradientStops.map((st) => over(st, [255, 255, 255, 1])) : [[255, 255, 255, 1]]
    let worst = null
    for (const bottom of bottoms) {
      let background = bottom
      for (const layer of [...layers].reverse()) background = over(layer, background)
      const foreground = over([fg0[0], fg0[1], fg0[2], fg0[3] * opacity], background)
      const r = ratio(foreground, background)
      if (!worst || r < worst.r) worst = { r, foreground, background }
    }
    results.push({
      ...base,
      status: worst.r >= threshold ? 'pass' : 'fail',
      ratio: Math.round(worst.r * 100) / 100,
      color: `rgb(${worst.foreground.slice(0, 3).map(Math.round).join(',')})`,
      background: `rgb(${worst.background.slice(0, 3).map(Math.round).join(',')})${gradientStops ? ' (arrêt le plus défavorable du dégradé)' : ''}`,
    })
  }
  return results
}

export async function auditPage(browser, baseURL, path, theme) {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  await page.route(/\/api\/v1\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: r.request().url().includes('/map') ? '[]' : '{}' }))
  await page.addInitScript((t) => {
    // Choix cookies enregistré (bannière fermée) et thème imposé via la préférence mémorisée.
    localStorage.setItem('cookie-consent', JSON.stringify({ preferences: false, choiceMadeAt: Date.now() }))
    localStorage.setItem('comfort-cookies', JSON.stringify({ theme: t }))
  }, theme)
  await page.goto(baseURL + path, { waitUntil: 'networkidle' })
  // La bascule se CONSTATE : sans ça, deux passes pourraient mesurer deux fois le même thème et
  // annoncer « les deux passent ».
  const appliedDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  if (appliedDark !== (theme === 'dark')) {
    await context.close()
    throw new Error(`${path} : thème « ${theme} » demandé, mais <html> est ${appliedDark ? 'sombre' : 'clair'} — mesure refusée`)
  }
  const results = await page.evaluate(measureInPage)
  await context.close()
  return results
}

// Clé stable d'un constat : ni ratio ni couleurs (un cran corrigé changerait la clé sans que le
// défaut disparaisse), mais thème, page, élément et texte.
const keyOf = (theme, path, r) => `${theme} ${path} ${r.element} « ${r.text} »`

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const update = args.includes('--update-baseline')
  const [baseURL, executablePath] = args.filter((a) => !a.startsWith('--'))
  const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox'] })
  const current = { belowThreshold: [], unmeasurable: [] }
  try {
    for (const theme of THEMES) for (const path of PUBLIC_PAGES) {
      const results = await auditPage(browser, baseURL, path, theme)
      for (const r of results) {
        if (r.status === 'fail') current.belowThreshold.push(`${keyOf(theme, path, r)} — ${r.ratio}:1 < ${r.threshold}:1 (${r.color} sur ${r.background})`)
        if (r.status === 'unmeasurable') current.unmeasurable.push(`${keyOf(theme, path, r)} — ${r.reason}`)
      }
    }
  } finally {
    await browser.close()
  }
  current.belowThreshold.sort(); current.unmeasurable.sort()

  if (update) {
    // La régénération n'est jamais silencieuse : le diff s'affiche, ligne par ligne.
    if (existsSync(BASELINE)) {
      const previous = JSON.parse(readFileSync(BASELINE, 'utf-8'))
      for (const kind of ['belowThreshold', 'unmeasurable']) {
        const before = new Set(previous[kind]); const after = new Set(current[kind])
        for (const l of current[kind]) if (!before.has(l)) console.log(`  + ${l}`)
        for (const l of previous[kind]) if (!after.has(l)) console.log(`  - ${l}`)
      }
      console.log('Diff de la référence ci-dessus : à relire, et à committer AVEC la correction qui le motive.')
    }
    writeFileSync(BASELINE, JSON.stringify({
      note: 'Référence figée — voir l\'en-tête de textContrast.mjs. Mise à jour dans le MÊME COMMIT que la correction qui la motive ; c\'est le diff de ce fichier qui se relit. Jamais de régénération en bloc pour faire passer.',
      ...current,
    }, null, 2) + '\n')
    console.log(`Référence écrite : ${current.belowThreshold.length} sous le seuil, ${current.unmeasurable.length} non mesurables.`)
    process.exit(0)
  }

  if (!existsSync(BASELINE)) { console.error('Référence absente : lancer avec --update-baseline, puis relire.'); process.exit(1) }
  const baseline = JSON.parse(readFileSync(BASELINE, 'utf-8'))
  const strip = (line) => line.split(' — ')[0]
  let changed = 0
  for (const kind of ['belowThreshold', 'unmeasurable']) {
    const before = new Set(baseline[kind].map(strip))
    const now = new Map(current[kind].map((l) => [strip(l), l]))
    const added = [...now.keys()].filter((k) => !before.has(k))
    const removed = [...before].filter((k) => !now.has(k))
    const label = kind === 'belowThreshold' ? 'sous le seuil' : 'non mesurable'
    for (const k of added) console.log(`  ✗ NOUVEAU ${label} : ${now.get(k)}`)
    for (const k of removed) console.log(`  ✓ DISPARU (${label}) : ${k} — si c'est une correction, mettre à jour la référence DANS LE MÊME COMMIT`)
    changed += added.length + removed.length
  }
  console.log(`\n${current.belowThreshold.length} sous le seuil (référence : ${baseline.belowThreshold.length}) · ${current.unmeasurable.length} non mesurables (référence : ${baseline.unmeasurable.length})`)
  if (changed) {
    console.log(`BILAN : l'ensemble a CHANGÉ (${changed} ligne(s)). Seuil WCAG 1.4.3 : 4,5:1, 3:1 pour le grand texte. Corriger, ou — si c'est une correction voulue — régénérer avec --update-baseline et relire le diff.`)
    process.exit(1)
  }
  console.log('BILAN : conforme à la référence.')
  process.exit(0)
}
