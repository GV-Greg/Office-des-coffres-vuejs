import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

/*
  Pas d'écran de chargement entre les pages d'authentification (Greg, 25/11/2026) : « Vous entrez dans la salle… » entre la connexion et « mot de passe oublié »
  n'avait pas de sens. Le routeur n'appelle pas `startNavigationLoading` quand on va d'une page d'authentification à une autre ; ailleurs, rien ne change.
*/
const startNavigationLoading = vi.fn()
vi.mock('../../src/use/useNavigationLoading', () => ({
  default: () => ({ startNavigationLoading, stopNavigationLoading: vi.fn(), trackApiCall: vi.fn(), isNavigationLoading: { value: false }, navigationContext: { value: 'office' }, navigationAccent: { value: 'office' } }),
}))
vi.mock('../../src/api.js', () => ({ http: { post: vi.fn(), get: vi.fn() } }))

const { default: router } = await import('../../src/router/index.js')

beforeEach(async () => {
  setActivePinia(createPinia())
  await router.push('/login')
  await router.isReady()
  startNavigationLoading.mockClear()
})

describe('routeur — le loader de navigation entre les pages d\'authentification', () => {
  it('connexion → mot de passe oublié → connexion : aucun écran de chargement', async () => {
    await router.push('/forgot-password')
    await router.push('/login')

    expect(router.currentRoute.value.name).toBe('login')
    expect(startNavigationLoading).not.toHaveBeenCalled()
  })

  it('connexion ↔ inscription et vers la page du nouveau mot de passe : aucun écran non plus', async () => {
    await router.push('/register')
    await router.push({ name: 'reset-password', query: { token: 't', email: 'a@b.c' } })

    expect(router.currentRoute.value.name).toBe('reset-password')
    expect(startNavigationLoading).not.toHaveBeenCalled()
  })

  it('en quittant les pages d\'authentification pour une autre page, l\'écran reste (contexte inchangé)', async () => {
    await router.push('/forgot-password')
    startNavigationLoading.mockClear()

    await router.push('/')

    expect(startNavigationLoading).toHaveBeenCalledTimes(1)
    expect(startNavigationLoading.mock.calls[0][0]).toBe('office')
  })
})
