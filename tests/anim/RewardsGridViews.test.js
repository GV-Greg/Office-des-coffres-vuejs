import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { reactive } from 'vue'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { push } from 'notivue'
import RewardsGridCreateView from '../../src/views/modules/animation/RewardsGridCreateView.vue'
import RewardsGridManageView from '../../src/views/modules/animation/RewardsGridManageView.vue'
import RewardsGridResetView from '../../src/views/modules/animation/RewardsGridResetView.vue'
import RewardsGridConfirmEmailView from '../../src/views/modules/animation/RewardsGridConfirmEmailView.vue'
import RewardsGridEntryView from '../../src/views/modules/animation/RewardsGridEntryView.vue'
import RewardsGridPublicView from '../../src/views/modules/animation/RewardsGridPublicView.vue'
import MyRewardsGrids from '../../src/views/modules/animation/MyRewardsGrids.vue'
import RewardsCreateForm from '../../src/components/anim/RewardsCreateForm.vue'
import { http } from '../../src/api.js'

// Les écrans de la Grille des lots : créer sans compte, retrouver (adresse + mot de passe), choisir un nouveau mot de passe, confirmer l'email,
// l'entrée, la page publique et « Ma grille ». Ils partagent leur structure avec Décode le code (Anim*View) : ici on vérifie ce qui est propre à la
// grille et que rien n'a glissé entre les deux types. Aucune règle côté site : le serveur juge, ses refus s'affichent tels quels.

vi.mock('notivue', () => ({ push: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock('../../src/api.js', () => ({ http: { get: vi.fn(), post: vi.fn() } }))
const auth = reactive({ getToken: 'jeton', isLoggedIn: false, activeCharacter: null })
vi.mock('../../src/stores/authStore', () => ({ useAuthStore: () => auth }))
const comfort = reactive({})
const cookieSet = vi.fn((k, v) => { comfort[k] = v })
vi.mock('../../src/stores/cookieStore', () => ({
  useCookieStore: () => ({ getComfortData: (k, f) => comfort[k] ?? f, setComfortData: cookieSet, hasAcceptedPreferences: true }),
}))
const route = reactive({ query: {}, params: {} })
vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({ replace: vi.fn() }),
  RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' },
}))

const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const readLocale = lang => JSON.parse(fs.readFileSync(path.join(localesDir, `${lang}.json`), 'utf8'))
const fr = readLocale('fr')
const en = readLocale('en')

const refusal = (status, messages, extra = {}) => ({ response: { status, data: { success: false, messages, message: messages.fr, ...extra } } })
const grid = (over = {}) => ({
  id: 1, slug: 'foire', name: 'Foire', status: 'incomplete', mode: 'anonymous', width: 2, height: 2, lots: [], organizer: 'Artifice', can_reopen: false, email: null, ...over,
})

const global = (locale, stubs = {}) => ({
  plugins: [createI18n({ legacy: false, locale, messages: { fr, en } })],
  stubs: { 'v-icon': true, ...stubs },
})
const mountView = (component, { locale = 'fr', stubs = {}, props = {} } = {}) => mount(component, { props, global: global(locale, stubs) })
const byId = (w, id) => w.find(`[data-testid="${id}"]`)

beforeEach(() => {
  vi.clearAllMocks()
  for (const k of Object.keys(comfort)) delete comfort[k]
  route.query = {}
  route.params = {}
  auth.isLoggedIn = false
  auth.activeCharacter = null
  // La carte (`GET map`) que lit le sélecteur royaume / province / ville : une liste vide suffit, mais elle doit exister.
  http.get.mockResolvedValue({ data: { success: true, kingdoms: [] } })
})

// ── Créer sans compte ─────────────────────────────────────────────────────────────────────────────

describe('RewardsGridCreateView', () => {
  const FormStub = {
    props: ['mode', 'errors', 'submitting'],
    emits: ['confirm'],
    template: '<div data-testid="form-stub" :data-mode="mode"><button data-testid="stub-confirm" @click="$emit(\'confirm\', { slug: \'foire\', name: \'Foire\', width: 3, height: 3 })">ok</button><span data-testid="stub-errors">{{ JSON.stringify(errors) }}</span></div>',
  }
  const mountCreate = (locale) => mountView(RewardsGridCreateView, { locale, stubs: { RewardsCreateForm: FormStub } })

  it('le titre rappelle l\'activité, le formulaire est celui du mode sans compte', () => {
    const w = mountCreate()

    expect(byId(w, 'create-title').text()).toBe(`${fr.Animation.Types.rewards.Name} — ${fr.Animation.Rewards.Create.Title}`)
    expect(byId(w, 'form-stub').attributes('data-mode')).toBe('anonymous')
  })

  it('crée sans jeton, annonce l\'adresse, et ne mémorise QUE l\'adresse', async () => {
    http.post.mockResolvedValue({ data: { success: true, grid: grid(), email_pending: false } })
    const w = mountCreate()

    await byId(w, 'stub-confirm').trigger('click')
    await flushPromises()

    expect(http.post).toHaveBeenCalledWith('anim/rewards-manage', { slug: 'foire', name: 'Foire', width: 3, height: 3 })
    expect(byId(w, 'create-done-address').text()).toContain('foire')
    expect(cookieSet).toHaveBeenCalledWith('anim_rewards_slug', 'foire')
    expect(byId(w, 'create-done-manage').attributes('data-to')).toContain('animation-rewards-manage')
    expect(byId(w, 'create-done-public').attributes('data-to')).toContain('animation-rewards-public')
    expect(byId(w, 'create-done-email').exists()).toBe(false)
  })

  it('un email : dit que le lien de confirmation est parti', async () => {
    http.post.mockResolvedValue({ data: { success: true, grid: grid(), email_pending: true } })
    const w = mountCreate()

    await byId(w, 'stub-confirm').trigger('click')
    await flushPromises()

    expect(byId(w, 'create-done-email').text()).toBe(fr.Animation.Rewards.Create.DoneEmail)
  })

  it('refus du serveur : les messages par champ reviennent au formulaire ; sans champ, un toast', async () => {
    http.post.mockRejectedValueOnce(refusal(422, { slug: { fr: 'Adresse prise.', en: 'Taken.' } }, { errors: { slug: ['Adresse prise.'] }, codes: { slug: 'slug_taken' } }))
    const w = mountCreate()

    await byId(w, 'stub-confirm').trigger('click')
    await flushPromises()
    expect(byId(w, 'stub-errors').text()).toContain('Adresse prise.')

    http.post.mockRejectedValueOnce(refusal(409, { fr: 'Déjà une grille ouverte.', en: 'A grid is already open.' }))
    await byId(w, 'stub-confirm').trigger('click')
    await flushPromises()
    expect(push.error).toHaveBeenCalledWith('Déjà une grille ouverte.')
  })
})

describe('RewardsCreateForm', () => {
  const mountForm = (props = {}) => mountView(RewardsCreateForm, { props: { mode: 'anonymous', slugDelay: 0, ...props } })

  it('les dimensions sont dans la colonne de la grille, 5 × 5 au départ, sans borne côté site', () => {
    const w = mountForm()

    expect(byId(w, 'create-width').element.value).toBe('5')
    expect(byId(w, 'create-height').element.value).toBe('5')
    expect(byId(w, 'create-width').attributes('max')).toBeUndefined()
  })

  it('un refus de dimensions du serveur s\'affiche sous les champs', () => {
    const w = mountForm({ errors: { dimensions: 'Les dimensions doivent être comprises entre 1 et 10.' } })

    expect(byId(w, 'create-error-dimensions').text()).toContain('entre 1 et 10')
  })

  it('l\'email part sous la clé `email`, celle que le serveur lit (et non `organizer_email`)', async () => {
    http.get.mockImplementation(async () => ({ data: { success: true, kingdoms: [], proposal: 'foire', slug: 'foire', valid: true, taken: false, min: 3, max: 20 } }))
    const w = mountForm()

    await byId(w, 'create-name').setValue('Foire')
    await byId(w, 'create-organizer').setValue('Artifice')
    await byId(w, 'create-email').setValue('artifice@example.org')
    w.findComponent({ name: 'AnimCreateForm' }).vm.$.setupState.form.placeId = 3
    w.findComponent({ name: 'AnimCreateForm' }).vm.$.setupState.form.password = 'Un-très-bon-mot-de-passe-1'
    w.findComponent({ name: 'AnimCreateForm' }).vm.$.setupState.form.confirmation = 'Un-très-bon-mot-de-passe-1'
    await flushPromises()
    w.findComponent({ name: 'AnimCreateForm' }).vm.$.setupState.slugState = { valid: true, taken: false, checked: true }
    await flushPromises()

    await w.find('form').trigger('submit')
    await flushPromises()
    await byId(w, 'recap-confirm').trigger('click')

    const body = w.emitted('confirm')[0][0]
    expect(body).toMatchObject({ name: 'Foire', organizer_name: 'Artifice', email: 'artifice@example.org', width: 5, height: 5, province_id: 3 })
    expect(body.organizer_email).toBeUndefined()
  })

  it('le récapitulatif dit les dimensions et ne promet que ce que la grille fait (aucune clôture automatique, pas de « coffres »)', async () => {
    http.get.mockImplementation(async () => ({ data: { success: true, kingdoms: [], proposal: 'foire', slug: 'foire', valid: true, taken: false, min: 3, max: 20 } }))
    const w = mountForm()
    const inner = w.findComponent({ name: 'AnimCreateForm' }).vm.$.setupState
    inner.form.name = 'Foire'
    inner.form.slug = 'foire'
    inner.form.placeId = 3
    inner.form.organizerName = 'Artifice'
    inner.form.password = 'Un-très-bon-mot-de-passe-1'
    inner.form.confirmation = 'Un-très-bon-mot-de-passe-1'
    inner.slugState = { valid: true, taken: false, checked: true }
    await flushPromises()
    await w.find('form').trigger('submit')
    await flushPromises()

    const recap = byId(w, 'recap').text()
    expect(byId(w, 'recap-dimensions').text()).toContain('5 × 5')
    expect(byId(w, 'recap-address').text()).toContain('/public/activite/grille/foire')
    expect(byId(w, 'recap-idle').exists()).toBe(false)
    expect(recap).not.toMatch(/coffre|proposition/i)
    expect(byId(w, 'recap-closing').text()).toContain('lots restent consultables')
  })
})

// ── Retrouver, réinitialiser, confirmer ───────────────────────────────────────────────────────────

describe('RewardsGridManageView', () => {
  const Card = { props: ['grid', 'gestures'], template: '<div data-testid="card-stub">{{ grid.name }}</div>' }
  const mountManage = (locale) => mountView(RewardsGridManageView, { locale, stubs: { RewardsGridCard: Card } })

  it('préremplit l\'adresse mémorisée, jamais le mot de passe', () => {
    comfort.anim_rewards_slug = 'foire'
    const w = mountManage()

    expect(byId(w, 'manage-slug').element.value).toBe('foire')
    expect(byId(w, 'manage-password').element.value).toBe('')
  })

  it('le mot de passe va dans le CORPS ; la carte s\'ouvre, le mot de passe est vidé, l\'adresse mémorisée sous la clé de la grille', async () => {
    http.post.mockResolvedValue({ data: { success: true, grid: grid() } })
    const w = mountManage()

    await byId(w, 'manage-slug').setValue('Foire')
    await byId(w, 'manage-password').setValue('un-bon-mot-de-passe')
    await w.find('form').trigger('submit')
    await flushPromises()

    expect(http.post).toHaveBeenCalledWith('anim/rewards-manage/foire/open', { password: 'un-bon-mot-de-passe' })
    expect(byId(w, 'card-stub').text()).toBe('Foire')
    expect(cookieSet).toHaveBeenCalledWith('anim_rewards_slug', 'foire')
    expect(JSON.stringify(cookieSet.mock.calls)).not.toContain('un-bon-mot-de-passe')
  })

  it('le refus est le message du serveur, dans la langue ; une route introuvable donne le refus générique de la grille', async () => {
    http.post.mockRejectedValueOnce(refusal(403, { fr: 'Adresse ou mot de passe incorrect.', en: 'Wrong address or password.' }))
    const w = mountManage('en')
    await byId(w, 'manage-slug').setValue('x')
    await byId(w, 'manage-password').setValue('y')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(byId(w, 'manage-error').text()).toBe('Wrong address or password.')

    http.post.mockRejectedValueOnce({ response: { status: 404, data: {} } })
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(byId(w, 'manage-error').text()).toBe(en.Animation.Rewards.Manage.NotFound)
  })

  it('« mot de passe oublié » : même réponse quoi qu\'il arrive, sans mot de passe envoyé ; un seul bouton selon la mémorisation', async () => {
    http.post.mockResolvedValue({ data: { success: true } })
    const w = mountManage()
    expect(byId(w, 'manage-forgot').text()).toContain(fr.Animation.Rewards.Manage.AskAdmin)

    await byId(w, 'manage-slug').setValue('foire')
    await byId(w, 'manage-forgot').trigger('click')
    await flushPromises()

    expect(http.post).toHaveBeenCalledWith('anim/rewards-manage/foire/reset-request')
    expect(byId(w, 'manage-reset-sent').text()).toContain('lien')

    comfort.anim_rewards_slug = 'foire'
    expect(byId(mountManage(), 'manage-forgot').text()).toContain(fr.Animation.Rewards.Manage.Forgot)
  })

  it('l\'encart de création pointe la création de la grille, et disparaît quand une grille est mémorisée', () => {
    expect(byId(mountManage(), 'manage-create-link').attributes('data-to')).toContain('animation-rewards-create')

    comfort.anim_rewards_slug = 'foire'
    expect(byId(mountManage(), 'manage-create').exists()).toBe(false)
  })

  it('clore la grille ouverte oublie l\'adresse ; « Fermer la gestion » referme la carte', async () => {
    http.post.mockResolvedValue({ data: { success: true, grid: grid() } })
    const w = mountManage()
    await byId(w, 'manage-slug').setValue('foire')
    await byId(w, 'manage-password').setValue('un-bon-mot-de-passe')
    await w.find('form').trigger('submit')
    await flushPromises()

    w.findComponent(Card).vm.$emit('update', grid({ status: 'closed' }))
    await flushPromises()
    expect(cookieSet).toHaveBeenLastCalledWith('anim_rewards_slug', null)

    await byId(w, 'manage-leave').trigger('click')
    expect(byId(w, 'manage-form').exists()).toBe(true)
  })
})

describe('RewardsGridResetView', () => {
  it('lien incomplet : le dit, sans formulaire', () => {
    const w = mountView(RewardsGridResetView)

    expect(byId(w, 'reset-missing').text()).toBe(fr.Animation.Rewards.Reset.Missing)
    expect(byId(w, 'reset-form').exists()).toBe(false)
  })

  it('choisit son mot de passe avec le jeton du lien ; l\'adresse est mémorisée, pas le mot de passe', async () => {
    http.post.mockResolvedValue({ data: { success: true } })
    route.query = { slug: 'foire', token: 'jeton-du-lien' }
    const w = mountView(RewardsGridResetView)

    const inputs = w.findAll('input[type="password"], input[type="text"]')
    await inputs[0].setValue('Un-très-bon-mot-de-passe-1')
    await inputs[1].setValue('Un-très-bon-mot-de-passe-1')
    await w.find('form').trigger('submit')
    await flushPromises()

    expect(http.post).toHaveBeenCalledWith('anim/rewards-manage/foire/reset-complete', {
      token: 'jeton-du-lien', password: 'Un-très-bon-mot-de-passe-1', password_confirmation: 'Un-très-bon-mot-de-passe-1',
    })
    expect(byId(w, 'reset-done').text()).toContain(fr.Animation.Rewards.Reset.Done)
    expect(cookieSet).toHaveBeenCalledWith('anim_rewards_slug', 'foire')
    expect(JSON.stringify(cookieSet.mock.calls)).not.toContain('Un-très-bon')
    expect(byId(w, 'reset-manage').attributes('data-to')).toContain('animation-rewards-manage')
  })

  it('un lien périmé ou déjà utilisé : le message du serveur', async () => {
    http.post.mockRejectedValue(refusal(422, { fr: 'Lien périmé.', en: 'Expired link.' }))
    route.query = { slug: 'foire', token: 'vieux' }
    const w = mountView(RewardsGridResetView)

    const inputs = w.findAll('input[type="password"], input[type="text"]')
    await inputs[0].setValue('Un-très-bon-mot-de-passe-1')
    await inputs[1].setValue('Un-très-bon-mot-de-passe-1')
    await w.find('form').trigger('submit')
    await flushPromises()

    expect(byId(w, 'reset-error').text()).toBe('Lien périmé.')
  })
})

describe('RewardsGridConfirmEmailView', () => {
  it('rappelle l\'API de la grille avec les paramètres du lien signé et confirme — sans promettre de notifications', async () => {
    route.query = { slug: 'foire', hash: 'h', expires: '1', signature: 's' }
    const w = mountView(RewardsGridConfirmEmailView)
    await flushPromises()

    expect(http.get).toHaveBeenCalledWith('anim/rewards-email-confirm/foire/h', { params: { expires: '1', signature: 's' } })
    expect(byId(w, 'confirm-ok').text()).toBe(fr.Animation.Rewards.Confirm.Ok)
    expect(byId(w, 'confirm-ok').text()).not.toMatch(/notification/i)
  })

  it('lien incomplet : une erreur, sans appel', async () => {
    route.query = { slug: 'foire' }
    const w = mountView(RewardsGridConfirmEmailView)
    await flushPromises()

    expect(http.get).not.toHaveBeenCalled()
    expect(byId(w, 'confirm-error').text()).toBe(fr.Animation.Rewards.Confirm.Error)
  })

  it('lien refusé : le message du serveur, dans la langue', async () => {
    http.get.mockRejectedValue(refusal(422, { fr: 'Lien invalide.', en: 'Invalid link.' }))
    route.query = { slug: 'foire', hash: 'h', expires: '1', signature: 's' }
    const w = mountView(RewardsGridConfirmEmailView, { locale: 'en' })
    await flushPromises()

    expect(byId(w, 'confirm-error').text()).toBe('Invalid link.')
  })
})

// ── Entrée, page publique, « Ma grille » ──────────────────────────────────────────────────────────

describe('RewardsGridEntryView', () => {
  it('le héros, le panneau « Votre grille » (3/4) et les quatre étapes (1/4)', () => {
    const w = mountView(RewardsGridEntryView, { stubs: { RewardsStartPanel: { template: '<div data-testid="start-stub" />' } } })

    expect(byId(w, 'rewards-entry-title').text()).toBe(fr.Animation.Types.rewards.Name)
    expect(byId(w, 'start-stub').exists()).toBe(true)
    expect(byId(w, 'rewards-entry-how').findAll('li')).toHaveLength(4)
  })
})

describe('RewardsGridPublicView', () => {
  const Board = { props: ['grid', 'editable'], template: '<div data-testid="board-stub" :data-editable="String(editable)" />' }
  const mountPublic = (locale = 'fr') => {
    route.params = { slug: 'foire' }
    return mountView(RewardsGridPublicView, { locale, stubs: { RewardsGridBoard: Board, SelectorMenu: true } })
  }
  const published = (over = {}) => grid({
    status: 'confirmed', place: { kind: 'province', name: 'Toulouse' },
    lots: [
      { id: 1, place: 5, name: 'Épée', player: 'Aldric', is_taken: false },
      { id: 2, place: 2, name: 'Pain', player: 'Bérénice', is_taken: false },
    ],
    ...over,
  })

  it('dans la coquille publique : menu, mention « site non officiel », lecture seule', async () => {
    http.get.mockResolvedValue({ data: { success: true, grid: published() } })
    const w = mountPublic()
    await flushPromises()

    expect(http.get).toHaveBeenCalledWith('anim/rewards-grids/foire')
    expect(byId(w, 'public-menu').exists()).toBe(true)
    expect(byId(w, 'public-footer').text()).toBe(fr.Animation.Public.Footer)
    expect(byId(w, 'public-organize').attributes('data-to')).toContain('welcome')
    expect(byId(w, 'board-stub').attributes('data-editable')).toBe('false')
  })

  it('titre, état, organisateur et lieu', async () => {
    http.get.mockResolvedValue({ data: { success: true, grid: published() } })
    const w = mountPublic()
    await flushPromises()

    expect(byId(w, 'public-grid-title').text()).toBe('Grille des lots « Foire »')
    expect(byId(w, 'public-grid-board').find('h2').classes()).toContain('sr-only')
    expect(byId(w, 'public-grid-status').text()).toBe(fr.Animation.GridStatus.confirmed)
    expect(w.text()).toContain('Organisateur : Artifice')
    expect(w.text()).toContain('Province de Toulouse')
  })

  it('la liste des lots (à gauche, lecture seule, triée par case), la grille au milieu, la légende à droite', async () => {
    http.get.mockResolvedValue({ data: { success: true, grid: published() } })
    const w = mountPublic()
    await flushPromises()

    const items = byId(w, 'public-grid-claimed').findAll('li').map(li => li.text())
    expect(items[0]).toContain('Pain')
    expect(items[1]).toContain('Épée')
    expect(byId(w, 'claimed-count').text()).toBe('2')
    expect(byId(w, 'claimed-list').classes()).toContain('tablet:columns-2') // deux colonnes sur la page publique seulement
    expect(byId(w, 'claimed-list').find('li').classes()).toContain('break-inside-avoid')
    expect(byId(w, 'public-grid-claimed').find('button').exists()).toBe(false) // aucun geste de remise sur la page publique
    expect(byId(w, 'public-grid-claimed').classes()).toContain('laptop:order-1')
    expect(byId(w, 'public-grid-board').classes()).toContain('laptop:order-2')
    expect(byId(w, 'board-legend').exists()).toBe(true)
    expect(byId(w, 'board-legend').element.parentElement.className).toContain('laptop:order-3')
  })

  it('la page publique n\'a aucun cadre à fond blanc : la liste et la légende reposent sur le fond de la page', async () => {
    http.get.mockResolvedValue({ data: { success: true, grid: published() } })
    const w = mountPublic()
    await flushPromises()

    for (const id of ['grid-taken-section', 'board-legend']) {
      const el = byId(w, id)
      expect(el.classes(), id).not.toContain('bg-white')
      expect(el.classes(), id).not.toContain('border')
    }
    expect(w.find('.bg-white').exists()).toBe(false)
    // Sans cadre, mais avec de l'air : un padding autour de la liste et de la légende, et un large écart entre les colonnes.
    expect(byId(w, 'grid-taken-section').classes()).toContain('p-4')
    expect(byId(w, 'board-legend').classes()).toContain('p-4')
    expect(byId(w, 'public-grid-board').element.parentElement.className).toContain('laptop:gap-14')
  })

  it('sans lot attribué : la liste le dit, sans inviter à cliquer (le visiteur ne peut rien attribuer)', async () => {
    http.get.mockResolvedValue({ data: { success: true, grid: published({ lots: [] }) } })
    const w = mountPublic()
    await flushPromises()

    expect(byId(w, 'grid-taken-empty').text()).toBe(fr.Animation.Grid.NoClaimed)
  })

  it('grille close : le dit', async () => {
    http.get.mockResolvedValue({ data: { success: true, grid: published({ status: 'closed' }) } })
    const w = mountPublic()
    await flushPromises()

    expect(byId(w, 'public-grid-closed').text()).toBe(fr.Animation.Rewards.Public.ClosedNotice)
  })

  it('inconnue ou pas encore tirée (404) : un constat, rien à réessayer', async () => {
    http.get.mockRejectedValue({ response: { status: 404, data: {} } })
    const w = mountPublic()
    await flushPromises()

    expect(byId(w, 'public-grid-notfound').text()).toBe(fr.Animation.Rewards.Public.NotFound)
  })

  it('une panne : le message du serveur et « Réessayer »', async () => {
    http.get.mockRejectedValueOnce(refusal(500, { fr: 'Panne.', en: 'Outage.' }))
    const w = mountPublic('en')
    await flushPromises()

    expect(byId(w, 'public-grid-error').text()).toContain('Outage.')
  })
})

describe('MyRewardsGrids', () => {
  const Form = {
    props: ['mode', 'errors', 'submitting'],
    emits: ['confirm'],
    template: '<div data-testid="form-stub" :data-mode="mode"><button data-testid="stub-confirm" @click="$emit(\'confirm\', { slug: \'foire\', name: \'Foire\', width: 3, height: 3 })">ok</button></div>',
  }
  const Card = { props: ['grid', 'gestures'], template: '<div data-testid="card-stub">{{ grid.name }}</div>' }
  const stubs = { RewardsCreateForm: Form, RewardsGridCard: Card }
  const login = () => { auth.isLoggedIn = true; auth.activeCharacter = { id: 7, pseudo: 'Artifice' } }
  const serverWith = (grids) => http.get.mockImplementation(async url => ({ data: { success: true, grids: url.startsWith('characters/') ? grids : undefined } }))

  it('sans personnage actif : le dit, sans appeler l\'API', async () => {
    const w = mountView(MyRewardsGrids, { stubs })
    await flushPromises()

    expect(byId(w, 'mine-no-character').exists()).toBe(true)
    expect(http.get).not.toHaveBeenCalled()
  })

  it('sans grille : le formulaire privé et l\'invitation ; avec une grille ouverte : le formulaire disparaît', async () => {
    login()
    serverWith([])
    const empty = mountView(MyRewardsGrids, { stubs })
    await flushPromises()
    expect(http.get).toHaveBeenCalledWith('characters/7/rewards-grids', { headers: { Authorization: 'Bearer jeton' } })
    expect(byId(empty, 'form-stub').attributes('data-mode')).toBe('private')
    expect(byId(empty, 'mine-empty').exists()).toBe(true)

    serverWith([grid({ mode: 'private' })])
    const open = mountView(MyRewardsGrids, { stubs })
    await flushPromises()
    expect(byId(open, 'mine-create').exists()).toBe(false)
    expect(byId(open, 'card-stub').text()).toBe('Foire')
  })

  it('une grille close laisse créer la suivante', async () => {
    login()
    serverWith([grid({ mode: 'private', status: 'closed' })])
    const w = mountView(MyRewardsGrids, { stubs })
    await flushPromises()

    expect(byId(w, 'mine-create').exists()).toBe(true)
  })

  it('crée avec le jeton ; la grille paraît ; un toast le dit', async () => {
    login()
    serverWith([])
    http.post.mockResolvedValue({ data: { success: true, grid: grid({ mode: 'private' }) } })
    const w = mountView(MyRewardsGrids, { stubs })
    await flushPromises()

    await byId(w, 'stub-confirm').trigger('click')
    await flushPromises()

    expect(http.post).toHaveBeenCalledWith('characters/7/rewards-grids', { slug: 'foire', name: 'Foire', width: 3, height: 3 }, { headers: { Authorization: 'Bearer jeton' } })
    expect(byId(w, 'card-stub').text()).toBe('Foire')
    expect(push.success).toHaveBeenCalledWith(fr.Animation.Grid.Created)
  })

  it('une panne de lecture : le message du serveur, dans la langue', async () => {
    login()
    http.get.mockRejectedValue(refusal(500, { fr: 'Panne.', en: 'Outage.' }))
    const w = mountView(MyRewardsGrids, { stubs, locale: 'en' })
    await flushPromises()

    expect(byId(w, 'mine-error').text()).toContain('Outage.')
  })
})
