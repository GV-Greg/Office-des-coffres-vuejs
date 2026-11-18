import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import fs from 'node:fs'
import { resolve } from 'node:path'
import { http } from '../../src/api.js'
import AnnouncementBanner from '../../src/components/AnnouncementBanner.vue'
import { fetchCurrentAnnouncement, isExpired, pickMessage } from '../../src/use/useAnnouncement.js'

// Bandeau d'annonce de l'accueil (18/11/2026) : le serveur sert la seule annonce en cours, le site la fait défiler de droite à gauche.

const messages = {
  fr: JSON.parse(fs.readFileSync(resolve(process.cwd(), 'src/locales/fr.json'), 'utf-8')),
  en: JSON.parse(fs.readFileSync(resolve(process.cwd(), 'src/locales/en.json'), 'utf-8')),
}
const original = http.defaults.adapter
const NOW = Date.parse('2026-11-18T10:00:00Z')

const announcement = (overrides = {}) => ({
  id: 1,
  message: { fr: 'Maintenance prévue cette semaine.', en: 'Maintenance planned this week.' },
  schedule: { type: 'period', starts_at: '2026-11-15T23:00:00Z', ends_at: '2026-11-22T22:59:59Z' },
  visible_until: '2026-11-22T22:59:59Z',
  ...overrides,
})
const serve = (body) => {
  http.defaults.adapter = (config) => Promise.resolve({ data: body, status: 200, statusText: 'OK', headers: {}, config })
}

const mounted = []
const mountBanner = async (locale = 'fr') => {
  const wrapper = mount(AnnouncementBanner, {
    global: { plugins: [createI18n({ legacy: false, locale, messages })] },
  })
  mounted.push(wrapper)
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  http.defaults.adapter = original
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useAnnouncement', () => {
  it('choisit la langue de l\'interface, à défaut l\'autre : une annonce n\'est jamais muette', () => {
    const a = announcement()
    expect(pickMessage(a, 'fr')).toBe('Maintenance prévue cette semaine.')
    expect(pickMessage(a, 'en')).toBe('Maintenance planned this week.')
    expect(pickMessage({ message: { fr: 'Seulement FR', en: '' } }, 'en')).toBe('Seulement FR')
    expect(pickMessage({ message: { fr: '', en: 'Only EN' } }, 'fr')).toBe('Only EN')
    expect(pickMessage(null, 'fr')).toBe('')
  })

  it('respecte la fin de visibilité du serveur, aussi pour une page restée ouverte', () => {
    expect(isExpired(announcement({ visible_until: '2026-11-18T09:59:59Z' }), NOW)).toBe(true)
    expect(isExpired(announcement({ visible_until: '2026-11-18T10:00:01Z' }), NOW)).toBe(false)
    expect(isExpired(announcement({ visible_until: null }), NOW)).toBe(false)
    expect(isExpired(announcement({ visible_until: 'pas une date' }), NOW)).toBe(false)
  })

  it('lit la route publique sans jeton, et ne rend rien sans annonce ni sur une panne', async () => {
    let seen
    http.defaults.adapter = (config) => {
      seen = config
      return Promise.resolve({ data: { success: true, announcement: announcement() }, status: 200, statusText: 'OK', headers: {}, config })
    }

    expect((await fetchCurrentAnnouncement(NOW)).id).toBe(1)
    expect(seen.url).toBe('announcements/current')
    expect(seen.headers.Authorization).toBeUndefined()

    serve({ success: true, announcement: null })
    expect(await fetchCurrentAnnouncement(NOW)).toBeNull()

    serve({ success: true, announcement: announcement({ visible_until: '2026-11-17T00:00:00Z' }) })
    expect(await fetchCurrentAnnouncement(NOW)).toBeNull()

    http.defaults.adapter = () => Promise.reject(new Error('Network Error'))
    expect(await fetchCurrentAnnouncement(NOW)).toBeNull()
  })
})

describe('AnnouncementBanner', () => {
  it('n\'affiche rien sans annonce', async () => {
    serve({ success: true, announcement: null })
    const wrapper = await mountBanner()
    expect(wrapper.find('[data-testid="announcement-banner"]').exists()).toBe(false)
  })

  it('fait défiler le message, en français puis en anglais, et le donne à plat aux lecteurs d\'écran', async () => {
    serve({ success: true, announcement: announcement() })

    const fr = await mountBanner('fr')
    const track = fr.get('[data-testid="announcement-track"]')
    expect(track.text()).toBe('Maintenance prévue cette semaine.')
    expect(track.attributes('aria-hidden')).toBe('true')
    expect(fr.get('[data-testid="announcement-marquee"] .sr-only').text()).toBe('Maintenance prévue cette semaine.')
    expect(fr.get('[data-testid="announcement-banner"]').attributes('aria-label')).toBe("Annonce de l'Office")

    const en = await mountBanner('en')
    expect(en.get('[data-testid="announcement-track"]').text()).toBe('Maintenance planned this week.')
  })

  it('défile un nombre FINI de passes (aucune animation sans fin), à une durée qui suit le message', async () => {
    serve({ success: true, announcement: announcement() })
    const wrapper = await mountBanner()
    const style = wrapper.get('[data-testid="announcement-track"]').attributes('style')

    expect(style).toContain('--announcement-passes: 3')
    expect(style).toMatch(/--announcement-duration: \d+(\.\d+)?s/)

    const long = await (async () => {
      serve({ success: true, announcement: announcement({ message: { fr: 'x'.repeat(400), en: 'x' } }) })
      return mountBanner()
    })()
    expect(long.get('[data-testid="announcement-track"]').attributes('style')).toContain('--announcement-duration: 45s')
  })

  it('une fois les passes faites, le message reste affiché en entier, à plat, sans bouton', async () => {
    serve({ success: true, announcement: announcement() })
    const wrapper = await mountBanner()

    await wrapper.get('[data-testid="announcement-track"]').trigger('animationend')

    expect(wrapper.find('[data-testid="announcement-track"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="announcement-static"]').text()).toBe('Maintenance prévue cette semaine.')
    expect(wrapper.find('[data-testid="announcement-toggle"]').exists()).toBe(false)
  })

  it('un bouton met le défilement en pause et le relance (WCAG 2.2.2)', async () => {
    serve({ success: true, announcement: announcement() })
    const wrapper = await mountBanner()
    const toggle = wrapper.get('[data-testid="announcement-toggle"]')

    expect(toggle.attributes('aria-label')).toBe("Mettre l'annonce en pause")
    expect(toggle.attributes('aria-pressed')).toBe('false')
    expect(wrapper.get('[data-testid="announcement-track"]').classes()).not.toContain('announcement-track--paused')

    await toggle.trigger('click')

    expect(toggle.attributes('aria-label')).toBe("Relancer le défilement de l'annonce")
    expect(toggle.attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="announcement-track"]').classes()).toContain('announcement-track--paused')

    await toggle.trigger('click')
    expect(wrapper.get('[data-testid="announcement-track"]').classes()).not.toContain('announcement-track--paused')
  })

  it('en mouvement réduit, le message est à plat d\'emblée', async () => {
    vi.stubGlobal('matchMedia', (query) => ({ matches: query.includes('prefers-reduced-motion'), media: query, addEventListener() {}, removeEventListener() {} }))
    serve({ success: true, announcement: announcement() })

    const wrapper = await mountBanner()

    expect(wrapper.find('[data-testid="announcement-track"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="announcement-static"]').text()).toBe('Maintenance prévue cette semaine.')
    expect(wrapper.find('[data-testid="announcement-toggle"]').exists()).toBe(false)
  })

  it('la feuille de style ne boucle pas à l\'infini et défile de droite à gauche', () => {
    const source = fs.readFileSync(resolve(process.cwd(), 'src/components/AnnouncementBanner.vue'), 'utf-8')

    expect(source).not.toMatch(/animation[^;]*infinite/)
    expect(source).toContain('translateX(-100%)')
    expect(source).toMatch(/from \{ transform: translateX\(0\)/)
  })
})
