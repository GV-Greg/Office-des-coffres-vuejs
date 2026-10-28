<script setup>
  import { ref, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { RouterLink, useRouter } from 'vue-router'
  import { useAuthStore } from '@/stores/authStore'
  import { useCookieStore } from '@/stores/cookieStore'
  import useDecodeActivities from '@/use/useDecodeActivities'
  import ChestLoader from '@/components/loading/ChestLoader.vue'

  /*
    « Votre activité » — le point de départ de la page de Décode le code (sans adresse). Il dit quoi faire selon QUI arrive :
      connecté, sans personnage ........ user-no-character : ajouter un personnage (ou organiser sans compte)
      connecté, en cours de lecture .... user-loading
      connecté, une activité ........... user-resume : la reprendre (« Ma salle »)
      connecté, aucune activité ........ user-create : la créer (« Ma salle »)
      déconnecté, adresse mémorisée .... guest-resume : la reprendre (adresse préremplie) et voir sa page
      déconnecté, rien de mémorisé ..... guest-start : créer sans compte, ou retrouver la sienne (adresse + mot de passe)
    Une activité EN COURS retrouvée (connecté : la sienne ; déconnecté : l'adresse mémorisée) envoie directement sur sa page de gestion,
    sauf si l'on vient de l'intérieur du module. Pas d'invitation à se connecter dans la page : le bouton est dans le menu du haut.
    L'adresse mémorisée (comfort data `anim_decode_slug`, D4/D22) n'existe que si les préférences sont acceptées ; sinon on le dit, une
    fois, à qui n'a rien de mémorisé. Elle est VÉRIFIÉE auprès du serveur (lecture publique) : une activité inconnue ou close n'est pas
    proposée à la reprise. ⚠️ Aucune règle ici : le serveur dit ce qui existe, l'écran ne fait que router.
  */
  const { t } = useI18n()
  const api = useDecodeActivities()
  const authStore = useAuthStore()
  const cookieStore = useCookieStore()
  const router = useRouter()

  const SLUG_KEY = 'anim_decode_slug'

  const loading = ref(false)
  const mine = ref(null)      // l'activité privée du personnage actif (en cours en priorité), ou null
  const remembered = ref(null) // l'activité sans compte dont l'adresse est mémorisée, si elle existe encore et n'est pas close

  const character = computed(() => authStore.activeCharacter ?? null)

  async function loadMine() {
    mine.value = null
    if (!authStore.isLoggedIn || !character.value) return
    try {
      const list = await api.list(character.value.id)
      mine.value = list.find(a => a.status !== 'closed') ?? list[0] ?? null
    } catch {
      mine.value = null // sans réponse, on propose de créer : « Ma salle » dira la vérité
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
      remembered.value = null // inconnue (404) ou panne : rien n'est proposé à la reprise
    }
  }

  // Arrivé de l'EXTÉRIEUR du module (menu, carte d'accueil, lien), on va droit à son activité ; revenu de l'intérieur (un lien « Décode le
  // code » depuis sa page), on n'y renvoie pas : il serait impossible de lire la page.
  const cameFromModule = () => String(window.history.state?.back ?? '').startsWith('/app/anim')

  async function load() {
    loading.value = true
    await Promise.all([loadMine(), loadRemembered()])
    loading.value = false
    if (cameFromModule()) return
    if (authStore.isLoggedIn && mine.value && mine.value.status !== 'closed') router.replace({ name: 'animation-mine' })
    else if (!authStore.isLoggedIn && remembered.value) router.replace({ name: 'animation-manage' })
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
    :aria-labelledby="'decode-start-title'"
    :data-scenario="scenario"
    data-testid="decode-start"
  >
    <h3 id="decode-start-title" class="!mt-0 !mb-2 text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-red-700 to-orange-600">{{ t('Animation.Start.Title') }}</h3>

    <!-- Le coffre du registre pendant la recherche (rien avant 150 ms : une réponse rapide n'en montre pas). -->
    <ChestLoader :loading="scenario.endsWith('loading')" accent="teal" illustration="gate">
    <!-- Connecté, sans personnage : l'activité privée est liée à un personnage. -->
    <template v-if="scenario === 'user-no-character'">
      <p class="text-slate-700 dark:text-slate-700" data-testid="start-no-character">{{ t('Animation.Start.NoCharacter') }}</p>
      <div class="mt-4 flex flex-wrap gap-3">
        <RouterLink :to="{ name: 'character-new' }" class="odc-btn odc-btn--soft odc-btn--rect flex-col !gap-1 !min-h-[5.5rem] min-w-[10rem] px-8 text-base odc--green" data-testid="decode-action-character">
          <v-icon name="fa-plus" scale="2" aria-hidden="true" />{{ t('Animation.Start.AddCharacter') }}
        </RouterLink>
      </div>
    </template>

    <!-- Connecté, activité existante : la reprendre. -->
    <template v-else-if="scenario === 'user-resume'">
      <p class="text-slate-700 dark:text-slate-700" data-testid="start-mine-text">
        {{ t('Animation.Start.MineFound', { name: mine.name, character: character.pseudo }) }}
        <span class="ml-1 px-2 py-0.5 rounded-full border border-teal-700 bg-teal-50 text-teal-900 text-xs font-bold" data-testid="start-mine-status">{{ t(`Animation.Status.${mine.status}`) }}</span>
      </p>
      <div class="mt-4 flex flex-wrap gap-3">
        <RouterLink :to="{ name: 'animation-mine' }" class="odc-btn odc-btn--soft odc-btn--rect flex-col !gap-1 !min-h-[5.5rem] min-w-[10rem] px-8 text-base odc--teal" data-testid="decode-action-mine">
          <v-icon name="gi-entry-door" scale="2" aria-hidden="true" />{{ mine.status === 'closed' ? t('Animation.Start.SeeMine') : t('Animation.Start.ResumeMine') }}
        </RouterLink>
      </div>
    </template>

    <!-- Connecté, aucune activité : la créer. -->
    <template v-else-if="scenario === 'user-create'">
      <p class="text-slate-700 dark:text-slate-700" data-testid="start-mine-none">{{ t('Animation.Start.MineNone', { character: character.pseudo }) }}</p>
      <div class="mt-4 flex flex-wrap gap-3">
        <RouterLink :to="{ name: 'animation-mine' }" class="odc-btn odc-btn--soft odc-btn--rect flex-col !gap-1 !min-h-[5.5rem] min-w-[10rem] px-8 text-base odc--green" data-testid="decode-action-mine">
          <v-icon name="gi-open-gate" scale="2" aria-hidden="true" />{{ t('Animation.Start.CreateMine') }}
        </RouterLink>
      </div>
    </template>

    <!-- Déconnecté, une adresse mémorisée et vérifiée : la reprendre. -->
    <template v-else-if="scenario === 'guest-resume'">
      <p class="text-slate-700 dark:text-slate-700" data-testid="start-remembered-text">{{ t('Animation.Start.RememberedFound', { name: remembered.name }) }}</p>
      <div class="mt-4 flex flex-wrap gap-3">
        <RouterLink :to="{ name: 'animation-manage' }" class="odc-btn odc-btn--soft odc-btn--rect flex-col !gap-1 !min-h-[5.5rem] min-w-[10rem] px-8 text-base odc--teal" data-testid="decode-action-manage">
          <v-icon name="gi-entry-door" scale="2" aria-hidden="true" />{{ t('Animation.Start.ResumeRemembered') }}
        </RouterLink>
        <RouterLink :to="{ name: 'animation-public', params: { slug: remembered.slug } }" class="odc-btn odc-btn--soft odc-btn--rect flex-col !gap-1 !min-h-[5.5rem] min-w-[10rem] px-8 text-base odc--slate" data-testid="decode-action-page">
          <v-icon name="fa-search" scale="2" aria-hidden="true" />{{ t('Animation.Start.SeePage') }}
        </RouterLink>
      </div>
    </template>

    <!-- Déconnecté, rien de mémorisé : créer sans compte, ou retrouver la sienne. -->
    <template v-else>
      <p class="text-slate-700 dark:text-slate-700" data-testid="start-guest-text">{{ t('Animation.Start.GuestIntro') }}</p>
      <div class="mt-4 flex flex-wrap gap-3">
        <RouterLink :to="{ name: 'animation-create' }" class="odc-btn odc-btn--soft odc-btn--rect flex-col !gap-1 !min-h-[5.5rem] min-w-[10rem] px-8 text-base odc--green" data-testid="decode-action-create">
          <v-icon name="gi-open-gate" scale="2" aria-hidden="true" />{{ t('Animation.Start.CreateGuest') }}
        </RouterLink>
        <RouterLink :to="{ name: 'animation-manage' }" class="odc-btn odc-btn--soft odc-btn--rect flex-col !gap-1 !min-h-[5.5rem] min-w-[10rem] px-8 text-base odc--teal" data-testid="decode-action-manage">
          <v-icon name="gi-entry-door" scale="2" aria-hidden="true" />{{ t('Animation.Start.FindGuest') }}
        </RouterLink>
      </div>
      <p v-if="rememberPreferencesHint" class="mt-3 text-xs italic text-slate-600 dark:text-slate-600" data-testid="start-cookie-hint">{{ t('Animation.Start.CookieHint') }}</p>
    </template>

    <!-- Connecté qui a aussi une activité sans compte mémorisée sur cet appareil : elle reste atteignable. -->
    <p v-if="showRemembered" class="mt-3 text-sm text-slate-700 dark:text-slate-700" data-testid="start-also-remembered">
      {{ t('Animation.Start.AlsoRemembered', { name: remembered.name }) }}
      <RouterLink :to="{ name: 'animation-manage' }" class="font-bold underline text-blue-800" data-testid="decode-action-manage">{{ t('Animation.Start.ResumeRemembered') }}</RouterLink>
    </p>
    </ChestLoader>
  </section>
</template>
