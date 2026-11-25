import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
  Le Relevé de guet — POINT DE COLLAGE UNIQUE du module Sécurité (22/11/2026) : cinq types de collage, même
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
function serve({ access = null, preview = { success: true, today: '2026-10-27', colours: [], previous: null }, reports = null } = {}) {
  http.get.mockImplementation((url) => {
    if (url.endsWith('customs-access')) return ok({ success: true, access })
    if (url.endsWith('customs-reports')) return typeof reports === 'function' ? reports() : ok({ success: true, days: [], report: reports })
    return ok({})
  })
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
// « Confier au scribe » est l'EXPORT (Greg, 23/11/2026) : le bilan n'est plus affiché dans le Relevé, on lit le message pour le forum.
let writeText
const bbcode = () => writeText.mock.calls.at(-1)?.[0] ?? ''
const chars = (text, label) => {
  const at = text.indexOf(label)
  const quote = text.slice(at).match(/\[quote\]([\s\S]*?)\[\/quote\]/)
  return quote ? [...quote[1].matchAll(/\[char\]([^[]+)\[\/char\]/g)].map(m => m[1]) : []
}
const diffPseudos = (w, column) => chars(bbcode(w), column === 0 ? 'Arrivées (' : 'Départs (')

afterEach(() => vi.useRealTimers())

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  document.body.innerHTML = ''
  writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
})

describe('Relevé de guet — visions copiées sans leur ligne de date (le journal du jeu sépare la date)', () => {
  const pasted = "Visions\nAujourd'hui, en chemin, vous avez croisé un groupe composé de Sheliss , de Yohanna. , de Sganamouche , de Roderick_alex et de Romaric_, Leely."

  it('elles sont comptées pour le jour du relevé, et l\'écran le dit (plus de « aucune vision de ce jour »)', async () => {
    const w = await mountGuet()
    await fill(w, { today: real('guet-fr'), visions: pasted })
    await generate(w)
    expect(w.findAll('[data-testid="guet-problem"]').map(p => p.text()).join(' ')).not.toContain('Aucune vision')
    expect(bbcode(w)).toContain('Visions en chemin')
  })

  it('en anglais aussi, et avec un titre : le jour est celui du serveur', async () => {
    const en = await mountGuet({ locale: 'en', loggedIn: true, access: ACCESS() })
    await fill(en, { today: real('guet-en'), visions: 'Visions\nToday, on the road you met Elyas.' })
    await generate(en)
    expect(bbcode(en)).toContain('Visions en chemin')
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
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-22T12:00:00Z'))
    const w = await mountGuet()
    useCookieStore().consent.preferences = true
    await fill(w, { today: aujourdhui, visions: real('visions-fr'), armies: allArmies('fr') })
    await generate(w)

    vi.setSystemTime(new Date('2026-11-23T12:00:00Z')) // le lendemain : la liste d'hier et les armées sont « retrouvées » ; les visions repartent VIDES
    const second = await mountGuet({ again: true })
    const under = (note, textarea) => {
      expect(note.exists()).toBe(true)
      expect(note.element.previousElementSibling).toBe(textarea.element)
    }
    under(find(second, 'yesterday-prefilled'), find(second, 'paste-yesterday'))
    expect(find(second, 'visions-restored').exists()).toBe(false)
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

  it('ignore les lignes du préambule : aucun parasite dans les entrées ni les sorties exportées', async () => {
    const w = await result()
    const names = [...diffPseudos(w, 0), ...diffPseudos(w, 1)]

    for (const parasite of ['Le', 'La', 'Ils', "L'adjoint", 'Liste']) expect(names).not.toContain(parasite)
    expect(bbcode(w)).toContain('[char]') // les pseudos sont des balises du jeu, qui portent leur propre lien
  })

  it('sans compte : aucun appel au serveur, aucune couleur, et le différentiel dit qu\'il compare à la liste d\'hier', async () => {
    const w = await result()

    expect(previewCalls()).toHaveLength(0)
    expect(bbcode(w)).not.toMatch(/liste rouge|liste verte/)
    expect(bbcode(w)).toContain('Comparé à la liste d\'hier')
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
    expect(bbcode(w)).toContain('Le collage annonçait 5 villageois')
  })
})

describe('Relevé de guet — les cinq types de collage, sans compte', () => {
  it('guet, visions, armées, groupes et contrôle de la zone : la même mise en forme que le Registre', async () => {
    const w = await mountGuet()
    await fill(w, { today: real('guet-fr'), visions: real('visions-fr'), armies: allArmies('fr') })
    await generate(w)

    expect(bbcode(w)).toContain('Habitants (')
    expect(bbcode(w)).toContain('Visions en chemin')
    expect(bbcode(w)).toContain('Groupe à surveiller')
    expect(bbcode(w)).not.toContain('Admission libre') // le détail d'un groupe n'est pas exporté
    expect(previewCalls()).toHaveLength(0)
  })

  it('les visions d\'un journal de plusieurs jours : le jour le plus récent du collage, les autres comptés', async () => {
    const w = await mountGuet()
    await fill(w, { visions: real('visions-fr') })
    await generate(w)

    expect(bbcode(w)).toContain('Visions en chemin') // le jour le plus récent du collage ; les autres jours ne sont pas exportés
  })

  it('en anglais, les collages anglais se lisent de la même façon', async () => {
    const w = await mountGuet({ locale: 'en' })
    await fill(w, { today: real('guet-en'), visions: real('visions-en'), armies: allArmies('en') })
    await generate(w)

    expect(bbcode(w)).toContain('Habitants (') // le BBCode du forum est en français fixe, même interface en anglais
    expect(bbcode(w)).toContain('Armées')
  })

  it('des collages illisibles sont signalés, rien n\'est inventé', async () => {
    const w = await mountGuet()
    await fill(w, { today: 'du texte quelconque', visions: 'rien', armies: 'rien non plus' })
    await generate(w)

    expect(w.findAll('[data-testid="guet-problem"]')).toHaveLength(3)
    expect(writeText).not.toHaveBeenCalled() // rien à exporter, rien de copié
  })

  it('« Confier au scribe » EST l\'export : le message est copié, sans second bouton ni affichage du bilan', async () => {
    const w = await mountGuet()
    await fill(w, { yesterday: hier, today: aujourdhui })
    await generate(w)

    expect(writeText).toHaveBeenCalledOnce()
    expect(writeText.mock.calls[0][0]).toContain('[b][size=20]Relevé de défense de la nuit du ')
    expect(push.success).toHaveBeenCalledWith('Le bilan est copié, prêt à coller sur le forum.')
    for (const gone of ['guet-export', 'customs-export', 'report-guet', 'guet-diff', 'guet-bbcode', 'guet-result-title']) expect(find(w, gone).exists()).toBe(false)
  })

  it('si la copie échoue, le message est montré pour être copié à la main', async () => {
    writeText.mockRejectedValue(new Error('refusé'))
    const w = await mountGuet()
    await fill(w, { yesterday: hier, today: aujourdhui })
    await generate(w)

    expect(find(w, 'guet-copy-failed').text()).toContain('La copie n\'a pas abouti')
    expect(find(w, 'guet-bbcode').element.value).toContain('Relevé de défense de la nuit du ')
    expect(push.success).not.toHaveBeenCalled()
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

  it('avec consentement, au rechargement le MÊME jour : visions et armées reviennent remplies (elles sont d\'aujourd\'hui, pas « retrouvées ») ; la liste d\'AUJOURD\'HUI ne se fait plus passer pour celle d\'hier', async () => {
    const w = await mountGuet()
    useCookieStore().consent.preferences = true
    await fill(w, { today: aujourdhui, visions: real('visions-fr'), armies: allArmies('fr') })
    await generate(w)

    const second = await mountGuet({ again: true }) // rechargement le MÊME jour

    expect(find(second, 'paste-yesterday').element.value).toBe('') // aucune liste d'hier n'a été collée : rien à proposer
    expect(find(second, 'paste-today').element.value).toBe(aujourdhui) // celle d'aujourd'hui revient dans SA case
    expect(find(second, 'yesterday-prefilled').exists()).toBe(false)
    expect(find(second, 'paste-visions').element.value).toBe(real('visions-fr'))
    expect(find(second, 'visions-restored').exists()).toBe(false)
    expect(find(second, 'armies-restored').exists()).toBe(false)
  })

  it('un collage RETROUVÉ (armées, groupes, zone) n\'est pas réenregistré sous le jour d\'aujourd\'hui par « Confier au scribe » (sinon il deviendrait inscriptible au rechargement)', async () => {
    const first = await mountGuet()
    useCookieStore().consent.preferences = true
    useCookieStore().setComfortData('guet_last_armies_groups', 'ancienne forme, sans jour') // gardé avant les jours
    const w = await mountGuet({ again: true })
    expect(find(w, 'armies-restored').exists()).toBe(true)
    await fill(w, { today: real('guet-fr') })
    await generate(w)

    expect(useCookieStore().getComfortData('guet_last_armies_groups')).toBe('ancienne forme, sans jour')
    expect(first).toBeTruthy()
  })

  it('les VISIONS sont celles d\'une nuit : la case repart VIDE chaque jour (Greg, 24/11/2026), la reprise d\'un autre jour est effacée ; celle du jour revient', async () => {
    const store = () => useCookieStore()
    const first = await mountGuet()
    store().consent.preferences = true
    store().setComfortData('guet_last_visions', { day: '2020-01-01', text: 'visions de la veille' })
    store().setComfortData('guet_last_armies_groups', { day: '2020-01-01', text: 'armées de la veille' })
    const w = await mountGuet({ again: true })

    expect(find(w, 'paste-visions').element.value).toBe('') // vide : celles de la veille ne servent à rien
    expect(find(w, 'visions-restored').exists()).toBe(false)
    expect(store().getComfortData('guet_last_visions')).toBeNull() // effacée, pas gardée pour rien
    expect(find(w, 'paste-armies-groups').element.value).toBe('armées de la veille') // les groupes : comme avant
    expect(find(w, 'armies-restored').exists()).toBe(true)
    expect(first).toBeTruthy()
  })

  describe('les listes gardées par jour (Greg, 23/11/2026)', () => {
    const at = iso => vi.setSystemTime(new Date(iso))
    beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }))
    afterEach(() => vi.useRealTimers())

    it('la liste collée hier revient comme « liste d\'hier » toute la journée, même après avoir collé celle d\'aujourd\'hui et recharge', async () => {
      at('2026-11-22T12:00:00Z')
      const monday = await mountGuet()
      useCookieStore().consent.preferences = true
      await fill(monday, { today: hier })
      await generate(monday)

      at('2026-11-23T12:00:00Z') // le lendemain : la liste d'hier est celle gardée sous le jour d'hier
      const tuesday = await mountGuet({ again: true })
      expect(find(tuesday, 'paste-yesterday').element.value).toBe(hier)
      expect(find(tuesday, 'yesterday-prefilled').text()).toBe('Pré-remplie automatiquement depuis votre dernière visite')

      await fill(tuesday, { today: aujourdhui })
      await generate(tuesday) // coller celle d'aujourd'hui n'écrase pas celle d'hier

      const reloaded = await mountGuet({ again: true })
      expect(find(reloaded, 'paste-yesterday').element.value).toBe(hier)
    })

    it('le surlendemain, la liste d\'avant-hier est effacée ; seules aujourd\'hui et hier restent', async () => {
      at('2026-11-21T12:00:00Z')
      const first = await mountGuet()
      useCookieStore().consent.preferences = true
      await fill(first, { today: hier })
      await generate(first)
      at('2026-11-22T12:00:00Z')
      await fill(await mountGuet({ again: true }), { today: aujourdhui })

      at('2026-11-24T12:00:00Z') // trois jours après la première : seule la dernière est encore d'hier ou d'aujourd'hui
      const w = await mountGuet({ again: true })
      expect(Object.keys(useCookieStore().getComfortData('guet_lists', {})).length).toBeLessThanOrEqual(2)
      expect(find(w, 'paste-yesterday').element.value).toBe('') // celle du 21 est trop vieille, rien n'a été collé le 23
    })

    it('l\'ancienne clé `guet_last_list` (une liste sans jour) est abandonnée : on ne sait plus de quel jour elle est', async () => {
      at('2026-11-23T12:00:00Z')
      const w = await mountGuet()
      useCookieStore().consent.preferences = true
      useCookieStore().setComfortData('guet_last_list', hier)
      const second = await mountGuet({ again: true })

      expect(find(second, 'paste-yesterday').element.value).toBe('')
      expect(useCookieStore().getComfortData('guet_last_list')).toBeNull()
      expect(w).toBeTruthy()
    })
  })

  it('un nouveau collage REMPLACE l\'ancien, jamais d\'historique', async () => {
    const w = await mountGuet()
    useCookieStore().consent.preferences = true
    await fill(w, { visions: 'premier collage' })
    await generate(w)
    await fill(w, { visions: 'second collage' })
    await generate(w)

    expect(useCookieStore().getComfortData('guet_last_visions').text).toBe('second collage')
  })

  it('un collage vide n\'efface pas le dernier gardé', async () => {
    const w = await mountGuet()
    useCookieStore().consent.preferences = true
    await fill(w, { visions: 'gardé' })
    await generate(w)
    await fill(w, { visions: '' })
    await generate(w)

    expect(useCookieStore().getComfortData('guet_last_visions').text).toBe('gardé')
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

    expect(bbcode(w)).toContain('Matt_hurst') // la marque rouge se lit dans le message
    expect(bbcode(w)).toContain('⚠')
    expect(bbcode(w)).toContain('Ville : Arras')
  })

  it('le dernier bilan de la ville PRIME sur la liste d\'hier collée et dit lequel', async () => {
    const preview = { success: true, today: '2026-10-27', colours: [], previous: { compared_to: '2026-10-26', pseudos: ['Alpha', 'Gamma'] } }
    const w = await mountGuet({ loggedIn: true, access: ACCESS(), preview })
    await fill(w, { yesterday: 'Liste des villageois (1)\nZed\t1PR', today: 'Liste des villageois (2)\nAlpha\t1PR\nBeta\t1PR' })
    await generate(w)

    expect(bbcode(w)).toContain('Comparé au bilan du 26/10/1474')
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

    expect(bbcode(w)).toContain('Habitants (')
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

    expect(bbcode(w)).toContain('Visions en chemin') // seules les 2 lignes du 27/10 (jour du serveur) sont gardées
  })
})

describe('Relevé de guet — inscription au Registre de douane', () => {
  async function ready(options = {}) {
    const w = await mountGuet({ loggedIn: true, access: ACCESS(), ...options })
    await fill(w, { today: real('guet-fr') })
    await generate(w)
    return w
  }

  it('la plaque d\'inscription est à droite du bouton « Confier au scribe », dans la même ligne ; son bouton est inactif tant qu\'il n\'y a rien à inscrire', async () => {
    const w = await mountGuet({ loggedIn: true, access: ACCESS() })
    const plate = find(w, 'guet-save-box')
    expect(plate.exists()).toBe(true) // ville et jour sont connus avant même de coller
    expect(find(w, 'guet-generate').element.nextElementSibling).toBe(plate.element)
    expect(find(w, 'guet-save').attributes('disabled')).toBeDefined()

    await fill(w, { today: real('guet-fr') })
    expect(find(w, 'guet-save').attributes('disabled')).toBeUndefined()
  })

  it('après l\'inscription, la plaque se scelle (parchemin et coche) et dit quoi', async () => {
    const w = await ready()
    expect(find(w, 'guet-sealed').exists()).toBe(false)
    await find(w, 'guet-save').trigger('click')
    await flushPromises()

    expect(find(w, 'guet-sealed').text()).toContain('Inscrit au registre')
    expect(find(w, 'guet-sealed').text()).toContain('Arras')
  })

  it('la ville et le jour sont DITS avant l\'envoi ; le bilan part avec l\'analyse et le brut gardé, sans date pour le jour en cours', async () => {
    const w = await ready()

    expect(find(w, 'guet-save-target').text()).toContain('Arras')
    expect(find(w, 'guet-save-target').text()).toContain('27/10/1474')
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

  it('des armées collées plus tôt AUJOURD\'HUI et retrouvées au rechargement sont inscrites avec le reste', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-27T12:00:00Z')) // le jour du serveur de ACCESS()
    const first = await mountGuet({ loggedIn: true, access: ACCESS() })
    useCookieStore().consent.preferences = true
    await fill(first, { today: real('guet-fr'), armies: allArmies('fr') })
    await generate(first)

    const w = await mountGuet({ loggedIn: true, access: ACCESS(), again: true })
    await fill(w, { today: real('guet-fr') })
    await find(w, 'guet-save').trigger('click')
    await flushPromises()

    expect(find(w, 'armies-restored').exists()).toBe(false)
    expect(Object.keys(saveCalls()[0][1].sections)).toEqual(['guet', 'armies_groups'])
  })

  it('un collage RETROUVÉ d\'un AUTRE jour est inscrit TEL QUEL, sans avoir à le modifier (Greg, 23/11/2026)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-26T12:00:00Z'))
    const first = await mountGuet({ loggedIn: true, access: ACCESS({ today: '2026-10-26', earliest_day: '2026-10-26' }) })
    useCookieStore().consent.preferences = true
    await fill(first, { today: real('guet-fr'), armies: allArmies('fr') })
    await generate(first)

    vi.setSystemTime(new Date('2026-10-27T12:00:00Z')) // le lendemain
    const w = await mountGuet({ loggedIn: true, access: ACCESS(), again: true })
    await fill(w, { today: real('guet-fr') })
    expect(find(w, 'armies-restored').exists()).toBe(true) // la mention dit qu'il est retrouvé…
    await find(w, 'guet-save').trigger('click')
    await flushPromises()

    expect(Object.keys(saveCalls()[0][1].sections)).toEqual(['guet', 'armies_groups']) // …et il part quand même
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

describe('Relevé de guet — un relevé de ce jour existe déjà (Greg, 24/11/2026)', () => {
  const REPORT = (over = {}) => ({ id: 5, city_id: 1, reported_on: '2026-10-27', sections: {}, sections_present: ['guet', 'armies_groups'], by_me: true, can_complete: true, can_correct: false, ...over })
  const reportCalls = () => http.get.mock.calls.filter(([url]) => url.endsWith('customs-reports'))

  it('le bandeau le dit SIMPLEMENT, au-dessus des cases de collage et hors de la plaque d\'inscription', async () => {
    const w = await mountGuet({ loggedIn: true, access: ACCESS(), reports: REPORT() })

    expect(reportCalls()[0][0]).toBe('characters/7/customs-reports')
    expect(reportCalls()[0][1].params).toEqual({ city_id: 1, date: '2026-10-27' })
    expect(find(w, 'guet-existing').text()).toBe('Un relevé du 27/10/1474 existe déjà pour cette ville.')
    expect(find(w, 'guet-save-box').element.contains(find(w, 'guet-existing').element)).toBe(false)
    expect(find(w, 'guet-existing').element.compareDocumentPosition(find(w, 'paste-yesterday').element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy() // avant les cases
    expect(find(w, 'guet-existing').text()).not.toMatch(/guet|visions|armées|Artifice|auteur/i) // ni détail, ni auteur
  })

  it('aucun relevé ce jour-là, ou aucun droit de lecture : rien n\'est dit, l\'inscription reste possible', async () => {
    expect(find(await mountGuet({ loggedIn: true, access: ACCESS(), reports: null }), 'guet-existing').exists()).toBe(false)

    const refused = () => refuse(403, { fr: 'Refusé.', en: 'Refused.' })
    const w = await mountGuet({ loggedIn: true, access: ACCESS(), reports: refused })
    expect(find(w, 'guet-existing').exists()).toBe(false)
    expect(find(w, 'guet-save-box').exists()).toBe(true)
  })

  it('sans compte ou sans droit d\'écriture : aucune demande au serveur', async () => {
    await mountGuet()
    await mountGuet({ loggedIn: true, access: ACCESS({ write_reports: false, writable_cities: [] }), reports: REPORT() })

    expect(reportCalls()).toHaveLength(0)
  })

  it('une case VIDÉE retire sa section du relevé existant : seulement visions et armées/groupes, jamais le guet, seulement si elles y sont inscrites', async () => {
    const w = await mountGuet({ loggedIn: true, access: ACCESS(), reports: REPORT({ sections_present: ['guet', 'visions', 'armies_groups'] }) })
    await fill(w, { today: aujourdhui, visions: '', armies: allArmies('fr') }) // les visions sont vidées, les armées gardées

    await find(w, 'guet-save').trigger('click')
    await flushPromises()

    const body = saveCalls()[0][1]
    expect(body.remove_sections).toEqual(['visions'])
    expect(Object.keys(body.sections)).toEqual(['guet', 'armies_groups'])
  })

  it('retirer seul suffit : le bouton est actif sans rien à inscrire ; sans relevé existant, une case vide ne retire rien', async () => {
    const w = await mountGuet({ loggedIn: true, access: ACCESS(), reports: REPORT({ sections_present: ['guet', 'visions'] }) })
    await fill(w, { today: '', visions: '', armies: '' })
    expect(find(w, 'guet-save').attributes('disabled')).toBeUndefined() // retirer les visions est un geste

    await find(w, 'guet-save').trigger('click')
    await flushPromises()
    expect(saveCalls()[0][1]).toEqual({ city_id: 1, sections: {}, remove_sections: ['visions'] })

    http.post.mockClear()
    const empty = await mountGuet({ loggedIn: true, access: ACCESS(), reports: null })
    await fill(empty, { today: '', visions: '', armies: '' })
    expect(find(empty, 'guet-save').attributes('disabled')).toBeDefined() // rien à inscrire, rien à retirer
    expect(saveCalls()).toHaveLength(0)
  })

  it('en anglais', async () => {
    const w = await mountGuet({ loggedIn: true, access: ACCESS(), reports: REPORT(), locale: 'en' })

    expect(find(w, 'guet-existing').text()).toBe('A report for 27/10/1474 already exists for this town.')
  })
})
