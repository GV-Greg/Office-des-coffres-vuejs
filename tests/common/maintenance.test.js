import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import fs from 'node:fs'
import { resolve } from 'node:path'
import { http } from '../../src/api.js'
import router from '../../src/router/index.js'
import useMaintenance, {
  BYPASS_HEADER, DEFAULT_RETRY_SECONDS, clearBypass, getBypass, isMaintenanceError, setBypass,
} from '../../src/use/useMaintenance.js'
import MaintenanceNotice from '../../src/components/MaintenanceNotice.vue'
import LoadingOverlay from '../../src/components/LoadingOverlay.vue'
import GateIllustration from '../../src/components/loading/GateIllustration.vue'
import useNavigationLoading from '../../src/use/useNavigationLoading.js'
import { PROBE_TIMEOUT_MS, TRY_BYPASS_TIMEOUT_MS, probeMaintenance, tryBypass } from '../../src/use/maintenanceProbe.js'

// Mode maintenance (brief admin/content/brief-mode-maintenance.md, 18/11/2026).

const SECRET = 'secret-de-test-0123456789'
const maintenanceError = (data = { success: false, message: 'maintenance', retry_after: 300 }, status = 503) => {
  const error = new Error('Request failed with status code ' + status)
  error.response = { status, data }
  return error
}

const original = http.defaults.adapter
const state = useMaintenance()

const messages = {
  fr: JSON.parse(fs.readFileSync(resolve(process.cwd(), 'src/locales/fr.json'), 'utf-8')),
  en: JSON.parse(fs.readFileSync(resolve(process.cwd(), 'src/locales/en.json'), 'utf-8')),
}
// Démontés après chaque test : un composant resté monté sonde encore l'API dès que l'état passe à « fermé ».
const mounted = []
const mountNotice = (locale = 'fr') => {
  const wrapper = mount(MaintenanceNotice, {
    global: { plugins: [createI18n({ legacy: false, locale, messages })] },
  })
  mounted.push(wrapper)
  return wrapper
}

beforeEach(() => {
  clearBypass()
  state.isMaintenance.value = false
  state.isChecking.value = false
})
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  http.defaults.adapter = original
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useMaintenance', () => {
  it('ne reconnaît que le 503 « maintenance » de Laravel, pas un 503 quelconque de l\'hébergeur', () => {
    expect(isMaintenanceError(maintenanceError())).toBe(true)
    expect(isMaintenanceError(maintenanceError('<html>Service Unavailable</html>'))).toBe(false)
    expect(isMaintenanceError(maintenanceError({ message: 'maintenance' }, 500))).toBe(false)
    expect(isMaintenanceError(new Error('Network Error'))).toBe(false)
  })

  it('n\'accepte qu\'un secret de la forme que le déploiement impose', () => {
    for (const bad of ['', 'a b', 'a"b', 'é', 'x'.repeat(129), undefined]) {
      expect(setBypass(bad)).toBe(false)
    }
    expect(getBypass()).toBe('')
    expect(setBypass(SECRET)).toBe(true)
    expect(getBypass()).toBe(SECRET)
  })

  it('garde le secret pour l\'onglet seulement, et le retire à la demande', () => {
    setBypass(SECRET)
    expect(sessionStorage.getItem('maintenance_bypass')).toBe(SECRET)
    expect(localStorage.getItem('maintenance_bypass')).toBeNull()

    clearBypass()
    expect(sessionStorage.getItem('maintenance_bypass')).toBeNull()
    expect(getBypass()).toBe('')
  })

  it('un secret présenté retire la page de maintenance affichée avant', () => {
    state.isMaintenance.value = true
    setBypass(SECRET)
    expect(state.isMaintenance.value).toBe(false)
  })
})

describe('api.js', () => {
  it('une 503 « maintenance » fait afficher la page, avec le délai annoncé', async () => {
    http.defaults.adapter = () => Promise.reject(maintenanceError({ message: 'maintenance', retry_after: 120 }))

    await expect(http.get('map')).rejects.toBeTruthy()

    expect(state.isMaintenance.value).toBe(true)
    expect(state.retryAfter.value).toBe(120)
  })

  it('sans délai lisible, retombe sur celui du brief (300 s)', async () => {
    http.defaults.adapter = () => Promise.reject(maintenanceError({ message: 'maintenance' }))
    await expect(http.get('map')).rejects.toBeTruthy()
    expect(state.retryAfter.value).toBe(DEFAULT_RETRY_SECONDS)
  })

  it('un 503 sans le corps de Laravel n\'est pas une maintenance', async () => {
    http.defaults.adapter = () => Promise.reject(maintenanceError('Service Unavailable'))
    await expect(http.get('map')).rejects.toBeTruthy()
    expect(state.isMaintenance.value).toBe(false)
  })

  it('présente le secret dans X-Maintenance-Bypass, et seulement s\'il existe', async () => {
    const seen = []
    http.defaults.adapter = (config) => {
      seen.push(config.headers[BYPASS_HEADER])
      return Promise.resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config })
    }

    await http.get('map')
    setBypass(SECRET)
    await http.get('map')

    expect(seen).toEqual([undefined, SECRET])
  })
})

describe('MaintenanceNotice', () => {
  it('n\'affiche rien tant que l\'Office est ouvert', () => {
    const wrapper = mountNotice()
    expect(wrapper.find('[data-testid="maintenance-page"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="maintenance-bypass-banner"]').exists()).toBe(false)
  })

  it('affiche la page, en français puis en anglais, sans lien ni navigation', async () => {
    state.isMaintenance.value = true

    const fr = mountNotice('fr')
    expect(fr.get('h1').text()).toBe('Maintenance en cours')
    expect(fr.get('[data-testid="maintenance-logo"]').attributes('alt')).toBe(messages.fr.Common.SiteName)
    expect(fr.text()).toContain("L'Office est momentanément fermé pour travaux. Revenez dans quelques instants.")
    expect(fr.get('[data-testid="maintenance-descriptor"]').text()).toBe("Site d'aide, non officiel, à la communauté du jeu Renaissance Kingdoms.")
    expect(fr.get('[data-testid="maintenance-intro"]').text()).toContain("qui vous proposera des coffres")
    expect(fr.get('[data-testid="maintenance-access"]').text()).toContain('Vous pourrez bientôt franchir le seuil de l\'Office')
    expect(fr.find('a').exists()).toBe(false)
    // Aucune navigation ; le seul bouton est l'accès administrateur (Greg, 18/11/2026).
    expect(fr.findAll('button').map((b) => b.attributes('data-testid'))).toEqual(['maintenance-admin-toggle'])
    expect(fr.get('[data-testid="maintenance-admin-toggle"]').text()).toBe('Accès administrateur')

    const en = mountNotice('en')
    expect(en.get('h1').text()).toBe('Maintenance in progress')
    expect(en.get('[data-testid="maintenance-access"]').text()).toContain('You will soon be able to cross the threshold')
    expect(en.get('[data-testid="maintenance-descriptor"]').text()).toBe('Unofficial help site for the Renaissance Kingdoms community.')
    expect(en.text()).toContain('The Office is momentarily closed for maintenance. Please come back shortly.')
  })

  it('rappelle à l\'administrateur qu\'il voit l\'Office fermé, et lui laisse sortir', async () => {
    setBypass(SECRET)
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })

    const wrapper = mountNotice()
    expect(wrapper.find('[data-testid="maintenance-page"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="maintenance-bypass-banner"]').text()).toContain('Accès de maintenance')

    await wrapper.get('[data-testid="maintenance-bypass-leave"]').trigger('click')

    expect(getBypass()).toBe('')
    expect(reload).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('recharge dès que l\'API répond autrement que par la maintenance', async () => {
    vi.useFakeTimers()
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    state.isMaintenance.value = true
    mountNotice()

    // Encore fermé : on ne recharge pas.
    http.defaults.adapter = () => Promise.reject(maintenanceError())
    await vi.advanceTimersByTimeAsync(30000)
    expect(reload).not.toHaveBeenCalled()

    // Rouvert.
    http.defaults.adapter = (config) => Promise.resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config })
    await vi.advanceTimersByTimeAsync(30000)
    await flushPromises()
    expect(reload).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})

describe('route /maintenance/:secret', () => {
  it('retient le secret puis renvoie à l\'accueil, sans laisser la page dans l\'historique', () => {
    const route = router.getRoutes().find((r) => r.name === 'maintenance-bypass')

    expect(route.path).toBe('/maintenance/:secret')
    expect(route.beforeEnter({ params: { secret: SECRET } })).toEqual({ name: 'home', replace: true })
    expect(getBypass()).toBe(SECRET)
  })

  it('ignore un secret de forme invalide', () => {
    const route = router.getRoutes().find((r) => r.name === 'maintenance-bypass')

    route.beforeEnter({ params: { secret: 'pas valide!' } })

    expect(getBypass()).toBe('')
  })
})

describe('sonde de démarrage', () => {
  const answer = (status, data) => (config) => Promise.resolve({ data, status, statusText: '', headers: {}, config })

  it('Office fermé : la page de maintenance s\'affiche, le chargement est levé', async () => {
    http.defaults.adapter = answer(503, { success: false, message: 'maintenance', retry_after: 300 })

    await probeMaintenance()

    expect(state.isMaintenance.value).toBe(true)
    expect(state.isChecking.value).toBe(false)
  })

  it('Office ouvert : l\'API répond 401 sans jeton, c\'est la réponse normale — le site s\'ouvre', async () => {
    http.defaults.adapter = answer(401, { message: 'Unauthenticated.' })

    await probeMaintenance()

    expect(state.isMaintenance.value).toBe(false)
    expect(state.isChecking.value).toBe(false)
  })

  it('n\'envoie aucun jeton, et borne l\'attente', async () => {
    let seen
    http.defaults.adapter = (config) => {
      seen = config
      return answer(401, {})(config)
    }

    await probeMaintenance()

    expect(seen.url).toBe('auth/me')
    expect(seen.headers.Authorization).toBeUndefined()
    expect(seen.timeout).toBe(PROBE_TIMEOUT_MS)
  })

  it('API injoignable ou trop lente : le site s\'ouvre, jamais bloqué', async () => {
    http.defaults.adapter = () => Promise.reject(new Error('timeout of 2500ms exceeded'))

    await probeMaintenance()

    expect(state.isMaintenance.value).toBe(false)
    expect(state.isChecking.value).toBe(false)
  })

  it('un 503 qui n\'est pas celui de Laravel n\'est pas une maintenance', async () => {
    http.defaults.adapter = answer(503, '<html>Service Unavailable</html>')

    await probeMaintenance()

    expect(state.isMaintenance.value).toBe(false)
  })

  it('le loader global couvre le site pendant la vérification, puis se retire', async () => {
    const wrapper = mount(LoadingOverlay, {
      global: { plugins: [createI18n({ legacy: false, locale: 'fr', messages })] },
    })
    mounted.push(wrapper)
    expect(wrapper.find('[role="status"]').exists()).toBe(false)

    let release
    http.defaults.adapter = (config) => new Promise((resolve) => {
      release = () => resolve({ data: {}, status: 401, statusText: '', headers: {}, config })
    })
    const probing = probeMaintenance()
    await flushPromises()

    expect(wrapper.get('[role="status"]').text()).toContain('Vous entrez dans l\'Office')
    expect(wrapper.get('[role="status"]').text()).not.toContain('la salle')

    release()
    await probing
    await flushPromises()

    expect(state.isChecking.value).toBe(false)
  })
})

describe('loader de la vérification de démarrage', () => {
  it('garde le halo orange de l\'Office, même si la page d\'arrivée est un module coloré', async () => {
    const navigation = useNavigationLoading()
    const wrapper = mount(LoadingOverlay, {
      global: { plugins: [createI18n({ legacy: false, locale: 'fr', messages })] },
    })
    mounted.push(wrapper)

    // Navigation vers Animation en cours (sarcelle) pendant la vérification.
    vi.useFakeTimers()
    navigation.startNavigationLoading('chest', { accent: 'teal' })
    vi.advanceTimersByTime(150)
    state.isChecking.value = true
    await flushPromises()

    expect(wrapper.findComponent(GateIllustration).props('accent')).toBe('office')
    expect(wrapper.get('[role="status"]').text()).toContain('Vous entrez dans l\'Office')

    // Sans vérification, la navigation reprend la couleur de son module.
    state.isChecking.value = false
    await flushPromises()
    expect(wrapper.findComponent(GateIllustration).props('accent')).toBe('teal')

    navigation.stopNavigationLoading()
  })
})

describe('accès administrateur depuis la page de maintenance', () => {
  const answer = (status, data) => (config) => Promise.resolve({ data, status, statusText: '', headers: {}, config })
  const maintenance503 = { success: false, message: 'maintenance', retry_after: 300 }

  it('essaie le secret auprès de l\'API, sans jeton, avec l\'en-tête de contournement, avant de le garder', async () => {
    let seen
    http.defaults.adapter = (config) => {
      seen = config
      return answer(401, { message: 'Unauthenticated.' })(config)
    }

    expect(await tryBypass(`  ${SECRET} `)).toBe('ok')

    expect(seen.url).toBe('auth/me')
    expect(seen.headers[BYPASS_HEADER]).toBe(SECRET)
    expect(seen.headers.Authorization).toBeUndefined()
    expect(seen.timeout).toBe(TRY_BYPASS_TIMEOUT_MS)
    expect(getBypass()).toBe(SECRET)
  })

  it('un secret refusé par l\'API (toujours 503) n\'est pas mémorisé', async () => {
    http.defaults.adapter = answer(503, maintenance503)

    expect(await tryBypass(SECRET)).toBe('refused')
    expect(getBypass()).toBe('')
  })

  it('un secret de forme invalide n\'atteint même pas l\'API', async () => {
    const adapter = vi.fn()
    http.defaults.adapter = adapter

    for (const bad of ['', '   ', 'a b', 'a"b', 'é', 'x'.repeat(129), undefined]) {
      expect(await tryBypass(bad)).toBe('refused')
    }
    expect(adapter).not.toHaveBeenCalled()
  })

  it('un réseau coupé ou un délai dépassé est dit comme tel, rien n\'est mémorisé', async () => {
    http.defaults.adapter = () => Promise.reject(new Error('Network Error'))

    expect(await tryBypass(SECRET)).toBe('error')
    expect(getBypass()).toBe('')
  })

  it('l\'en-tête essayé l\'emporte sur un ancien secret mémorisé (intercepteur de api.js)', async () => {
    setBypass('ancien-secret-0123456789')
    let seen
    http.defaults.adapter = (config) => {
      seen = config.headers[BYPASS_HEADER]
      return answer(503, maintenance503)(config)
    }

    await tryBypass(SECRET)

    expect(seen).toBe(SECRET)
  })

  it('le lien ouvre un champ masqué, le bon secret ouvre l\'accès et recharge le site', async () => {
    state.isMaintenance.value = true
    http.defaults.adapter = answer(401, { message: 'Unauthenticated.' })
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })

    const wrapper = mountNotice()
    expect(wrapper.find('[data-testid="maintenance-admin-form"]').exists()).toBe(false)

    await wrapper.get('[data-testid="maintenance-admin-toggle"]').trigger('click')
    const input = wrapper.get('[data-testid="maintenance-admin-input"]')
    expect(input.attributes('type')).toBe('password')
    expect(wrapper.get('[data-testid="maintenance-admin-submit"]').attributes('disabled')).toBeDefined()

    await input.setValue(SECRET)
    await wrapper.get('[data-testid="maintenance-admin-form"]').trigger('submit')
    await flushPromises()

    expect(getBypass()).toBe(SECRET)
    expect(reload).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  it('un mauvais secret affiche « Secret refusé. », vide le champ, ne recharge pas', async () => {
    state.isMaintenance.value = true
    http.defaults.adapter = answer(503, maintenance503)
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })

    const wrapper = mountNotice()
    await wrapper.get('[data-testid="maintenance-admin-toggle"]').trigger('click')
    await wrapper.get('[data-testid="maintenance-admin-input"]').setValue(SECRET)
    await wrapper.get('[data-testid="maintenance-admin-form"]').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[data-testid="maintenance-admin-error"]').text()).toBe('Secret refusé.')
    expect(wrapper.get('[data-testid="maintenance-admin-input"]').element.value).toBe('')
    expect(getBypass()).toBe('')
    expect(reload).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('en anglais, le lien et le message d\'erreur sont traduits', async () => {
    state.isMaintenance.value = true
    http.defaults.adapter = () => Promise.reject(new Error('Network Error'))

    const wrapper = mountNotice('en')
    expect(wrapper.get('[data-testid="maintenance-admin-toggle"]').text()).toBe('Administrator access')
    await wrapper.get('[data-testid="maintenance-admin-toggle"]').trigger('click')
    await wrapper.get('[data-testid="maintenance-admin-input"]').setValue(SECRET)
    await wrapper.get('[data-testid="maintenance-admin-form"]').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[data-testid="maintenance-admin-error"]').text()).toBe('Could not verify, please try again.')
  })

  it('le secret n\'est écrit dans aucun fichier du site', () => {
    const dir = resolve(process.cwd(), 'src')
    const files = []
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(resolve(d, e.name)) : files.push(resolve(d, e.name))))
    walk(dir)
    const offenders = files.filter((f) => /\.(js|vue|json|html)$/.test(f) && /MAINTENANCE_SECRET|VITE_MAINTENANCE/.test(fs.readFileSync(f, 'utf-8')))
    expect(offenders, 'aucune variable de secret de maintenance côté site (le bundle est public)').toEqual([])
  })
})
