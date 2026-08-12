import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import LoadingOverlay from '../../src/components/LoadingOverlay.vue'
import useNavigationLoading from '../../src/use/useNavigationLoading.js'

const i18n = createI18n({
  legacy: false,
  locale: 'fr',
  messages: {
    fr: { Common: { LoadingOffice: "Ouverture de l'office…", LoadingChest: 'Ouverture du coffre…' } },
    en: { Common: { LoadingOffice: 'Opening the office…', LoadingChest: 'Opening the chest…' } }
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

  it('affiche le pavillon et le texte "office" pour une navigation générale', async () => {
    const { startNavigationLoading } = useNavigationLoading()
    const wrapper = mountOverlay()
    startNavigationLoading('office')
    vi.advanceTimersByTime(150)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.chest-icon').attributes('name')).toBe('gi-medieval-pavilion')
    expect(wrapper.text()).toContain("Ouverture de l'office")
  })

  it('affiche le coffre et le texte "coffre" pour un module Coffres X', async () => {
    const { startNavigationLoading } = useNavigationLoading()
    const wrapper = mountOverlay()
    startNavigationLoading('chest')
    vi.advanceTimersByTime(150)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.chest-icon').attributes('name')).toBe('gi-chest')
    expect(wrapper.text()).toContain('Ouverture du coffre')
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
