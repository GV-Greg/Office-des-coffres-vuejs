<script setup>
  import { ref, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { RouterLink, useRouter } from 'vue-router'
  import { useAuthStore } from '@/stores/authStore'
  import { useCookieStore } from '@/stores/cookieStore'
  import useRewardsGrid from '@/use/useRewardsGrid'
  import ChestLoader from '@/components/loading/ChestLoader.vue'

  /*
    « Votre grille » — point de départ de la page Grille des lots (sans adresse). Même logique que
    DecodeStartPanel, adaptée à l'activité :
      connecté, sans personnage ........ user-no-character
      connecté, en lecture ............. user-loading
      connecté, grille existante ........ user-resume → animation-rewards-mine
      connecté, aucune grille ........... user-create → animation-rewards-mine
      déconnecté, adresse mémorisée .... guest-resume → animation-rewards-manage
      déconnecté, rien de mémorisé ..... guest-start  → créer / retrouver
  */
  const { t } = useI18n()
  const api = useRewardsGrid()
  const authStore = useAuthStore()
  const cookieStore = useCookieStore()
  const router = useRouter()

  const SLUG_KEY = 'anim_rewards_slug'

  const loading = ref(false)
  const mine = ref(null)       // la grille privée du personnage actif (non close en priorité)
  const remembered = ref(null) // la grille sans compte dont l'adresse est mémorisée

  const character = computed(() => authStore.activeCharacter ?? null)

  async function loadMine() {
    mine.value = null
    if (!authStore.isLoggedIn || !character.value) return
    try {
      const list = await api.list(character.value.id)
      mine.value = list.find(a => a.status !== 'closed') ?? list[0] ?? null
    } catch {
      mine.value = null
    }
  }

  async function loadRemembered() {
    remembered.value = null
    const slug = String(cookieStore.getComfortData(SLUG_KEY, '') ?? '')
    if (!slug) return
    try {
      const found = await api.show(slug)
      remembered.value = found.status === 'closed' ? null : found
    } catch {
      remembered.value = null
    }
  }

  const cameFromModule = () => String(window.history.state?.back ?? '').startsWith('/app/anim')

  async function load() {
    loading.value = true
    await Promise.all([loadMine(), loadRemembered()])
    loading.value = false
    if (cameFromModule()) return
    if (authStore.isLoggedIn && mine.value && mine.value.status !== 'closed') {
      router.replace({ name: 'animation-rewards-mine' })
    } else if (!authStore.isLoggedIn && remembered.value) {
      router.replace({ name: 'animation-rewards-manage' })
    }
  }
  watch(() => [authStore.isLoggedIn, character.value?.id], load, { immediate: true })

  const scenario = computed(() => {
    if (authStore.isLoggedIn) {
      if (!character.value) return 'user-no-character'
      if (loading.value) return 'user-loading'
      return mine.value ? 'user-resume' : 'user-create'
    }
    if (loading.value) return 'guest-loading'
    return remembered.value ? 'guest-resume' : 'guest-start'
  })

  const showRemembered = computed(() => authStore.isLoggedIn && !!remembered.value)
  const rememberPreferencesHint = computed(() => !authStore.isLoggedIn && !remembered.value && !cookieStore.hasAcceptedPreferences)
</script>

<template>
  <section
    class="rounded-xl border border-slate-300 bg-white p-5"
    :data-scenario="scenario"
    data-testid="rewards-start"
  >
    <h3 class="!mt-0 !mb-2 text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-teal-700 to-green-600">{{ t('Animation.Rewards.Start.Title') }}</h3>

    <ChestLoader :loading="scenario.endsWith('loading')" accent="teal">
    <!-- Connecté, sans personnage -->
    <template v-if="scenario === 'user-no-character'">
      <p class="text-slate-700 dark:text-slate-700" data-testid="rewards-start-no-character">{{ t('Animation.Rewards.Start.NoCharacter') }}</p>
      <div class="mt-4 flex flex-wrap gap-3">
        <RouterLink :to="{ name: 'character-new' }" class="odc-btn odc-btn--soft odc-btn--rect flex-col !gap-1 !min-h-[5.5rem] min-w-[10rem] px-8 text-base odc--green" data-testid="rewards-action-character">
          <v-icon name="fa-plus" scale="2" aria-hidden="true" />{{ t('Animation.Start.AddCharacter') }}
        </RouterLink>
      </div>
    </template>

    <!-- Connecté, grille existante -->
    <template v-else-if="scenario === 'user-resume'">
      <p class="text-slate-700 dark:text-slate-700" data-testid="rewards-start-mine-text">
        {{ t('Animation.Rewards.Start.MineFound', { name: mine.name, character: character.pseudo }) }}
        <span class="ml-1 px-2 py-0.5 rounded-full border border-teal-700 bg-teal-50 text-teal-900 text-xs font-bold" data-testid="rewards-start-mine-status">{{ t(`Animation.GridStatus.${mine.status}`) }}</span>
      </p>
      <div class="mt-4 flex flex-wrap gap-3">
        <RouterLink :to="{ name: 'animation-rewards-mine' }" class="odc-btn odc-btn--soft odc-btn--rect flex-col !gap-1 !min-h-[5.5rem] min-w-[10rem] px-8 text-base odc--teal" data-testid="rewards-action-mine">
          <v-icon name="gi-entry-door" scale="2" aria-hidden="true" />{{ mine.status === 'closed' ? t('Animation.Rewards.Start.SeeMine') : t('Animation.Rewards.Start.ResumeMine') }}
        </RouterLink>
      </div>
    </template>

    <!-- Connecté, aucune grille -->
    <template v-else-if="scenario === 'user-create'">
      <p class="text-slate-700 dark:text-slate-700" data-testid="rewards-start-mine-none">{{ t('Animation.Rewards.Start.MineNone', { character: character.pseudo }) }}</p>
      <div class="mt-4 flex flex-wrap gap-3">
        <RouterLink :to="{ name: 'animation-rewards-mine' }" class="odc-btn odc-btn--soft odc-btn--rect flex-col !gap-1 !min-h-[5.5rem] min-w-[10rem] px-8 text-base odc--green" data-testid="rewards-action-mine">
          <v-icon name="gi-open-gate" scale="2" aria-hidden="true" />{{ t('Animation.Rewards.Start.CreateMine') }}
        </RouterLink>
      </div>
    </template>

    <!-- Déconnecté, adresse mémorisée -->
    <template v-else-if="scenario === 'guest-resume'">
      <p class="text-slate-700 dark:text-slate-700" data-testid="rewards-start-remembered-text">{{ t('Animation.Rewards.Start.RememberedFound', { name: remembered.name }) }}</p>
      <div class="mt-4 flex flex-wrap gap-3">
        <RouterLink :to="{ name: 'animation-rewards-manage' }" class="odc-btn odc-btn--soft odc-btn--rect flex-col !gap-1 !min-h-[5.5rem] min-w-[10rem] px-8 text-base odc--teal" data-testid="rewards-action-manage">
          <v-icon name="gi-entry-door" scale="2" aria-hidden="true" />{{ t('Animation.Rewards.Start.ResumeRemembered') }}
        </RouterLink>
        <RouterLink :to="{ name: 'animation-rewards-public', params: { slug: remembered.slug } }" class="odc-btn odc-btn--soft odc-btn--rect flex-col !gap-1 !min-h-[5.5rem] min-w-[10rem] px-8 text-base odc--slate" data-testid="rewards-action-page">
          <v-icon name="fa-search" scale="2" aria-hidden="true" />{{ t('Animation.Start.SeePage') }}
        </RouterLink>
      </div>
    </template>

    <!-- Déconnecté, rien de mémorisé -->
    <template v-else>
      <p class="text-slate-700 dark:text-slate-700" data-testid="rewards-start-guest-text">{{ t('Animation.Rewards.Start.GuestIntro') }}</p>
      <div class="mt-4 flex flex-wrap gap-3">
        <RouterLink :to="{ name: 'animation-rewards-create' }" class="odc-btn odc-btn--soft odc-btn--rect flex-col !gap-1 !min-h-[5.5rem] min-w-[10rem] px-8 text-base odc--green" data-testid="rewards-action-create">
          <v-icon name="gi-open-gate" scale="2" aria-hidden="true" />{{ t('Animation.Rewards.Start.CreateGuest') }}
        </RouterLink>
        <RouterLink :to="{ name: 'animation-rewards-manage' }" class="odc-btn odc-btn--soft odc-btn--rect flex-col !gap-1 !min-h-[5.5rem] min-w-[10rem] px-8 text-base odc--teal" data-testid="rewards-action-manage">
          <v-icon name="gi-entry-door" scale="2" aria-hidden="true" />{{ t('Animation.Rewards.Start.FindGuest') }}
        </RouterLink>
      </div>
      <p v-if="rememberPreferencesHint" class="mt-3 text-xs italic text-slate-600 dark:text-slate-600" data-testid="rewards-start-cookie-hint">{{ t('Animation.Rewards.Start.CookieHint') }}</p>
    </template>

    <!-- Connecté qui a aussi une grille sans compte mémorisée -->
    <p v-if="showRemembered" class="mt-3 text-sm text-slate-700 dark:text-slate-700" data-testid="rewards-start-also-remembered">
      {{ t('Animation.Rewards.Start.AlsoRemembered', { name: remembered.name }) }}
      <RouterLink :to="{ name: 'animation-rewards-manage' }" class="font-bold underline text-blue-800">{{ t('Animation.Rewards.Start.ResumeRemembered') }}</RouterLink>
    </p>
    </ChestLoader>
  </section>
</template>
