import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ITEM_ICON_URL_PATTERN, MAX_NAMES_PER_REQUEST, MAX_QUERY_CHARS,
  itemIconUrl, uniqueNames, batchNames, cleanIcons,
} from '../../src/modules/itemIcons'
import { exportInventoryToBBCode } from '../../src/modules/inventoryBBcode'
import { fetchItemIcons, clearItemIconCache } from '../../src/use/itemIconsApi'
import { http } from '../../src/api.js'

/*
  Icônes d'items dans l'export BBCode (brief admin/content/brief-icones-items.md, phase 2). L'Office ne connaît que l'ID chez Celsius ;
  le site en tire une URL du CDN pour écrire un `[img]`, et rien d'autre : jamais une image dans l'interface (Greg, 13/11/2026).
*/
vi.mock('../../src/api.js', () => ({ http: { get: vi.fn() } }))

const src = resolve(dirname(fileURLToPath(import.meta.url)), '../../src')

beforeEach(() => {
  vi.clearAllMocks()
  clearItemIconCache()
})

describe('itemIconUrl — l\'URL du CDN de Celsius, construite à la volée', () => {
  it('remplace l\'ID dans le modèle', () => {
    expect(itemIconUrl(50)).toBe('https://lesroyaumes.cdn.oxv.fr/images/items/item50.png')
    expect(ITEM_ICON_URL_PATTERN).toContain('%d')
  })

  it('refuse tout ce qui n\'est pas un entier positif : l\'ID sert à écrire une URL', () => {
    for (const bad of [0, -1, 1.5, '50', null, undefined, NaN, '../x']) expect(itemIconUrl(bad)).toBeNull()
  })
})

describe('batchNames — jamais plus de 200 noms, jamais une URL trop longue', () => {
  it('écarte les doublons et les noms vides, garde l\'ordre', () => {
    expect(uniqueNames(['B', 'A', 'B', '', '  ', 'C'])).toEqual(['B', 'A', 'C'])
  })

  it('coupe par paquets de 200 au plus', () => {
    const names = Array.from({ length: 450 }, (_, i) => `N${i}`)
    const batches = batchNames(names)
    expect(batches.map(b => b.length)).toEqual([200, 200, 50])
    expect(batches.flat()).toEqual(names)
    expect(MAX_NAMES_PER_REQUEST).toBe(200)
  })

  it('coupe aussi sur la longueur de l\'URL, accents compris', () => {
    const names = Array.from({ length: 150 }, (_, i) => `Sacs de maïs très, très long ${i} ${'é'.repeat(30)}`)
    const batches = batchNames(names)
    expect(batches.length).toBeGreaterThan(1)
    for (const batch of batches) {
      const url = axios.getUri({ url: 'item-icons', params: { names: batch } })
      expect(url.length).toBeLessThanOrEqual(MAX_QUERY_CHARS + 20)
    }
    expect(batches.flat()).toEqual(names)
  })

  it('un nom seul passe toujours, même démesuré', () => {
    expect(batchNames(['x'.repeat(9000)])).toEqual([['x'.repeat(9000)]])
  })

  it('aucun nom : aucun lot', () => {
    expect(batchNames([])).toEqual([])
  })

  it('axios écrit bien names[]=… (le format que le serveur lit)', () => {
    const url = axios.getUri({ url: 'item-icons', params: { names: ['A', 'Sacs de maïs'] } })
    // axios écrit l'espace en « + » : PHP le relit comme une espace.
    expect(decodeURIComponent(url).replace(/\+/g, ' ')).toBe('item-icons?names[]=A&names[]=Sacs de maïs')
  })
})

describe('cleanIcons — la réponse du serveur ne passe pas telle quelle', () => {
  it('ne garde que des couples « nom → entier positif »', () => {
    expect(cleanIcons({ A: 50, B: '51', C: 0, D: -3, E: 1.5, F: null, G: '../x', H: 52 })).toEqual({ A: 50, H: 52 })
    expect(cleanIcons([])).toEqual({})
    expect(cleanIcons(null)).toEqual({})
    expect(cleanIcons('x')).toEqual({})
  })
})

describe('fetchItemIcons — la lecture publique, au moment de l\'export', () => {
  const reply = icons => Promise.resolve({ data: { success: true, icons } })

  it('demande les noms à `item-icons` sans jeton et rend les couples trouvés', async () => {
    http.get.mockImplementation(() => reply({ 'Miches de pain': 50 }))
    const out = await fetchItemIcons(['Miches de pain', 'Inconnu'])
    expect(out).toEqual({ 'Miches de pain': 50 })
    expect(http.get).toHaveBeenCalledTimes(1)
    expect(http.get).toHaveBeenCalledWith('item-icons', { params: { names: ['Miches de pain', 'Inconnu'] } })
  })

  it('envoie plusieurs lots pour plus de 200 noms', async () => {
    http.get.mockImplementation(() => reply({}))
    await fetchItemIcons(Array.from({ length: 401 }, (_, i) => `N${i}`))
    expect(http.get.mock.calls.map(c => c[1].params.names.length)).toEqual([200, 200, 1])
  })

  it('se souvient de la page : un second export ne refait aucune requête, sans icône comprise', async () => {
    http.get.mockImplementation(() => reply({ A: 1 }))
    await fetchItemIcons(['A', 'B'])
    http.get.mockClear()
    expect(await fetchItemIcons(['A', 'B'])).toEqual({ A: 1 })
    expect(http.get).not.toHaveBeenCalled()
  })

  it('ne redemande que les noms nouveaux', async () => {
    http.get.mockImplementation(() => reply({ A: 1, C: 3 }))
    await fetchItemIcons(['A', 'B'])
    http.get.mockClear()
    expect(await fetchItemIcons(['A', 'C'])).toEqual({ A: 1, C: 3 })
    expect(http.get.mock.calls[0][1].params.names).toEqual(['C'])
  })

  it('une réponse piégée ne laisse passer aucun ID douteux', async () => {
    http.get.mockImplementation(() => reply({ A: '1/../../x', B: 2 }))
    expect(await fetchItemIcons(['A', 'B'])).toEqual({ B: 2 })
  })

  it('lève l\'erreur réseau, sans rien mémoriser du lot qui a échoué', async () => {
    http.get.mockRejectedValueOnce(new Error('réseau'))
    await expect(fetchItemIcons(['A'])).rejects.toThrow('réseau')
    http.get.mockImplementation(() => reply({ A: 1 }))
    expect(await fetchItemIcons(['A'])).toEqual({ A: 1 })
  })
})

describe('exportInventoryToBBCode — le [img] dans le gras, devant le texte', () => {
  const items = [{ quantity: 175, name: 'Miches de pain' }, { quantity: 3, name: 'Cailloux' }]
  const opts = icons => ({
    categoryKeys: ['divers'],
    getCategoryLabel: () => 'Divers',
    options: { qtyFormat: 'suffix', ...(icons ? { icons } : {}) },
  })
  const run = icons => exportInventoryToBBCode(items, () => 'divers', opts(icons))

  it('sans icônes (réglage éteint ou aucune demande) : export identique à avant', () => {
    expect(run()).toBe(run({}))
    expect(run()).not.toContain('[img]')
    expect(run()).toContain('[*][b]Miches de pain (x175)[/b]')
  })

  it('un item qui a une icône reçoit son [img] dans le gras ; les autres restent sans rien', () => {
    const out = run({ 'Miches de pain': 50 })
    expect(out).toContain('[*][b][img]https://lesroyaumes.cdn.oxv.fr/images/items/item50.png[/img] Miches de pain (x175)[/b]')
    expect(out).toContain('[*][b]Cailloux (x3)[/b]')
    expect(out.match(/\[img\]/g)).toHaveLength(1)
  })

  it('fonctionne aussi avec le nombre devant', () => {
    const out = exportInventoryToBBCode(items, () => 'divers', {
      categoryKeys: ['divers'], getCategoryLabel: () => 'Divers', options: { qtyFormat: 'prefix', icons: { Cailloux: 7 } },
    })
    expect(out).toContain('[*][b][img]https://lesroyaumes.cdn.oxv.fr/images/items/item7.png[/img] 3 Cailloux[/b]')
  })

  it('un ID invalide ne s\'écrit jamais en URL', () => {
    expect(run({ 'Miches de pain': '50/../x' })).not.toContain('[img]')
  })
})

describe('garde-fou — aucune icône n\'est jamais chargée dans l\'interface (Greg, 13/11/2026)', () => {
  const walk = dir => readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })

  it('l\'adresse du CDN de Celsius n\'apparaît que dans modules/itemIcons.js', () => {
    const hits = walk(src)
      .filter(f => /\.(vue|js|json|css)$/.test(f))
      .filter(f => readFileSync(f, 'utf-8').includes('cdn.oxv.fr'))
      .map(f => f.slice(src.length + 1))
    expect(hits).toEqual(['modules/itemIcons.js'])
  })

  it('aucune vue ni aucun composant ne pose d\'image d\'item (ni `item-icons`, ni `itemIconUrl`, ni <img> du CDN)', () => {
    const offenders = walk(join(src, 'views'))
      .concat(walk(join(src, 'components')))
      .filter(f => f.endsWith('.vue'))
      .filter(f => {
        const text = readFileSync(f, 'utf-8')
        return text.includes('itemIconUrl') || text.includes('ITEM_ICON_URL_PATTERN') || /<img[^>]*(item-icons|icon_url|itemIcon)/i.test(text)
      })
      .map(f => f.slice(src.length + 1))
    expect(offenders).toEqual([])
  })
})
