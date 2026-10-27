<script setup>
  import { ref, reactive, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { RouterLink } from 'vue-router'
  import { push } from 'notivue'
  import { useAuthStore } from '@/stores/authStore'
  import { apiMessage, apiFieldErrors } from '@/stores/mandateStore'
  import useDecodeActivities from '@/use/useDecodeActivities'
  import useNavigationLoading from '@/use/useNavigationLoading'
  import CityCascadeSelect from '@/components/forms/CityCascadeSelect.vue'
  import ChestLoader from '@/components/loading/ChestLoader.vue'

  /*
    Les Coffres Scellés — « Mes activités » (brief, lot 2) : créer une activité, sceller un coffre, inscrire les
    propositions reçues, rouvrir, clore, supprimer, exporter en BBCode. ⚠️ AUCUNE règle ici : seul l'organisateur
    gère son activité, on ne supprime qu'une activité close, une réouverture peut être refusée, la note d'une
    combinaison est calculée par le serveur — l'écran affiche ce que l'API répond (`apiMessage`, FR et EN). Les
    boutons suivent seulement l'état (un bouton « Rouvrir » n'a de sens que sur une activité close).
    Le code du coffre en cours n'est visible que de son organisateur : il vient de cette API, jamais de la page publique.
  */
  const { t, locale } = useI18n()
  const authStore = useAuthStore()
  const api = useDecodeActivities()
  const { trackApiCall } = useNavigationLoading()

  const character = computed(() => (authStore.isLoggedIn ? authStore.activeCharacter : null))
  const activities = ref([])
  const loading = ref(false)
  const error = ref('')

  async function load() {
    activities.value = []
    error.value = ''
    if (!character.value) return
    loading.value = true
    try {
      activities.value = await api.list(character.value.id)
    } catch (e) {
      error.value = apiMessage(e, locale.value, t('Auth.Errors.NetworkError'))
    } finally {
      loading.value = false
    }
  }
  watch(() => character.value?.id, load, { immediate: true })

  // ── Création ────────────────────────────────────────────────────────────────────────────────────────
  const form = reactive({ name: '', description: '', placeKind: 'none', placeId: '' })
  const fieldErrors = ref({})
  const creating = ref(false)

  function onPlaceKind() { form.placeId = '' }

  function create() {
    creating.value = true
    fieldErrors.value = {}
    const body = { name: form.name.trim() }
    if (form.description.trim()) body.description = form.description.trim()
    if (form.placeKind === 'province' && form.placeId) body.province_id = Number(form.placeId)
    if (form.placeKind === 'city' && form.placeId) body.city_id = Number(form.placeId)
    trackApiCall(api.create(character.value.id, body))
      .then((created) => {
        activities.value = [created, ...activities.value]
        form.name = ''; form.description = ''; form.placeKind = 'none'; form.placeId = ''
        push.success(t('Animation.Mine.Created'))
      })
      .catch((e) => { fieldErrors.value = apiFieldErrors(e, locale.value); if (!Object.keys(fieldErrors.value).length) push.error(apiMessage(e, locale.value, t('Auth.Errors.NetworkError'))) })
      .finally(() => { creating.value = false })
  }

  // ── Gestes sur une activité ─────────────────────────────────────────────────────────────────────────
  const busy = ref(null)               // id de l'activité en cours d'envoi
  const proposals = reactive({})       // id d'activité → { combination, player }
  const results = reactive({})         // id d'activité → dernière note, en toutes lettres
  const exported = reactive({})        // id d'activité → BBCode affiché
  const confirmingDelete = ref(null)

  const proposalOf = (a) => (proposals[a.id] ??= { combination: '', player: '' })
  const replace = (updated) => { activities.value = activities.value.map(a => (a.id === updated.id ? updated : a)) }

  function run(activity, call, success) {
    busy.value = activity.id
    return trackApiCall(call())
      .then((result) => { if (success) push.success(t(success)); return result })
      .catch((e) => { push.error(apiMessage(e, locale.value, t('Auth.Errors.NetworkError'))); return null })
      .finally(() => { busy.value = null })
  }

  const seal = (a) => run(a, () => api.generateSecret(a.id), 'Animation.Mine.Sealed').then(u => u && replace(u))
  const reopen = (a) => run(a, () => api.reopen(a.id), 'Animation.Mine.Reopened').then(u => u && replace(u))
  const close = (a) => run(a, () => api.close(a.id), 'Animation.Mine.Closed').then(u => u && replace(u))

  async function remove(a) {
    const done = await run(a, async () => { await api.remove(a.id); return true }, 'Animation.Mine.Deleted')
    confirmingDelete.value = null
    if (done) activities.value = activities.value.filter(x => x.id !== a.id)
  }

  async function submitProposal(a) {
    const entry = proposalOf(a)
    const result = await run(a, () => api.propose(a.id, a.current.id, { combination: entry.combination.trim(), player: entry.player.trim() }))
    if (!result) return
    results[a.id] = result.found
      ? t('Animation.Mine.ResultFound', { player: result.proposal.player })
      : t('Animation.Mine.ResultScore', { combination: result.proposal.combination, player: result.proposal.player, score: result.score })
    entry.combination = ''
    replace(result.activity)
  }

  async function doExport(a, kind) {
    const text = await run(a, () => (kind === 'rules' ? api.exportRules(a.id) : api.exportResults(a.id)))
    if (text === null) return
    exported[a.id] = text
    try {
      await navigator.clipboard.writeText(text)
      push.success(t('Animation.Mine.Copied'))
    } catch {
      push.warning(t('Animation.Mine.CopyFailed')) // le texte reste affiché, à sélectionner à la main
    }
  }
</script>

<template>
  <div class="w-full max-w-4xl text-slate-800 dark:text-slate-800">
    <h2 class="text-2xl font-bold text-slate-800 dark:text-slate-800">{{ t('Animation.Mine.Title') }}</h2>

    <p v-if="!character" class="text-slate-700 dark:text-slate-700" data-testid="mine-no-character">{{ t('Animation.Mine.NoCharacter') }}</p>
    <template v-else>
      <!-- Création -->
      <section class="border border-slate-300 rounded-lg p-4 bg-white" data-testid="mine-create">
        <h3 class="text-lg font-bold text-slate-800 dark:text-slate-800">{{ t('Animation.Mine.CreateTitle') }}</h3>
        <p class="text-xs text-slate-600 dark:text-slate-600">{{ t('Animation.Mine.OneAtATime') }}</p>
        <form class="mt-2 space-y-3" @submit.prevent="create">
          <div>
            <label for="create-name" class="block text-sm font-bold">{{ t('Animation.Mine.Name') }}</label>
            <input id="create-name" v-model="form.name" type="text" maxlength="190" required class="form-field w-full" data-testid="create-name" />
            <p v-if="fieldErrors.name" role="alert" class="text-sm text-red-700 dark:text-red-700" data-testid="create-error-name">{{ fieldErrors.name }}</p>
          </div>
          <div>
            <label for="create-description" class="block text-sm font-bold">{{ t('Animation.Mine.Description') }}</label>
            <textarea id="create-description" v-model="form.description" rows="2" maxlength="2000" class="form-field w-full" data-testid="create-description"></textarea>
          </div>
          <fieldset>
            <legend class="text-sm font-bold">{{ t('Animation.Mine.Place') }}</legend>
            <div class="flex flex-wrap gap-4">
              <label v-for="kind in ['none', 'province', 'city']" :key="kind" class="inline-flex items-center gap-1.5">
                <input v-model="form.placeKind" type="radio" name="place-kind" :value="kind" :data-testid="`place-${kind}`" @change="onPlaceKind" />
                {{ t(kind === 'none' ? 'Animation.Mine.PlaceNone' : kind === 'province' ? 'Animation.Mine.PlaceProvince' : 'Animation.Mine.PlaceCity') }}
              </label>
            </div>
            <!-- Province OU ville : jamais les deux (une seule cascade à la fois) ; le serveur refuse de toute façon les deux. -->
            <CityCascadeSelect v-if="form.placeKind !== 'none'" :key="form.placeKind" v-model="form.placeId" :stop-at="form.placeKind === 'province' ? 'province' : 'city'" />
            <p v-if="fieldErrors.city_id || fieldErrors.province_id" role="alert" class="text-sm text-red-700 dark:text-red-700">{{ fieldErrors.city_id || fieldErrors.province_id }}</p>
          </fieldset>
          <button type="submit" class="odc-btn odc-btn--soft odc-btn--sm odc--green" :disabled="creating || !form.name.trim()" data-testid="create-submit">
            <v-icon name="fa-plus" aria-hidden="true" />{{ t('Animation.Mine.CreateButton') }}
          </button>
        </form>
      </section>

      <!-- Liste -->
      <ChestLoader :loading="loading" :error="error" accent="teal" error-testid="mine-error" @retry="load">
        <p v-if="!activities.length" class="mt-4 text-sm text-slate-700 dark:text-slate-700" data-testid="mine-empty">{{ t('Animation.Mine.Empty') }}</p>

        <article v-for="a in activities" :key="a.id" class="mt-4 border border-slate-300 rounded-lg p-4 bg-white" :data-testid="`activity-${a.id}`">
          <header class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 class="!mb-0 text-lg font-bold text-slate-800 dark:text-slate-800">{{ a.name }}</h3>
              <span class="px-2 py-0.5 rounded-full border border-teal-700 bg-teal-50 text-teal-900 text-xs font-bold" :data-testid="`status-${a.id}`">{{ t(`Animation.Status.${a.status}`) }}</span>
            </div>
            <RouterLink :to="{ name: 'animation-decode', params: { name: a.name } }" class="text-sm underline">{{ t('Animation.Mine.ViewPublic') }}</RouterLink>
          </header>

          <!-- Le coffre en cours : le code n'est visible que de l'organisateur. -->
          <section v-if="a.current" class="mt-3" :data-testid="`current-${a.id}`">
            <p class="font-bold">{{ t('Animation.Mine.SecretTitle', { number: a.current.number }) }}</p>
            <p class="font-mono text-2xl tracking-widest tabular-nums" :data-testid="`code-${a.id}`">{{ a.current.code }}</p>
            <p class="text-xs text-slate-600 dark:text-slate-600">{{ t('Animation.Mine.SecretHelp') }}</p>
            <p class="text-sm">{{ t('Animation.Mine.Attempts', { count: a.current.proposals.length }) }}</p>

            <form v-if="a.status !== 'closed'" class="mt-2 flex flex-wrap items-end gap-2" :data-testid="`proposal-form-${a.id}`" @submit.prevent="submitProposal(a)">
              <div>
                <label :for="`comb-${a.id}`" class="block text-sm font-bold">{{ t('Animation.Mine.Combination') }}</label>
                <input :id="`comb-${a.id}`" v-model="proposalOf(a).combination" type="text" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" required class="form-field w-32 font-mono" :data-testid="`combination-${a.id}`" />
              </div>
              <div>
                <label :for="`player-${a.id}`" class="block text-sm font-bold">{{ t('Animation.Mine.Player') }}</label>
                <input :id="`player-${a.id}`" v-model="proposalOf(a).player" type="text" maxlength="30" required class="form-field w-48" :data-testid="`player-${a.id}`" />
              </div>
              <button type="submit" class="odc-btn odc-btn--soft odc-btn--sm odc--green" :disabled="busy === a.id" :data-testid="`propose-${a.id}`">
                <v-icon name="fa-plus" aria-hidden="true" />{{ t('Animation.Mine.Submit') }}
              </button>
            </form>
            <p v-if="results[a.id]" role="status" class="mt-2 font-semibold" :data-testid="`result-${a.id}`">{{ results[a.id] }}</p>
          </section>

          <!-- Gestes : suivent l'état, le serveur reste juge. -->
          <div class="mt-3 flex flex-wrap gap-2">
            <button v-if="a.status === 'new'" type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--teal" :disabled="busy === a.id" :data-testid="`seal-${a.id}`" @click="seal(a)">
              <v-icon name="gi-chest" aria-hidden="true" />{{ t('Animation.Mine.Seal') }}
            </button>
            <button v-if="a.status === 'closed'" type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--teal" :disabled="busy === a.id" :data-testid="`reopen-${a.id}`" @click="reopen(a)">
              <v-icon name="fa-undo" aria-hidden="true" />{{ t('Animation.Mine.Reopen') }}
            </button>
            <button v-else type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--red" :disabled="busy === a.id" :data-testid="`close-${a.id}`" @click="close(a)">
              <v-icon name="fa-lock" aria-hidden="true" />{{ t('Animation.Mine.Close') }}
            </button>
            <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--teal" :disabled="busy === a.id" :data-testid="`export-rules-${a.id}`" @click="doExport(a, 'rules')">
              <v-icon name="fa-copy" aria-hidden="true" />{{ t('Animation.Mine.ExportRules') }}
            </button>
            <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--teal" :disabled="busy === a.id" :data-testid="`export-results-${a.id}`" @click="doExport(a, 'results')">
              <v-icon name="fa-copy" aria-hidden="true" />{{ t('Animation.Mine.ExportResults') }}
            </button>
            <button v-if="a.status === 'closed'" type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--red" :disabled="busy === a.id" :data-testid="`delete-${a.id}`" @click="confirmingDelete = a.id">
              <v-icon name="fa-trash" aria-hidden="true" />{{ t('Animation.Mine.Delete') }}
            </button>
          </div>

          <div v-if="confirmingDelete === a.id" role="alertdialog" class="mt-3 border border-red-700 rounded p-3 bg-red-50" :data-testid="`delete-confirm-${a.id}`">
            <p class="font-semibold text-red-900 dark:text-red-900">{{ t('Animation.Mine.DeleteConfirm', { name: a.name }) }}</p>
            <div class="mt-2 flex gap-2">
              <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--red" :disabled="busy === a.id" :data-testid="`delete-yes-${a.id}`" @click="remove(a)">{{ t('Animation.Mine.DeleteConfirmButton') }}</button>
              <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--slate" @click="confirmingDelete = null">{{ t('Animation.Mine.DeleteCancel') }}</button>
            </div>
          </div>

          <div v-if="exported[a.id]" class="mt-3">
            <label :for="`export-${a.id}`" class="block text-sm font-bold">{{ t('Animation.Mine.ExportTitle') }}</label>
            <textarea :id="`export-${a.id}`" readonly rows="8" class="form-field w-full font-mono text-xs" :value="exported[a.id]" :data-testid="`export-text-${a.id}`"></textarea>
          </div>
        </article>
      </ChestLoader>
    </template>
  </div>
</template>
