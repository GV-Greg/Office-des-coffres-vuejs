import { describe, it, expect } from 'vitest'
import { http, HTTP_TIMEOUT_MS } from '../../src/api.js'

// Sans délai, une requête que le serveur ne rend jamais (429 retenus par l'hébergeur en prod,
// constat du 29/09/2026) bloque l'interface sans fin. axios n'en pose aucun par défaut : ce test
// empêche un refactor d'api.js de le perdre en silence.
describe('client HTTP (api.js)', () => {
  it('borne toute requête par un délai d\'attente', () => {
    expect(http.defaults.timeout).toBe(HTTP_TIMEOUT_MS)
    expect(HTTP_TIMEOUT_MS).toBeGreaterThan(0)
  })

  it('laisse assez de marge à une réponse lente du mutualisé', () => {
    // auth/me met 0,3 à 0,65 s en prod (mesure du 28/09/2026) : 20 s ne coupe rien de légitime.
    expect(HTTP_TIMEOUT_MS).toBeGreaterThanOrEqual(15000)
  })
})
