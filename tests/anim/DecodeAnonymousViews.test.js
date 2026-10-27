import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { reactive } from 'vue'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { push } from 'notivue'
import DecodeCreateAnonymousView from '../../src/views/modules/animation/DecodeCreateAnonymousView.vue'
import DecodeManageView from '../../src/views/modules/animation/DecodeManageView.vue'
import DecodeResetView from '../../src/views/modules/animation/DecodeResetView.vue'
import DecodeEmailConfirmView from '../../src/views/modules/animation/DecodeEmailConfirmView.vue'
import { http } from '../../src/api.js'

// Les quatre pages du mode SANS COMPTE : créer, retrouver (adresse + mot de passe), choisir un nouveau mot de passe, confirmer l'email.
// Aucune règle côté site : le serveur juge, ses refus s'affichent tels quels. Le mot de passe n'est jamais mémorisé ; seule l'adresse peut l'être.

vi.mock('notivue', () => ({ push: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock('../../src/api.js', () => ({ http: { get: vi.fn(), post: vi.fn() } }))
vi.mock('../../src/stores/authStore', () => ({ useAuthStore: () => ({ getToken: 'jeton', isLoggedIn: false, activeCharacter: null }) }))
const comfort = reactive({})
const cookieSet = vi.fn((k, v) => { comfort[k] = v })
vi.mock('../../src/stores/cookieStore', () => ({
  useCookieStore: () => ({ getComfortData: (k, f) => comfort[k] ?? f, setComfortData: cookieSet, hasAcceptedPreferences: true }),
}))
const route = reactive({ query: {} })
vi.mock('vue-router', () => ({
  useRoute: () => route,
  RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' },
}))

const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const readLocale = lang => JSON.parse(fs.readFileSync(path.join(localesDir, `${lang}.json`), 'utf8'))
const fr = readLocale('fr')
const en = readLocale('en')

const FormStub = {
  props: ['mode', 'errors', 'submitting'],
  emits: ['confirm'],
  template: '<div data-testid="form-stub" :data-mode="mode"><button data-testid="stub-confirm" @click="$emit(\'confirm\', { slug: \'les-trois-coffres\', name: \'X\' })">ok</button><span data-testid="stub-errors">{{ JSON.stringify(errors) }}</span></div>',
}

const refusal = (status, messages, extra = {}) => ({ response: { status, data: { success: false, messages, message: messages.fr, ...extra } } })
const activity = (over = {}) => ({
  id: 1, slug: 'les-trois-coffres', name: 'Les Trois Coffres', status: 'launched', mode: 'anonymous', organizer: 'Artifice',
  current: { id: 11, number: 1, code: '48213', proposals: [] }, opened: [], ranking: [], can_reopen: false, email: null, ...over,
})

function mountView(component, { locale = 'fr', stubs = {} } = {}) {
  return mount(component, { global: { plugins: [createI18n({ legacy: false, locale, messages: { fr, en } })], stubs } })
}

beforeEach(() => {
  vi.clearAllMocks()
  for (const k of Object.keys(comfort)) delete comfort[k]
  route.query = {}
})

describe('DecodeCreateAnonymousView', () => {
  const mountCreate = (locale) => mountView(DecodeCreateAnonymousView, { locale, stubs: { DecodeCreateForm: FormStub } })

  it('le titre rappelle l\'activité, et le formulaire est celui du mode sans compte', () => {
    const w = mountCreate()

    expect(w.find('h2').text()).toBe('Décode le code — Organiser une activité sans compte')
    expect(w.findAll('[data-testid="create-visual"] span')).toHaveLength(5)
    expect(w.find('[data-testid="form-stub"]').attributes('data-mode')).toBe('anonymous')
  })

  it('crée sans jeton, annonce l\'adresse, et ne mémorise QUE l\'adresse', async () => {
    http.post.mockResolvedValue({ data: { success: true, activity: activity(), email_pending: false } })
    const w = mountCreate()

    await w.find('[data-testid="stub-confirm"]').trigger('click')
    await flushPromises()

    expect(http.post).toHaveBeenCalledWith('anim/decode-manage', { slug: 'les-trois-coffres', name: 'X' })
    expect(w.find('[data-testid="create-done"]').exists()).toBe(true)
    expect(w.find('[data-testid="create-done-address"]').text()).toContain('les-trois-coffres')
    expect(cookieSet).toHaveBeenCalledWith('anim_decode_slug', 'les-trois-coffres')
    expect(JSON.stringify(cookieSet.mock.calls)).not.toContain('mot')
  })

  it('un email : dit que le lien de confirmation est parti', async () => {
    http.post.mockResolvedValue({ data: { success: true, activity: activity(), email_pending: true } })
    const w = mountCreate()

    await w.find('[data-testid="stub-confirm"]').trigger('click')
    await flushPromises()

    expect(w.find('[data-testid="create-done-email"]').exists()).toBe(true)
  })

  it('refus du serveur : les messages par champ reviennent au formulaire', async () => {
    http.post.mockRejectedValue(refusal(422, { fr: 'x', en: 'y' }, { errors: { slug: ['Adresse prise.'] } }))
    const w = mountCreate()

    await w.find('[data-testid="stub-confirm"]').trigger('click')
    await flushPromises()

    expect(JSON.parse(w.find('[data-testid="stub-errors"]').text())).toEqual({ slug: 'Adresse prise.' })
    expect(w.find('[data-testid="create-done"]').exists()).toBe(false)
  })

  it('refus sans champ (limite atteinte) : un message en toast', async () => {
    http.post.mockRejectedValue(refusal(429, { fr: 'Trop d\'essais.', en: 'Too many attempts.' }))
    const w = mountCreate('en')

    await w.find('[data-testid="stub-confirm"]').trigger('click')
    await flushPromises()

    expect(push.error).toHaveBeenCalledWith('Too many attempts.')
  })
})

describe('DecodeManageView', () => {
  const mountManage = (locale) => mountView(DecodeManageView, { locale, stubs: { DecodeActivityCard: { props: ['activity', 'gestures'], template: '<div data-testid="card-stub">{{ activity.name }}</div>' } } })

  it('préremplit l\'adresse mémorisée, jamais le mot de passe', () => {
    comfort.anim_decode_slug = 'les-trois-coffres'
    const w = mountManage()

    expect(w.find('[data-testid="manage-slug"]').element.value).toBe('les-trois-coffres')
    expect(w.find('[data-testid="manage-password"]').element.value).toBe('')
  })

  it('le mot de passe va dans le CORPS ; la carte s\'ouvre, le mot de passe est vidé, l\'adresse mémorisée', async () => {
    http.post.mockResolvedValue({ data: { success: true, activity: activity() } })
    const w = mountManage()

    await w.find('[data-testid="manage-slug"]').setValue('les-trois-coffres')
    await w.find('[data-testid="manage-password"]').setValue('un-bon-mot-de-passe')
    await w.find('form').trigger('submit')
    await flushPromises()

    expect(http.post).toHaveBeenCalledWith('anim/decode-manage/les-trois-coffres/open', { password: 'un-bon-mot-de-passe' })
    expect(w.find('[data-testid="card-stub"]').text()).toBe('Les Trois Coffres')
    expect(cookieSet).toHaveBeenCalledWith('anim_decode_slug', 'les-trois-coffres')
    expect(JSON.stringify(cookieSet.mock.calls)).not.toContain('un-bon-mot-de-passe')
  })

  it('le refus (mauvais mot de passe, activité inconnue ou close) est le message du serveur, dans la langue', async () => {
    http.post.mockRejectedValue(refusal(403, { fr: 'Adresse ou mot de passe incorrect.', en: 'Wrong address or password.' }))
    const w = mountManage('en')

    await w.find('[data-testid="manage-slug"]').setValue('x')
    await w.find('[data-testid="manage-password"]').setValue('y')
    await w.find('form').trigger('submit')
    await flushPromises()

    expect(w.find('[data-testid="manage-error"]').text()).toBe('Wrong address or password.')
    expect(w.find('[data-testid="card-stub"]').exists()).toBe(false)
  })

  it('« Mot de passe oublié » : même réponse quoi qu\'il arrive, sans mot de passe envoyé', async () => {
    http.post.mockResolvedValue({ data: { success: true } })
    const w = mountManage()
    expect(w.find('[data-testid="manage-forgot"]').attributes('disabled')).toBeDefined() // pas d'adresse

    await w.find('[data-testid="manage-slug"]').setValue('les-trois-coffres')
    await w.find('[data-testid="manage-forgot"]').trigger('click')
    await flushPromises()

    expect(http.post).toHaveBeenCalledWith('anim/decode-manage/les-trois-coffres/reset-request')
    expect(w.find('[data-testid="manage-reset-sent"]').exists()).toBe(true)
  })

  it('UN seul bouton de mot de passe perdu : « Demander à l\'administrateur » sans salle mémorisée, « Réinitialiser mon mot de passe » avec', async () => {
    const w = mountManage()
    expect(w.findAll('[data-testid="manage-forgot"]')).toHaveLength(1)
    expect(w.find('[data-testid="manage-forgot"]').text()).toBe('Demander à l\'administrateur')

    comfort.anim_decode_slug = 'les-trois-coffres'
    const remembered = mountManage()
    delete comfort.anim_decode_slug
    expect(remembered.findAll('[data-testid="manage-forgot"]')).toHaveLength(1)
    expect(remembered.find('[data-testid="manage-forgot"]').text()).toBe('Réinitialiser mon mot de passe')
  })

  it('une adresse saisie avec des majuscules est envoyée en minuscules ; une route introuvable donne le refus générique', async () => {
    http.post.mockRejectedValue({ response: { status: 404, data: { message: 'The route could not be found.' } } })
    const w = mountManage()

    await w.find('[data-testid="manage-slug"]').setValue('  Test ')
    await w.find('[data-testid="manage-password"]').setValue('un-bon-mot-de-passe')
    await w.find('form').trigger('submit')
    await flushPromises()

    expect(http.post).toHaveBeenCalledWith('anim/decode-manage/test/open', { password: 'un-bon-mot-de-passe' })
    expect(w.find('[data-testid="manage-error"]').text()).toBe('Adresse ou mot de passe inconnus.')
  })

  it('une salle mémorisée sur l\'appareil : pas d\'encart pour en créer une autre', () => {
    comfort.anim_decode_slug = 'les-trois-coffres'
    const w = mountManage()
    delete comfort.anim_decode_slug

    expect(w.find('[data-testid="manage-create"]').exists()).toBe(false)
    expect(w.find('[data-testid="manage-slug"]').element.value).toBe('les-trois-coffres')
    expect(mountManage().find('[data-testid="manage-create"]').exists()).toBe(true)
  })

  it('propose de créer une activité, et « Quitter » referme la carte', async () => {
    http.post.mockResolvedValue({ data: { success: true, activity: activity() } })
    const w = mountManage()
    expect(w.find('[data-testid="manage-create-link"]').attributes('data-to')).toContain('animation-create')

    await w.find('[data-testid="manage-slug"]').setValue('les-trois-coffres')
    await w.find('[data-testid="manage-password"]').setValue('un-bon-mot-de-passe')
    await w.find('form').trigger('submit')
    await flushPromises()
    await w.find('[data-testid="manage-leave"]').trigger('click')

    expect(w.find('[data-testid="manage-form"]').exists()).toBe(true)
    expect(w.find('[data-testid="manage-password"]').element.value).toBe('')
  })
})

describe('DecodeResetView', () => {
  const mountReset = (locale) => mountView(DecodeResetView, { locale })

  it('lien incomplet : le dit, sans formulaire', () => {
    const w = mountReset()

    expect(w.find('[data-testid="reset-missing"]').exists()).toBe(true)
    expect(w.find('[data-testid="reset-form"]').exists()).toBe(false)
  })

  it('choisit son mot de passe avec le jeton du lien ; l\'adresse est mémorisée, pas le mot de passe', async () => {
    route.query = { slug: 'les-trois-coffres', token: 'abc' }
    http.post.mockResolvedValue({ data: { success: true } })
    const w = mountReset()

    expect(w.find('[data-testid="reset-submit"]').attributes('disabled')).toBeDefined()
    await w.find('[data-testid="reset-password"]').setValue('Zsdlk5jwe!qpxy')
    await w.find('[data-testid="reset-confirmation"]').setValue('Zsdlk5jwe!qpxy')
    await w.find('form').trigger('submit')
    await flushPromises()

    expect(http.post).toHaveBeenCalledWith('anim/decode-manage/les-trois-coffres/reset-complete', { token: 'abc', password: 'Zsdlk5jwe!qpxy', password_confirmation: 'Zsdlk5jwe!qpxy' })
    expect(w.find('[data-testid="reset-done"]').exists()).toBe(true)
    expect(cookieSet).toHaveBeenCalledWith('anim_decode_slug', 'les-trois-coffres')
    expect(JSON.stringify(cookieSet.mock.calls)).not.toContain('Zsdlk5jwe')
  })

  it('un lien périmé ou déjà utilisé : le message du serveur', async () => {
    route.query = { slug: 'les-trois-coffres', token: 'abc' }
    http.post.mockRejectedValue(refusal(422, { fr: 'Ce lien a expiré.', en: 'This link has expired.' }))
    const w = mountReset('en')

    await w.find('[data-testid="reset-password"]').setValue('Zsdlk5jwe!qpxy')
    await w.find('[data-testid="reset-confirmation"]').setValue('Zsdlk5jwe!qpxy')
    await w.find('form').trigger('submit')
    await flushPromises()

    expect(w.find('[data-testid="reset-error"]').text()).toBe('This link has expired.')
    expect(w.find('[data-testid="reset-done"]').exists()).toBe(false)
  })
})

describe('DecodeEmailConfirmView', () => {
  const query = { slug: 'les-trois-coffres', hash: 'a'.repeat(40), expires: '1700000000', signature: 'sig' }

  it('rappelle l\'API avec les paramètres du lien signé et confirme', async () => {
    route.query = query
    http.get.mockResolvedValue({ data: { success: true } })
    const w = mountView(DecodeEmailConfirmView)
    await flushPromises()

    expect(http.get).toHaveBeenCalledWith(`anim/decode-email-confirm/les-trois-coffres/${'a'.repeat(40)}`, { params: { expires: '1700000000', signature: 'sig' } })
    expect(w.find('[data-testid="confirm-ok"]').exists()).toBe(true)
    expect(w.find('[data-testid="confirm-manage"]').exists()).toBe(true)
  })

  it('lien incomplet : une erreur, sans appel', async () => {
    route.query = { slug: 'x' }
    const w = mountView(DecodeEmailConfirmView)
    await flushPromises()

    expect(http.get).not.toHaveBeenCalled()
    expect(w.find('[data-testid="confirm-error"]').exists()).toBe(true)
  })

  it('lien refusé : le message du serveur, dans la langue', async () => {
    route.query = query
    http.get.mockRejectedValue(refusal(403, { fr: 'Lien invalide.', en: 'Invalid link.' }))
    const w = mountView(DecodeEmailConfirmView, { locale: 'en' })
    await flushPromises()

    expect(w.find('[data-testid="confirm-error"]').text()).toBe('Invalid link.')
  })
})
