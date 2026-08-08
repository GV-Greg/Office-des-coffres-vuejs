// @vitest-environment node
// Logique pure, aucun DOM à monter — voir README, section Tests.
import { describe, it, expect } from 'vitest'
import { parseEntries, diffNewEntries, splitByType, buildPayload, buildForumPayloads } from '../../scripts/whatsNewAnnounce.mjs'

describe('whatsNewAnnounce', () => {
  describe('parseEntries', () => {
    it('parse un JSON valide', () => {
      expect(parseEntries('[{"id":"a"}]')).toEqual([{ id: 'a' }])
    })

    it('renvoie [] pour une chaîne vide', () => {
      expect(parseEntries('')).toEqual([])
    })

    it('renvoie [] pour un JSON invalide', () => {
      expect(parseEntries('{not valid')).toEqual([])
    })

    it('renvoie [] si le JSON parsé n\'est pas un tableau', () => {
      expect(parseEntries('{"foo":"bar"}')).toEqual([])
    })
  })

  describe('diffNewEntries', () => {
    it('ne signale pas une entrée dont l\'id existe déjà, même si le texte a changé', () => {
      const previous = [{ id: 'a', date: '2026-08-01', fr: 'Ancien texte' }]
      const current = [{ id: 'a', date: '2026-08-01', fr: 'Texte corrigé (coquille)' }]
      expect(diffNewEntries(previous, current)).toEqual([])
    })

    it('pont legacy : une ancienne entrée sans id n\'est pas ré-annoncée si son date+fr matche une entrée courante avec id', () => {
      const previous = [{ date: '2026-08-05', scope: 'public', fr: 'Nouveau coffre pour l\'économie.' }]
      const current = [{ id: 'economy-mines-report', date: '2026-08-05', scope: 'public', type: 'feature', fr: 'Nouveau coffre pour l\'économie.' }]
      expect(diffNewEntries(previous, current)).toEqual([])
    })

    it('signale une entrée réellement nouvelle', () => {
      const previous = [{ id: 'a', date: '2026-08-01', fr: 'Ancien' }]
      const current = [
        { id: 'a', date: '2026-08-01', fr: 'Ancien' },
        { id: 'b', date: '2026-08-06', fr: 'Nouveau' },
      ]
      expect(diffNewEntries(previous, current)).toEqual([{ id: 'b', date: '2026-08-06', fr: 'Nouveau' }])
    })

    it('cas premier run (previous vide) : tout est nouveau', () => {
      const current = [{ id: 'a', date: '2026-08-01', fr: 'Ancien' }]
      expect(diffNewEntries([], current)).toEqual(current)
    })
  })

  describe('splitByType', () => {
    it('sépare feature et fix', () => {
      const entries = [
        { id: 'a', type: 'feature' },
        { id: 'b', type: 'fix' },
        { id: 'c', type: 'feature' },
      ]
      expect(splitByType(entries)).toEqual({
        feature: [{ id: 'a', type: 'feature' }, { id: 'c', type: 'feature' }],
        fix: [{ id: 'b', type: 'fix' }],
      })
    })
  })

  describe('buildPayload', () => {
    it('renvoie null si aucune entrée', () => {
      expect(buildPayload([])).toBeNull()
    })

    it('construit un message avec émoji, date, scope et texte', () => {
      const entries = [{ date: '2026-08-05', scope: 'public', type: 'feature', fr: 'Un nouveau coffre.' }]
      const payload = buildPayload(entries)
      expect(payload.content).toContain('📯')
      expect(payload.content).toContain('2026-08-05')
      expect(payload.content).toContain('🌐 Public')
      expect(payload.content).toContain('Un nouveau coffre.')
    })

    it('inclut un bloc de texte par langue demandée (préparation multi-langue)', () => {
      const entries = [{ date: '2026-08-05', scope: 'public', type: 'feature', fr: 'Texte FR', en: 'Text EN' }]
      const payload = buildPayload(entries, { locales: ['fr', 'en'] })
      expect(payload.content).toContain('Texte FR')
      expect(payload.content).toContain('Text EN')
    })
  })

  describe('buildForumPayloads (salon Forum "registre-des-reparations")', () => {
    it('renvoie [] si aucune entrée', () => {
      expect(buildForumPayloads([])).toEqual([])
    })

    it('construit un payload par entrée, avec thread_name et contenu formaté', () => {
      const entries = [
        { date: '2026-08-05', scope: 'private', type: 'fix', fr: 'Un bug corrigé.' },
        { date: '2026-08-06', scope: 'public', type: 'fix', fr: 'Un autre bug corrigé.' },
      ]
      const payloads = buildForumPayloads(entries)
      expect(payloads).toHaveLength(2)
      expect(payloads[0].thread_name).toBe('2026-08-05 — Un bug corrigé.')
      expect(payloads[0].content).toContain('🔨')
      expect(payloads[0].content).toContain('🔒 Membres')
      expect(payloads[1].thread_name).toBe('2026-08-06 — Un autre bug corrigé.')
      expect(payloads[1].content).toContain('🌐 Public')
    })

    it('tronque le thread_name à 100 caractères (limite Discord)', () => {
      const longText = 'A'.repeat(150)
      const entries = [{ date: '2026-08-05', scope: 'public', type: 'fix', fr: longText }]
      const [payload] = buildForumPayloads(entries)
      expect(payload.thread_name.length).toBe(100)
      expect(payload.thread_name.endsWith('...')).toBe(true)
    })
  })
})
