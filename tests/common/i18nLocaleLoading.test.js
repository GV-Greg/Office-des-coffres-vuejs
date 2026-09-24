import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { watch } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

/*
  Chargement des locales — src/i18n/index.js.

  Le français est embarqué, l'anglais chargé à la demande. Ces tests tiennent la promesse
  qui justifie ce partage : une locale indisponible (réseau coupé, chunk absent après un
  déploiement) ne doit jamais laisser l'interface afficher ses clés brutes.

  Chaque test réimporte le module (`vi.resetModules`) : l'instance i18n et l'ensemble des
  locales déjà chargées sont des singletons de module, qui fuiraient sinon d'un test à
  l'autre.
*/

const EN_PATH = '../../src/locales/en.json'

const importI18n = () => import('../../src/i18n/index.js')

const makeEnUnavailable = () => {
  vi.doMock(EN_PATH, () => {
    throw new Error('Failed to fetch dynamically imported module')
  })
}

const pushError = vi.fn()

beforeEach(() => {
  vi.resetModules()
  vi.doUnmock(EN_PATH)
  vi.doMock('notivue', () => ({ push: { error: pushError } }))
  pushError.mockClear()
  localStorage.clear()
})

const mountSelector = async () => {
  const { default: i18n } = await importI18n()
  const { default: SelectorLanguage } = await import('../../src/components/SelectorLanguage.vue')
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(SelectorLanguage, { global: { plugins: [pinia, i18n] } })
  return { i18n, wrapper }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('i18n — le français est toujours disponible', () => {
  it('traduit sans attendre aucun chargement', async () => {
    const { default: i18n } = await importI18n()
    const { t } = i18n.global

    expect(t('Common.SiteName')).toBe('Office des coffres')
    expect(t('Validation.Required', { field: 'email' })).toContain('est requis')
  })
})

describe('i18n — anglais indisponible', () => {
  it("reste en français, sans rejeter ni afficher de clé", async () => {
    makeEnUnavailable()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { default: i18n, setLocale } = await importI18n()

    await expect(setLocale('en')).resolves.toBe('fr')

    expect(i18n.global.locale.value).toBe('fr')
    expect(i18n.global.t('Welcome.Intro')).not.toBe('Welcome.Intro')
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0][0]).toContain('« en »')
  })

  it("SelectorLanguage ne mémorise pas une langue qui n'a pas pu s'afficher", async () => {
    makeEnUnavailable()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { default: i18n } = await importI18n()
    const { default: SelectorLanguage } = await import('../../src/components/SelectorLanguage.vue')
    const { useCookieStore } = await import('../../src/stores/cookieStore.js')

    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(SelectorLanguage, { global: { plugins: [pinia, i18n] } })

    await wrapper.get('button').trigger('click')
    // Attendre l'échec réel du chargement, pas seulement l'état initial (déjà 'fr').
    await vi.waitFor(() => expect(warn).toHaveBeenCalled())
    await wrapper.vm.$nextTick()

    expect(i18n.global.locale.value).toBe('fr')
    expect(wrapper.text()).toBe('FR')
    expect(useCookieStore().getComfortData('locale', null)).not.toBe('en')
  })

  it("SelectorLanguage le signale par un toast, dans la langue DEMANDÉE", async () => {
    makeEnUnavailable()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { wrapper } = await mountSelector()

    await wrapper.get('button').trigger('click')
    await vi.waitFor(() => expect(warn).toHaveBeenCalled())
    await vi.waitFor(() => expect(pushError).toHaveBeenCalledOnce())

    // Qui clique sur « EN » ne lit peut-être pas le français : le message est en anglais, et
    // propose de recharger — un import dynamique raté reste en échec dans le registre de
    // modules du navigateur, un second clic ne retenterait rien (vérifié le 24/09/2026).
    const message = pushError.mock.calls[0][0]
    expect(message).toContain('English could not be loaded')
    expect(message).toMatch(/reload the page/i)
  })

  it("la locale n'est jamais basculée, même un instant, quand l'anglais échoue", async () => {
    makeEnUnavailable()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { default: i18n, setLocale } = await importI18n()

    // Observateur synchrone : il enregistre CHAQUE valeur prise par la locale, pas seulement
    // la dernière. Un état à moitié basculé — locale posée avant la résolution du chargement,
    // puis rétablie — passerait inaperçu d'une simple lecture finale.
    const seen = []
    const stop = watch(i18n.global.locale, (value) => seen.push(value), { flush: 'sync' })

    await setLocale('en')
    stop()

    expect(seen).not.toContain('en')
    expect(i18n.global.locale.value).toBe('fr')
    expect(document.documentElement.getAttribute('lang')).not.toBe('en')
  })
})

describe('i18n — anglais disponible', () => {
  it('bascule, et les consommateurs hors composant suivent (instance unique)', async () => {
    const { setLocale } = await importI18n()
    const { default: useValidators } = await import('../../src/modules/Validators.js')

    await expect(setLocale('en')).resolves.toBe('en')

    // Validators.js utilise i18n.global.t : c'est lui qui restait en français quand une
    // seconde instance, jamais basculée, lui était réservée.
    expect(useValidators().isRequired('email', '')).toContain('is required')
    expect(document.documentElement.getAttribute('lang')).toBe('en')
  })

  it("SelectorLanguage bascule sans toast d'erreur", async () => {
    const { i18n, wrapper } = await mountSelector()

    await wrapper.get('button').trigger('click')
    await vi.waitFor(() => expect(i18n.global.locale.value).toBe('en'))

    expect(pushError).not.toHaveBeenCalled()
  })
})
