import { describe, it, expect, vi } from 'vitest'
import { watch, reactive } from 'vue'

// Du portail d'accueil vers l'Accueil, un connecté passe par /login qui le redirige vers `home` (après la vérification du jeton).
// Le loader ne doit dire qu'UNE phrase : « Vous entrez dans l'Office » (contexte `entry`), jamais « la salle » (`office`) avant.

const auth = reactive({ isLoggedIn: true, checkAuth: () => new Promise(r => setTimeout(() => r(true), 400)) })
vi.mock('../../src/stores/authStore', () => ({ useAuthStore: () => auth }))
vi.mock('../../src/api.js', () => ({ http: { get: vi.fn(), post: vi.fn() }, ADMIN_ORIGIN: '' }))

describe('loader du portail d\'accueil vers l\'Accueil', () => {
  it('connecté : une seule phrase (« entry ») pendant toute la redirection /login → home', async () => {
    const { default: router } = await import('../../src/router/index.js')
    const { default: useNavigationLoading } = await import('../../src/use/useNavigationLoading.js')
    const { isNavigationLoading, navigationContext } = useNavigationLoading()
    await router.push('/')
    await router.isReady()

    const shown = new Set()
    watch([isNavigationLoading, navigationContext], ([visible, context]) => { if (visible) shown.add(context) }, { flush: 'sync' })
    await router.push('/login')

    expect(router.currentRoute.value.name).toBe('home')
    expect([...shown]).toEqual(['entry'])
  }, 20000)
})
