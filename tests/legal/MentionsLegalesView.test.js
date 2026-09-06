import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import MentionsLegalesView from '../../src/views/legal/MentionsLegalesView.vue'

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
          Name: 'Gregory Van den Bergh',
          AddressLabel: 'Adresse',
          Address: 'Avenue Cardinal Mercier 67 Bte 1 - 5000 Namur (Belgique)',
          EmailLabel: 'Email de contact',
          Email: 'contact-odc[at]creacube.be',
        },
      },
      Cookies: { PageTitle: 'Politique cookies et stockage local' },
      Privacy: { PageTitle: 'Politique de confidentialité' },
      Mentions: {
        PageTitle: 'Mentions légales',
        Preamble: 'Préambule des mentions légales.',
        Section1: { Title: '1. Éditeur du site', StatusLabel: 'Statut', Status: 'Édition non commerciale.' },
        Section2: {
          Title: '2. Hébergeur du site',
          HostNameLabel: 'Nom', HostName: 'o2switch',
          HostAddressLabel: 'Adresse', HostAddress: 'Clermont-Ferrand, France',
          HostWebsiteLabel: 'Site web',
          HostTypeLabel: "Type d'hébergement", HostType: 'Mutualisé.',
        },
        Section3: { Title: '3. Directeur de la publication', Content: 'Gregory Van den Bergh.' },
        Section4: { Title: '4. Nature du site', Content: 'Outil communautaire non officiel.' },
        Section5: { Title: '5. Propriété intellectuelle', Content: 'Code source via {frontendRepoLink} et {backendRepoLink}.' },
        Section6: { Title: '6. Données personnelles et cookies', Intro: 'Voir les politiques dédiées :' },
        Section7: { Title: '7. Contact', Content: 'Contact : {email}' },
        LastUpdated: 'Dernière modification : {date}',
      },
    },
  },
}

const i18n = createI18n({ legacy: false, locale: 'fr', messages })

const RouterLinkStub = {
  props: ['to'],
  template: '<a :href="typeof to === \'string\' ? to : JSON.stringify(to)"><slot /></a>',
}

function mountView() {
  return mount(MentionsLegalesView, {
    global: {
      plugins: [createPinia(), i18n],
      stubs: { RouterLink: RouterLinkStub },
    },
  })
}

describe('MentionsLegalesView', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('affiche le titre de la page', () => {
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Mentions légales')
  })

  it('affiche les 7 sections', () => {
    const wrapper = mountView()
    for (const title of [
      '1. Éditeur du site', '2. Hébergeur du site', '3. Directeur de la publication',
      '4. Nature du site', '5. Propriété intellectuelle', '6. Données personnelles et cookies',
      '7. Contact',
    ]) {
      expect(wrapper.text()).toContain(title)
    }
  })

  it('réutilise les clés Legal.Common.Contact.* (éditeur du site) sans les redéfinir', () => {
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Gregory Van den Bergh')
    expect(wrapper.text()).toContain('Avenue Cardinal Mercier 67 Bte 1 - 5000 Namur (Belgique)')
  })

  it('affiche un vrai lien mailto avec le "@" désobfusqué (le JSON source garde [at], voir project_vue_i18n_at_symbol_bug)', () => {
    const wrapper = mountView()
    const link = wrapper.find('a[href="mailto:contact-odc@creacube.be"]')
    expect(link.exists()).toBe(true)
    expect(link.text()).toBe('contact-odc@creacube.be')
  })

  it("affiche les informations de l'hébergeur avec un lien externe sécurisé", () => {
    const wrapper = mountView()
    expect(wrapper.text()).toContain('o2switch')
    const link = wrapper.find('a[href="https://www.o2switch.fr"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
  })

  it('les liens vers les dépôts GitHub sont externes et sécurisés', () => {
    const wrapper = mountView()
    for (const href of [
      'https://github.com/GV-Greg/Office-des-coffres-vuejs',
      'https://github.com/GV-Greg/Office-des-coffres-backend',
    ]) {
      const link = wrapper.find(`a[href="${href}"]`)
      expect(link.exists()).toBe(true)
      expect(link.attributes('target')).toBe('_blank')
      expect(link.attributes('rel')).toBe('noopener noreferrer')
    }
  })

  it('les liens vers les politiques cookies et confidentialité sont de vrais RouterLink', () => {
    const wrapper = mountView()
    const privacyLink = wrapper.find('[data-testid="privacy-policy-link"]')
    const cookiesLink = wrapper.find('[data-testid="cookies-policy-link"]')
    expect(privacyLink.attributes('href')).toBe(JSON.stringify({ name: 'legal-privacy' }))
    expect(cookiesLink.attributes('href')).toBe(JSON.stringify({ name: 'legal-cookies' }))
  })

  it('affiche une date de dernière modification', () => {
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Dernière modification :')
  })
})

describe('Route /legal/mentions', () => {
  it('est enregistrée, publique et pointe vers MentionsLegalesView', async () => {
    const { default: router } = await import('../../src/router/index.js')
    const resolved = router.resolve('/legal/mentions')

    expect(resolved.name).toBe('legal-mentions')
    expect(resolved.meta.public).toBe(true)
  })
})
