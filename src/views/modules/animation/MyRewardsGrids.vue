<script setup>
  import { ref, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { push } from 'notivue'
  import { useAuthStore } from '@/stores/authStore'
  import { apiMessage, apiFieldErrors } from '@/stores/mandateStore'
  import useRewardsGrid from '@/use/useRewardsGrid'
  import useNavigationLoading from '@/use/useNavigationLoading'
  import RewardsCreateForm from '@/components/anim/RewardsCreateForm.vue'
  import RewardsGridCard from '@/components/anim/RewardsGridCard.vue'
  import RewardsGridHero from '@/components/anim/RewardsGridHero.vue'
  import ChestLoader from '@/components/loading/ChestLoader.vue'

  /*
    Grille des lots — « Ma grille » (mode PRIVÉ, lié au personnage actif). Créer (adresse, lieu, dimensions, écran de confirmation),
    ajouter des lots, tirer au sort, attribuer les cases, clore, rouvrir, supprimer, exporter en BBCode.
    ⚠️ AUCUNE règle ici : seul l'organisateur gère sa grille, on ne supprime qu'une grille close, les bornes des dimensions sont au serveur —
    l'écran affiche ce que l'API répond (`apiMessage`, FR et EN). Une grille privée disparaît avec son personnage ou son compte (catégorie C).
    Même structure que « Ma salle » de Décode le code (MyDecodeActivities).
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
  const fieldErrors = ref({})
  const creating = ref(false)
  const formKey = ref(0) // remet le formulaire à zéro après une création

  function create(payload) {
    creating.value = true
    fieldErrors.value = {}
    trackApiCall(api.create(character.value.id, payload))
      .then((created) => {
        grids.value = [created, ...grids.value]
        formKey.value++
        push.success(t('Animation.Grid.Created'))
      })
      .catch((e) => {
        fieldErrors.value = apiFieldErrors(e, locale.value)
        if (!Object.keys(fieldErrors.value).length) push.error(apiMessage(e, locale.value, t('Auth.Errors.NetworkError')))
      })
      .finally(() => { creating.value = false })
  }

  // Une seule grille non close à la fois : tant qu'elle court, le formulaire s'efface (le serveur refuserait de toute façon).
  const hasOpen = computed(() => grids.value.some(g => g.status !== 'closed'))
  const showCreate = computed(() => !hasOpen.value)

  const replace = updated => { grids.value = grids.value.map(g => (g.id === updated.id ? updated : g)) }
  const removed = gone => { grids.value = grids.value.filter(g => g.id !== gone.id) }
</script>

<template>
  <div class="w-full text-slate-800 dark:text-slate-800">
    <!-- Toute la page attend ses données : changer de personnage rouvre le coffre, formulaire et titre compris. -->
    <ChestLoader :loading="loading" :error="error" accent="teal" error-testid="mine-error" @retry="load">
      <RewardsGridHero v-if="!grids.length" :title="t('Animation.Grid.MineTitle')" :divider="false" title-testid="mine-title" class="mb-5" />

      <p v-if="!character" class="text-slate-700 dark:text-slate-700" data-testid="mine-no-character">{{ t('Animation.Grid.NoCharacter') }}</p>
      <template v-else>
        <section v-if="showCreate" class="mb-5 rounded-xl border border-slate-300 p-5 bg-white" data-testid="mine-create">
          <h3 class="!mt-0 text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-teal-700 to-green-600">{{ t('Animation.Grid.CreateTitle') }}</h3>
          <p class="text-xs italic text-slate-700 dark:text-slate-700">{{ t('Animation.Grid.OneAtATime') }}</p>
          <RewardsCreateForm :key="formKey" mode="private" :errors="fieldErrors" :submitting="creating" @confirm="create" />
        </section>

        <p v-if="!grids.length" class="mt-4 text-center text-sm italic text-slate-700 dark:text-slate-700" data-testid="mine-empty">{{ t('Animation.Grid.Empty') }}</p>
        <RewardsGridCard v-for="g in grids" :key="g.id" :grid="g" :gestures="gestures" @update="replace" @removed="removed" />
      </template>
    </ChestLoader>
  </div>
</template>
