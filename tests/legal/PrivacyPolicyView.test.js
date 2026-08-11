import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import PrivacyPolicyView from '../../src/views/legal/PrivacyPolicyView.vue'

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
      Common: {
        Contact: {
          NameLabel: 'Nom / raison sociale',
          Name: '[À REMPLIR PAR GREG : nom]',
          AddressLabel: 'Adresse',
          Address: '[À REMPLIR PAR GREG : adresse]',
          EmailLabel: 'Email de contact',
          Email: '[À REMPLIR PAR GREG : email]',
        },
      },
      Privacy: {
        PageTitle: 'Politique de confidentialité',
        Preamble: 'Préambule avec un lien vers {cookiesLink}.',
        CookiesPolicyLink: 'Politique cookies',
        Section1: { Title: '1. Rappel', Content: 'Contenu section 1.' },
        Section2: { Title: '2. Responsable de traitement' },
        Section3: {
          Title: '3. Compte',
          Intro: 'Création optionnelle.',
          AccountFieldsIntro: 'Deux informations :',
          AccountFields: [
            { Label: 'Email', Text: 'pour se connecter.' },
            { Label: 'Mot de passe', Text: 'haché.' },
          ],
          CharacterFieldsIntro: 'Puis les personnages :',
          CharacterFields: [
            { Label: 'Pseudo', Text: 'du jeu.' },
            { Label: 'Ville', Text: 'du référentiel.' },
            { Label: 'Statut', Text: 'validé ou non.' },
          ],
        },
        Section4: {
          Title: '4. Ce que nous faisons',
          Headers: { Data: 'Donnée', Purpose: 'Finalité', LegalBasis: 'Base légale' },
          Rows: [
            { Data: 'Email', Purpose: 'Authentifier', LegalBasis: 'Contrat' },
            { Data: 'Mot de passe', Purpose: 'Vérifier identité', LegalBasis: 'Contrat' },
          ],
          NoCommercialUse: 'Aucun usage commercial.',
        },
        Section5: {
          Title: '5. Conservation',
          ActiveAccount: 'Compte actif : conservé.',
          InactiveAccount: 'Compte inactif : après [À REMPLIR PAR GREG : durée] sans connexion.',
          DeletedAccount: 'Compte supprimé : effacé.',
          TechnicalLogs: 'Logs : 12 mois.',
        },
        Section6: {
          Title: '6. Accessibilité',
          Yourself: 'Vous-même.',
          Editor: "L'éditeur.",
          NoOneElse: 'Personne d\'autre.',
          Hosting: 'Hébergeur : [À REMPLIR PAR GREG : hébergeur].',
        },
        Section7: {
          Title: '7. Droits RGPD',
          Intro: 'Vous disposez des droits suivants :',
          Rights: [
            { Label: "Droit d'accès", Text: 'obtenir une copie.' },
            { Label: 'Droit de rectification', Text: 'corriger.' },
          ],
          Complaint: 'Réclamation auprès de la {cnilLink}.',
          HowToExercise: 'Contactez {email} pour exercer ces droits.',
        },
        Section8: {
          Title: '8. Sécurité',
          Intro: 'Mesures mises en œuvre :',
          Measures: ['Mesure un', 'Mesure deux'],
          BreachNotice: 'Notification en cas de faille.',
        },
        Section9: {
          Title: '9. Cookies et stockage local',
          Content: 'Voir la politique dédiée : {cookiesLink}.',
        },
        Section10: { Title: '10. Modifications', Content: 'Peut être modifiée.' },
        Section11: { Title: '11. Contact', Content: 'Contactez {email}.' },
        LastUpdated: 'Dernière modification : {date}',
      },
    },
  },
}

const i18n = createI18n({ legacy: false, locale: 'fr', messages })

// Stub maison (plutôt que `RouterLink: true`) : sérialise `to` dans le href pour pouvoir
// vérifier la cible réelle du lien, pas seulement sa présence.
const RouterLinkStub = {
  props: ['to'],
  template: '<a :href="typeof to === \'string\' ? to : JSON.stringify(to)"><slot /></a>',
}

function mountView() {
  return mount(PrivacyPolicyView, {
    global: {
      plugins: [createPinia(), i18n],
      stubs: { RouterLink: RouterLinkStub },
    },
  })
}

describe('PrivacyPolicyView', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('affiche le titre de la page', () => {
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Politique de confidentialité')
  })

  it('affiche les 11 sections de la politique', () => {
    const wrapper = mountView()
    for (const title of [
      '1. Rappel', '2. Responsable de traitement', '3. Compte',
      '4. Ce que nous faisons', '5. Conservation', '6. Accessibilité',
      '7. Droits RGPD', '8. Sécurité', '9. Cookies et stockage local',
      '10. Modifications', '11. Contact',
    ]) {
      expect(wrapper.text()).toContain(title)
    }
  })

  it('garde les placeholders [À REMPLIR PAR GREG] tels quels (responsable de traitement, clés partagées Legal.Common.Contact)', () => {
    const wrapper = mountView()
    expect(wrapper.text()).toContain('[À REMPLIR PAR GREG : nom]')
    expect(wrapper.text()).toContain('[À REMPLIR PAR GREG : adresse]')
    expect(wrapper.text()).toContain('[À REMPLIR PAR GREG : email]')
  })

  it('garde les placeholders spécifiques à la politique de confidentialité (durée, hébergeur)', () => {
    const wrapper = mountView()
    expect(wrapper.text()).toContain('[À REMPLIR PAR GREG : durée]')
    expect(wrapper.text()).toContain('[À REMPLIR PAR GREG : hébergeur]')
  })

  it('rend les champs du compte et des personnages (§3)', () => {
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Email')
    expect(wrapper.text()).toContain('pour se connecter.')
    expect(wrapper.text()).toContain('Pseudo')
    expect(wrapper.text()).toContain('du jeu.')
  })

  it('rend le tableau des données traitées (§4)', () => {
    const wrapper = mountView()
    const table = wrapper.find('table')
    expect(table.exists()).toBe(true)
    expect(table.text()).toContain('Authentifier')
    expect(table.text()).toContain('Contrat')
  })

  it('rend les droits RGPD (§7)', () => {
    const wrapper = mountView()
    expect(wrapper.text()).toContain("Droit d'accès")
    expect(wrapper.text()).toContain('Droit de rectification')
  })

  it('rend les mesures de sécurité (§8)', () => {
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Mesure un')
    expect(wrapper.text()).toContain('Mesure deux')
  })

  it('le lien vers la politique cookies est un vrai RouterLink navigable', () => {
    const wrapper = mountView()
    const cookiesLinks = wrapper.findAll('[data-testid="cookies-policy-link"]')
    expect(cookiesLinks.length).toBeGreaterThan(0)
    for (const link of cookiesLinks) {
      expect(link.attributes('href')).toBe(JSON.stringify({ name: 'legal-cookies' }))
    }
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

describe('Route /legal/privacy', () => {
  it('est enregistrée, publique et pointe vers PrivacyPolicyView', async () => {
    const { default: router } = await import('../../src/router/index.js')
    const resolved = router.resolve('/legal/privacy')

    expect(resolved.name).toBe('legal-privacy')
    expect(resolved.meta.public).toBe(true)
  })
})
