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

  Usage : node tests/browser/textContrast.mjs <baseURL> [cheminChrome]
  (build de prod servi par `vite preview` ; API simulée, aucune requête ne part vers la prod).
*/
import { chromium } from 'playwright-core'

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

if (import.meta.url === `file://${process.argv[1]}`) {
  const [baseURL, executablePath] = process.argv.slice(2)
  const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox'] })
  let failures = 0
  const unmeasurable = new Set()
  try {
    for (const theme of THEMES) for (const path of PUBLIC_PAGES) {
      const results = await auditPage(browser, baseURL, path, theme)
      const fails = results.filter((r) => r.status === 'fail')
      failures += fails.length
      for (const u of results.filter((r) => r.status === 'unmeasurable')) unmeasurable.add(`${u.element} « ${u.text} » — ${u.reason}`)
      console.log(`${theme.padEnd(5)} ${path.padEnd(18)} ${results.length} textes · ${fails.length} sous le seuil`)
      for (const f of fails) console.log(`      ✗ ${f.ratio}:1 < ${f.threshold}:1  ${f.color} sur ${f.background}  ${f.size}px${f.large ? ' (grand)' : ''}  ${f.element} « ${f.text} »`)
    }
  } finally {
    await browser.close()
  }
  console.log(`\nNon mesurables (${unmeasurable.size}), à vérifier autrement :`)
  for (const u of unmeasurable) console.log(`   · ${u}`)
  console.log(`\nBILAN : ${failures} texte(s) sous le seuil`)
  process.exit(failures ? 1 : 0)
}
