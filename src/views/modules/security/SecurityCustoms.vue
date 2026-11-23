<script setup>
  import { ref, computed, watch } from 'vue'
  import { RouterLink } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { apiMessage } from '@/stores/mandateStore'
  import { useAuthStore } from '@/stores/authStore'
  import { formatFieldDate } from '@/modules/playerDates'
  import { defaultCityId } from '@/modules/customsCity'
  import customsApi from '@/use/customsApi'
  import useCustomsAccess from '@/use/useCustomsAccess'
  import ChestLoader from '@/components/loading/ChestLoader.vue'
  import AccessDenied from '@/components/loading/AccessDenied.vue'
  import CustomsReportView from '@/components/customs/CustomsReportView.vue'
  import CustomsExport from '@/components/customs/CustomsExport.vue'
  import CustomsListsModal from '@/components/customs/CustomsListsModal.vue'
  import InfoTip from '@/components/InfoTip.vue'

  /*
    Le Registre de douane (module Sécurité, « La Salle des gardes » ; brief admin/content/brief-module-securite.md ; fil admin/echanges/
    module-securite). Les bilans de défense d'une ville, jour par jour, et les listes rouge et verte de la province.

    ⚠️ Aucune règle côté site : qui lit, qui écrit, quelles villes, quels jours, le serveur le dit (`customs-access`) ; un refus s'affiche tel quel,
    en FR ou EN. Le parseur des collages est ICI (frontend, comme les mines) ; le serveur reçoit l'analyse ET le brut gardé, ne re-parse jamais.
    L'auteur d'un bilan n'est jamais nommé (politique §6). Rien n'est gardé dans le navigateur. La saisie vit dans le Relevé de guet (point de collage unique).
    « Aucun membre de la sécurité n'est connu de l'Office pour votre province » est l'état COURANT d'une province (le repli maire/douanier), dit à l'écran.
  */
  const { t, locale } = useI18n()
  const authStore = useAuthStore()
  const api = customsApi()

  const character = computed(() => (authStore.isLoggedIn ? authStore.activeCharacter : null))
  const { access, ready } = useCustomsAccess(() => character.value?.id ?? null)

  const cityId = ref(null)
  const day = ref(null)
  const days = ref([])
  const report = ref(null)
  const loading = ref(false)
  const error = ref('')
  const showLists = ref(false)

  const cities = computed(() => access.value?.readable_cities ?? [])
  const city = computed(() => cities.value.find(c => c.id === cityId.value) ?? null)
  const today = computed(() => access.value?.today ?? null)
  const dayLabel = iso => formatFieldDate('customs_report_day', iso, locale.value)

  // Jours proposés : ceux qui ont un bilan, aujourd'hui, et — pour qui corrige — les jours que le serveur autorise (`earliest_day` → aujourd'hui).
  const dayOptions = computed(() => {
    if (!access.value) return []
    const set = new Set([...days.value, access.value.today])
    if (access.value.correct_reports) {
      for (let d = access.value.earliest_day; d <= access.value.today; d = nextIso(d)) set.add(d)
    }
    return [...set].sort().reverse()
  })
  const dayIndex = computed(() => dayOptions.value.indexOf(day.value))
  const olderDay = computed(() => dayOptions.value[dayIndex.value + 1] ?? null)
  const newerDay = computed(() => (dayIndex.value > 0 ? dayOptions.value[dayIndex.value - 1] : null))

  function nextIso(iso) {
    const next = new Date(`${iso}T00:00:00Z`)
    next.setUTCDate(next.getUTCDate() + 1)
    return next.toISOString().slice(0, 10)
  }

  // La SAISIE n'est plus ici : elle se fait dans le Relevé de guet, point de collage unique (fil module-securite 12 à 14). Le Registre se lit, se consulte, se corrige par là.
  const canEnter = computed(() => !!access.value?.write_reports)
  const canOpenLists = computed(() => !!access.value && (access.value.read_lists || access.value.add_red_only))

  async function load() {
    if (!character.value || !cityId.value) return
    loading.value = true
    error.value = ''
    try {
      const data = await api.reports(character.value.id, cityId.value, day.value)
      days.value = data.days
      report.value = data.report
    } catch (e) {
      error.value = apiMessage(e, locale.value, t('Auth.Errors.NetworkError'))
      report.value = null
    } finally {
      loading.value = false
    }
  }

  // À l'arrivée de l'accès : la première ville lisible et le jour du jeu en cours que le serveur annonce.
  watch(access, (value) => {
    if (!value) return
    cityId.value = defaultCityId(value.readable_cities, authStore.activeCharacter)
    day.value = value.today
  }, { immediate: true })
  watch([cityId, day], load)
  watch(() => character.value?.id, () => { report.value = null; days.value = [] })
</script>

<template>
  <div class="w-full" data-testid="customs-page">
    <ChestLoader :loading="!ready" accent="rose" error-testid="customs-chest-error">
      <AccessDenied v-if="!access" :message="t('SecurityCustoms.NoAccess')" testid="customs-denied" />

      <div v-else class="space-y-4">
        <div class="-mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <h1 class="!mt-0 bg-none text-3xl laptop:text-4xl text-rose-600" data-testid="customs-title">{{ t('SecurityCustoms.Title', { province: access.province.name }) }}</h1>
          <!-- Aucun trio connu : c'est l'état courant d'une province, dit en infobulle plutôt qu'en encart. -->
          <InfoTip v-if="!access.has_security_trio" :label="t('SecurityCustoms.NoTrioLabel')" :text="t('SecurityCustoms.NoTrio')" testid="no-trio" />
        </div>

        <!-- Où l'on regarde : la ville et le jour. -->
        <div v-if="cities.length" class="flex flex-wrap items-end gap-3" data-testid="customs-bar">
          <label class="text-sm"><span class="block font-bold">{{ t('SecurityCustoms.City') }}</span>
            <select v-model.number="cityId" class="rounded p-1" data-testid="city-select">
              <option v-for="c in cities" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </label>
          <div class="flex items-end gap-1">
            <button type="button" class="odc-btn odc-btn--soft odc-btn--icon odc-btn--sm odc--slate" :disabled="!olderDay" :aria-label="t('SecurityCustoms.OlderDay')" :title="t('SecurityCustoms.OlderDay')" data-testid="older-day" @click="day = olderDay">
              <v-icon name="fa-chevron-left" aria-hidden="true" />
            </button>
            <label class="text-sm"><span class="block font-bold">{{ t('SecurityCustoms.Day') }}</span>
              <select v-model="day" class="rounded p-1" data-testid="day-select">
                <option v-for="d in dayOptions" :key="d" :value="d">{{ dayLabel(d) }}{{ days.includes(d) ? '' : ` — ${t('SecurityCustoms.NoReportShort')}` }}</option>
              </select>
            </label>
            <button type="button" class="odc-btn odc-btn--soft odc-btn--icon odc-btn--sm odc--slate" :disabled="!newerDay" :aria-label="t('SecurityCustoms.NewerDay')" :title="t('SecurityCustoms.NewerDay')" data-testid="newer-day" @click="day = newerDay">
              <v-icon name="fa-chevron-right" aria-hidden="true" />
            </button>
            <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--slate" :disabled="day === today" data-testid="today-button" @click="day = today">{{ t('SecurityCustoms.Today') }}</button>
          </div>
          <button v-if="canOpenLists" type="button" class="odc-btn odc-btn--soft odc--slate ml-auto" data-testid="lists-open" @click="showLists = true">
            <v-icon name="fa-user-tag" aria-hidden="true" />{{ t('SecurityCustoms.ListsButton') }}
          </button>
        </div>
        <p v-else class="text-sm text-slate-800 dark:text-slate-800" data-testid="no-readable-city">{{ t('SecurityCustoms.NoReadableCity') }}</p>
        <button v-if="!cities.length && canOpenLists" type="button" class="odc-btn odc-btn--soft odc--slate" data-testid="lists-open" @click="showLists = true">
          <v-icon name="fa-user-tag" aria-hidden="true" />{{ t('SecurityCustoms.ListsButton') }}
        </button>

        <p v-if="error" role="alert" class="font-bold text-red-800 dark:text-red-800" data-testid="customs-error">{{ error }}</p>

        <section v-if="city" :aria-busy="loading">
          <h3 class="!mb-0 text-lg font-bold text-slate-800 dark:text-slate-800">{{ t('SecurityCustoms.ReportTitle', { date: dayLabel(day), city: city.name }) }}</h3>
          <p v-if="loading" class="text-sm text-slate-800 dark:text-slate-800">{{ t('SecurityCustoms.Loading') }}</p>
          <CustomsReportView v-else-if="report" :report="report" class="mt-2" />
          <CustomsExport v-if="report && !loading" :report="report" :city-name="city.name" class="mt-3" />
          <p v-else class="mt-1 text-sm text-slate-800 dark:text-slate-800" data-testid="no-report">{{ t('SecurityCustoms.NoReport', { city: city.name }) }}</p>
        </section>

        <!-- On saisit un relevé dans le Relevé de guet : un seul endroit pour tous les collages. -->
        <RouterLink v-if="canEnter" :to="{ name: 'security-guet' }" class="odc-btn odc-btn--soft odc--green inline-flex" data-testid="enter-report">
          <v-icon name="gi-quill" aria-hidden="true" />{{ t('SecurityCustoms.EnterReport') }}
        </RouterLink>

        <CustomsListsModal v-if="canOpenLists" :show="showLists" :character-id="character.id" :access="access" @close="showLists = false" @changed="load" />
      </div>
    </ChestLoader>
  </div>
</template>
