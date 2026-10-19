import { describe, it, expect, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import useSharedResource, { sharedRequest } from '../../src/use/useSharedResource'

const deferred = () => { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej }); return { promise, resolve, reject } }

describe('sharedRequest', () => {
  it('partage UNE requête entre appels simultanés de même clé', async () => {
    const d = deferred()
    const fetcher = vi.fn(() => d.promise)
    const a = sharedRequest('k:1', fetcher)
    const b = sharedRequest('k:1', fetcher)
    d.resolve('ok')
    expect(await a).toBe('ok')
    expect(await b).toBe('ok')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('ne garde rien dans la durée : un appel suivant refait la requête', async () => {
    const fetcher = vi.fn(async () => 'x')
    await sharedRequest('k:2', fetcher)
    await sharedRequest('k:2', fetcher)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})

describe('useSharedResource', () => {
  it('passe à prêt après la réponse, avec la donnée', async () => {
    const d = deferred()
    const { data, ready } = useSharedResource('t', 7, () => d.promise)
    expect(ready.value).toBe(false)
    d.resolve({ write: 1 })
    await flushPromises()
    expect(ready.value).toBe(true)
    expect(data.value).toEqual({ write: 1 })
  })

  it('passe à prêt aussi sur un échec, la donnée reste nulle et l\'erreur est gardée', async () => {
    const { data, ready, error } = useSharedResource('t', 7, async () => { throw new Error('hors ligne') })
    await flushPromises()
    expect(ready.value).toBe(true)
    expect(data.value).toBe(null)
    expect(error.value.message).toBe('hors ligne')
  })

  it('une clé nulle est prête tout de suite, sans requête', () => {
    const fetcher = vi.fn()
    const { ready, data } = useSharedResource('t', () => null, fetcher)
    expect(ready.value).toBe(true)
    expect(data.value).toBe(null)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('deux composants de même clé partagent la requête ; un autre espace de noms ne la partage pas', async () => {
    const d = deferred()
    const fetcher = vi.fn(() => d.promise)
    const a = useSharedResource('mine', 7, fetcher)
    const b = useSharedResource('mine', 7, fetcher)
    const other = useSharedResource('autre', 7, fetcher)
    d.resolve('v')
    await flushPromises()
    expect(fetcher).toHaveBeenCalledTimes(2) // mine (partagée) + autre
    expect(a.data.value).toBe('v')
    expect(b.data.value).toBe('v')
    expect(other.ready.value).toBe(true)
  })

  it('suit la clé : un changement de personnage recharge, et une réponse tardive de l\'ancien est ignorée', async () => {
    const key = ref(1)
    const slow = deferred()
    const fetcher = vi.fn((k) => (k === 1 ? slow.promise : Promise.resolve('deux')))
    const { data } = useSharedResource('t', key, fetcher)
    key.value = 2
    await flushPromises()
    expect(data.value).toBe('deux')
    slow.resolve('un')
    await flushPromises()
    await nextTick()
    expect(data.value).toBe('deux')
  })
})
