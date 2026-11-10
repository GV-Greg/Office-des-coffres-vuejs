<script setup>
  import { ref, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { push } from 'notivue'
  import { useAuthStore } from '@/stores/authStore'
  import { apiMessage, apiFieldErrors } from '@/stores/mandateStore'
  import useRewardsGrid from '@/use/useRewardsGrid'
  import useNavigationLoading from '@/use/useNavigationLoading'
  import RewardsGridCard from '@/components/anim/RewardsGridCard.vue'
  import ChestLoader from '@/components/loading/ChestLoader.vue'
  import RewardsGridHero from '@/components/anim/RewardsGridHero.vue'
  import CityCascadeSelect from '@/components/forms/CityCascadeSelect.vue'
  import SlugField from '@/components/anim/SlugField.vue'

  /*
    Grille des lots — « Ma grille » (mode PRIVÉ, lié au personnage actif). Créer, ajouter des lots,
    tirer au sort, confirmer, attribuer les cases, clore, supprimer.
    ⚠️ AUCUNE règle ici : seul l'organisateur gère sa grille, les refus de l'API s'affichent tels quels.
    Une grille privée disparaît avec son personnage ou son compte (catégorie C).
  */
  const { t, locale } = useI18n()
  const authStore = useAuthStore()
  const api = useRewardsGrid()
  const { trackApiCall } = useNavigationLoading()
  const gestures = api.asOrganizer()

  const character = computed(() => (authStore.isLoggedIn ? authStore.activeCharacter : null))
  const grids = ref([])
  const loading = ref(false)
  const error = ref('')

  async function load() {
    grids.value = []
    error.value = ''
    if (!character.value) return
    loading.value = true
    try {
      grids.value = await api.list(character.value.id)
    } catch (e) {
      error.value = apiMessage(e, locale.value, t('Auth.Errors.NetworkError'))
    } finally {
      loading.value = false
    }
  }
  watch(() => character.value?.id, load, { immediate: true })

  // ── Création ──────────────────────────────────────────────────────────────────────────────────
  const form = ref({ name: '', slug: '', width: 5, height: 5, place_kind: 'kingdom', place_id: null })
  const fieldErrors = ref({})
  const creating = ref(false)
  const confirmed = ref(false) // étape 2 : écran de confirmation avant création

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
    }
    if (form.value.place_kind === 'kingdom') payload.kingdom_id = form.value.place_id
    else if (form.value.place_kind === 'province') payload.province_id = form.value.place_id
    else payload.city_id = form.value.place_id

    trackApiCall(api.create(character.value.id, payload))
      .then((created) => {
        grids.value = [created, ...grids.value]
        form.value = { name: '', slug: '', width: 5, height: 5, place_kind: 'kingdom', place_id: null }
        confirmed.value = false
        push.success(t('Animation.Grid.Created'))
      })
      .catch((e) => {
        confirmed.value = false
        fieldErrors.value = apiFieldErrors(e, locale.value)
        if (!Object.keys(fieldErrors.value).length) push.error(apiMessage(e, locale.value, t('Auth.Errors.NetworkError')))
      })
      .finally(() => { creating.value = false })
  }

  const hasOpen = computed(() => grids.value.some(g => g.status !== 'closed'))
  const showCreate = computed(() => !hasOpen.value)

  const replace = updated => { grids.value = grids.value.map(g => (g.id === updated.id ? updated : g)) }
  const removed = gone => { grids.value = grids.value.filter(g => g.id !== gone.id) }
</script>

<template>
  <div class="w-full text-slate-800 dark:text-slate-800">
    <RewardsGridHero v-if="!grids.length" :title="t('Animation.Grid.MineTitle')" :divider="false" title-testid="mine-grid-title" class="mb-5" />
    <ChestLoader :loading="loading" :error="error" accent="teal" error-testid="mine-grid-error" @retry="load">
      <p v-if="!character" class="text-slate-700 dark:text-slate-700" data-testid="mine-grid-no-character">{{ t('Animation.Grid.NoCharacter') }}</p>
      <template v-else>
        <!-- Formulaire de création (uniquement si aucune grille ouverte) -->
        <section v-if="showCreate && !confirmed" class="rounded-xl border border-slate-300 p-5 bg-white mb-5" data-testid="mine-grid-create">
          <h3 class="!mt-0 text-xl font-extrabold text-teal-800">{{ t('Animation.Grid.CreateTitle') }}</h3>
          <p class="text-xs italic text-slate-700 dark:text-slate-700 mb-3">{{ t('Animation.Grid.OneAtATime') }}</p>

          <form class="space-y-4" @submit.prevent="goConfirm" data-testid="mine-grid-create-form">
            <!-- Nom -->
            <div>
              <label for="grid-name" class="block text-sm font-bold mb-1">
                {{ t('Animation.Grid.Name') }} <span aria-hidden="true" class="text-red-700">*</span>
              </label>
              <input id="grid-name" v-model="form.name" type="text" maxlength="60" required class="form-field w-full" data-testid="grid-name-input" />
              <p v-if="fieldErrors.name" role="alert" class="text-xs text-red-700 mt-1">{{ fieldErrors.name }}</p>
            </div>

            <!-- Adresse (slug) -->
            <div>
              <label for="grid-slug" class="block text-sm font-bold mb-1">
                {{ t('Animation.Grid.Slug') }} <span aria-hidden="true" class="text-red-700">*</span>
              </label>
              <SlugField v-model="form.slug" :name="form.name" activity-type="rewards" :error="fieldErrors.slug" data-testid="grid-slug-input" />
            </div>

            <!-- Dimensions -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="grid-width" class="block text-sm font-bold mb-1">{{ t('Animation.Grid.Width') }} <span aria-hidden="true" class="text-red-700">*</span></label>
                <input id="grid-width" v-model.number="form.width" type="number" min="2" max="20" required class="form-field w-full" data-testid="grid-width-input" />
                <p v-if="fieldErrors.width" role="alert" class="text-xs text-red-700 mt-1">{{ fieldErrors.width }}</p>
              </div>
              <div>
                <label for="grid-height" class="block text-sm font-bold mb-1">{{ t('Animation.Grid.Height') }} <span aria-hidden="true" class="text-red-700">*</span></label>
                <input id="grid-height" v-model.number="form.height" type="number" min="2" max="20" required class="form-field w-full" data-testid="grid-height-input" />
                <p v-if="fieldErrors.height" role="alert" class="text-xs text-red-700 mt-1">{{ fieldErrors.height }}</p>
              </div>
            </div>

            <!-- Lieu -->
            <div>
              <p class="text-sm font-bold mb-1">{{ t('Animation.Grid.Place') }} <span aria-hidden="true" class="text-red-700">*</span></p>
              <div class="flex gap-3 mb-2">
                <label class="flex items-center gap-1 text-sm cursor-pointer">
                  <input v-model="form.place_kind" type="radio" value="kingdom" name="place_kind" class="accent-teal-700" />
                  {{ t('Animation.Grid.PlaceKingdom') }}
                </label>
                <label class="flex items-center gap-1 text-sm cursor-pointer">
                  <input v-model="form.place_kind" type="radio" value="province" name="place_kind" class="accent-teal-700" />
                  {{ t('Animation.Grid.PlaceProvince') }}
                </label>
                <label class="flex items-center gap-1 text-sm cursor-pointer">
                  <input v-model="form.place_kind" type="radio" value="city" name="place_kind" class="accent-teal-700" />
                  {{ t('Animation.Grid.PlaceCity') }}
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

            <button type="submit" class="odc-btn odc-btn--soft odc-btn--rect odc--teal w-full" data-testid="mine-grid-create-confirm">
              {{ t('Animation.Grid.CreateConfirmBtn') }}
            </button>
          </form>
        </section>

        <!-- Écran de confirmation avant création -->
        <section v-if="showCreate && confirmed" class="rounded-xl border border-teal-500 p-5 bg-white mb-5" data-testid="mine-grid-confirm-screen">
          <h3 class="!mt-0 text-xl font-extrabold text-teal-800">{{ t('Animation.Grid.ConfirmTitle') }}</h3>
          <ul class="text-sm space-y-1 mb-4">
            <li><strong>{{ t('Animation.Grid.Name') }} :</strong> {{ form.name }}</li>
            <li><strong>{{ t('Animation.Grid.Slug') }} :</strong> {{ form.slug }}</li>
            <li><strong>{{ t('Animation.Grid.Dimensions') }} :</strong> {{ form.width }} × {{ form.height }} ({{ form.width * form.height }} {{ t('Animation.Grid.Cells') }})</li>
          </ul>
          <div class="flex gap-2">
            <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--slate" :disabled="creating" data-testid="mine-grid-back" @click="backToForm">{{ t('Animation.Grid.Back') }}</button>
            <button type="button" class="odc-btn odc-btn--soft odc-btn--rect odc--teal" :disabled="creating" data-testid="mine-grid-create-submit" @click="create">{{ t('Animation.Grid.ConfirmCreate') }}</button>
          </div>
        </section>

        <p v-if="!grids.length" class="mt-4 text-center text-sm italic text-slate-700 dark:text-slate-700" data-testid="mine-grid-empty">{{ t('Animation.Grid.Empty') }}</p>
        <RewardsGridCard v-for="g in grids" :key="g.id" :grid="g" :gestures="gestures" @update="replace" @removed="removed" />
      </template>
    </ChestLoader>
  </div>
</template>
