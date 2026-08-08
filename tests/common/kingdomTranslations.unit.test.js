// @vitest-environment node
// Logique pure, aucun DOM à monter — voir README, section Tests.
import { describe, it, expect } from 'vitest'
import { translateKingdomName } from '../../src/modules/kingdomTranslations'

describe('translateKingdomName', () => {
  it('traduit un royaume connu en français', () => {
    expect(translateKingdomName('Kingdom of France', 'fr')).toBe('Royaume de France')
  })

  it('laisse le nom original en anglais', () => {
    expect(translateKingdomName('Kingdom of France', 'en')).toBe('Kingdom of France')
  })

  it('laisse le nom original si aucune traduction connue', () => {
    expect(translateKingdomName('Unknown Realm', 'fr')).toBe('Unknown Realm')
  })
})
