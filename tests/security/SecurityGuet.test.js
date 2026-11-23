import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import { push } from 'notivue'
import SecurityGuet from '../../src/views/modules/security/SecurityGuet.vue'
import { useCookieStore } from '../../src/stores/cookieStore'
import { useAuthStore } from '../../src/stores/authStore'
import { http } from '../../src/api.js'

/*
  Le Relevé de guet — POINT DE COLLAGE UNIQUE du module Sécurité (fil admin/echanges/module-securite 12 à 14, 22/11/2026) : cinq types de collage, même
  écran, même parseur. Sans compte : tout se lit dans le navigateur, aucun appel au serveur, le dernier collage de chaque type est gardé avec le consentement
  « Préférences ». Avec un titre de sécurité : couleurs et dernier bilan de la ville (`customs-preview`, pseudos seulement), inscription au Registre.
  ⚠️ Aucune règle côté site : droits, villes et jours viennent de `customs-access`.
*/
vi.mock('notivue', () => ({ push: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../src/api.js', () => ({ http: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const fr = JSON.parse(readFileSync(resolve(localesDir, 'fr.json'), 'utf-8'))
const en = JSON.parse(readFileSync(resolve(localesDir, 'en.json'), 'utf-8'))
const read = path => readFileSync(resolve(process.cwd(), path), 'utf8')
const real = name => read(`tests/fixtures/customs/collage-${name}.txt`)

const fixture = read('tests/fixtures/Bug_ExportSorties.txt')
function extractBlock(text, startTag, endTag) {
  const start = text.indexOf(startTag) + startTag.length
  const end = text.indexOf(endTag)
  return text.slice(start, end).replace(/^\n/, '').replace(/\n$/, '')
}
const hier = extractBlock(fixture, '--- HIER_DEBUT ---', '--- HIER_FIN ---')
const aujourdhui = extractBlock(fixture, '--- AUJOURDHUI_DEBUT ---', '--- AUJOURDHUI_FIN ---')
const lines = block => extractBlock(fixture, `--- ${block}_ATTENDUES ---`, `--- ${block}_FIN ---`).split('\n').map(s => s.trim()).filter(Boolean)
const sortiesAttendues = lines('SORTIES')
const entreesAttendues = lines('ENTREES')

const ok = data => Promise.resolve({ data })
const refuse = (status, messages) => Promise.reject({ response: { status, data: { success: false, message: messages.fr, errors: { x: [messages.fr] }, messages: { x: messages } } } })

const CITIES = [{ id: 1, name: 'Arras' }, { id: 2, name: 'Béthune' }]
const ACCESS = (over = {}) => ({
  province: { id: 3, name: 'Artois' }, role: 'prevot_des_marechaux', has_security_trio: true, today: '2026-10-27', earliest_day: '2026-10-20',
  read_reports: true, write_reports: true, correct_reports: true, read_lists: true, write_lists: true, add_red_only: false,
  writable_cities: CITIES, readable_cities: CITIES, min_parser_version: 1, ...over,
})

let pinia
function serve({ access = null, preview = { success: true, today: '2026-10-27', colours: [], previous: null } } = {}) {
  http.get.mockImplementation(url => (url.endsWith('customs-access') ? ok({ success: true, access }) : ok({})))
  http.post.mockImplementation((url) => {
    if (url.endsWith('customs-preview')) return typeof preview === 'function' ? preview() : ok(preview)
    return ok({ success: true, mode: 'created' })
  })
}

// `again` : une SECONDE visite — le même magasin (consentement, stockage de confort), un nouvel écran.
async function mountGuet({ locale = 'fr', loggedIn = false, again = false, characterCity = null, ...options } = {}) {
  if (!again) pinia = createPinia()
  setActivePinia(pinia)
  if (loggedIn) useAuthStore().$patch({ user: { characters: [{ id: 7, pseudo: 'Artifice', city_id: characterCity }] }, token: 'jeton' })
  serve(options)
  const wrapper = mount(SecurityGuet, { global: { plugins: [pinia, createI18n({ legacy: false, locale, messages: { fr, en } })], stubs: { 'v-icon': true } }, attachTo: document.body })
  await flushPromises()
  return wrapper
}
const find = (w, id) => w.find(`[data-testid="${id}"]`)
const previewCalls = () => http.post.mock.calls.filter(([url]) => url.endsWith('customs-preview'))
const saveCalls = () => http.post.mock.calls.filter(([url]) => url.endsWith('customs-reports'))

async function fill(w, { yesterday, today, visions, armies } = {}) {
  if (yesterday !== undefined) await find(w, 'paste-yesterday').setValue(yesterday)
  if (today !== undefined) await find(w, 'paste-today').setValue(today)
  if (visions !== undefined) await find(w, 'paste-visions').setValue(visions)
  if (armies !== undefined) await find(w, 'paste-armies-groups').setValue(armies)
}
async function generate(w) {
  await find(w, 'guet-generate').trigger('click')
  await flushPromises()
}
const allArmies = lang => `${real(`armees-${lang}`)}\n\n${real(`groupes-${lang}`)}\n\n${real(`controle-zone-${lang}`)}`
const diffPseudos = (w, column) => w.findAll('[data-testid="guet-diff"] .grid > div')[column].findAll('[data-testid="customs-pseudo"]').map(n => n.text().replace(/\(.*\)/, '').trim())

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  document.body.innerHTML = ''
})

describe('Relevé de guet — visions copiées sans leur ligne de date (le journal du jeu sépare la date)', () => {
  const pasted = "Visions\nAujourd'hui, en chemin, vous avez croisé un groupe composé de Sheliss , de Yohanna. , de Sganamouche , de Roderick_alex et de Romaric_, Leely."

  it('elles sont comptées pour le jour du relevé, et l\'écran le dit (plus de « aucune vision de ce jour »)', async () => {
    const w = await mountGuet()
    await fill(w, { today: real('guet-fr'), visions: pasted })
    await generate(w)
    expect(w.findAll('[data-testid="guet-problem"]').map(p => p.text()).join(' ')).not.toContain('Aucune vision')
    expect(find(w, 'guet-visions-assumed').text()).toMatch(/^Visions collées sans date : elles sont comptées pour le /)
    expect(find(w, 'report-visions').exists()).toBe(true)
  })

  it('en anglais aussi, et avec un titre : le jour est celui du serveur', async () => {
    const en = await mountGuet({ locale: 'en', loggedIn: true, access: ACCESS() })
    await fill(en, { today: real('guet-en'), visions: 'Visions\nToday, on the road you met Elyas.' })
    await generate(en)
    expect(find(en, 'guet-visions-assumed').text()).toContain('Visions pasted without a date')
    expect(find(en, 'report-visions').exists()).toBe(true)
  })
})

describe('Relevé de guet — la ville proposée par défaut (Greg, 23/11/2026)', () => {
  it('c\'est la ville du personnage (douanier, maire…), pas la première de la liste', async () => {
    const w = await mountGuet({ loggedIn: true, access: ACCESS(), characterCity: 2 })
    expect(find(w, 'guet-city').element.value).toBe('2')
  })

  it('si cette ville n\'est pas lisible (ou inconnue), la première des villes lisibles', async () => {
    expect(find(await mountGuet({ loggedIn: true, access: ACCESS(), characterCity: 99 }), 'guet-city').element.value).toBe('1')
    expect(find(await mountGuet({ loggedIn: true, access: ACCESS(), characterCity: null }), 'guet-city').element.value).toBe('1')
  })
})

describe('Relevé de guet — présentation (fil module-securite 19, A1 à A5, 23/11/2026)', () => {
  it('A1 : un h1 « Relevé de guet » / « Watch Report »', async () => {
    expect(find(await mountGuet(), 'guet-title').element.tagName).toBe('H1')
    expect(find(await mountGuet(), 'guet-title').text()).toBe('Relevé de guet')
    expect(find(await mountGuet({ locale: 'en' }), 'guet-title').text()).toBe('Watch Report')
  })

  it('A2 : le bouton se nomme « Confier au scribe » (« Entrust to the scribe », l\'anglais déjà employé par les exports)', async () => {
    expect(find(await mountGuet(), 'guet-generate').text()).toBe('Confier au scribe')
    expect(find(await mountGuet({ locale: 'en' }), 'guet-generate').text()).toBe('Entrust to the scribe')
  })

  it('A3 et A4 : quatre libellés en `form-label`, chacun avec une seule phrase d\'aide', async () => {
    const w = await mountGuet()
    const labels = ['yesterday', 'today', 'visions', 'armies'].map(id => w.find(`label[for="guet-${id}"]`))
    expect(labels.map(l => l.text())).toEqual(['Liste du guet d\'hier', 'Liste du guet d\'aujourd\'hui', 'Visions', 'Armées et groupes'])
    for (const label of labels) {
      expect(label.classes()).toContain('form-label')
      expect(label.element.nextElementSibling.textContent).toMatch(/^Collez /)
    }
    expect(find(w, 'guet-intro').exists()).toBe(false) // la phrase d'introduction est supprimée (redondante avec les aides)
    const en = await mountGuet({ locale: 'en' })
    expect(en.find('label[for="guet-today"]').text()).toBe('Today\'s watch list')
  })

  it('libellés dans la couleur du module Sécurité (rose, comme le titre du menu), jamais en orange', async () => {
    const w = await mountGuet()
    // le titre aussi : le dégradé orange global du h1 est neutralisé
    expect(find(w, 'guet-title').classes()).toEqual(expect.arrayContaining(['bg-none', 'text-rose-600']))
    for (const id of ['yesterday', 'today', 'visions', 'armies']) {
      const classes = w.find(`label[for="guet-${id}"]`).classes()
      expect(classes).toContain('text-rose-700')
      expect(classes.join(' ')).not.toMatch(/orange/)
    }
  })

  it('« Pré-remplie automatiquement… » et « Retrouvé… » se lisent SOUS la zone de collage, pas entre le libellé et la zone', async () => {
    const w = await mountGuet()
    useCookieStore().consent.preferences = true
    await fill(w, { today: aujourdhui, visions: real('visions-fr'), armies: allArmies('fr') })
    await generate(w)

    const second = await mountGuet({ again: true })
    const under = (note, textarea) => {
      expect(note.exists()).toBe(true)
      expect(note.element.previousElementSibling).toBe(textarea.element)
    }
    under(find(second, 'yesterday-prefilled'), find(second, 'paste-yesterday'))
    under(find(second, 'visions-restored'), find(second, 'paste-visions'))
    under(find(second, 'armies-restored'), find(second, 'paste-armies-groups'))
    expect(find(second, 'yesterday-prefilled').text()).toBe('Pré-remplie automatiquement depuis votre dernière visite')
  })

  it('A5 : le mode douanier n\'apparaît que pour qui peut INSCRIRE au Registre (jamais sans titre, ni avec un titre de lecture seule)', async () => {
    const scribe = await mountGuet({ loggedIn: true, access: ACCESS() })
    expect(find(scribe, 'guet-customs-mode').element.previousElementSibling).toBe(find(scribe, 'guet-title').element) // à droite du titre
    expect(find(scribe, 'guet-customs-mode').text()).toBe('Mode douanier')
    expect(find(scribe, 'guet-customs-mode-detail').text()).toBe('Vos relevés seront colorisés et conservés dans le Registre de douane') // le détail, sous le titre
    expect(find(await mountGuet({ loggedIn: true, access: ACCESS(), locale: 'en' }), 'guet-customs-mode').text())
      .toBe('Customs mode')

    expect(find(await mountGuet(), 'guet-customs-mode').exists()).toBe(false) // sans compte
    expect(find(await mountGuet({ loggedIn: true, access: null }), 'guet-customs-mode').exists()).toBe(false) // aucun titre
    const reader = await mountGuet({ loggedIn: true, access: ACCESS({ write_reports: false, writable_cities: [], role: 'leader' }) })
    expect(find(reader, 'guet-customs-mode').exists()).toBe(false) // lecture seule : rien n'est conservé
  })
})

describe('Relevé de guet — le guet sur données réelles (préambule + tableau)', () => {
  async function result() {
    const w = await mountGuet()
    await fill(w, { yesterday: hier, today: aujourdhui })
    await generate(w)
    return w
  }

  it('détecte les bonnes entrées, sans pollution du préambule descriptif', async () => {
    const entrees = diffPseudos(await result(), 0)

    expect(entrees).toHaveLength(entreesAttendues.length)
    expect(entrees).toEqual(expect.arrayContaining(entreesAttendues))
  })

  it('détecte les bonnes sorties, sans doublon ni pseudo parasite du préambule', async () => {
    const sorties = diffPseudos(await result(), 1)

    expect(sorties).toHaveLength(sortiesAttendues.length)
    expect(sorties).toEqual(expect.arrayContaining(sortiesAttendues))
  })

  it('ignore les lignes du préambule et lie entrées et sorties à la fiche du personnage', async () => {
    const w = await result()
    const names = w.findAll('[data-testid="guet-diff"] [data-testid="customs-pseudo-link"]').map(a => a.text())

    for (const parasite of ['Le', 'La', 'Ils', "L'adjoint", 'Liste']) expect(names).not.toContain(parasite)
    expect(w.find('[data-testid="customs-pseudo-link"]').attributes('href')).toContain('https://www.renaissancekingdoms.com/FichePersonnage.php?login=')
  })

  it('sans compte : aucun appel au serveur, aucune couleur, et le différentiel dit qu\'il compare à la liste d\'hier', async () => {
    const w = await result()

    expect(previewCalls()).toHaveLength(0)
    expect(w.findAll('[data-colour="red"], [data-colour="green"]')).toHaveLength(0)
    expect(find(w, 'guet-diff').text()).toContain('Comparé à la liste d\'hier collée')
    expect(find(w, 'guet-registry-bar').exists()).toBe(false) // sans titre : ni encart ni note, le relevé se lit simplement
  })
})

describe('Relevé de guet — contrôle du total annoncé', () => {
  it('n\'alerte pas sur des collages complets', async () => {
    const w = await mountGuet()
    await fill(w, { yesterday: hier, today: aujourdhui })
    await generate(w)

    expect(w.find('[role="alert"]').exists()).toBe(false)
  })

  it('alerte quand « Liste des villageois (N) » ne colle pas aux lignes lues : hier et aujourd\'hui', async () => {
    const w = await mountGuet()
    await fill(w, { yesterday: 'Liste des villageois (3)\nA\t1PR\nB\t1PR', today: 'Liste des villageois (5)\nA\t1PR\nC\t1PR' })
    await generate(w)

    expect(find(w, 'yesterday-mismatch').text()).toContain('La liste d\'hier annonce 3 villageois, 2 ont été lus')
    expect(find(w, 'total-mismatch').text()).toContain('5')
  })
})

describe('Relevé de guet — les cinq types de collage, sans compte', () => {
  it('guet, visions, armées, groupes et contrôle de la zone : la même mise en forme que le Registre', async () => {
    const w = await mountGuet()
    await fill(w, { today: real('guet-fr'), visions: real('visions-fr'), armies: allArmies('fr') })
    await generate(w)

    expect(find(w, 'report-guet').exists()).toBe(true)
    expect(find(w, 'report-visions').exists()).toBe(true)
    expect(find(w, 'report-armies-groups').text()).toContain('Groupe à surveiller')
    expect(find(w, 'guet-result-title').text()).toMatch(/^Relevé du /)
    expect(previewCalls()).toHaveLength(0)
  })

  it('les visions d\'un journal de plusieurs jours : le jour le plus récent du collage, les autres comptés', async () => {
    const w = await mountGuet()
    await fill(w, { visions: real('visions-fr') })
    await generate(w)

    expect(find(w, 'report-visions').text()).toContain('11')
  })

  it('en anglais, les collages anglais se lisent de la même façon', async () => {
    const w = await mountGuet({ locale: 'en' })
    await fill(w, { today: real('guet-en'), visions: real('visions-en'), armies: allArmies('en') })
    await generate(w)

    expect(find(w, 'guet-result-title').text()).toMatch(/^Report of /)
    expect(find(w, 'report-guet').exists()).toBe(true)
    expect(find(w, 'report-armies-groups').exists()).toBe(true)
  })

  it('des collages illisibles sont signalés, rien n\'est inventé', async () => {
    const w = await mountGuet()
    await fill(w, { today: 'du texte quelconque', visions: 'rien', armies: 'rien non plus' })
    await generate(w)

    expect(w.findAll('[data-testid="guet-problem"]')).toHaveLength(3)
    expect(find(w, 'customs-report').exists()).toBe(false)
  })

  it('l\'export du guet garde son format historique (liste, entrées, sorties) et l\'export du bilan est à côté', async () => {
    const writeText = vi.fn()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const w = await mountGuet()
    await fill(w, { yesterday: hier, today: aujourdhui })
    await generate(w)
    await find(w, 'guet-export').trigger('click')

    expect(writeText).toHaveBeenCalledOnce()
    expect(writeText.mock.calls[0][0]).toContain('[size=15][color=blue][i]Entrées (')
    expect(writeText.mock.calls[0][0]).toContain('[char]')
    expect(find(w, 'customs-export').text()).toContain('Bilan de défense en BBCode')
  })
})

describe('Relevé de guet — le dernier collage de chaque type (stockage « Préférences »)', () => {
  it('sans consentement : rien n\'est gardé (le Relevé fonctionne quand même)', async () => {
    const w = await mountGuet()
    await fill(w, { today: aujourdhui, visions: real('visions-fr'), armies: allArmies('fr') })
    await generate(w)

    const second = await mountGuet() // une vraie seconde visite : nouvelle page, rien dans le stockage local
    expect(find(second, 'paste-yesterday').element.value).toBe('')
    expect(find(second, 'paste-visions').element.value).toBe('')
    expect(find(second, 'paste-armies-groups').element.value).toBe('')
    expect(second.find('.italic').exists()).toBe(false)
  })

  it('avec consentement : la liste du jour revient comme « liste d\'hier », visions et armées reviennent marquées « retrouvé »', async () => {
    const w = await mountGuet()
    useCookieStore().consent.preferences = true
    await fill(w, { today: aujourdhui, visions: real('visions-fr'), armies: allArmies('fr') })
    await generate(w)

    const second = await mountGuet({ again: true })

    expect(find(second, 'paste-yesterday').element.value).toBe(aujourdhui)
    expect(second.text()).toContain('Pré-remplie automatiquement depuis votre dernière visite')
    expect(find(second, 'paste-visions').element.value).toBe(real('visions-fr'))
    expect(find(second, 'visions-restored').exists()).toBe(true)
    expect(find(second, 'armies-restored').exists()).toBe(true)
  })

  it('un nouveau collage REMPLACE l\'ancien, jamais d\'historique', async () => {
    const w = await mountGuet()
    useCookieStore().consent.preferences = true
    await fill(w, { visions: 'premier collage' })
    await generate(w)
    await fill(w, { visions: 'second collage' })
    await generate(w)

    expect(useCookieStore().getComfortData('guet_last_visions')).toBe('second collage')
  })

  it('un collage vide n\'efface pas le dernier gardé', async () => {
    const w = await mountGuet()
    useCookieStore().consent.preferences = true
    await fill(w, { visions: 'gardé' })
    await generate(w)
    await fill(w, { visions: '' })
    await generate(w)

    expect(useCookieStore().getComfortData('guet_last_visions')).toBe('gardé')
  })
})

describe('Relevé de guet — avec un titre de sécurité', () => {
  const PREVIEW_COLOURS = { success: true, today: '2026-10-27', colours: [{ pseudo: 'Matt_hurst', colour: 'red' }], previous: null }

  it('le serveur dit la ville ; les pseudos (et seulement eux) partent pour être colorés, rien n\'est écrit', async () => {
    const w = await mountGuet({ loggedIn: true, access: ACCESS(), preview: PREVIEW_COLOURS })
    await fill(w, { today: real('guet-fr'), visions: real('visions-fr') })
    await generate(w)

    expect(previewCalls()).toHaveLength(1)
    const [url, body] = previewCalls()[0]
    expect(url).toBe('characters/7/customs-preview')
    expect(body.city_id).toBe(1)
    expect(body.pseudos.length).toBeGreaterThan(45)
    expect(body.pseudos.every(p => typeof p === 'string' && !/\s/.test(p))).toBe(true)
    expect(Object.keys(body).sort()).toEqual(['city_id', 'pseudos']) // jamais un texte collé
    expect(saveCalls()).toHaveLength(0)
  })

  it('les couleurs revenues se posent, le sens est dit par le texte', async () => {
    const w = await mountGuet({ loggedIn: true, access: ACCESS(), preview: PREVIEW_COLOURS })
    await fill(w, { visions: real('visions-fr') })
    await generate(w)

    const red = w.findAll('[data-colour="red"]')
    expect(red.length).toBeGreaterThan(0)
    expect(red[0].text()).toContain('liste rouge')
    expect(find(w, 'guet-result-title').text()).toContain('Arras')
  })

  it('le dernier bilan de la ville PRIME sur la liste d\'hier collée et dit lequel', async () => {
    const preview = { success: true, today: '2026-10-27', colours: [], previous: { compared_to: '2026-10-26', pseudos: ['Alpha', 'Gamma'] } }
    const w = await mountGuet({ loggedIn: true, access: ACCESS(), preview })
    await fill(w, { yesterday: 'Liste des villageois (1)\nZed\t1PR', today: 'Liste des villageois (2)\nAlpha\t1PR\nBeta\t1PR' })
    await generate(w)

    expect(find(w, 'guet-diff').text()).toContain('Comparé au bilan du 26/10/1474')
    expect(diffPseudos(w, 0)).toEqual(['Beta'])
    expect(diffPseudos(w, 1)).toEqual(['Gamma'])
  })

  it('un titre de lecture sans ville (juge) : les couleurs seulement, pas de ville dans la demande', async () => {
    const w = await mountGuet({ loggedIn: true, access: ACCESS({ read_reports: false, write_reports: false, correct_reports: false, readable_cities: [], writable_cities: [], role: 'juge' }), preview: PREVIEW_COLOURS })
    await fill(w, { today: 'Liste des villageois (1)\nMatt_hurst\t1PR' })
    await generate(w)

    expect(previewCalls()[0][1].city_id).toBeUndefined()
    expect(w.find('[data-testid="guet-city"]').exists()).toBe(false)
    expect(find(w, 'guet-registry-bar').exists()).toBe(false) // rien à choisir : pas d'encart vide
  })

  it('un simple joueur avec compte (aucun titre) : mode sans compte, aucun appel de couleurs', async () => {
    const w = await mountGuet({ loggedIn: true, access: null })
    await fill(w, { today: real('guet-fr') })
    await generate(w)

    expect(previewCalls()).toHaveLength(0)
    expect(find(w, 'guet-registry-bar').exists()).toBe(false)
    expect(find(w, 'guet-save-box').exists()).toBe(false)
  })

  it('une panne ou un refus de l\'appel de couleurs ne bloque pas le relevé, et se dit', async () => {
    const preview = () => refuse(422, { fr: 'Aucun titre reconnu.', en: 'No recognised title.' })
    const w = await mountGuet({ loggedIn: true, access: ACCESS(), preview, locale: 'en' })
    await fill(w, { today: real('guet-en') })
    await generate(w)

    expect(find(w, 'report-guet').exists()).toBe(true)
    expect(find(w, 'guet-preview-error').text()).toContain('No recognised title.')
  })

  it('le jour : seuls prévôt et connétable choisissent (du plus ancien permis à aujourd\'hui, dits par le serveur)', async () => {
    const w = await mountGuet({ loggedIn: true, access: ACCESS() })
    const options = w.findAll('[data-testid="guet-day"] option').map(o => o.element.value)

    expect(options[0]).toBe('2026-10-27')
    expect(options).toContain('2026-10-20')
    expect(options).not.toContain('2026-10-19')

    const capitaine = await mountGuet({ loggedIn: true, access: ACCESS({ correct_reports: false, role: 'capitaine' }) })
    expect(capitaine.find('[data-testid="guet-day"]').exists()).toBe(false)
  })

  it('les visions sont filtrées sur le jour que le SERVEUR annonce, pas sur le plus récent du collage', async () => {
    const w = await mountGuet({ loggedIn: true, access: ACCESS() }) // today = 2026-10-27
    await fill(w, { visions: real('visions-fr') })
    await generate(w)

    expect(find(w, 'report-visions').text()).toContain('10') // 10 lignes d'autres jours, 2 du 27/10 gardées
  })
})

describe('Relevé de guet — inscription au Registre de douane', () => {
  async function ready(options = {}) {
    const w = await mountGuet({ loggedIn: true, access: ACCESS(), ...options })
    await fill(w, { today: real('guet-fr') })
    await generate(w)
    return w
  }

  it('la ville et le jour sont DITS avant l\'envoi ; le bilan part avec l\'analyse et le brut gardé, sans date pour le jour en cours', async () => {
    const w = await ready()

    expect(find(w, 'guet-save-target').text()).toBe('Le bilan sera inscrit pour Arras, le 27/10/1474.')
    await find(w, 'guet-save').trigger('click')
    await flushPromises()

    const [url, body] = saveCalls()[0]
    expect(url).toBe('characters/7/customs-reports')
    expect(body.city_id).toBe(1)
    expect(body.date).toBeUndefined()
    expect(body.sections.guet.report.villagers).toHaveLength(45)
    expect(body.sections.guet.raw.split('\n')).toHaveLength(46)
    expect(body.sections.guet.raw).not.toContain('Le maire est')
    expect(push.success).toHaveBeenCalledWith('Le bilan est inscrit au registre.')
  })

  it('un jour passé choisi par le prévôt envoie sa date', async () => {
    const w = await ready()
    await find(w, 'guet-day').setValue('2026-10-22')
    await find(w, 'guet-save').trigger('click')
    await flushPromises()

    expect(saveCalls()[0][1].date).toBe('2026-10-22')
  })

  it('un collage RETROUVÉ d\'une visite précédente n\'est jamais inscrit tant qu\'il n\'est pas modifié', async () => {
    const first = await mountGuet({ loggedIn: true, access: ACCESS() })
    useCookieStore().consent.preferences = true
    await fill(first, { today: real('guet-fr'), armies: allArmies('fr') })
    await generate(first)

    const w = await mountGuet({ loggedIn: true, access: ACCESS(), again: true })
    await fill(w, { today: real('guet-fr') })
    await generate(w)
    expect(find(w, 'armies-restored').exists()).toBe(true)
    expect(find(w, 'guet-save-restored').exists()).toBe(true)

    await find(w, 'guet-save').trigger('click')
    await flushPromises()
    expect(Object.keys(saveCalls()[0][1].sections)).toEqual(['guet']) // pas les armées/groupes retrouvés

    await find(w, 'paste-armies-groups').setValue(allArmies('fr')) // retouché : l'inscrire redevient permis
    await find(w, 'paste-armies-groups').trigger('input')
    await find(w, 'guet-save').trigger('click')
    await flushPromises()
    expect(Object.keys(saveCalls()[1][1].sections)).toEqual(['guet', 'armies_groups'])
  })

  it('un refus du serveur s\'affiche tel quel, dans la langue de l\'interface, et les collages restent', async () => {
    const w = await ready({ locale: 'en' })
    http.post.mockImplementation(url => (url.endsWith('customs-reports') ? refuse(422, { fr: 'Un bilan existe déjà.', en: 'A report already exists.' }) : ok({ success: true, colours: [], previous: null })))
    await find(w, 'guet-save').trigger('click')
    await flushPromises()

    expect(push.error).toHaveBeenCalledWith('A report already exists.')
    expect(find(w, 'paste-today').element.value).toContain('Liste des villageois')
  })

  it('qui ne fait que lire (dirigeant) ou ne saisit pas dans cette ville (maire d\'une autre) n\'a pas le bouton', async () => {
    const reader = await ready({ access: ACCESS({ write_reports: false, correct_reports: false, role: 'leader', writable_cities: [] }) })
    expect(find(reader, 'guet-save-box').exists()).toBe(false)

    const mayor = await ready({ access: ACCESS({ correct_reports: false, role: 'mayor', writable_cities: [CITIES[0]] }) })
    await find(mayor, 'guet-city').setValue(2)
    await generate(mayor)
    expect(find(mayor, 'guet-save-box').exists()).toBe(false)
  })

  it('sans titre : aucun bouton d\'inscription', async () => {
    const w = await mountGuet()
    await fill(w, { today: real('guet-fr') })
    await generate(w)

    expect(find(w, 'guet-save-box').exists()).toBe(false)
  })
})
