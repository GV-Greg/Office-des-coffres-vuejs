import { describe, it, expect, vi, beforeEach } from 'vitest'
import useDecodeActivities from '../../src/use/useDecodeActivities'
import { http } from '../../src/api.js'

// Les appels de Décode le code : aucune règle ici, mais deux CONTRATS qui se perdent facilement — le mode sans compte n'envoie JAMAIS de
// jeton et met le mot de passe dans le CORPS (jamais dans l'adresse) ; le mode privé envoie le jeton.

vi.mock('../../src/api.js', () => ({ http: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))
vi.mock('../../src/stores/authStore', () => ({ useAuthStore: () => ({ getToken: 'jeton' }) }))

const ok = (data = {}) => Promise.resolve({ data: { success: true, ...data } })

beforeEach(() => {
  vi.clearAllMocks()
  http.get.mockImplementation(() => ok({ types: ['decode'], activity: { slug: 'x' }, bbcode: '[b]x[/b]' }))
  http.post.mockImplementation(() => ok({ activity: { slug: 'x' }, bbcode: '[b]x[/b]' }))
  http.delete.mockImplementation(() => ok())
})

describe('useDecodeActivities — lecture publique', () => {
  it('types, page par slug encodé, aperçu du slug : sans jeton', async () => {
    const api = useDecodeActivities()

    await api.types()
    await api.show('les-trois-coffres')
    await api.slug({ name: 'Les Trois Coffres' })
    await api.slug({ slug: 'abc' })

    expect(http.get.mock.calls).toEqual([
      ['anim/activity-types'],
      ['anim/decode-activities/les-trois-coffres'],
      ['anim/decode-slug', { params: { name: 'Les Trois Coffres' } }],
      ['anim/decode-slug', { params: { slug: 'abc' } }],
    ])
  })
})

describe('useDecodeActivities — mode sans compte', () => {
  it('crée sans jeton', async () => {
    await useDecodeActivities().createAnonymous({ slug: 'abc', name: 'Abc' })

    expect(http.post).toHaveBeenCalledWith('anim/decode-manage', { slug: 'abc', name: 'Abc' })
  })

  it('le mot de passe est dans le CORPS de chaque geste, jamais dans l\'adresse, et aucun jeton n\'est envoyé', async () => {
    const gestures = useDecodeActivities().asAnonymous('les-trois-coffres', 'un-bon-mot-de-passe')
    const activity = { id: 1 }

    await gestures.generateSecret(activity)
    await gestures.propose(activity, 11, { combination: '12345', character_name: 'Aldric' })
    await gestures.close(activity)
    await gestures.exportRules(activity)
    await gestures.exportResults(activity)

    expect(http.post.mock.calls).toEqual([
      ['anim/decode-manage/les-trois-coffres/secrets', { password: 'un-bon-mot-de-passe' }],
      ['anim/decode-manage/les-trois-coffres/secrets/11/proposals', { password: 'un-bon-mot-de-passe', combination: '12345', character_name: 'Aldric' }],
      ['anim/decode-manage/les-trois-coffres/close', { password: 'un-bon-mot-de-passe' }],
      ['anim/decode-manage/les-trois-coffres/export/rules', { password: 'un-bon-mot-de-passe' }],
      ['anim/decode-manage/les-trois-coffres/export/results', { password: 'un-bon-mot-de-passe' }],
    ])
    for (const call of http.post.mock.calls) {
      expect(call[0]).not.toContain('un-bon-mot-de-passe')
      expect(call[2]).toBeUndefined() // pas de configuration, donc pas d'en-tête Authorization
    }
  })

  it('open prouve le mot de passe et rend l\'état de gestion', async () => {
    const activity = await useDecodeActivities().open('les-trois-coffres', 'un-bon-mot-de-passe')

    expect(http.post).toHaveBeenCalledWith('anim/decode-manage/les-trois-coffres/open', { password: 'un-bon-mot-de-passe' })
    expect(activity).toEqual({ slug: 'x' })
  })

  it('n\'offre ni « rouvrir » ni « supprimer » : la clôture est définitive (D19), l\'auteur ne supprime pas (D13)', () => {
    const gestures = useDecodeActivities().asAnonymous('abc', 'secret')

    expect(gestures.mode).toBe('anonymous')
    expect(gestures.reopen).toBeUndefined()
    expect(gestures.remove).toBeUndefined()
  })

  it('réinitialisation : la demande ne porte aucun mot de passe ; la fin porte le jeton et le nouveau mot de passe dans le corps', async () => {
    const api = useDecodeActivities()

    await api.requestReset('les-trois-coffres')
    await api.completeReset('les-trois-coffres', { token: 'abc', password: 'un-tout-nouveau', password_confirmation: 'un-tout-nouveau' })

    expect(http.post.mock.calls).toEqual([
      ['anim/decode-manage/les-trois-coffres/reset-request'],
      ['anim/decode-manage/les-trois-coffres/reset-complete', { token: 'abc', password: 'un-tout-nouveau', password_confirmation: 'un-tout-nouveau' }],
    ])
  })

  it('confirme l\'adresse en rappelant l\'API avec les paramètres du lien signé', async () => {
    await useDecodeActivities().confirmEmail({ slug: 'les-trois-coffres', hash: 'a'.repeat(40), expires: '1700000000', signature: 'sig' })

    expect(http.get).toHaveBeenCalledWith(`anim/decode-email-confirm/les-trois-coffres/${'a'.repeat(40)}`, { params: { expires: '1700000000', signature: 'sig' } })
  })
})

describe('useDecodeActivities — mode privé', () => {
  it('envoie le jeton et passe par les routes à identifiant', async () => {
    const gestures = useDecodeActivities().asOrganizer()
    const auth = { headers: { Authorization: 'Bearer jeton' } }
    const activity = { id: 3 }

    await useDecodeActivities().list(7)
    await useDecodeActivities().create(7, { slug: 'abc', name: 'Abc' })
    await gestures.generateSecret(activity)
    await gestures.propose(activity, 11, { combination: '12345', character_name: 'Aldric' })
    await gestures.reopen(activity)
    await gestures.close(activity)
    await gestures.remove(activity)
    await gestures.exportRules(activity)
    await gestures.exportResults(activity)

    expect(http.get.mock.calls).toEqual([
      ['characters/7/decode-activities', auth],
      ['decode-activities/3/export/rules', auth],
      ['decode-activities/3/export/results', auth],
    ])
    expect(http.post.mock.calls.map(c => c[0])).toEqual([
      'characters/7/decode-activities',
      'decode-activities/3/secrets',
      'decode-activities/3/secrets/11/proposals',
      'decode-activities/3/reopen',
      'decode-activities/3/close',
    ])
    expect(http.post.mock.calls.every(c => c[2].headers.Authorization === 'Bearer jeton')).toBe(true)
    expect(http.delete).toHaveBeenCalledWith('decode-activities/3', auth)
    expect(gestures.mode).toBe('private')
  })
})
