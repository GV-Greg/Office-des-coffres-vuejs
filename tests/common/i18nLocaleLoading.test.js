import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

beforeEach(() => {
  vi.resetModules()
  vi.doUnmock(EN_PATH)
  localStorage.clear()
})

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
})
