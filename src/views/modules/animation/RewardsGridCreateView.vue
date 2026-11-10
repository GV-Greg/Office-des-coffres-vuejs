<script setup>
  import { ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { RouterLink } from 'vue-router'
  import { apiMessage, apiFieldErrors } from '@/stores/mandateStore'
  import { useCookieStore } from '@/stores/cookieStore'
  import useRewardsGrid from '@/use/useRewardsGrid'
  import useNavigationLoading from '@/use/useNavigationLoading'
  import CityCascadeSelect from '@/components/forms/CityCascadeSelect.vue'
  import SlugField from '@/components/anim/SlugField.vue'
  import PasswordField from '@/components/anim/PasswordField.vue'
  import RewardsGridHero from '@/components/anim/RewardsGridHero.vue'
  import { push } from 'notivue'

  /*
    Grille des lots — organiser une grille SANS COMPTE : aucun compte requis. Le formulaire suit la
    même mécanique que le mode privé (deux colonnes, écran de confirmation). Le mot de passe n'est ni
    conservé ni mémorisé : seule l'ADRESSE est retenue sur cet appareil sous la clé `anim_rewards_slug`
    (uniquement si les cookies « Préférences » sont acceptés). Aucune règle ici : le serveur juge.
  */
  const { t, locale } = useI18n()
  const api = useRewardsGrid()
  const cookieStore = useCookieStore()
  const { trackApiCall } = useNavigationLoading()

  const form = ref({
    name: '',
    slug: '',
    width: 5,
    height: 5,
    organizer_name: '',
    password: '',
    password_confirmation: '',
    organizer_email: '',
    place_kind: 'kingdom',
    place_id: null,
  })
  const fieldErrors = ref({})
  const creating = ref(false)
  const confirmed = ref(false) // étape de confirmation avant envoi
  const created = ref(null) // { grid, email_pending }

  function goConfirm() {
    confirmed.value = true
  }
  function backToForm() {
    confirmed.value = false
  }

  function create() {
    creating.value = true
    fieldErrors.value = {}
    const payload = {
      name: form.value.name,
      slug: form.value.slug,
      width: form.value.width,
      height: form.value.height,
      organizer_name: form.value.organizer_name,
      password: form.value.password,
      password_confirmation: form.value.password_confirmation,
    }
    if (form.value.organizer_email) payload.organizer_email = form.value.organizer_email
    if (form.value.place_kind === 'kingdom') payload.kingdom_id = form.value.place_id
    else if (form.value.place_kind === 'province') payload.province_id = form.value.place_id
    else payload.city_id = form.value.place_id

    trackApiCall(api.createAnonymous(payload))
      .then((result) => {
        created.value = result
        cookieStore.setComfortData('anim_rewards_slug', result.grid.slug)
        form.value.password = ''
        form.value.password_confirmation = ''
      })
      .catch((e) => {
        confirmed.value = false
        fieldErrors.value = apiFieldErrors(e, locale.value)
        if (!Object.keys(fieldErrors.value).length) push.error(apiMessage(e, locale.value, t('Auth.Errors.NetworkError')))
      })
      .finally(() => { creating.value = false })
  }
</script>

<template>
  <div class="w-full text-slate-800 dark:text-slate-800">
    <RewardsGridHero :title="t('Animation.Grid.Create.Title')" :divider="false" title-testid="grid-create-title" class="mb-5" />

    <!-- Après création : écran de succès -->
    <section v-if="created" class="rounded-xl border border-teal-700 bg-white p-5" role="status" data-testid="grid-create-done">
      <h3 class="!mt-0 text-xl font-extrabold text-teal-800">{{ t('Animation.Grid.Create.DoneTitle') }}</h3>
      <p class="mt-1" data-testid="grid-create-done-address">
        {{ t('Animation.Grid.Create.DoneAddress') }}
        <code class="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono">{{ created.grid.slug }}</code>
      </p>
      <p v-if="created.email_pending" class="mt-1 text-sm" data-testid="grid-create-done-email">{{ t('Animation.Grid.Create.DoneEmail') }}</p>
      <p class="mt-1 text-sm">{{ t('Animation.Grid.Create.DonePassword') }}</p>
      <div class="mt-4 flex flex-wrap gap-3">
        <RouterLink :to="{ name: 'animation-rewards-manage' }" class="odc-btn odc-btn--soft odc-btn--rect odc--teal" data-testid="grid-create-done-manage">
          <v-icon name="gi-chest" aria-hidden="true" />{{ t('Animation.Grid.Manage.Open') }}
        </RouterLink>
        <a :href="`/public/activite/grille/${created.grid.slug}`" target="_blank" rel="noopener" class="odc-btn odc-btn--soft odc-btn--rect odc--slate" data-testid="grid-create-done-public">
          <v-icon name="fa-eye" aria-hidden="true" />{{ t('Animation.Mine.ViewPublic') }}
        </a>
      </div>
    </section>

    <!-- Écran de confirmation (étape 2) -->
    <section v-else-if="confirmed" class="rounded-xl border border-teal-500 p-5 bg-white" data-testid="grid-create-confirm">
      <h3 class="!mt-0 text-xl font-extrabold text-teal-800">{{ t('Animation.Grid.Create.ConfirmTitle') }}</h3>
      <ul class="text-sm space-y-1 mb-4">
        <li><strong>{{ t('Animation.Grid.Name') }} :</strong> {{ form.name }}</li>
        <li><strong>{{ t('Animation.Grid.Slug') }} :</strong> {{ form.slug }}</li>
        <li><strong>{{ t('Animation.Grid.Dimensions') }} :</strong> {{ form.width }} × {{ form.height }} ({{ form.width * form.height }} {{ t('Animation.Grid.Cells') }})</li>
        <li><strong>{{ t('Animation.Grid.OrganizerName') }} :</strong> {{ form.organizer_name }}</li>
      </ul>
      <p class="text-sm text-orange-800 dark:text-orange-800 mb-4">{{ t('Animation.Grid.Create.ConfirmWarning') }}</p>
      <div class="flex gap-2">
        <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--slate" :disabled="creating" data-testid="grid-create-back" @click="backToForm">{{ t('Animation.Grid.Back') }}</button>
        <button type="button" class="odc-btn odc-btn--soft odc-btn--rect odc--teal" :disabled="creating" data-testid="grid-create-submit" @click="create">{{ t('Animation.Grid.Create.ConfirmCreate') }}</button>
      </div>
    </section>

    <!-- Formulaire en deux colonnes : la grille à gauche, l'identité à droite -->
    <div v-else class="grid gap-5 laptop:grid-cols-2 items-start">
      <section class="rounded-xl border border-slate-300 p-5 bg-white" data-testid="grid-create-form-left">
        <h3 class="!mt-0 text-xl font-extrabold text-teal-800">{{ t('Animation.Grid.Create.SectionGrid') }}</h3>

        <div class="space-y-4">
          <!-- Nom -->
          <div>
            <label for="anon-grid-name" class="block text-sm font-bold mb-1">
              {{ t('Animation.Grid.Name') }} <span aria-hidden="true" class="text-red-700">*</span>
            </label>
            <input id="anon-grid-name" v-model="form.name" type="text" maxlength="60" required class="form-field w-full" data-testid="anon-grid-name" />
            <p v-if="fieldErrors.name" role="alert" class="text-xs text-red-700 mt-1">{{ fieldErrors.name }}</p>
          </div>

          <!-- Adresse (slug) -->
          <div>
            <label class="block text-sm font-bold mb-1">
              {{ t('Animation.Grid.Slug') }} <span aria-hidden="true" class="text-red-700">*</span>
            </label>
            <SlugField v-model="form.slug" :name="form.name" activity-type="rewards" :error="fieldErrors.slug" data-testid="anon-grid-slug" />
          </div>

          <!-- Dimensions -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="anon-grid-width" class="block text-sm font-bold mb-1">{{ t('Animation.Grid.Width') }} <span aria-hidden="true" class="text-red-700">*</span></label>
              <input id="anon-grid-width" v-model.number="form.width" type="number" min="2" max="20" required class="form-field w-full" data-testid="anon-grid-width" />
              <p v-if="fieldErrors.width" role="alert" class="text-xs text-red-700 mt-1">{{ fieldErrors.width }}</p>
            </div>
            <div>
              <label for="anon-grid-height" class="block text-sm font-bold mb-1">{{ t('Animation.Grid.Height') }} <span aria-hidden="true" class="text-red-700">*</span></label>
              <input id="anon-grid-height" v-model.number="form.height" type="number" min="2" max="20" required class="form-field w-full" data-testid="anon-grid-height" />
              <p v-if="fieldErrors.height" role="alert" class="text-xs text-red-700 mt-1">{{ fieldErrors.height }}</p>
            </div>
          </div>

          <!-- Lieu -->
          <div>
            <p class="text-sm font-bold mb-1">{{ t('Animation.Grid.Place') }} <span aria-hidden="true" class="text-red-700">*</span></p>
            <div class="flex gap-3 mb-2">
              <label class="flex items-center gap-1 text-sm cursor-pointer">
                <input v-model="form.place_kind" type="radio" value="kingdom" name="anon_place_kind" class="accent-teal-700" />{{ t('Animation.Grid.PlaceKingdom') }}
              </label>
              <label class="flex items-center gap-1 text-sm cursor-pointer">
                <input v-model="form.place_kind" type="radio" value="province" name="anon_place_kind" class="accent-teal-700" />{{ t('Animation.Grid.PlaceProvince') }}
              </label>
              <label class="flex items-center gap-1 text-sm cursor-pointer">
                <input v-model="form.place_kind" type="radio" value="city" name="anon_place_kind" class="accent-teal-700" />{{ t('Animation.Grid.PlaceCity') }}
              </label>
            </div>
            <CityCascadeSelect
              :key="form.place_kind"
              v-model="form.place_id"
              :stop-at="form.place_kind === 'city' ? undefined : form.place_kind"
            />
            <p v-if="fieldErrors.kingdom_id || fieldErrors.province_id || fieldErrors.city_id" role="alert" class="text-xs text-red-700 mt-1">
              {{ fieldErrors.kingdom_id || fieldErrors.province_id || fieldErrors.city_id }}
            </p>
          </div>
        </div>
      </section>

      <section class="rounded-xl border border-slate-300 p-5 bg-white" data-testid="grid-create-form-right">
        <h3 class="!mt-0 text-xl font-extrabold text-teal-800">{{ t('Animation.Grid.Create.SectionIdentity') }}</h3>

        <div class="space-y-4">
          <!-- Pseudo de l'organisateur -->
          <div>
            <label for="anon-grid-organizer" class="block text-sm font-bold mb-1">
              {{ t('Animation.Grid.OrganizerName') }} <span aria-hidden="true" class="text-red-700">*</span>
            </label>
            <input id="anon-grid-organizer" v-model="form.organizer_name" type="text" maxlength="40" required class="form-field w-full" data-testid="anon-grid-organizer" />
            <p v-if="fieldErrors.organizer_name" role="alert" class="text-xs text-red-700 mt-1">{{ fieldErrors.organizer_name }}</p>
          </div>

          <!-- Mot de passe -->
          <PasswordField v-model="form.password" v-model:confirmation="form.password_confirmation" :slug="form.slug" :error="fieldErrors.password" id-prefix="anon-grid" />

          <!-- Email (optionnel) -->
          <div>
            <label for="anon-grid-email" class="block text-sm font-bold mb-1">{{ t('Animation.Grid.OrganizerEmail') }}</label>
            <input id="anon-grid-email" v-model="form.organizer_email" type="email" maxlength="255" class="form-field w-full" data-testid="anon-grid-email" />
            <p class="text-xs text-slate-500 mt-1">{{ t('Animation.Grid.Create.EmailHelp') }}</p>
            <p v-if="fieldErrors.organizer_email" role="alert" class="text-xs text-red-700 mt-1">{{ fieldErrors.organizer_email }}</p>
          </div>

          <p class="text-xs text-slate-500">
            <span aria-hidden="true" class="text-red-700">*</span> {{ t('Animation.Grid.Create.Required') }}
          </p>

          <button type="button" class="odc-btn odc-btn--soft odc-btn--rect odc--teal w-full" data-testid="anon-grid-confirm-btn" @click="goConfirm">
            {{ t('Animation.Grid.Create.GoConfirm') }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
