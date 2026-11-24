<script setup>
  import { ref, computed, watch } from 'vue'
  import { RouterLink } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { apiMessage } from '@/stores/mandateStore'
  import { useAuthStore } from '@/stores/authStore'
  import { formatFieldDate } from '@/modules/playerDates'
  import customsApi from '@/use/customsApi'
  import useCustomsAccess from '@/use/useCustomsAccess'
  import ChestLoader from '@/components/loading/ChestLoader.vue'
  import AccessDenied from '@/components/loading/AccessDenied.vue'
  import ReportCard from '@/components/customs/ReportCard.vue'
  import CustomsPseudo from '@/components/customs/CustomsPseudo.vue'

  /*
    Vue d'ensemble de la province (module Sécurité, « La Salle des gardes » ; PR 5, maquette validée par Greg le 23/11/2026, fil admin/echanges/
    module-securite 18 et 19). LECTURE SEULE : la couverture de chaque ville et, FUSIONNÉS, les pseudos des listes rouge et verte, les groupes à
    surveiller et les armées — chaque ligne datée de son jour de bilan, JAMAIS de différentiel entre villes (un pseudo vu dans deux villes apparaît deux
    fois, chaque ligne avec sa ville et son jour). Le serveur agrège (`GET characters/{id}/customs-province`) : jamais le brut, l'auteur ni les listes
    complètes d'habitants.

    ⚠️ Aucune règle côté site : qui voit la vue (au moins DEUX villes lisibles), quelles villes, quels jours, le serveur le dit. Rien n'est gardé dans le
    navigateur.
  */
  const { t, locale } = useI18n()
  const authStore = useAuthStore()
  const api = customsApi()

  const character = computed(() => (authStore.isLoggedIn ? authStore.activeCharacter : null))
  const { access, ready } = useCustomsAccess(() => character.value?.id ?? null)

  // La vue n'a de sens qu'à partir de deux villes lisibles : c'est le serveur qui les compte (`readable_cities`), le menu masque le lien de même.
  const allowed = computed(() => (access.value?.readable_cities?.length ?? 0) >= 2)

  const overview = ref(null)
  const loading = ref(false)
  const error = ref('')

  const dayLabel = iso => formatFieldDate('customs_report_day', iso, locale.value)

  async function load() {
    if (!character.value || !allowed.value) return
    loading.value = true
    error.value = ''
    try {
      overview.value = await api.province(character.value.id)
    } catch (e) {
      error.value = apiMessage(e, locale.value, t('Auth.Errors.NetworkError'))
      overview.value = null
    } finally {
      loading.value = false
    }
  }
  watch(allowed, (value) => { if (value) load() }, { immediate: true })

  // Âge du dernier bilan : « aujourd'hui », « hier », « il y a N jours », en jours du jeu (le serveur dit `today`) ; orange gras dès deux jours,
  // comme le Registre des stocks.
  const daysAgo = (day) => Math.round((Date.parse(`${overview.value.today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86400000)
  const age = day => t('SecurityProvince.Coverage.Age', { n: daysAgo(day) }, daysAgo(day))
  const isOld = day => daysAgo(day) >= 2

  // Marques : filtre par liste et par ville (présentation seule ; le serveur a déjà tout filtré).
  const colourFilter = ref('')
  const cityFilter = ref('')
  const marks = computed(() => (overview.value?.marks ?? [])
    .filter(m => !colourFilter.value || m.colour === colourFilter.value)
    .filter(m => !cityFilter.value || String(m.city.id) === cityFilter.value))
</script>

<template>
  <div class="w-full" data-testid="province-page">
    <ChestLoader :loading="!ready || loading" accent="rose" error-testid="province-chest-error">
      <AccessDenied v-if="!allowed" :message="t('SecurityProvince.NoAccess')" testid="province-denied" />

      <div v-else class="space-y-4">
        <div class="-mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <h1 class="!mt-0 bg-none text-3xl laptop:text-4xl text-rose-600" data-testid="province-title">{{ t('SecurityProvince.Title') }}</h1>
        </div>

        <p v-if="error" role="alert" class="font-bold text-red-800 dark:text-red-800" data-testid="province-error">{{ error }}</p>

        <template v-if="overview">
          <div class="flex flex-wrap items-end gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm" data-testid="province-bar">
            <label class="text-sm text-slate-800 dark:text-slate-800"><span class="block font-bold">{{ t('SecurityCustoms.Province') }}</span>
              <select disabled class="rounded p-1 disabled:opacity-100 disabled:text-slate-800" data-testid="province-select">
                <option>{{ overview.province.name }}</option>
              </select>
            </label>
            <p class="!my-0 text-sm text-slate-700 dark:text-slate-700">{{ t('SecurityProvince.Note') }}</p>
          </div>

          <div class="grid grid-cols-1 items-start gap-4 laptop:grid-cols-2">
            <div class="space-y-4">
              <!-- Couverture : une ligne par ville lisible. L'absence d'information se VOIT (« Aucun bilan »). -->
              <ReportCard :title="t('SecurityProvince.Coverage.Title')" tone="blue" testid="province-coverage">
                <ul class="space-y-1">
                  <li v-for="city in overview.cities" :key="city.id" class="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-3 text-sm text-slate-800 dark:text-slate-800" :data-testid="`province-city-${city.id}`">
                    <span class="font-bold">{{ city.name }}</span>
                    <span v-if="city.last_report_day" :class="isOld(city.last_report_day) ? 'font-bold text-orange-800 dark:text-orange-800' : ''" data-testid="province-age">{{ age(city.last_report_day) }}</span>
                    <span v-else class="text-slate-600 dark:text-slate-600" data-testid="province-age">{{ t('SecurityProvince.Coverage.NoReport') }}</span>
                    <span v-if="city.arrivals !== null" class="tabular-nums" :title="t('SecurityProvince.Coverage.MovesTitle', { date: dayLabel(city.compared_to) })" data-testid="province-moves">+{{ city.arrivals }} / −{{ city.departures }}</span>
                    <span v-else class="text-slate-500 dark:text-slate-500" data-testid="province-moves">—</span>
                    <RouterLink
                      v-if="city.last_report_day"
                      :to="{ name: 'security-customs', query: { city: city.id, day: city.last_report_day } }"
                      class="underline"
                      :aria-label="t('SecurityProvince.Coverage.Open', { city: city.name })"
                      :title="t('SecurityProvince.Coverage.Open', { city: city.name })"
                      data-testid="province-open"
                    >▸</RouterLink>
                    <span v-else aria-hidden="true"></span>
                  </li>
                </ul>
              </ReportCard>

              <!-- Armées : une ligne par armée, avec sa ville et le jour de son bilan. -->
              <ReportCard :title="t('SecurityProvince.Armies.Title')" tone="rose" testid="province-armies">
                <ul v-if="overview.armies.length" class="space-y-2">
                  <li v-for="(army, index) in overview.armies" :key="index" class="text-sm text-slate-800 dark:text-slate-800">
                    <span class="font-bold">{{ army.name }}</span> — {{ t('SecurityCustoms.Report.ArmyLeader') }}
                    <CustomsPseudo :pseudo="army.commander.pseudo" :colour="army.commander.colour" />
                    <span class="block text-xs text-slate-600 dark:text-slate-600">{{ army.city.name }} · {{ dayLabel(army.day) }}</span>
                  </li>
                </ul>
                <p v-else class="text-sm text-slate-600 dark:text-slate-600">{{ t('SecurityProvince.Armies.Empty') }}</p>
              </ReportCard>
            </div>

            <div class="space-y-4">
              <!-- Sur les listes : les pseudos des listes rouge et verte, où et comment ils ont été vus, le jour du bilan. Aucun « déplacement » dit. -->
              <ReportCard :title="t('SecurityProvince.Marks.Title')" tone="rose" testid="province-marks">
                <div class="mb-2 flex flex-wrap items-end gap-3">
                  <label class="text-sm text-slate-800 dark:text-slate-800"><span class="block font-bold">{{ t('SecurityProvince.Marks.FilterColour') }}</span>
                    <select v-model="colourFilter" class="rounded p-1" data-testid="province-filter-colour">
                      <option value="">{{ t('SecurityProvince.Marks.All') }}</option>
                      <option value="red">{{ t('SecurityProvince.Marks.Red') }}</option>
                      <option value="green">{{ t('SecurityProvince.Marks.Green') }}</option>
                    </select>
                  </label>
                  <label class="text-sm text-slate-800 dark:text-slate-800"><span class="block font-bold">{{ t('SecurityProvince.Marks.FilterCity') }}</span>
                    <select v-model="cityFilter" class="rounded p-1" data-testid="province-filter-city">
                      <option value="">{{ t('SecurityProvince.Marks.AllCities') }}</option>
                      <option v-for="city in overview.cities" :key="city.id" :value="String(city.id)">{{ city.name }}</option>
                    </select>
                  </label>
                  <span class="text-xs text-slate-600 dark:text-slate-600" data-testid="province-marks-count">{{ t('SecurityProvince.Marks.Count', { count: marks.length }, marks.length) }}</span>
                </div>
                <ul v-if="marks.length" class="max-h-[28rem] space-y-1 overflow-y-auto" data-testid="province-marks-list">
                  <li v-for="(mark, index) in marks" :key="index" class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 text-sm text-slate-800 dark:text-slate-800">
                    <span>
                      <CustomsPseudo :pseudo="mark.pseudo" :colour="mark.colour" />
                      <span class="ml-1 text-slate-700 dark:text-slate-700">{{ t(`SecurityProvince.Marks.As.${mark.as}`) }} · {{ mark.city.name }}</span>
                    </span>
                    <span class="text-xs tabular-nums text-slate-600 dark:text-slate-600">{{ dayLabel(mark.day) }}</span>
                  </li>
                </ul>
                <p v-else class="text-sm text-slate-600 dark:text-slate-600">{{ t('SecurityProvince.Marks.Empty') }}</p>
              </ReportCard>

              <!-- Groupes à surveiller : seul « Groupe de … » alerte (« groupe à surveiller », jamais « brigand »). -->
              <ReportCard :title="t('SecurityProvince.Watch.Title')" :tone="overview.groups_to_watch.length ? 'alert' : 'muted'" testid="province-watch">
                <ul v-if="overview.groups_to_watch.length" class="space-y-2">
                  <li v-for="(group, index) in overview.groups_to_watch" :key="index" class="text-sm text-slate-800 dark:text-slate-800">
                    <span class="font-bold">{{ t(`SecurityCustoms.Report.GroupTypes.${group.type}`) }}</span>
                    <span class="ml-1 inline-flex flex-wrap gap-1">
                      <CustomsPseudo v-for="member in group.members" :key="member.pseudo" :pseudo="member.pseudo" :colour="member.colour" />
                    </span>
                    <span class="block text-xs text-slate-600 dark:text-slate-600">{{ group.city.name }} · {{ dayLabel(group.day) }}</span>
                  </li>
                </ul>
                <p v-else class="text-sm text-slate-600 dark:text-slate-600">{{ t('SecurityProvince.Watch.Empty') }}</p>
              </ReportCard>
            </div>
          </div>
        </template>
      </div>
    </ChestLoader>
  </div>
</template>
