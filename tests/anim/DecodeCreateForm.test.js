import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { reactive } from 'vue'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import DecodeCreateForm from '../../src/components/anim/DecodeCreateForm.vue'
import { http } from '../../src/api.js'

// Création d'une activité (privée ou sans compte) : un formulaire, puis l'écran de confirmation (D25, D39) — UN seul bouton « Je confirme ».
// Aucune règle côté site : l'adresse est jugée par le serveur (mocké ici), le lieu vient de la cascade (doublure).

vi.mock('../../src/api.js', () => ({ http: { get: vi.fn() } }))
const auth = reactive({ getToken: 'jeton', isLoggedIn: true, activeCharacter: { id: 7, pseudo: 'Artifice' } })
vi.mock('../../src/stores/authStore', () => ({ useAuthStore: () => auth }))
const cookies = reactive({ accepted: false })
vi.mock('../../src/stores/cookieStore', () => ({ useCookieStore: () => ({ get hasAcceptedPreferences() { return cookies.accepted } }) }))

const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const readLocale = lang => JSON.parse(fs.readFileSync(path.join(localesDir, `${lang}.json`), 'utf8'))
const fr = readLocale('fr')
const en = readLocale('en')

const CascadeStub = {
  props: { modelValue: [Number, String], stopAt: String, inline: Boolean, initialCityId: [Number, String] },
  emits: ['update:modelValue', 'label'],
  template: '<button type="button" data-testid="cascade" :data-stop="stopAt" :data-inline="String(inline)" :data-city="initialCityId" @click="$emit(\'update:modelValue\', 5); $emit(\'label\', \'Bretagne\')">lieu</button>',
}

async function mountForm({ mode = 'anonymous', errors = {}, locale = 'fr' } = {}) {
  http.get.mockResolvedValue({ data: { success: true, proposal: 'les-trois-coffres', slug: 'les-trois-coffres', valid: true, taken: false, min: 3, max: 20 } })
  const wrapper = mount(DecodeCreateForm, {
    props: { mode, errors, slugDelay: 0 },
    global: { plugins: [createI18n({ legacy: false, locale, messages: { fr, en } })], stubs: { CityCascadeSelect: CascadeStub } },
  })
  await flushPromises()
  return wrapper
}

// Remplit tout ce qu'il faut pour pouvoir continuer.
async function fillAnonymous(w, over = {}) {
  await w.find('[data-testid="create-name"]').setValue('Les Trois Coffres')
  await flushPromises()
  await w.find('[data-testid="cascade"]').trigger('click')
  await w.find('[data-testid="create-organizer"]').setValue(over.pseudo ?? 'Artifice')
  await w.find('[data-testid="create-password"]').setValue('Zsdlk5jwe!qpxy')
  await w.find('[data-testid="create-confirmation"]').setValue('Zsdlk5jwe!qpxy')
  if (over.email) await w.find('[data-testid="create-email"]').setValue(over.email)
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
  cookies.accepted = false
})

describe('DecodeCreateForm — mise en page', () => {
  it('sans compte : deux colonnes (la salle, l\'identité), pas de champ description', async () => {
    const w = await mountForm()

    expect(w.find('[data-testid="create-form"]').classes()).toContain('laptop:grid-cols-2')
    expect(w.find('[data-testid="create-col-activity"]').exists()).toBe(true)
    expect(w.find('[data-testid="create-col-organizer"]').exists()).toBe(true)
    expect(w.find('[data-testid="create-description"]').exists()).toBe(false)
  })

  it('privé : une seule colonne à 3/4 de la largeur, sans pseudo, mot de passe ni email', async () => {
    const w = await mountForm({ mode: 'private' })

    expect(w.find('[data-testid="create-form"]').classes()).toContain('laptop:w-3/4')
    expect(w.find('[data-testid="create-col-organizer"]').exists()).toBe(false)
    expect(w.find('[data-testid="create-organizer"]').exists()).toBe(false)
  })

  it('le lieu est un des trois niveaux (pas d\'« aucun lieu »), la cascade s\'arrête au niveau choisi, royaume et province sur une ligne', async () => {
    const w = await mountForm()

    expect(w.find('[data-testid="place-none"]').exists()).toBe(false)
    expect(w.find('[data-testid="place-province"]').element.checked).toBe(true)
    expect(w.find('[data-testid="cascade"]').attributes('data-stop')).toBe('province')
    expect(w.find('[data-testid="cascade"]').attributes('data-inline')).toBe('true')
    await w.find('[data-testid="place-kingdom"]').setValue()
    expect(w.find('[data-testid="cascade"]').attributes('data-stop')).toBe('kingdom')
    await w.find('[data-testid="place-city"]').setValue()
    expect(w.find('[data-testid="cascade"]').attributes('data-stop')).toBe('city')
  })

  it('les champs obligatoires portent une étoile, et la note l\'explique', async () => {
    const w = await mountForm()

    expect(w.find('[data-testid="create-required-note"]').text()).toBe('* champ obligatoire')
    for (const id of ['create-name', 'create-organizer']) {
      const label = w.find(`label[for="${id}"]`)
      expect(label.text()).toContain('*')
    }
    expect(w.find('label[for="create-slug"]').text()).toContain('*')
    expect(w.find('label[for="create-password"]').text()).toContain('*')
  })

  it('la mention du pseudo est à côté du libellé, et plus sous le champ', async () => {
    const w = await mountForm()

    expect(w.find('[data-testid="create-organizer-hint"]').text()).toContain('administrateur')
    expect(w.find('[data-testid="create-organizer"]').attributes('aria-describedby')).toBe('create-organizer-hint')
    expect(w.text()).not.toContain('Obligatoire. Il est affiché comme organisateur')
  })
})

describe('DecodeCreateForm — continuer', () => {
  it('grisé tant que tout n\'est pas rempli', async () => {
    const w = await mountForm()
    expect(w.find('[data-testid="create-continue"]').attributes('disabled')).toBeDefined()

    await fillAnonymous(w)
    expect(w.find('[data-testid="create-continue"]').attributes('disabled')).toBeUndefined()
  })

  it('le lieu manque : grisé', async () => {
    const w = await mountForm()
    await w.find('[data-testid="create-name"]').setValue('Les Trois Coffres')
    await flushPromises()
    await w.find('[data-testid="create-organizer"]').setValue('Artifice')
    await w.find('[data-testid="create-password"]').setValue('Zsdlk5jwe!qpxy')
    await w.find('[data-testid="create-confirmation"]').setValue('Zsdlk5jwe!qpxy')

    expect(w.find('[data-testid="create-continue"]').attributes('disabled')).toBeDefined()
  })

  it('ressaisie différente : grisé', async () => {
    const w = await mountForm()
    await fillAnonymous(w)
    await w.find('[data-testid="create-confirmation"]').setValue('autre-chose-completement')

    expect(w.find('[data-testid="create-continue"]').attributes('disabled')).toBeDefined()
  })

  it('adresse prise : grisé', async () => {
    const w = await mountForm()
    http.get.mockResolvedValue({ data: { success: true, proposal: 'les-trois-coffres', slug: 'les-trois-coffres', valid: true, taken: true, min: 3, max: 20 } })
    await fillAnonymous(w)
    await w.find('[data-testid="create-input"]').setValue('les-trois-coffres')
    await flushPromises()

    expect(w.find('[data-testid="create-continue"]').attributes('disabled')).toBeDefined()
  })

  it('privé : nom, adresse et lieu suffisent', async () => {
    const w = await mountForm({ mode: 'private' })
    await w.find('[data-testid="create-name"]').setValue('Les Trois Coffres')
    await flushPromises()
    await w.find('[data-testid="cascade"]').trigger('click')

    expect(w.find('[data-testid="create-continue"]').attributes('disabled')).toBeUndefined()
  })

  it('l\'icône du bouton est enregistrée (fa-arrow-right)', async () => {
    const w = await mountForm()

    expect(w.find('[data-testid="create-continue"]').html()).toContain('fa-arrow-right')
  })
})

describe('DecodeCreateForm — province de résidence', () => {
  it('connecté : la cascade part de la résidence du personnage actif ; sans compte, de rien', async () => {
    auth.activeCharacter = { id: 7, pseudo: 'Artifice', city_id: 42 }
    const priv = await mountForm({ mode: 'private' })
    expect(priv.find('[data-testid="cascade"]').attributes('data-city')).toBe('42')

    const anon = await mountForm()
    expect(anon.find('[data-testid="cascade"]').attributes('data-city') ?? '').toBe('')
    auth.activeCharacter = { id: 7, pseudo: 'Artifice' }
  })
})

describe('DecodeCreateForm — écran de confirmation', () => {
  async function toRecap(w) {
    await w.find('[data-testid="create-form"]').trigger('submit')
    await flushPromises()
  }

  it('sans compte, sans email, préférences refusées : un récapitulatif selon les choix, UN seul bouton « Je confirme »', async () => {
    const w = await mountForm()
    await fillAnonymous(w)
    await toRecap(w)

    expect(w.find('[data-testid="recap"]').exists()).toBe(true)
    for (const key of ['address', 'organizer', 'place', 'password', 'email', 'connection', 'closing', 'idle', 'cookies']) {
      expect(w.find(`[data-testid="recap-${key}"]`).exists(), key).toBe(true)
    }
    expect(w.find('[data-testid="recap-address"]').text()).toContain('/public/activite/decode/les-trois-coffres')
    expect(w.find('[data-testid="recap-organizer"]').text()).toContain('Artifice')
    expect(w.find('[data-testid="recap-place"]').text()).toBe('Lieu rattaché à l\'activité : Province de Bretagne.')
    expect(w.find('[data-testid="recap-email"]').text()).toBe(fr.Animation.Recap.EmailNo.replace('{pseudo}', 'Artifice'))
    expect(w.find('[data-testid="recap-cookies"]').text()).toBe(fr.Animation.Recap.CookiesNo)
    expect(w.find('[data-testid="recap"]').findAll('button').filter(b => b.attributes('data-testid') === 'recap-confirm')).toHaveLength(1)
  })

  it('avec un email et les préférences acceptées : les lignes suivent les choix', async () => {
    cookies.accepted = true
    const w = await mountForm()
    await fillAnonymous(w, { email: 'artifice@example.test' })
    await toRecap(w)

    expect(w.find('[data-testid="recap-email"]').text()).toBe(fr.Animation.Recap.EmailYes)
    expect(w.find('[data-testid="recap-cookies"]').text()).toBe(fr.Animation.Recap.CookiesYes)
  })

  it('privé : ni mot de passe, ni email, ni IP — la suppression avec le personnage est dite', async () => {
    const w = await mountForm({ mode: 'private' })
    await w.find('[data-testid="create-name"]').setValue('Les Trois Coffres')
    await flushPromises()
    await w.find('[data-testid="cascade"]').trigger('click')
    await toRecap(w)

    expect(w.find('[data-testid="recap-organizer"]').text()).toContain('Artifice')
    expect(w.find('[data-testid="recap-deletion"]').exists()).toBe(true)
    for (const key of ['password', 'email', 'connection', 'cookies']) expect(w.find(`[data-testid="recap-${key}"]`).exists(), key).toBe(false)
  })

  it('« Je confirme » émet la charge : adresse, nom, lieu, pseudo, mot de passe et ressaisie — sans description', async () => {
    const w = await mountForm()
    await fillAnonymous(w, { email: 'artifice@example.test' })
    await toRecap(w)

    await w.find('[data-testid="recap-confirm"]').trigger('click')

    expect(w.emitted('confirm')[0][0]).toEqual({
      slug: 'les-trois-coffres',
      name: 'Les Trois Coffres',
      province_id: 5,
      organizer_name: 'Artifice',
      password: 'Zsdlk5jwe!qpxy',
      password_confirmation: 'Zsdlk5jwe!qpxy',
      email: 'artifice@example.test',
    })
  })

  it('« Retour » revient au formulaire, saisies conservées', async () => {
    const w = await mountForm()
    await fillAnonymous(w)
    await toRecap(w)

    await w.find('[data-testid="recap-back"]').trigger('click')

    expect(w.find('[data-testid="create-name"]').element.value).toBe('Les Trois Coffres')
    expect(w.find('[data-testid="create-organizer"]').element.value).toBe('Artifice')
  })

  it('un refus du serveur ramène au formulaire, message sous le champ', async () => {
    const w = await mountForm()
    await fillAnonymous(w)
    await toRecap(w)

    await w.setProps({ errors: { slug: 'Cette adresse est déjà prise.' } })
    await flushPromises()

    expect(w.find('[data-testid="create-error-slug"]').text()).toBe('Cette adresse est déjà prise.')
    expect(w.find('[data-testid="recap"]').exists()).toBe(false)
  })

  it('en anglais', async () => {
    const w = await mountForm({ locale: 'en' })

    expect(w.find('[data-testid="create-required-note"]').text()).toBe('* required field')
    expect(w.find('[data-testid="create-organizer-hint"]').text()).toContain('administrator')
  })
})
