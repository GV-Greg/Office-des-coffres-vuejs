// @vitest-environment node
// Logique pure, aucun DOM à monter — voir README, section Tests.
import { describe, it, expect } from 'vitest'
import useValidators from '../../src/modules/Validators.js'

const { isRequired, minLength, maxLength, isEmail, isConfirmed } = useValidators()

describe('Validators', () => {
  describe('isEmail', () => {
    it('accepte un email valide', () => {
      expect(isEmail('test@test.com')).toBe('')
    })

    it('rejette un email invalide', () => {
      expect(isEmail('pas-un-email')).not.toBe('')
    })
  })

  describe('isConfirmed', () => {
    it('accepte quand la valeur correspond à la confirmation', () => {
      expect(isConfirmed('password123', 'password', 'password123')).toBe('')
    })

    it('rejette quand la valeur ne correspond pas', () => {
      expect(isConfirmed('autre', 'password', 'password123')).not.toBe('')
    })
  })

  describe('isRequired', () => {
    it('rejette une valeur vide', () => {
      expect(isRequired('username', '')).not.toBe('')
    })

    it('accepte une valeur non vide', () => {
      expect(isRequired('username', 'Artifice')).toBe('')
    })
  })

  describe('minLength / maxLength', () => {
    it('rejette une valeur trop courte', () => {
      expect(minLength('password', 'abc', 8)).not.toBe('')
    })

    it('rejette une valeur trop longue', () => {
      expect(maxLength('username', 'a'.repeat(200), 190)).not.toBe('')
    })

    it('accepte une valeur dans les bornes', () => {
      expect(minLength('password', 'password123', 8)).toBe('')
      expect(maxLength('username', 'Artifice', 190)).toBe('')
    })
  })
})
