<script setup>
  import { ref, reactive, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useAuthStore } from '@/stores/authStore'
  import { useCookieStore } from '@/stores/cookieStore'
  import { passwordStrength } from '@/modules/passwordStrength'
  import CityCascadeSelect from '@/components/forms/CityCascadeSelect.vue'
  import SlugField from '@/components/anim/SlugField.vue'
  import PasswordField from '@/components/anim/PasswordField.vue'

  /*
    Création d'une activité de « Décode le code », mode PRIVÉ (lié au personnage) ou SANS COMPTE (D2). Deux temps :
      1. le formulaire — nom, adresse (SlugField, règles du serveur), lieu (royaume, province OU ville : un seul niveau, D1) et,
         sans compte, pseudo OBLIGATOIRE (D12), mot de passe choisi (D10) et email FACULTATIF (D23) ;
      2. l'écran de confirmation (D25, D39) : un récapitulatif construit SELON LES CHOIX, puis UN SEUL bouton « Je confirme ». Il sert aussi
         d'information de collecte (IP, email) au moment où les données sont saisies. Rien n'est enregistré de la confirmation elle-même.
    ⚠️ Aucune règle de sécurité ici : le serveur juge (slug, mot de passe, un seul niveau de lieu, une seule activité par connexion…) et
    ses refus s'affichent tels quels (`errors`, dans la langue de l'interface). Les textes du récapitulatif sont un BROUILLON de Claude Code :
    Cowork les aligne sur le texte légal (politique, « Vos données ») avant la mise en ligne.
    Vocabulaire (D34) : « personnage » pour le pseudo, « joueur » pour la personne (email, connexion).
  */
  const props = defineProps({
    mode: { type: String, required: true, validator: v => ['private', 'anonymous'].includes(v) },
    errors: { type: Object, default: () => ({}) },
    submitting: { type: Boolean, default: false },
    slugDelay: { type: Number, default: 300 },
  })
  const emit = defineEmits(['confirm'])

  const { t } = useI18n()
  const authStore = useAuthStore()
  const cookieStore = useCookieStore()

  const anonymous = computed(() => props.mode === 'anonymous')
  const form = reactive({
    name: '', slug: '', placeKind: 'province', placeId: '', placeLabel: '',
    organizerName: '', password: '', confirmation: '', email: '',
  })
  const slugState = ref({ valid: false, taken: false, checked: false })
  const step = ref('form') // 'form' | 'recap'

  const onPlaceKind = () => { form.placeId = ''; form.placeLabel = '' }
  // Connecté : la province proposée d'emblée est celle de résidence du personnage (modifiable). Sans compte, rien à proposer.
  const residenceCityId = computed(() => (anonymous.value ? '' : authStore.activeCharacter?.city_id ?? ''))
  const cascadeStop = computed(() => (form.placeKind === 'city' ? 'city' : form.placeKind))

  const canContinue = computed(() => {
    if (form.name.trim().length < 3) return false
    if (!slugState.value.checked || !slugState.value.valid || slugState.value.taken) return false
    if (!form.placeId) return false
    if (!anonymous.value) return true
    const strength = passwordStrength(form.password, { slug: form.slug, pseudo: form.organizerName })
    return form.organizerName.trim() !== '' && strength.meetsMinimum && form.password === form.confirmation
  })

  function payload() {
    const body = { slug: form.slug, name: form.name.trim() }
    if (form.placeKind === 'kingdom' && form.placeId) body.kingdom_id = Number(form.placeId)
    if (form.placeKind === 'province' && form.placeId) body.province_id = Number(form.placeId)
    if (form.placeKind === 'city' && form.placeId) body.city_id = Number(form.placeId)
    if (anonymous.value) {
      body.organizer_name = form.organizerName.trim()
      body.password = form.password
      body.password_confirmation = form.confirmation
      if (form.email.trim()) body.email = form.email.trim()
    }
    return body
  }

  // Un refus du serveur ramène au formulaire, où les messages s'affichent sous les champs.
  watch(() => props.errors, (errors) => { if (Object.keys(errors).length) step.value = 'form' })

  const address = computed(() => `${window.location.origin}/public/activite/decode/${form.slug}`)
  const hasEmail = computed(() => form.email.trim() !== '')
  const preferences = computed(() => cookieStore.hasAcceptedPreferences)
  // Le lieu choisi, nommé : « Province de Bretagne », « Ville de Brest », « Royaume : France ».
  const placeText = computed(() => {
    if (!form.placeLabel) return ''
    const kind = form.placeKind[0].toUpperCase() + form.placeKind.slice(1)
    return t('Animation.Recap.Place', { place: t(`Animation.Public.Place${kind}`, { name: form.placeLabel }) })
  })

  // Le récapitulatif, ligne par ligne, SELON les choix (D25, D39). Une clé de test par ligne.
  const lines = computed(() => {
    const list = [{ key: 'address', text: t('Animation.Recap.Address', { address: address.value }) }]
    if (anonymous.value) {
      list.push({ key: 'organizer', text: t('Animation.Recap.Organizer', { pseudo: form.organizerName.trim() }) })
    } else {
      list.push({ key: 'organizer', text: t('Animation.Recap.OrganizerPrivate', { pseudo: authStore.activeCharacter?.pseudo ?? '' }) })
    }
    if (placeText.value) list.push({ key: 'place', text: placeText.value })

    if (anonymous.value) {
      list.push({ key: 'password', text: t('Animation.Recap.Password') })
      list.push(hasEmail.value
        ? { key: 'email', text: t('Animation.Recap.EmailYes') }
        : { key: 'email', text: t('Animation.Recap.EmailNo', { pseudo: form.organizerName.trim() }) })
      list.push({ key: 'connection', text: t('Animation.Recap.Connection') })
      list.push({ key: 'closing', text: t('Animation.Recap.ClosingAnonymous') })
      list.push({ key: 'idle', text: t('Animation.Recap.Idle') })
      list.push({ key: 'cookies', text: preferences.value ? t('Animation.Recap.CookiesYes') : t('Animation.Recap.CookiesNo') })
    } else {
      list.push({ key: 'closing', text: t('Animation.Recap.ClosingPrivate') })
      list.push({ key: 'idle', text: t('Animation.Recap.Idle') })
      list.push({ key: 'deletion', text: t('Animation.Recap.DeletionPrivate') })
    }
    return list
  })

  const confirm = () => emit('confirm', payload())
</script>

<template>
  <div>
    <!-- 1. Le formulaire -->
    <!-- Deux colonnes dès `laptop` (sans compte) : la salle à gauche, l'organisateur à droite — la page tient sans défilement. -->
    <form
      v-show="step === 'form'"
      class="grid gap-x-8 gap-y-3"
      :class="anonymous ? 'laptop:grid-cols-2' : 'laptop:w-3/4'"
      data-testid="create-form"
      @submit.prevent="step = 'recap'"
    >
      <div class="space-y-3" data-testid="create-col-activity">
        <h3 v-if="anonymous" class="!m-0 text-base font-bold text-teal-800 dark:text-teal-800">{{ t('Animation.Create.ColumnActivity') }}</h3>
        <div>
          <label for="create-name" class="block text-sm font-bold">{{ t('Animation.Mine.Name') }}<span class="text-red-700 dark:text-red-700" aria-hidden="true"> *</span></label>
          <input id="create-name" v-model="form.name" type="text" maxlength="190" required class="form-field w-full" data-testid="create-name" />
          <p v-if="errors.name" role="alert" class="text-sm text-red-700 dark:text-red-700" data-testid="create-error-name">{{ errors.name }}</p>
        </div>

        <SlugField v-model="form.slug" :name="form.name" :delay="slugDelay" id-prefix="create" @state="slugState = $event" />
        <p v-if="errors.slug" role="alert" class="text-sm text-red-700 dark:text-red-700" data-testid="create-error-slug">{{ errors.slug }}</p>

        <fieldset>
          <legend class="text-sm font-bold">{{ t('Animation.Mine.Place') }}<span class="text-red-700 dark:text-red-700" aria-hidden="true"> *</span></legend>
          <div class="flex flex-wrap gap-x-4 gap-y-1">
            <label v-for="kind in ['kingdom', 'province', 'city']" :key="kind" class="inline-flex items-center gap-1.5">
              <input v-model="form.placeKind" type="radio" name="place-kind" :value="kind" :data-testid="`place-${kind}`" @change="onPlaceKind" />
              {{ t(`Animation.Mine.Place${kind[0].toUpperCase()}${kind.slice(1)}`) }}
            </label>
          </div>
          <!-- Royaume, province OU ville : jamais deux niveaux (une seule cascade à la fois) ; le serveur refuse de toute façon. -->
          <CityCascadeSelect :key="form.placeKind" v-model="form.placeId" :stop-at="cascadeStop" inline :initial-city-id="residenceCityId" @label="form.placeLabel = $event" />
          <p v-if="errors.place" role="alert" class="text-sm text-red-700 dark:text-red-700" data-testid="create-error-place">{{ errors.place }}</p>
        </fieldset>
      </div>

      <!-- Mode sans compte : pseudo obligatoire, mot de passe choisi, email facultatif. -->
      <div v-if="anonymous" class="space-y-3" data-testid="create-col-organizer">
        <h3 class="!m-0 text-base font-bold text-teal-800 dark:text-teal-800">{{ t('Animation.Create.ColumnOrganizer') }}</h3>
        <div>
          <div class="flex flex-wrap items-baseline gap-x-2">
            <label for="create-organizer" class="block text-sm font-bold">{{ t('Animation.Create.Organizer') }}<span class="text-red-700 dark:text-red-700" aria-hidden="true"> *</span></label>
            <span class="text-xs text-slate-600 dark:text-slate-600" aria-hidden="true">—</span>
            <span id="create-organizer-hint" class="text-xs italic whitespace-nowrap text-slate-600 dark:text-slate-600" data-testid="create-organizer-hint">{{ t('Animation.Create.OrganizerHint') }}</span>
          </div>
          <input id="create-organizer" v-model="form.organizerName" type="text" maxlength="30" required aria-describedby="create-organizer-hint" class="form-field w-full" data-testid="create-organizer" />
          <p v-if="errors.organizer_name" role="alert" class="text-sm text-red-700 dark:text-red-700" data-testid="create-error-organizer">{{ errors.organizer_name }}</p>
        </div>

        <PasswordField v-model="form.password" v-model:confirmation="form.confirmation" :slug="form.slug" :pseudo="form.organizerName" :error="errors.password" id-prefix="create" />

        <div>
          <label for="create-email" class="block text-sm font-bold">{{ t('Animation.Create.Email') }}</label>
          <input id="create-email" v-model="form.email" type="email" maxlength="190" autocomplete="email" class="form-field w-full" data-testid="create-email" />
          <p class="text-xs text-slate-600 dark:text-slate-600">{{ t('Animation.Create.EmailHelp') }}</p>
          <p v-if="errors.email" role="alert" class="text-sm text-red-700 dark:text-red-700" data-testid="create-error-email">{{ errors.email }}</p>
        </div>
      </div>

      <div class="laptop:col-span-full flex flex-wrap items-center gap-3">
        <p class="text-xs italic text-slate-600 dark:text-slate-600" data-testid="create-required-note">{{ t('Animation.Create.RequiredNote') }}</p>
        <button type="submit" class="odc-btn odc-btn--soft odc-btn--sm odc--green" :disabled="!canContinue" data-testid="create-continue">
          <v-icon name="fa-arrow-right" aria-hidden="true" />{{ t('Animation.Create.Continue') }}
        </button>
        <p v-if="errors.activity" role="alert" class="text-sm text-red-700 dark:text-red-700" data-testid="create-error-activity">{{ errors.activity }}</p>
        <p v-if="errors.type" role="alert" class="text-sm text-red-700 dark:text-red-700">{{ errors.type }}</p>
      </div>
    </form>

    <!-- 2. L'écran de confirmation (D25, D39) : un récapitulatif selon les choix, UN seul bouton. -->
    <section v-if="step === 'recap'" aria-labelledby="recap-title" data-testid="recap">
      <h3 id="recap-title" class="text-lg font-bold text-slate-800 dark:text-slate-800">{{ t('Animation.Recap.Title') }}</h3>
      <p class="text-sm text-slate-700 dark:text-slate-700">{{ t('Animation.Recap.Intro') }}</p>
      <ul class="mt-2 list-disc pl-5 space-y-1 text-sm text-slate-800 dark:text-slate-800">
        <li v-for="line in lines" :key="line.key" :data-testid="`recap-${line.key}`">{{ line.text }}</li>
      </ul>
      <div class="mt-3 flex flex-wrap gap-2">
        <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--green" :disabled="submitting" data-testid="recap-confirm" @click="confirm">
          <v-icon name="fa-check" aria-hidden="true" />{{ t('Animation.Recap.Confirm') }}
        </button>
        <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--slate" data-testid="recap-back" @click="step = 'form'">
          <v-icon name="fa-reply" aria-hidden="true" />{{ t('Animation.Recap.Back') }}
        </button>
      </div>
    </section>
  </div>
</template>
