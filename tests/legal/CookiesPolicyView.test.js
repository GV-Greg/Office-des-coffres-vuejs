import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import CookiesPolicyView from '../../src/views/legal/CookiesPolicyView.vue'

// Mock api.js (importé par authStore.js, lui-même importé par router/index.js)
vi.mock('../../src/api.js', () => ({
  http: {
    post: vi.fn(),
    get: vi.fn(),
  }
}))

const localStorageMock = (() => {
  let store = {}
  return {
    getItem:    vi.fn(key => store[key] ?? null),
    setItem:    vi.fn((key, value) => { store[key] = value.toString() }),
    removeItem: vi.fn(key => { delete store[key] }),
    clear:      vi.fn(() => { store = {} }),
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

const messages = {
  fr: {
    Common: { SiteName: 'Office des coffres' },
    Legal: {
      Cookies: {
        PageTitle: 'Politique cookies et stockage local',
        Preamble: 'Préambule avec un lien vers {privacyLink}.',
        PrivacyPolicyLink: 'Politique de confidentialité (à venir)',
        Section1: { Title: '1. Rappel', Content: 'Contenu section 1.' },
        Section2: {
          Title: '2. Responsable de traitement',
          NameLabel: 'Nom / raison sociale',
          Name: '[À REMPLIR PAR GREG : nom]',
          AddressLabel: 'Adresse',
          Address: '[À REMPLIR PAR GREG : adresse]',
          EmailLabel: 'Email de contact',
          Email: '[À REMPLIR PAR GREG : email]',
        },
        Section3: {
          Title: '3. Stockage',
          Intro: 'Deux mécanismes.',
          Preferences: {
            Title: 'Préférences', Purpose: 'p1', Data: 'd1', Retention: 'r1', LegalBasis: 'l1', IfDecline: 'i1',
          },
          Tokens: {
            Title: 'Jetons', Purpose: 'p2', Data: 'd2', Retention: 'r2', LegalBasis: 'l2', IfDecline: 'i2',
          },
        },
        Fields: {
          Purpose: 'Finalité', Data: 'Données', Retention: 'Durée', LegalBasis: 'Base légale', IfDecline: 'Si refus',
        },
        Section4: {
          Title: '4. Ce que nous ne faisons pas',
          Items: ['Item un', 'Item deux', 'Item trois', 'Item quatre', 'Item cinq'],
        },
        Section5: { Title: '5. Technique', Content: 'Contenu section 5.' },
        Section6: {
          Title: '6. Anonyme vs connecté',
          Anonymous: 'Visiteur anonyme.',
          Registered: 'Utilisateur connecté, voir {privacyLink}.',
        },
        Section7: {
          Title: '7. Vos droits',
          Withdraw: 'Retrait du consentement.',
          Erase: 'Effacement.',
          Complaint: 'Réclamation auprès de la {cnilLink}.',
        },
        Section8: { Title: '8. Modifications', Content: 'Contenu section 8.' },
        Section9: { Title: '9. Contact', Content: 'Contactez-nous.' },
        LastUpdated: 'Dernière modification : {date}',
      },
    },
  },
}

const i18n = createI18n({ legacy: false, locale: 'fr', messages })

function mountView() {
  return mount(CookiesPolicyView, {
    global: {
      plugins: [createPinia(), i18n],
      stubs: { RouterLink: true },
    },
  })
}

describe('CookiesPolicyView', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('affiche le titre de la page', () => {
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Politique cookies et stockage local')
  })

  it('affiche les 9 sections de la politique', () => {
    const wrapper = mountView()
    for (const title of [
      '1. Rappel', '2. Responsable de traitement', '3. Stockage',
      '4. Ce que nous ne faisons pas', '5. Technique', '6. Anonyme vs connecté',
      '7. Vos droits', '8. Modifications', '9. Contact',
    ]) {
      expect(wrapper.text()).toContain(title)
    }
  })

  it('garde les placeholders [À REMPLIR PAR GREG] tels quels (responsable de traitement)', () => {
    const wrapper = mountView()
    expect(wrapper.text()).toContain('[À REMPLIR PAR GREG : nom]')
    expect(wrapper.text()).toContain('[À REMPLIR PAR GREG : adresse]')
    expect(wrapper.text()).toContain('[À REMPLIR PAR GREG : email]')
  })

  it('rend les 5 items de la section "Ce que nous ne faisons pas"', () => {
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Item un')
    expect(wrapper.text()).toContain('Item cinq')
  })

  it("le lien vers la politique de confidentialité n'est pas un lien navigable (route pas encore créée)", () => {
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Politique de confidentialité (à venir)')
    expect(wrapper.find('a[href="/legal/privacy"]').exists()).toBe(false)
  })

  it('le lien CNIL est un vrai lien externe sécurisé', () => {
    const wrapper = mountView()
    const link = wrapper.find('a[href="https://www.cnil.fr"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
  })

  it('affiche une date de dernière modification', () => {
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Dernière modification :')
  })
})

describe('Route /legal/cookies', () => {
  it('est enregistrée, publique et pointe vers CookiesPolicyView', async () => {
    const { default: router } = await import('../../src/router/index.js')
    const resolved = router.resolve('/legal/cookies')

    expect(resolved.name).toBe('legal-cookies')
    expect(resolved.meta.public).toBe(true)
  })
})
