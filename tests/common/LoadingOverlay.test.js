import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import LoadingOverlay from '../../src/components/LoadingOverlay.vue'
import useNavigationLoading from '../../src/use/useNavigationLoading.js'

const i18n = createI18n({
  legacy: false,
  locale: 'fr',
  messages: {
    fr: { Common: { LoadingRoom: 'Vous entrez dans la salle…', LoadingApi: 'Le greffe traite votre demande…' } },
    en: { Common: { LoadingRoom: 'You step into the room…', LoadingApi: 'The clerk is handling your request…' } }
  }
})

function mountOverlay() {
  return mount(LoadingOverlay, { global: { plugins: [i18n] } })
}

describe('LoadingOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    const { stopNavigationLoading } = useNavigationLoading()
    stopNavigationLoading()
    vi.useRealTimers()
  })

  it("reste invisible tant qu'aucune navigation n'est en cours", () => {
    const wrapper = mountOverlay()
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it('affiche le portique et « Vous entrez dans la salle » pour une navigation générale', async () => {
    const { startNavigationLoading } = useNavigationLoading()
    const wrapper = mountOverlay()
    startNavigationLoading('office')
    vi.advanceTimersByTime(150)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.gate').exists()).toBe(true)
    expect(wrapper.find('.gate .icon').attributes('name')).toBe('gi-dungeon-gate')
    expect(wrapper.find('.greffe-in').exists()).toBe(false)
    expect(wrapper.text()).toContain('Vous entrez dans la salle')
  })

  it('le portique d\'un module « Coffres X » prend la couleur du module', async () => {
    const { startNavigationLoading } = useNavigationLoading()
    const wrapper = mountOverlay()
    startNavigationLoading('chest', { accent: 'rose' })
    vi.advanceTimersByTime(150)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.gate').attributes('style')).toContain('--gate-ink: #e11d48')
    expect(wrapper.text()).toContain('Vous entrez dans la salle')
  })

  it('hors module, le portique reste neutre même si une couleur est passée', async () => {
    const { startNavigationLoading } = useNavigationLoading()
    const wrapper = mountOverlay()
    startNavigationLoading('office', { accent: 'rose' })
    vi.advanceTimersByTime(150)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.gate').attributes('style')).toContain('--gate-ink: #f97316')
  })

  it('affiche le registre du greffe, pas le portique, pendant un envoi à l\'API', async () => {
    const { startNavigationLoading } = useNavigationLoading()
    const wrapper = mountOverlay()
    startNavigationLoading('api')
    vi.advanceTimersByTime(150)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.greffe-in').attributes('name')).toBe('gi-scroll-unfurled')
    expect(wrapper.find('.gate').exists()).toBe(false)
    expect(wrapper.text()).toContain('Le greffe traite votre demande')
  })

  it('expose role="status" et aria-live="polite" pour l\'accessibilité', async () => {
    const { startNavigationLoading } = useNavigationLoading()
    const wrapper = mountOverlay()
    startNavigationLoading('office')
    vi.advanceTimersByTime(150)
    await wrapper.vm.$nextTick()
    const el = wrapper.find('[role="status"]')
    expect(el.exists()).toBe(true)
    expect(el.attributes('aria-live')).toBe('polite')
  })
})
