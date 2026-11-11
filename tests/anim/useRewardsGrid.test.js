import { describe, it, expect, vi, beforeEach } from 'vitest'
import useRewardsGrid from '../../src/use/useRewardsGrid'
import { http } from '../../src/api.js'

// Les appels de la Grille des lots : aucune règle ici, mais deux CONTRATS qui se perdent facilement — le mode sans compte n'envoie JAMAIS de
// jeton et met le mot de passe dans le CORPS (jamais dans l'adresse) ; le mode privé envoie le jeton. Le tirage mène directement à
// `confirmed` : aucun geste « confirm ».

vi.mock('../../src/api.js', () => ({ http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))
vi.mock('../../src/stores/authStore', () => ({ useAuthStore: () => ({ getToken: 'jeton' }) }))

const ok = (data = {}) => Promise.resolve({ data: { success: true, ...data } })
const BEARER = { headers: { Authorization: 'Bearer jeton' } }

beforeEach(() => {
  vi.clearAllMocks()
  http.get.mockImplementation(() => ok({ grid: { slug: 'x' }, grids: [], proposal: 'x' }))
  http.post.mockImplementation(() => ok({ grid: { slug: 'x' } }))
  http.patch.mockImplementation(() => ok({ grid: { slug: 'x' } }))
  http.delete.mockImplementation(() => ok())
})

describe('useRewardsGrid — lecture publique', () => {
  it('page par slug encodé, aperçu du slug : sans jeton, sur les routes de la grille', async () => {
    const api = useRewardsGrid()

    await api.show('foire-de-toulouse')
    await api.slug({ name: 'Foire de Toulouse' })
    await api.slug({ slug: 'abc' })

    expect(http.get.mock.calls).toEqual([
      ['anim/rewards-grids/foire-de-toulouse'],
      ['anim/rewards-slug', { params: { name: 'Foire de Toulouse' } }],
      ['anim/rewards-slug', { params: { slug: 'abc' } }],
    ])
  })
})

describe('useRewardsGrid — mode privé', () => {
  it('liste et création : avec le jeton', async () => {
    const api = useRewardsGrid()

    await api.list(7)
    await api.create(7, { slug: 'abc', name: 'Abc' })

    expect(http.get).toHaveBeenCalledWith('characters/7/rewards-grids', BEARER)
    expect(http.post).toHaveBeenCalledWith('characters/7/rewards-grids', { slug: 'abc', name: 'Abc' }, BEARER)
  })

  it('les gestes passent par l\'identifiant de la grille, avec le jeton', async () => {
    const g = useRewardsGrid().asOrganizer()
    const grid = { id: 4 }

    await g.addLots(grid, ['Épée', 'Épée'])
    await g.removeLot(grid, 9)
    await g.draw(grid)
    await g.assign(grid, 9, { player: 'Aldric' })
    await g.markTaken(grid, 9, { is_taken: true })
    await g.close(grid)
    await g.reopen(grid)
    await g.remove(grid)

    expect(g.mode).toBe('private')
    expect(http.post.mock.calls).toEqual([
      ['rewards-grids/4/lots', { names: ['Épée', 'Épée'] }, BEARER], // UNE requête pour plusieurs lots (limite de débit de l'API)
      ['rewards-grids/4/draw', {}, BEARER],
      ['rewards-grids/4/close', {}, BEARER],
      ['rewards-grids/4/reopen', {}, BEARER],
    ])
    expect(http.patch.mock.calls).toEqual([
      ['rewards-grids/4/lots/9/assign', { player: 'Aldric' }, BEARER],
      ['rewards-grids/4/lots/9/taken', { is_taken: true }, BEARER],
    ])
    expect(http.delete.mock.calls).toEqual([['rewards-grids/4/lots/9', BEARER], ['rewards-grids/4', BEARER]])
  })

  it('aucun geste « confirm » : le tirage confirme', () => {
    expect(useRewardsGrid().asOrganizer().confirm).toBeUndefined()
    expect(useRewardsGrid().asAnonymous('x', 'y').confirm).toBeUndefined()
  })
})

describe('useRewardsGrid — mode sans compte', () => {
  it('crée sans jeton', async () => {
    await useRewardsGrid().createAnonymous({ slug: 'abc', name: 'Abc' })

    expect(http.post).toHaveBeenCalledWith('anim/rewards-manage', { slug: 'abc', name: 'Abc' })
  })

  it('le mot de passe est dans le CORPS de chaque geste, jamais dans l\'adresse, et aucun jeton n\'est envoyé', async () => {
    const g = useRewardsGrid().asAnonymous('foire-de-toulouse', 'un-bon-mot-de-passe')
    const grid = { id: 1 }

    await g.addLots(grid, ['Épée', 'Pain'])
    await g.draw(grid)
    await g.assign(grid, 9, { player: 'Aldric' })
    await g.markTaken(grid, 9, { is_taken: false })
    await g.close(grid)
    await g.removeLot(grid, 9)

    expect(g.mode).toBe('anonymous')
    expect(http.post.mock.calls).toEqual([
      ['anim/rewards-manage/foire-de-toulouse/lots', { password: 'un-bon-mot-de-passe', names: ['Épée', 'Pain'] }],
      ['anim/rewards-manage/foire-de-toulouse/draw', { password: 'un-bon-mot-de-passe' }],
      ['anim/rewards-manage/foire-de-toulouse/close', { password: 'un-bon-mot-de-passe' }],
    ])
    expect(http.patch.mock.calls).toEqual([
      ['anim/rewards-manage/foire-de-toulouse/lots/9/assign', { password: 'un-bon-mot-de-passe', player: 'Aldric' }],
      ['anim/rewards-manage/foire-de-toulouse/lots/9/taken', { password: 'un-bon-mot-de-passe', is_taken: false }],
    ])
    expect(http.delete).toHaveBeenCalledWith('anim/rewards-manage/foire-de-toulouse/lots/9', { data: { password: 'un-bon-mot-de-passe' } })
    expect(JSON.stringify([...http.post.mock.calls, ...http.patch.mock.calls])).not.toContain('jeton')
  })

  it('ouvrir, demander un lien, choisir un mot de passe, confirmer l\'email : routes de la grille', async () => {
    const api = useRewardsGrid()

    await api.open('abc', 'secret')
    await api.requestReset('abc')
    await api.completeReset('abc', { token: 't', password: 'p', password_confirmation: 'p' })
    await api.confirmEmail({ slug: 'abc', hash: 'h', expires: '1', signature: 's' })

    expect(http.post.mock.calls).toEqual([
      ['anim/rewards-manage/abc/open', { password: 'secret' }],
      ['anim/rewards-manage/abc/reset-request'],
      ['anim/rewards-manage/abc/reset-complete', { token: 't', password: 'p', password_confirmation: 'p' }],
    ])
    expect(http.get).toHaveBeenCalledWith('anim/rewards-email-confirm/abc/h', { params: { expires: '1', signature: 's' } })
  })
})
