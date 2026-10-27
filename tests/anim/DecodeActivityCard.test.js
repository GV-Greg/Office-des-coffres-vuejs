import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { push } from 'notivue'
import DecodeActivityCard from '../../src/components/anim/DecodeActivityCard.vue'

// La carte de l'organisateur, la même pour le mode privé et le mode sans compte : elle reçoit des gestes et ne suit que l'état.
// Sans compte : pas de « Rouvrir » ni de « Supprimer » (D19, D13), et une clôture demande confirmation (elle est définitive).

vi.mock('notivue', () => ({ push: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const readLocale = lang => JSON.parse(fs.readFileSync(path.join(localesDir, `${lang}.json`), 'utf8'))
const fr = readLocale('fr')
const en = readLocale('en')

const activity = (over = {}) => ({
  id: 1, slug: 'les-trois-coffres', name: 'Les Trois Coffres', status: 'launched', mode: 'anonymous', organizer: 'Artifice',
  current: { id: 11, number: 1, code: '48213', proposals: [] }, opened: [], ranking: [], can_reopen: false, email: null,
  ...over,
})

function gestures(mode, over = {}) {
  const base = {
    mode,
    generateSecret: vi.fn().mockResolvedValue(activity({ current: { id: 12, number: 2, code: '70251', proposals: [] } })),
    propose: vi.fn().mockResolvedValue({ score: 4, found: false, proposal: { combination: '12345', character_name: 'Aldric', points: 4 }, activity: activity() }),
    close: vi.fn().mockResolvedValue(activity({ status: 'closed', current: null })),
    exportRules: vi.fn().mockResolvedValue('[b]Règles[/b]'),
    exportResults: vi.fn().mockResolvedValue('[b]Résultats[/b]'),
  }
  if (mode === 'private') {
    base.reopen = vi.fn().mockResolvedValue(activity({ mode: 'private' }))
    base.remove = vi.fn().mockResolvedValue(true)
  }
  return { ...base, ...over }
}

function mountCard({ gest = gestures('anonymous'), act = activity(), locale = 'fr' } = {}) {
  return mount(DecodeActivityCard, {
    props: { activity: act, gestures: gest },
    global: { plugins: [createI18n({ legacy: false, locale, messages: { fr, en } })], stubs: { RouterLink: { template: '<a><slot /></a>' } } },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(globalThis.navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue() }, configurable: true })
})

describe('DecodeActivityCard — sans compte', () => {
  it('montre le nom, l\'adresse, le statut et la combinaison secrète du coffre en cours', () => {
    const w = mountCard()

    expect(w.find('[data-testid="activity-1"]').text()).toContain('Les Trois Coffres')
    expect(w.find('[data-testid="slug-1"]').exists()).toBe(false)
    expect(w.find('[data-testid="public-1"]').exists()).toBe(true)
    expect(w.find('[data-testid="decode-divider"]').exists()).toBe(false)
    expect(w.find('[data-testid="status-1"]').text()).toBe('En cours')
    expect(w.find('[data-testid="code-1"]').text()).toBe('48213')
  })

  it('pas de « Rouvrir » ni de « Supprimer » : la clôture est définitive, l\'auteur ne supprime pas', () => {
    const w = mountCard({ act: activity({ status: 'closed', current: null, can_reopen: true }) })

    expect(w.find('[data-testid="reopen-1"]').exists()).toBe(false)
    expect(w.find('[data-testid="delete-1"]').exists()).toBe(false)
  })

  it('clore demande confirmation ; « non » ne fait rien, « oui » clôt', async () => {
    const gest = gestures('anonymous')
    const w = mountCard({ gest })

    await w.find('[data-testid="close-1"]').trigger('click')
    expect(w.find('[data-testid="close-confirm-1"]').exists()).toBe(true)
    expect(gest.close).not.toHaveBeenCalled()

    await w.find('[data-testid="close-no-1"]').trigger('click')
    expect(w.find('[data-testid="close-confirm-1"]').exists()).toBe(false)
    expect(gest.close).not.toHaveBeenCalled()

    await w.find('[data-testid="close-1"]').trigger('click')
    await w.find('[data-testid="close-yes-1"]').trigger('click')
    await flushPromises()
    expect(gest.close).toHaveBeenCalledTimes(1)
    expect(w.emitted('update')[0][0].status).toBe('closed')
  })

  it('sceller un coffre, puis inscrire une proposition : la note vient du serveur', async () => {
    const gest = gestures('anonymous')
    const w = mountCard({ gest, act: activity({ status: 'new', current: null }) })

    await w.find('[data-testid="seal-1"]').trigger('click')
    await flushPromises()
    expect(gest.generateSecret).toHaveBeenCalled()
    expect(w.emitted('update')).toHaveLength(1)

    const w2 = mountCard({ gest })
    await w2.find('[data-testid="combination-1"]').setValue('12345')
    await w2.find('[data-testid="character-1"]').setValue('Aldric')
    await w2.find('[data-testid="proposal-form-1"]').trigger('submit')
    await flushPromises()
    expect(gest.propose).toHaveBeenCalledWith(expect.anything(), 11, { combination: '12345', character_name: 'Aldric' })
    expect(w2.find('[data-testid="result-1"]').text()).toBe('Combinaison 12345 de Aldric : 4 sur 10.')
  })

  it('« Inscrire » reste grisé tant que la combinaison n\'a pas cinq chiffres', async () => {
    const w = mountCard()
    const btn = () => w.find('[data-testid="propose-1"]')

    expect(btn().attributes('disabled')).toBeDefined()
    await w.find('[data-testid="combination-1"]').setValue('1234')
    expect(btn().attributes('disabled')).toBeDefined()
    await w.find('[data-testid="combination-1"]').setValue('12345')
    expect(btn().attributes('disabled')).toBeUndefined()
  })

  it('propose les pseudos déjà inscrits (classement et coffre en cours), sans doublon', () => {
    const w = mountCard({ act: activity({
      ranking: [{ character_name: 'Brunehaut', points: 20 }, { character_name: 'Aldric', points: 4 }],
      current: { id: 11, number: 2, code: '48213', proposals: [{ combination: '12345', character_name: 'Aldric', points: 4 }, { combination: '54321', character_name: 'Clovis', points: 2 }] },
    }) })

    const options = w.findAll('[data-testid="names-1"] option').map(o => o.attributes('value'))
    expect(options).toEqual(['Aldric', 'Brunehaut', 'Clovis'])
    expect(w.find('[data-testid="character-1"]').attributes('list')).toBe('names-1')
  })

  it('le nombre de tentatives s\'accorde : singulier pour une, pluriel sinon', () => {
    const count = n => mountCard({ act: activity({ current: { id: 11, number: 1, code: '48213', proposals: Array.from({ length: n }, (_, i) => ({ combination: '1234' + i, character_name: 'A', points: 1 })) } }) }).text()

    expect(count(1)).toContain('1 tentative sur ce coffre')
    expect(count(2)).toContain('2 tentatives sur ce coffre')
    expect(count(0)).toContain('0 tentatives sur ce coffre')
  })

  it('un refus du serveur s\'affiche tel que l\'API le dit, dans la langue', async () => {
    const gest = gestures('anonymous', {
      propose: vi.fn().mockRejectedValue({ response: { status: 422, data: { messages: { fr: 'Refus FR', en: 'Refusal EN' } } } }),
    })
    const w = mountCard({ gest, locale: 'en' })

    await w.find('[data-testid="combination-1"]').setValue('12345')
    await w.find('[data-testid="character-1"]').setValue('X')
    await w.find('[data-testid="proposal-form-1"]').trigger('submit')
    await flushPromises()

    expect(push.error).toHaveBeenCalledWith('Refusal EN')
  })

  it('exporte le BBCode et l\'affiche', async () => {
    const w = mountCard()

    await w.find('[data-testid="export-rules-1"]').trigger('click')
    await flushPromises()

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('[b]Règles[/b]')
    expect(w.find('[data-testid="export-text-1"]').element.value).toBe('[b]Règles[/b]')
  })

  it('dit si l\'adresse email est confirmée, en attente, ou absente', () => {
    expect(mountCard({ act: activity({ email: null }) }).find('[data-testid="email-1"]').exists()).toBe(false)
    expect(mountCard({ act: activity({ email: { set: false, verified: false } }) }).find('[data-testid="email-1"]').exists()).toBe(false)

    const pending = mountCard({ act: activity({ email: { set: true, verified: false } }) })
    expect(pending.find('[data-testid="email-1"]').text()).toBe(fr.Animation.Mine.EmailPending)

    const confirmed = mountCard({ act: activity({ email: { set: true, verified: true } }) })
    expect(confirmed.find('[data-testid="email-1"]').text()).toBe(fr.Animation.Mine.EmailConfirmed)
  })
})

describe('DecodeActivityCard — privé', () => {
  it('clore est direct (l\'activité se rouvre), puis « Rouvrir » et « Supprimer » existent', async () => {
    const gest = gestures('private')
    const w = mountCard({ gest, act: activity({ mode: 'private' }) })

    await w.find('[data-testid="close-1"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="close-confirm-1"]').exists()).toBe(false)
    expect(gest.close).toHaveBeenCalledTimes(1)

    const closed = mountCard({ gest, act: activity({ mode: 'private', status: 'closed', current: null, can_reopen: true }) })
    expect(closed.find('[data-testid="reopen-1"]').exists()).toBe(true)
    expect(closed.find('[data-testid="delete-1"]').exists()).toBe(true)
  })

  it('supprimer demande confirmation, puis prévient le parent', async () => {
    const gest = gestures('private')
    const w = mountCard({ gest, act: activity({ mode: 'private', status: 'closed', current: null, can_reopen: true }) })

    await w.find('[data-testid="delete-1"]').trigger('click')
    expect(gest.remove).not.toHaveBeenCalled()
    await w.find('[data-testid="delete-yes-1"]').trigger('click')
    await flushPromises()

    expect(gest.remove).toHaveBeenCalledTimes(1)
    expect(w.emitted('removed')).toHaveLength(1)
  })
})
