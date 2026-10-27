import { describe, it, expect } from 'vitest'
import { passwordStrength, MIN_PASSWORD_LENGTH } from '../../src/modules/passwordStrength'

// Barre de force (D10, D28) : une AIDE, pas une règle. Le serveur impose 10 caractères et « ni le slug ni le pseudo ».

describe('passwordStrength', () => {
  it('le minimum est celui du serveur : 10 caractères', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(10)
  })

  it('vide ou trop court : insuffisant, minimum non atteint', () => {
    expect(passwordStrength('')).toMatchObject({ level: 0, meetsMinimum: false })
    expect(passwordStrength('Court1!')).toMatchObject({ level: 0, meetsMinimum: false, reasons: expect.arrayContaining(['too_short']) })
    expect(passwordStrength('123456789')).toMatchObject({ level: 0, meetsMinimum: false })
  })

  it('exactement le minimum, une seule famille de caractères : faible', () => {
    expect(passwordStrength('zsdlkfjwek')).toMatchObject({ level: 1, meetsMinimum: true })
  })

  it('12 caractères : correct', () => {
    expect(passwordStrength('zsdlkfjwekqp').level).toBe(2)
  })

  it('la montée est progressive : 9 caractères insuffisant, 10 de deux familles faible, 10 de trois familles correct, 10 de quatre solide', () => {
    expect(passwordStrength('safe013wa').level).toBe(0)
    expect(passwordStrength('safe013way').level).toBe(1)
    expect(passwordStrength('Safe013way').level).toBe(2)
    expect(passwordStrength('Zsdlk5jwe!').level).toBe(3)
  })

  it('14 caractères avec trois familles, ou 18 caractères : solide', () => {
    expect(passwordStrength('Zsdlk5jwe!qpxy').level).toBe(3)
    expect(passwordStrength('une phrase de passe très longue').level).toBe(3)
  })

  it('le slug ou le pseudo comme mot de passe : insuffisant, quelle que soit la casse', () => {
    expect(passwordStrength('les-trois-coffres', { slug: 'les-trois-coffres' })).toMatchObject({ level: 0, reasons: expect.arrayContaining(['same_as_slug']) })
    expect(passwordStrength('ARTIFICE-ROI', { pseudo: 'Artifice-Roi' })).toMatchObject({ level: 0, reasons: expect.arrayContaining(['same_as_pseudo']) })
  })

  it('un mot courant plafonne à « faible », même long', () => {
    const r = passwordStrength('MonSuperPassword!2026')
    expect(r.reasons).toContain('common')
    expect(r.level).toBe(1)
  })

  it('une suite ou une répétition plafonne aussi', () => {
    expect(passwordStrength('abcdefghijkl').reasons).toContain('sequence')
    expect(passwordStrength('abcdefghijkl').level).toBe(1)
    expect(passwordStrength('aaaaaaaaaaaa').reasons).toContain('repeated')
    expect(passwordStrength('aaaaaaaaaaaa').level).toBe(1)
  })

  it('ne renvoie jamais de texte : seulement des codes', () => {
    for (const reason of passwordStrength('court').reasons) expect(reason).toMatch(/^[a-z_]+$/)
  })

  it('accepte null et undefined sans lever', () => {
    expect(passwordStrength(null).level).toBe(0)
    expect(passwordStrength(undefined).level).toBe(0)
  })
})
