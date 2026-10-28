import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import PasswordField from '../../src/components/anim/PasswordField.vue'

// Mot de passe d'un organisateur sans compte (D10, D28) : saisie, ressaisie, « afficher », barre de force INDICATIVE.

const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const readLocale = lang => JSON.parse(fs.readFileSync(path.join(localesDir, `${lang}.json`), 'utf8'))
const messages = { fr: readLocale('fr'), en: readLocale('en') }

const mountField = (props = {}, locale = 'fr') => mount(PasswordField, {
  props: { modelValue: '', confirmation: '', ...props },
  global: { plugins: [createI18n({ legacy: false, locale, messages })] },
})

describe('PasswordField', () => {
  it('la barre dit le niveau en toutes lettres (jamais la couleur seule)', () => {
    const levels = [
      ['court', 'Insuffisant'],
      ['zsdlkfjwek', 'Faible'],
      ['zsdlkfjwekqp', 'Correct'],
      ['Zsdlk5jwe!qpxy', 'Solide'],
    ]
    for (const [password, label] of levels) {
      const w = mountField({ modelValue: password })
      expect(w.find('[data-testid="pw-strength-label"]').text()).toContain(label)
    }
  })

  it('le niveau est annoncé (role="status") et exposé pour les tests', () => {
    const w = mountField({ modelValue: 'zsdlkfjwekqp' })

    expect(w.find('[data-testid="pw-strength-label"]').attributes('role')).toBe('status')
    expect(w.find('[data-testid="pw-strength"]').attributes('data-level')).toBe('2')
  })

  it('rien saisi : pas de niveau annoncé', () => {
    const w = mountField()

    expect(w.find('[data-testid="pw-strength-label"]').exists()).toBe(false)
    expect(w.find('[data-testid="pw-strength"]').attributes('data-level')).toBe('')
  })

  it('un mot courant est signalé, avec le conseil de l\'éviter', () => {
    const w = mountField({ modelValue: 'MonSuperPassword!2026' })

    expect(w.find('[data-testid="pw-strength-label"]').text()).toContain('évitez les mots courants, les suites de chiffres et les répétitions')
  })

  it('le slug ou le pseudo comme mot de passe : insuffisant', () => {
    const w = mountField({ modelValue: 'les-trois-coffres', slug: 'les-trois-coffres' })

    expect(w.find('[data-testid="pw-strength"]').attributes('data-level')).toBe('0')
  })

  it('la ressaisie différente est signalée ; identique, non', () => {
    expect(mountField({ modelValue: 'zsdlkfjwek', confirmation: 'zsdlkfjwex' }).find('[data-testid="pw-mismatch"]').exists()).toBe(true)
    expect(mountField({ modelValue: 'zsdlkfjwek', confirmation: 'zsdlkfjwek' }).find('[data-testid="pw-mismatch"]').exists()).toBe(false)
    expect(mountField({ modelValue: 'zsdlkfjwek', confirmation: '' }).find('[data-testid="pw-mismatch"]').exists()).toBe(false)
  })

  it('« Afficher » démasque les deux champs, « Masquer » les remasque', async () => {
    const w = mountField({ modelValue: 'secret' })
    expect(w.find('[data-testid="pw-password"]').attributes('type')).toBe('password')
    expect(w.find('[data-testid="pw-confirmation"]').attributes('type')).toBe('password')

    await w.find('[data-testid="pw-toggle"]').trigger('click')
    expect(w.find('[data-testid="pw-password"]').attributes('type')).toBe('text')
    expect(w.find('[data-testid="pw-confirmation"]').attributes('type')).toBe('text')
    expect(w.find('[data-testid="pw-toggle"]').attributes('aria-pressed')).toBe('true')
    expect(w.find('[data-testid="pw-toggle"]').text()).toContain('Masquer')

    await w.find('[data-testid="pw-toggle"]').trigger('click')
    expect(w.find('[data-testid="pw-password"]').attributes('type')).toBe('password')
  })

  it('émet la saisie et la ressaisie par v-model', async () => {
    const w = mountField()

    await w.find('[data-testid="pw-password"]').setValue('abcdefghij')
    await w.find('[data-testid="pw-confirmation"]').setValue('abcdefghij')

    expect(w.emitted('update:modelValue').at(-1)).toEqual(['abcdefghij'])
    expect(w.emitted('update:confirmation').at(-1)).toEqual(['abcdefghij'])
  })

  it('les champs demandent un nouveau mot de passe (le navigateur ne propose pas un ancien)', () => {
    const w = mountField()

    expect(w.find('[data-testid="pw-password"]').attributes('autocomplete')).toBe('new-password')
    expect(w.find('[data-testid="pw-confirmation"]').attributes('autocomplete')).toBe('new-password')
  })

  it('affiche le refus du serveur tel quel, et rappelle le minimum', () => {
    const w = mountField({ error: 'Le mot de passe doit compter au moins 10 caractères.' })

    expect(w.find('[data-testid="pw-error"]').text()).toBe('Le mot de passe doit compter au moins 10 caractères.')
    expect(w.text()).toContain('Au moins 10 caractères')
  })

  it('en anglais', () => {
    const w = mountField({ modelValue: 'Zsdlk5jwe!qpxy' }, 'en')

    expect(w.find('[data-testid="pw-strength-label"]').text()).toContain('Strong')
  })

  it('un conseil dit quoi faire tant que le mot de passe n\'est pas solide', () => {
    expect(mountField({ modelValue: 'safe013safe' }).find('[data-testid="pw-tip"]').text()).toContain('allongez-le')
    expect(mountField({ modelValue: 'court' }).find('[data-testid="pw-tip"]').text()).toBe('Encore 5 caractères')
    expect(mountField({ modelValue: '123456789' }).find('[data-testid="pw-tip"]').text()).toBe('Encore 1 caractère')
    expect(mountField({ modelValue: 'les-trois-coffres', slug: 'les-trois-coffres' }).find('[data-testid="pw-tip"]').text()).toContain('autre chose')
  })

  it('mot de passe solide ou champ vide : aucun conseil', () => {
    expect(mountField({ modelValue: 'Zsdlk5jwe!qpxy' }).find('[data-testid="pw-tip"]').exists()).toBe(false)
    expect(mountField().find('[data-testid="pw-tip"]').exists()).toBe(false)
  })
})
