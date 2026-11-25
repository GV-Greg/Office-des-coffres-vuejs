import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import SecurityCustomsTable from '../../src/views/modules/security/SecurityCustomsTable.vue'
import { useAuthStore } from '../../src/stores/authStore'
import { http } from '../../src/api.js'

/*
  La Table des douanes (PR 5) : un Registre de douane ÉTENDU, en lecture seule. Pour chaque ville
  qui a un bilan AU JOUR AFFICHÉ, un bloc dépliable — arrivées et départs (les PSEUDOS), habitants et listes, groupes (tous), armées —, les autres villes
  en bas, grisées, « Aucun bilan » (Greg, 24/11/2026 : une ville sans bilan aujourd'hui n'a pas de bloc). Jamais de différentiel entre villes. Le serveur
  agrège et dit qui la voit (au moins deux villes lisibles). Aucune règle côté site, rien n'est gardé dans le navigateur.
*/
vi.mock('../../src/api.js', () => ({ http: { get: vi.fn() } }))

const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const fr = JSON.parse(readFileSync(resolve(localesDir, 'fr.json'), 'utf-8'))
const en = JSON.parse(readFileSync(resolve(localesDir, 'en.json'), 'utf-8'))

const CITIES = [{ id: 1, name: 'Arras' }, { id: 2, name: 'Béthune' }, { id: 3, name: 'Lens' }]
const ACCESS = (over = {}) => ({ province: { id: 3, name: 'Artois' }, role: 'prevot_des_marechaux', has_security_trio: true, today: '2026-05-26', readable_cities: CITIES, ...over })
const nothing = { guet_day: null, inhabitants: null, groups: null, villagers: null, arrivals: null, departures: null, compared_to: null }
const PROVINCE = () => ({
  success: true,
  province: { id: 3, name: 'Artois' },
  today: '2026-05-26',
  as_of: '2026-05-26',
  days: ['2026-05-25', '2026-05-23', '2026-05-20'],
  cities: [
    { id: 1, name: 'Arras', last_report_day: '2026-05-26', guet_day: '2026-05-26', inhabitants: 3, groups: 2, villagers: [{ pseudo: 'Gregor.', noblesse: '', colour: 'red' }, { pseudo: 'Artifice', noblesse: 'de Lapin', colour: 'green' }, { pseudo: 'Nouveau', noblesse: '', colour: null }], arrivals: [{ pseudo: 'Nouveau', colour: null }], departures: [{ pseudo: 'Parti', colour: 'red' }], compared_to: '2026-05-25' },
    { id: 2, name: 'Béthune', last_report_day: '2026-05-26', ...nothing },
    { id: 3, name: 'Lens', last_report_day: '2026-05-25', ...nothing }, // un bilan d'HIER seulement : pas de bloc aujourd'hui
  ],
  marks: [
    { pseudo: 'Gregor.', colour: 'red', as: 'villager', city: { id: 1, name: 'Arras' }, day: '2026-05-26' },
    { pseudo: 'Gregor.', colour: 'red', as: 'vision', city: { id: 2, name: 'Béthune' }, day: '2026-05-26' },
    { pseudo: 'Artifice', colour: 'green', as: 'group_member', city: { id: 1, name: 'Arras' }, day: '2026-05-26' },
  ],
  groups: [
    { type: 'corps_armes', alert: false, members: [{ pseudo: 'Damonkael', colour: null }], city: { id: 1, name: 'Arras' }, day: '2026-05-26' },
    { type: 'groupe', alert: true, members: [{ pseudo: 'Sefrian', colour: 'red' }], city: { id: 1, name: 'Arras' }, day: '2026-05-26' },
  ],
  armies: [{ name: 'Legio', commander: { pseudo: 'Lucas_', colour: null }, city: { id: 1, name: 'Arras' }, day: '2026-05-26' }],
})

const ok = data => Promise.resolve({ data })
const refuse = (status, messages) => Promise.reject({ response: { status, data: { success: false, message: messages.fr, code: 'province_not_readable', messages } } })

async function mountPage({ access = ACCESS(), province = PROVINCE(), locale = 'fr', loggedIn = true } = {}) {
  setActivePinia(createPinia())
  if (loggedIn) useAuthStore().$patch({ user: { characters: [{ id: 7, pseudo: 'Artifice' }] }, token: 'jeton' })
  http.get.mockImplementation((url, config) => {
    if (url.endsWith('customs-access')) return ok({ success: true, access })
    if (url.endsWith('customs-province')) return typeof province === 'function' ? province(config) : ok(province)
    return ok({})
  })
  const wrapper = mount(SecurityCustomsTable, {
    global: {
      plugins: [createI18n({ legacy: false, locale, messages: { fr, en } })],
      stubs: { RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' }, 'v-icon': true },
    },
  })
  await flushPromises()
  return wrapper
}
const find = (w, id) => w.find(`[data-testid="${id}"]`)
const block = (w, id) => find(w, `table-city-${id}`)
const provinceCalls = () => http.get.mock.calls.filter(([url]) => url.endsWith('customs-province'))
// Le serveur : la situation AU jour demandé (ici seulement l'étiquette `as_of` change ; le contenu est celui de la fixture).
const asOf = config => ok({ ...PROVINCE(), as_of: config?.params?.date ?? '2026-05-26' })

beforeEach(() => vi.clearAllMocks())

describe('Table des douanes — qui la voit', () => {
  it('avec au moins deux villes lisibles, la table s\'ouvre et demande l\'agrégat du personnage actif', async () => {
    const w = await mountPage()

    expect(provinceCalls()).toHaveLength(1)
    expect(provinceCalls()[0][0]).toBe('characters/7/customs-province')
    expect(find(w, 'table-title').text()).toBe('Table des douanes')
    expect(find(w, 'table-province').text()).toBe('Artois')
  })

  it('avec UNE seule ville lisible (ou aucun rôle) : le cadenas, et aucun appel à la table', async () => {
    const one = await mountPage({ access: ACCESS({ readable_cities: [CITIES[0]] }) })
    expect(find(one, 'table-denied').text()).toContain('aucun rôle qui lise les bilans de plusieurs villes')
    expect(provinceCalls()).toHaveLength(0)

    expect(find(await mountPage({ access: null }), 'table-denied').exists()).toBe(true)
  })

  it('un refus du serveur s\'affiche tel quel, dans la langue de l\'interface', async () => {
    const province = () => refuse(403, { fr: 'Refusé par l\'Office.', en: 'Refused by the Office.' })

    expect(find(await mountPage({ province }), 'table-error').text()).toBe('Refusé par l\'Office.')
    expect(find(await mountPage({ province, locale: 'en' }), 'table-error').text()).toBe('Refused by the Office.')
  })
})

describe('Table des douanes — un bloc par ville', () => {
  it('une ville avec bilan = un bloc dépliable ; une ville sans bilan = en bas, grisée, « Aucun bilan »', async () => {
    const w = await mountPage()

    expect(w.findAll('details.city-block').map(d => d.attributes('data-testid'))).toEqual(['table-city-1', 'table-city-2'])
    expect(find(w, 'table-without').text()).toContain('Lens')
    expect(find(find(w, 'table-without'), 'table-age').text()).toBe('Aucun bilan')
    expect(block(w, 3).element.closest('details')).toBeNull() // pas un bloc : rien à déplier
  })

  it('la plaque de la ville ne porte AUCUNE date (le jour est celui de la barre) ; plus de « hier » ni d\'« aujourd\'hui »', async () => {
    const w = await mountPage()

    expect(find(block(w, 1), 'table-summary').text()).not.toMatch(/\d{2}\/\d{2}\/\d{4}|hier|aujourd/)
    expect(block(w, 1).find('[data-testid="table-age"]').exists()).toBe(false)
  })

  it('une ville sans bilan AU JOUR AFFICHÉ n\'a pas de bloc, même avec un bilan la veille : elle descend dans « Villes sans bilan »', async () => {
    const w = await mountPage() // Lens a un bilan d'hier (25), pas d'aujourd'hui (26)
    expect(block(w, 3).element.closest('details')).toBeNull()
    expect(find(w, 'table-without').text()).toContain('Lens')

    const province = PROVINCE()
    province.today = province.as_of = '2026-05-30' // plus aucune ville n'a de bilan CE jour-là
    const later = await mountPage({ province })
    expect(later.findAll('details.city-block')).toHaveLength(0)
    expect(find(later, 'table-empty').exists()).toBe(true)
    expect(find(later, 'table-without').findAll('li')).toHaveLength(3)
    expect(find(later, 'table-totals').exists()).toBe(false) // les villes cachées ne comptent pas dans la synthèse
  })

  it('la plaque signale ce qui demande l\'attention : pseudos sur la liste ROUGE et groupes à surveiller de CETTE ville', async () => {
    const w = await mountPage()

    expect(block(w, 1).find('[data-testid="table-alert"]').text()).toContain('2') // Gregor. (rouge) + le groupe de Sefrian
    expect(block(w, 2).find('[data-testid="table-alert"]').text()).toContain('1') // Gregor. croisé en chemin
    const calm = PROVINCE()
    calm.marks = []
    calm.groups = []
    expect(block(await mountPage({ province: calm }), 1).find('[data-testid="table-alert"]').exists()).toBe(false)
  })

  it('plus de bouton « Ouvrir dans le Registre de douane » dans les blocs', async () => {
    const w = await mountPage()

    expect(w.find('[data-testid="table-open"]').exists()).toBe(false)
    expect(w.find('a').exists()).toBe(false)
  })
})

describe('Table des douanes — un bilan se VOIT même quand rien n\'est à surveiller', () => {
  it('la plaque dit ce que contient le bilan : le nombre d\'habitants et de groupes (jamais leur détail)', async () => {
    const w = await mountPage()

    expect(block(w, 1).find('[data-testid="table-counts"]').text()).toBe('3 habitants · 2 groupes · 1 arrivée · 1 départ')
    expect(block(w, 2).find('[data-testid="table-counts"]').exists()).toBe(false) // pas de guet ni d'armées/groupes dans ce bilan
  })

  it('un habitant, un groupe, aucune arrivée ni départ : les accords, et rien pour ce qui est à zéro', async () => {
    const province = PROVINCE()
    province.cities[0] = { ...province.cities[0], inhabitants: 1, groups: 1, arrivals: [], departures: [] }

    expect(block(await mountPage({ province }), 1).find('[data-testid="table-counts"]').text()).toBe('1 habitant · 1 groupe')
  })

  it('arrivées et départs au pluriel ; sans bilan antérieur (null) : rien', async () => {
    const province = PROVINCE()
    province.cities[0] = { ...province.cities[0], arrivals: [{ pseudo: 'A', colour: null }, { pseudo: 'B', colour: null }], departures: [{ pseudo: 'C', colour: null }, { pseudo: 'D', colour: null }, { pseudo: 'E', colour: null }] }
    expect(block(await mountPage({ province }), 1).find('[data-testid="table-counts"]').text()).toBe('3 habitants · 2 groupes · 2 arrivées · 3 départs')

    province.cities[0] = { ...province.cities[0], arrivals: null, departures: null, compared_to: null }
    expect(block(await mountPage({ province }), 1).find('[data-testid="table-counts"]').text()).toBe('3 habitants · 2 groupes')
  })

  it('un bilan sans alerte : la plaque garde ses comptes, les rubriques disent « Aucun … » — la carte n\'a plus l\'air vide', async () => {
    const province = PROVINCE()
    province.marks = []
    province.groups = []
    province.armies = []
    const w = await mountPage({ province })

    expect(block(w, 1).find('[data-testid="table-counts"]').text()).toContain('3 habitants')
    expect(block(w, 1).find('[data-testid="table-alert"]').exists()).toBe(false)
  })
})

describe('Table des douanes — la liste des habitants, dans un accordéon fermé', () => {
  it('fermé par défaut, sans les habitants des listes (déjà au-dessus) ; absent sans guet ou s\'il n\'en reste aucun', async () => {
    const w = await mountPage()
    const villagers = find(block(w, 1), 'table-villagers')

    expect(villagers.exists()).toBe(true)
    expect(villagers.element.closest('[data-testid="table-marks"]')).not.toBeNull() // sous « Habitants et listes »
    expect(villagers.element.open).toBe(false)
    // SANS les habitants déjà au-dessus (liste rouge ou verte : Gregor. et Artifice) : seul « Nouveau » reste
    expect(villagers.findAll('[data-testid="table-villager"]').map(v => v.text())).toEqual(['Nouveau'])
    expect(villagers.find('summary').text()).toBe('Habitants (1)')
    expect(find(block(w, 1), 'table-marks').find('h4').text()).toBe('Habitants')
    expect(find(block(w, 2), 'table-villagers').exists()).toBe(false)

    const province = PROVINCE()
    province.cities[0].villagers = province.cities[0].villagers.filter(v => v.colour) // tous sont sur les listes
    expect(find(block(await mountPage({ province }), 1), 'table-villagers').exists()).toBe(false)
  })

  it('les pseudos de la Table n\'ont pas de cadre (on gagne de la place) ; la liste rouge garde son icône, son texte caché et son gras', async () => {
    const w = await mountPage()
    const pseudos = block(w, 1).findAll('[data-testid="customs-pseudo"]')

    expect(pseudos.length).toBeGreaterThan(0)
    for (const pseudo of pseudos) expect(pseudo.classes()).not.toContain('border')
    const red = pseudos.find(p => p.attributes('data-colour') === 'red')
    expect(red.classes()).toContain('font-bold')
    expect(red.find('.sr-only').text()).toContain('liste rouge')
    expect(red.find('v-icon-stub').exists()).toBe(true)
  })
})

describe('Table des douanes — le contenu d\'un bloc', () => {
  it('arrivées et départs : les PSEUDOS, comparés au bilan antérieur de la même ville', async () => {
    const w = await mountPage()
    const moves = find(block(w, 1), 'table-moves')

    expect(moves.text()).toContain('Comparé au bilan du 25/05/1474.')
    expect(moves.find('[data-testid="table-arrivals"]').text()).toContain('Nouveau')
    expect(moves.find('[data-testid="table-departures"]').text()).toContain('Parti')
    expect(moves.find('[data-testid="table-departures"]').text()).toContain('liste rouge') // le sens passe par le texte
  })

  it('sans bilan antérieur : « Aucun bilan antérieur : pas de comparaison. », jamais des arrivées inventées', async () => {
    const w = await mountPage()
    const moves = find(block(w, 2), 'table-moves')

    expect(moves.text()).toContain('Aucun bilan antérieur : pas de comparaison.')
    expect(moves.find('[data-testid="table-arrivals"]').exists()).toBe(false)
  })

  it('« Habitants et listes » : un tableau à en-tête (dégradé signature) ; chaque ligne dit le pseudo et son rôle ; la colonne « Bilan » seulement si une ligne vient d\'un autre bilan que celui de la plaque', async () => {
    const province = PROVINCE()
    province.marks[2] = { ...province.marks[2], day: '2026-05-24' } // Artifice : vu dans un bilan plus ancien que celui du jour (26)
    const w = await mountPage({ province })
    const marks = find(block(w, 1), 'table-marks')
    const rows = marks.findAll('[data-testid="table-mark"]').map(r => r.text())

    expect(marks.find('table thead').exists()).toBe(true)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toContain('Gregor.')
    expect(rows[0]).toContain('liste rouge')
    expect(rows[0]).toContain('habitant')
    expect(rows[0]).toContain('26/05/1474') // une ligne vient du 24 : la colonne « Bilan » apparaît
    expect(rows[1]).toContain('24/05/1474')
    expect(rows[1]).toContain('Artifice')
    expect(rows[1]).toContain('liste verte')
    expect(rows[1]).toContain('membre d\'un groupe')
  })

  it('chaque bloc ne montre QUE sa ville ; un pseudo vu dans deux villes apparaît dans les deux blocs, chacun avec son jour — jamais « déplacé »', async () => {
    const w = await mountPage()
    const arras = find(block(w, 1), 'table-marks').text()
    const bethune = find(block(w, 2), 'table-marks').text()

    expect(arras).toContain('Gregor.')
    expect(bethune).toContain('Gregor.')
    expect(bethune).toContain('croisé en chemin')
    expect(bethune).not.toContain('26/05/1474') // le jour est celui de la barre ; pas de colonne « Bilan » quand tout vient du bilan du jour
    expect(bethune).not.toContain('Artifice') // celui d'Arras
    expect(w.text()).not.toMatch(/déplac|est passé|vient de/i)
  })

  it('groupes et armées : un tableau par rubrique, la ville de chaque bloc seulement ; une phrase quand il n\'y en a pas', async () => {
    const w = await mountPage()
    const watch = find(block(w, 1), 'table-groups')
    const armies = find(block(w, 1), 'table-armies')

    // TOUS les groupes (Greg, 24/11/2026), en LISTE de phrases ; seul « Groupe composé de … » est mis en exergue, en tête ; le détail d'un groupe n'est pas montré
    const rows = watch.findAll('[data-testid="table-group"]')
    expect(watch.find('table').exists()).toBe(false)
    expect(rows).toHaveLength(2)
    expect(rows[0].attributes('data-alert')).toBe('true')
    expect(rows[0].find('[data-testid="table-group-lead"]').text()).toBe('Groupe composé de')
    expect(rows[0].text()).toContain('Sefrian')
    expect(rows[0].classes()).toContain('bg-orange-100')
    expect(rows[0].find('[data-testid="table-group-alert"]').exists()).toBe(true)
    expect(rows[1].attributes('data-alert')).toBe('false')
    expect(rows[1].find('[data-testid="table-group-lead"]').text()).toBe("Corps d'armes composé de")
    expect(rows[1].text()).toContain('Damonkael')
    expect(rows[1].classes()).not.toContain('bg-orange-100')
    expect(rows[1].find('[data-testid="table-group-alert"]').exists()).toBe(false)
    // le jour du bilan est sur la plaque : pas de jour à côté des groupes quand ils viennent tous de ce bilan
    expect(watch.find('[data-testid="table-group-day"]').exists()).toBe(false)
    expect(armies.findAll('[data-testid="table-army"]')).toHaveLength(1)
    expect(armies.text()).toContain('Legio')
    expect(armies.text()).toContain('Lucas_')

    expect(find(block(w, 2), 'table-groups').text()).toContain('Aucun groupe')
    expect(find(block(w, 2), 'table-armies').text()).toContain('Aucune armée.')
    expect(find(block(w, 2), 'table-marks').findAll('table').length).toBe(1) // Béthune a une marque, donc un tableau
    // pas de colonne « Bilan » : cette marque vient du bilan du jour
    expect(find(block(w, 2), 'table-marks').findAll('th')).toHaveLength(2)
  })

  it('le détail d\'un groupe n\'est pas montré', async () => {
    const w = await mountPage()

    expect(w.text()).not.toMatch(/Admission libre|Fermé/)
  })
})

describe('Table des douanes — voir tout d\'un coup ou se concentrer sur une ville', () => {
  it('tous les blocs sont ouverts au départ ; « Tout replier » puis « Tout déplier »', async () => {
    const w = await mountPage()
    const states = () => w.findAll('details.city-block').map(d => d.element.open)

    expect(states()).toEqual([true, true])
    await find(w, 'table-collapse').trigger('click')
    expect(states()).toEqual([false, false])
    await find(w, 'table-expand').trigger('click')
    expect(states()).toEqual([true, true])
  })

  it('on peut replier une seule ville : les autres ne bougent pas', async () => {
    const w = await mountPage()
    const first = w.find('details').element
    first.open = false
    first.dispatchEvent(new Event('toggle'))
    await flushPromises()

    expect(w.findAll('details.city-block').map(d => d.element.open)).toEqual([false, true])
  })

  it('la synthèse de la province : seulement ce qui compte pour la sécurité, et seulement s\'il y en a', async () => {
    const w = await mountPage()
    const totals = w.findAll('[data-testid="table-totals"] li').map(li => `${li.attributes('data-tone')}: ${li.text()}`)

    expect(totals).toEqual(['red: 2 sur liste rouge', 'green: 1 sur liste verte', 'alert: 1 groupe à surveiller'])

    const calm = PROVINCE()
    calm.marks = []
    calm.groups = []
    expect(find(await mountPage({ province: calm }), 'table-totals').exists()).toBe(false)
  })

  it('aucune ville n\'a de bilan : une phrase, des villes grisées, aucun bouton déplier', async () => {
    const province = PROVINCE()
    province.cities = province.cities.map(c => ({ ...c, last_report_day: null, ...nothing }))
    province.marks = []
    province.groups = []
    province.armies = []
    const w = await mountPage({ province })

    expect(find(w, 'table-empty').text()).toBe('Aucun bilan inscrit dans la province.')
    expect(w.findAll('details.city-block')).toHaveLength(0)
    expect(find(w, 'table-expand').exists()).toBe(false)
    expect(find(w, 'table-without').findAll('li')).toHaveLength(3)
  })
})

describe('Table des douanes — naviguer dans les jours (Greg, 24/11/2026)', () => {
  it('au départ : aujourd\'hui ; la liste des jours = ceux qui ont un bilan (le serveur les dit) plus aujourd\'hui ; « Aujourd\'hui » est inactif', async () => {
    const w = await mountPage()

    expect(find(w, 'table-day').element.value).toBe('2026-05-26')
    expect(find(w, 'table-day').findAll('option').map(o => o.element.value)).toEqual(['2026-05-26', '2026-05-25', '2026-05-23', '2026-05-20'])
    expect(find(w, 'table-today').attributes('disabled')).toBeDefined()
    expect(find(w, 'table-newer').attributes('disabled')).toBeDefined() // rien après aujourd'hui
    expect(find(w, 'table-note').text()).toBe('Situation de la province au jour le jour')
    expect(provinceCalls()[0][1].params).toEqual({}) // sans date : aujourd'hui
  })

  it('choisir un jour redemande la situation AU jour choisi, et la dit', async () => {
    const w = await mountPage({ province: asOf })
    await find(w, 'table-day').setValue('2026-05-23')
    await flushPromises()

    expect(provinceCalls()).toHaveLength(2)
    expect(provinceCalls()[1][1].params).toEqual({ date: '2026-05-23' })
    expect(find(w, 'table-day').element.value).toBe('2026-05-23')
    expect(find(w, 'table-note').text()).toBe('Situation de la province au jour le jour') // la même phrase, tout le temps
    expect(find(w, 'table-today').attributes('disabled')).toBeUndefined()
  })

  it('les flèches vont au jour précédent et au jour suivant de la liste ; « Aujourd\'hui » revient sans date', async () => {
    const w = await mountPage({ province: asOf })
    await find(w, 'table-older').trigger('click')
    await flushPromises()
    expect(provinceCalls()[1][1].params).toEqual({ date: '2026-05-25' })

    await find(w, 'table-older').trigger('click')
    await flushPromises()
    expect(provinceCalls()[2][1].params).toEqual({ date: '2026-05-23' })

    await find(w, 'table-newer').trigger('click')
    await flushPromises()
    expect(provinceCalls()[3][1].params).toEqual({ date: '2026-05-25' })

    await find(w, 'table-today').trigger('click')
    await flushPromises()
    expect(provinceCalls()[4][1].params).toEqual({})
    expect(find(w, 'table-day').element.value).toBe('2026-05-26')
  })

  it('au jour le plus ancien, la flèche « jour précédent » est inactive', async () => {
    const w = await mountPage({ province: asOf })
    await find(w, 'table-day').setValue('2026-05-20')
    await flushPromises()

    expect(find(w, 'table-older').attributes('disabled')).toBeDefined()
  })

  it('à un jour passé, seules les villes qui ont un bilan CE jour-là ont un bloc', async () => {
    const past = (config) => {
      const province = PROVINCE()
      province.as_of = config?.params?.date ?? '2026-05-26'
      if (province.as_of === '2026-05-25') province.cities = province.cities.map(c => (c.id === 3 ? { ...c } : { ...c, last_report_day: '2026-05-23' }))
      return ok(province)
    }
    const w = await mountPage({ province: past })
    expect(w.findAll('details.city-block')).toHaveLength(2) // le 26 : Arras et Béthune

    await find(w, 'table-day').setValue('2026-05-25')
    await flushPromises()
    // le 25 : seule Lens a un bilan
    expect(w.findAll('details.city-block').map(d => d.attributes('data-testid'))).toEqual(['table-city-3'])
    expect(find(w, 'table-without').text()).toContain('Arras')
  })

  it('la navigation est inactive pendant un chargement (pas de double demande)', async () => {
    let release
    const calls = []
    const province = (config) => { calls.push(config); return calls.length === 1 ? ok(PROVINCE()) : new Promise((resolve) => { release = () => resolve({ data: PROVINCE() }) }) }
    const w = await mountPage({ province })
    await find(w, 'table-older').trigger('click')
    expect(find(w, 'table-older').attributes('disabled')).toBeDefined()
    expect(find(w, 'table-day').attributes('disabled')).toBeDefined()

    release()
    await flushPromises()
    expect(find(w, 'table-day').attributes('disabled')).toBeUndefined()
  })
})

describe('Table des douanes — le chargement au changement de jour', () => {
  it('changer de jour : le petit loader de composant du Bilan des mines (le cadenas, aux couleurs de la Sécurité, aligné en haut) prend la place des blocs ; la barre reste', async () => {
    let release
    let calls = 0
    const province = () => (++calls === 1 ? ok(PROVINCE()) : new Promise((resolve) => { release = () => resolve({ data: PROVINCE() }) }))
    const w = await mountPage({ province })
    expect(find(w, 'access-loader').exists()).toBe(false)

    await find(w, 'table-older').trigger('click')
    const loader = find(w, 'access-loader')
    expect(loader.exists()).toBe(true)
    expect(loader.classes()).toContain('justify-start') // aligné EN HAUT, pas centré
    expect(loader.find('v-icon-stub').attributes('name')).toBe('gi-padlock') // le cadenas du Bilan des mines
    expect(loader.find('v-icon-stub').classes()).toContain('text-rose-700') // à la couleur de la Sécurité
    expect(w.findAll('details.city-block')).toHaveLength(0) // les blocs attendent
    expect(find(w, 'table-bar').exists()).toBe(true) // la barre de navigation reste

    release()
    await flushPromises()
    expect(find(w, 'access-loader').exists()).toBe(false)
    expect(w.findAll('details.city-block').length).toBeGreaterThan(0)
  })

  it('plus de simple « Chargement… » : aucun texte de chargement brut dans la page', async () => {
    let calls = 0
    const province = () => (++calls === 1 ? ok(PROVINCE()) : new Promise(() => {}))
    const w = await mountPage({ province })
    await find(w, 'table-older').trigger('click')

    expect(w.text()).not.toMatch(/Chargement…|Loading…/)
  })

  it('un échec en naviguant garde la table et le dit', async () => {
    let calls = 0
    const province = () => (++calls === 1 ? ok(PROVINCE()) : refuse(403, { fr: 'Refusé par l\'Office.', en: 'Refused.' }))
    const w = await mountPage({ province })
    await find(w, 'table-older').trigger('click')
    await flushPromises()

    expect(find(w, 'table-error').text()).toBe('Refusé par l\'Office.')
    expect(find(w, 'table-day').exists()).toBe(true) // la barre reste : on peut réessayer
    expect(w.findAll('details.city-block').length).toBeGreaterThan(0)
  })
})

describe('Table des douanes — lecture seule, rien n\'est gardé', () => {
  it('aucun champ de collage ni bouton d\'écriture (seulement naviguer, déplier et replier), aucun stockage local', async () => {
    const write = vi.spyOn(Storage.prototype, 'setItem')
    const w = await mountPage()

    expect(w.find('textarea').exists()).toBe(false)
    expect(w.findAll('button').map(b => b.attributes('data-testid'))).toEqual(['table-older', 'table-newer', 'table-today', 'table-expand', 'table-collapse'])
    expect(write).not.toHaveBeenCalled()
    write.mockRestore()
  })

  it('en anglais', async () => {
    const w = await mountPage({ locale: 'en' })

    expect(find(w, 'table-title').text()).toBe('Customs Table')
    expect(block(w, 1).find('[data-testid="table-counts"]').text()).toBe('3 inhabitants · 2 groups · 1 arrival · 1 departure')
    expect(find(block(w, 1), 'table-marks').text()).toContain('inhabitant')
    expect(find(w, 'table-expand').text()).toBe('Expand all')
  })
})

describe('Table des douanes — les phrases des groupes', () => {
  it('chaque type a sa phrase (accord compris) ; la milice, sans pseudo, tient en un mot ; en anglais aussi', async () => {
    const province = PROVINCE()
    const arras = { id: 1, name: 'Arras' }
    province.groups = ['lance', 'corps_armes', 'marechaux', 'groupe'].map(type => ({ type, alert: type === 'groupe', members: [{ pseudo: 'Membre', colour: null }], city: arras, day: '2026-05-26' }))
      .concat([{ type: 'milice', alert: false, members: [], city: arras, day: '2026-05-26' }])
    const leads = async locale => (await mountPage({ province, locale })).findAll('[data-testid="table-group-lead"]').map(l => l.text())

    expect(await leads('fr')).toEqual(['Groupe composé de', 'Lance composée de', "Corps d'armes composé de", 'Groupe de maréchaux composé de', 'Milice'])
    expect(await leads('en')).toEqual(['Group made up of', 'Armed Retinue made up of', 'Armed Mob made up of', 'Marshal group made up of', 'Militia'])
  })
})
