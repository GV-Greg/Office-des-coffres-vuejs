<script setup>
  import { ref, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { push } from 'notivue'
  import { useAuthStore } from '@/stores/authStore'
  import { apiMessage, apiFieldErrors } from '@/stores/mandateStore'
  import useDecodeActivities from '@/use/useDecodeActivities'
  import useNavigationLoading from '@/use/useNavigationLoading'
  import DecodeCreateForm from '@/components/anim/DecodeCreateForm.vue'
  import DecodeActivityCard from '@/components/anim/DecodeActivityCard.vue'
  import DecodeCodeVisual from '@/components/anim/DecodeCodeVisual.vue'
  import ChestLoader from '@/components/loading/ChestLoader.vue'

  /*
    Décode le code — « Ma salle » (mode PRIVÉ, lié au personnage actif). Créer (adresse, lieu royaume/province/ville, écran
    de confirmation), sceller un coffre, inscrire les propositions reçues, rouvrir, clore, supprimer, exporter en BBCode.
    ⚠️ AUCUNE règle ici : seul l'organisateur gère son activité, on ne supprime qu'une activité close, la note d'une combinaison est
    calculée par le serveur — l'écran affiche ce que l'API répond (`apiMessage`, FR et EN). Les boutons suivent seulement l'état.
    Une activité privée disparaît avec son personnage ou son compte (D21). Le code du coffre en cours n'est visible que de son
    organisateur : il vient de cette API, jamais de la page publique.
  */
  const { t, locale } = useI18n()
  const authStore = useAuthStore()
  const api = useDecodeActivities()
  const { trackApiCall } = useNavigationLoading()
  const gestures = api.asOrganizer()

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

  // ── Création ──────────────────────────────────────────────────────────────────────────────────
  const fieldErrors = ref({})
  const creating = ref(false)
  const formKey = ref(0) // remet le formulaire à zéro après une création

  function create(payload) {
    creating.value = true
    fieldErrors.value = {}
    trackApiCall(api.create(character.value.id, payload))
      .then((created) => {
        activities.value = [created, ...activities.value]
        formKey.value++
        push.success(t('Animation.Mine.Created'))
      })
      .catch((e) => {
        fieldErrors.value = apiFieldErrors(e, locale.value)
        if (!Object.keys(fieldErrors.value).length) push.error(apiMessage(e, locale.value, t('Auth.Errors.NetworkError')))
      })
      .finally(() => { creating.value = false })
  }

  // Une seule activité non close à la fois : tant qu'elle court, le formulaire s'efface (le serveur refuserait de toute façon).
  const hasOpen = computed(() => activities.value.some(a => a.status !== 'closed'))
  const showCreate = computed(() => !hasOpen.value)

  const replace = updated => { activities.value = activities.value.map(a => (a.id === updated.id ? updated : a)) }
  const removed = gone => { activities.value = activities.value.filter(a => a.id !== gone.id) }
</script>

<template>
  <div class="w-full text-slate-800 dark:text-slate-800" :class="activities.length ? '' : 'max-w-4xl'">
    <!-- Toute la page attend ses données : changer de personnage rouvre la porte de la salle, formulaire et titre compris. -->
    <ChestLoader :loading="loading" :error="error" accent="teal" illustration="gate" error-testid="mine-error" @retry="load">
      <!-- Sans salle, l'en-tête de l'entrée des salles (cases, titre, filet) ; dès qu'une salle existe, c'est SON encadré (« Ma salle … ») qui fait le titre. -->
      <template v-if="!activities.length">
        <div class="flex items-center justify-center gap-3">
          <DecodeCodeVisual size="title" />
          <h2 class="!m-0 text-2xl font-bold text-slate-800 dark:text-slate-800">{{ t('Animation.Mine.Title') }}</h2>
        </div>
        <div class="mx-auto my-3 flex w-full max-w-md items-center gap-3" aria-hidden="true">
          <span class="h-px flex-1 bg-slate-400"></span>
          <v-icon name="gi-rolling-dice-cup" scale="1.3" class="text-teal-700" />
          <span class="h-px flex-1 bg-slate-400"></span>
        </div>
      </template>

      <p v-if="!character" class="text-slate-700 dark:text-slate-700" data-testid="mine-no-character">{{ t('Animation.Mine.NoCharacter') }}</p>
      <template v-else>
        <section v-if="showCreate" class="rounded-xl border border-slate-300 p-5 bg-white" data-testid="mine-create">
          <h3 class="!mt-0 text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-red-700 to-orange-600">{{ t('Animation.Mine.CreateTitle') }}</h3>
          <p class="text-xs italic text-slate-700 dark:text-slate-700">{{ t('Animation.Mine.OneAtATime') }}</p>
          <DecodeCreateForm :key="formKey" mode="private" :errors="fieldErrors" :submitting="creating" @confirm="create" />
        </section>

        <p v-if="!activities.length" class="mt-4 text-center text-sm italic text-slate-700 dark:text-slate-700" data-testid="mine-empty">{{ t('Animation.Mine.Empty') }}</p>
        <DecodeActivityCard v-for="a in activities" :key="a.id" :activity="a" :gestures="gestures" @update="replace" @removed="removed" />
      </template>
    </ChestLoader>
  </div>
</template>
