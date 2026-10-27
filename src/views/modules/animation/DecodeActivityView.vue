<script setup>
  import { ref, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { apiMessage } from '@/stores/mandateStore'
  import useDecodeActivities from '@/use/useDecodeActivities'
  import ChestLoader from '@/components/loading/ChestLoader.vue'
  import AccessDenied from '@/components/loading/AccessDenied.vue'

  /*
    Les Coffres Scellés — page PUBLIQUE d'une activité, en lecture seule (brief, lot 2). Sans nom : un champ pour
    retrouver une activité. Avec un nom : l'activité, ses règles (locales), le coffre en cours et ses tentatives,
    les coffres ouverts (combinaison révélée + découvreur) et le classement cumulé. ⚠️ Aucune règle ici et jamais
    le code d'un coffre scellé : le serveur ne l'envoie pas (seul l'organisateur le voit, dans « Mes activités »).
    Le lien est celui de l'export BBCode : /app/anim/decode/<nom>.
  */
  const { t, locale } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const api = useDecodeActivities()

  const name = computed(() => (route.params.name ? String(route.params.name) : ''))
  const search = ref('')
  const activity = ref(null)
  const loading = ref(false)
  const error = ref('')    // panne : le coffre se referme et propose « Réessayer »
  const notFound = ref('') // activité inconnue : un constat, rien à réessayer

  async function load() {
    activity.value = null
    error.value = ''
    notFound.value = ''
    if (!name.value) return
    loading.value = true
    try {
      activity.value = await api.show(name.value)
    } catch (e) {
      if (e?.response?.status === 404) notFound.value = apiMessage(e, locale.value, t('Animation.Public.NotFound'))
      else error.value = apiMessage(e, locale.value, t('Auth.Errors.NetworkError'))
    } finally {
      loading.value = false
    }
  }
  watch(name, load, { immediate: true })

  const go = () => {
    const wanted = search.value.trim()
    if (wanted) router.push({ name: 'animation-decode', params: { name: wanted } })
  }

  const place = computed(() => {
    const p = activity.value?.place
    if (!p) return ''
    return t(p.kind === 'province' ? 'Animation.Public.PlaceProvince' : 'Animation.Public.PlaceCity', { name: p.name })
  })
  const organizer = computed(() => (activity.value?.organizer
    ? t('Animation.Public.Organizer', { name: activity.value.organizer })
    : t('Animation.Public.OrganizerGone')))
</script>

<template>
  <div class="w-full max-w-4xl text-slate-800 dark:text-slate-800">
    <!-- Recherche par nom : toujours présente, c'est ainsi qu'on retrouve une activité sans lien. -->
    <form class="flex flex-wrap items-end gap-2 border-b border-slate-300 pb-3" role="search" data-testid="decode-search" @submit.prevent="go">
      <div class="flex-1 min-w-[12rem]">
        <label for="decode-search-name" class="block text-sm font-bold">{{ t('Animation.Public.SearchLabel') }}</label>
        <input
          id="decode-search-name"
          v-model="search"
          type="text"
          maxlength="190"
          class="form-field w-full"
          :placeholder="t('Animation.Public.SearchPlaceholder')"
          data-testid="decode-search-input"
        />
      </div>
      <button type="submit" class="odc-btn odc-btn--soft odc-btn--sm odc--teal" data-testid="decode-search-button">
        <v-icon name="fa-search" aria-hidden="true" />{{ t('Animation.Public.SearchButton') }}
      </button>
    </form>

    <h2 v-if="!name" class="mt-4 text-xl font-bold text-slate-800 dark:text-slate-800">{{ t('Animation.Types.decode.Name') }}</h2>
    <section v-if="!name" class="mt-2" data-testid="decode-rules-intro">
      <p class="text-slate-700 dark:text-slate-700">{{ t('Animation.Types.decode.Rules') }}</p>
    </section>

    <AccessDenied v-if="notFound" :message="notFound" testid="decode-not-found" />
    <ChestLoader v-else-if="name" :loading="loading" :error="error" accent="teal" error-testid="decode-error" @retry="load">
      <article v-if="activity" class="mt-4" data-testid="decode-activity">
        <header class="border-b border-slate-300 pb-2">
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 class="!mb-0 text-2xl font-bold text-slate-800 dark:text-slate-800" data-testid="decode-name">{{ activity.name }}</h2>
            <span class="px-2 py-0.5 rounded-full border border-teal-700 bg-teal-50 text-teal-900 text-xs font-bold" data-testid="decode-status">{{ t(`Animation.Status.${activity.status}`) }}</span>
          </div>
          <p class="mt-1 text-sm text-slate-700 dark:text-slate-700">
            {{ organizer }}<template v-if="place"> — {{ place }}</template>
          </p>
          <p v-if="activity.description" class="mt-2 whitespace-pre-line" data-testid="decode-description">{{ activity.description }}</p>
        </header>

        <section class="mt-4">
          <h3 class="text-lg font-bold text-slate-800 dark:text-slate-800">{{ t('Animation.Types.decode.RulesTitle') }}</h3>
          <p class="text-slate-700 dark:text-slate-700" data-testid="decode-rules">{{ t('Animation.Types.decode.Rules') }}</p>
        </section>

        <p v-if="activity.status === 'closed'" role="note" class="mt-4 font-semibold text-orange-800 dark:text-orange-800" data-testid="decode-closed">
          {{ t('Animation.Public.ClosedNotice') }}
        </p>

        <section class="mt-4" data-testid="decode-current">
          <template v-if="activity.current">
            <h3 class="text-lg font-bold text-slate-800 dark:text-slate-800">{{ t('Animation.Public.CurrentChest', { number: activity.current.number }) }}</h3>
            <p v-if="!activity.current.proposals.length" class="text-sm text-slate-700 dark:text-slate-700" data-testid="decode-no-attempts">{{ t('Animation.Public.NoAttempts') }}</p>
            <table v-else class="mt-1 w-full text-sm" data-testid="decode-attempts">
              <caption class="sr-only">{{ t('Animation.Public.AttemptsTitle') }}</caption>
              <thead>
                <tr class="text-left border-b border-slate-300">
                  <th scope="col" class="py-1">{{ t('Animation.Public.Combination') }}</th>
                  <th scope="col" class="py-1">{{ t('Animation.Public.Player') }}</th>
                  <th scope="col" class="py-1 text-right">{{ t('Animation.Public.Score') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(attempt, index) in activity.current.proposals" :key="index" class="border-b border-slate-200">
                  <td class="py-1 font-mono tabular-nums">{{ attempt.combination }}</td>
                  <td class="py-1">{{ attempt.player }}</td>
                  <td class="py-1 text-right tabular-nums">{{ t('Animation.Public.Points', { points: attempt.points }) }}</td>
                </tr>
              </tbody>
            </table>
          </template>
          <p v-else class="text-sm text-slate-700 dark:text-slate-700" data-testid="decode-no-chest">{{ t('Animation.Public.NoChest') }}</p>
        </section>

        <section class="mt-4" data-testid="decode-opened">
          <h3 class="text-lg font-bold text-slate-800 dark:text-slate-800">{{ t('Animation.Public.OpenedTitle') }}</h3>
          <p v-if="!activity.opened.length" class="text-sm text-slate-700 dark:text-slate-700">{{ t('Animation.Public.NoOpened') }}</p>
          <ul v-else class="list-none p-0">
            <li v-for="chest in activity.opened" :key="chest.number" class="py-0.5">
              <strong class="font-mono tabular-nums">{{ t('Animation.Public.OpenedLine', { number: chest.number, code: chest.code }) }}</strong>
              <span v-if="chest.discoverer"> — {{ t('Animation.Public.DiscoveredBy', { name: chest.discoverer }) }}</span>
            </li>
          </ul>
        </section>

        <section class="mt-4" data-testid="decode-ranking">
          <h3 class="text-lg font-bold text-slate-800 dark:text-slate-800">{{ t('Animation.Public.RankingTitle') }}</h3>
          <p v-if="!activity.ranking.length" class="text-sm text-slate-700 dark:text-slate-700">{{ t('Animation.Public.NoRanking') }}</p>
          <ol v-else class="p-0 list-none">
            <li v-for="(row, index) in activity.ranking" :key="row.player" class="py-0.5">
              {{ index + 1 }}. <strong>{{ row.player }}</strong> — <span class="tabular-nums">{{ t('Animation.Public.Points', { points: row.points }) }}</span>
            </li>
          </ol>
        </section>
      </article>
    </ChestLoader>
  </div>
</template>
