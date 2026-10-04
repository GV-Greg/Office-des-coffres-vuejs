<script setup>
  import { ref, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { push } from 'notivue'
  import { http } from '@/api.js'
  import { useAuthStore } from '@/stores/authStore'
  import { apiMessage } from '@/stores/mandateStore'
  import { formatFieldDate } from '@/modules/playerDates'
  import { provinceHistoryToBBcode } from '@/modules/provinceBBcode'

  /*
    « Ma province » (fil admin/echanges/mandats-historique, 04 §11, 07) : l'historique des postes de
    la province de RÉSIDENCE du personnage actif — résidence seule, décision de Greg. Le personnage
    se change par le sélecteur de la NavBar (SelectorCharacter), déjà présent sur toutes les pages.

    ⚠️ Une page intitulée « Ma province » se lit comme LA province : l'avertissement « l'Office
    n'enregistre que ce que les joueurs déclarent » est en tête, visible et permanent (04 §11).
    Fond de carte toujours clair : textes répétés en `dark:` à cause de `.dark p`.
  */
  const { t, locale } = useI18n()
  const authStore = useAuthStore()

  const character = computed(() => authStore.activeCharacter)
  const history = ref(null)
  const loading = ref(false)
  const failed = ref(false)

  const load = async () => {
    if (!character.value) return
    loading.value = true
    failed.value = false
    try {
      const response = await http.get(`characters/${character.value.id}/province`, {
        headers: { Authorization: `Bearer ${authStore.getToken}` },
      })
      history.value = response.data
    } catch (error) {
      failed.value = true
      push.error(apiMessage(error, locale.value, t('Province.LoadError')))
    } finally {
      loading.value = false
    }
  }
  watch(() => character.value?.id, load, { immediate: true })

  const province = computed(() => history.value?.province ?? null)
  const label = (labels) => labels?.[locale.value] ?? ''
  const fieldDate = (field, value) => formatFieldDate(field, value, locale.value)
  const declaredOffices = computed(() => (history.value?.offices ?? []).filter(o => o.holders.length))
  const emptyOffices = computed(() => (history.value?.offices ?? []).filter(o => !o.holders.length))

  const CAUSE_CLASS = {
    ongoing: 'border-green-200 bg-green-50 text-green-800',
    reattribue: 'border-yellow-300 bg-yellow-50 text-yellow-900',
    default: 'border-slate-200 bg-slate-50 text-slate-700',
  }
  const causeClass = (holder) => holder.ongoing ? CAUSE_CLASS.ongoing : (CAUSE_CLASS[holder.end_reason] ?? CAUSE_CLASS.default)

  const copyForForum = () => {
    navigator.clipboard.writeText(provinceHistoryToBBcode(history.value))
      .then(() => push.success(t('Province.Copied')))
      .catch(() => push.error(t('Province.CopyError')))
  }
</script>

<template>
  <div class="page-card">
    <div class="w-full max-w-6xl flex flex-col gap-4">
      <!-- Aucun personnage : on dit quoi faire, jamais une page blanche (04 §11). -->
      <div v-if="!authStore.hasCharacters" class="rounded-xl bg-white shadow-md p-6 text-center" data-testid="province-no-character">
        <p class="text-slate-700 dark:text-slate-700">{{ t('Province.NoCharacter') }}</p>
        <RouterLink to="/app/character/new" class="odc-btn odc-btn--soft odc-btn--sm odc--orange mt-3">
          <v-icon name="fa-user-plus" />
          {{ t('Profil.AddCharacter') }}
        </RouterLink>
      </div>

      <template v-else>
        <header class="text-center">
          <h2 class="mt-0 mb-1">{{ province ? t('Province.Title', { province: province.name }) : t('Province.TitleShort') }}</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">{{ t('Province.For', { pseudo: character?.pseudo }) }}</p>
        </header>

        <p role="note" class="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm font-semibold text-yellow-900 dark:text-yellow-900" data-testid="province-warning">
          <v-icon name="fa-info-circle" class="mr-1" />
          {{ t('Province.Warning') }}
        </p>

        <p v-if="loading" role="status" class="text-center text-sm text-slate-600 dark:text-slate-300">{{ t('Province.Loading') }}</p>
        <p v-else-if="failed" class="text-center text-sm text-red-700 dark:text-red-300">{{ t('Province.LoadError') }}</p>

        <!-- Résidence inconnue : on dit ce qui manque. -->
        <div v-else-if="history && !province" class="rounded-xl bg-white shadow-md p-6 text-center" data-testid="province-no-residence">
          <p class="text-slate-700 dark:text-slate-700">{{ t('Province.NoResidence') }}</p>
          <RouterLink :to="{ name: 'profil' }" class="odc-btn odc-btn--soft odc-btn--sm odc--blue mt-3">{{ t('Province.ToProfile') }}</RouterLink>
        </div>

        <template v-else-if="province">
          <div class="flex justify-end">
            <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--slate" data-testid="province-copy" @click="copyForForum">
              <v-icon name="fa-reply" />
              {{ t('Province.CopyForForum') }}
            </button>
          </div>

          <!-- Conseil comtal, par titre (Q2) -->
          <section class="rounded-xl bg-white shadow-md p-4" aria-labelledby="province-council">
            <h3 id="province-council" class="mt-0 mb-3 text-base font-bold text-slate-800 dark:text-slate-800">{{ t('Province.Council') }}</h3>
            <p v-if="!declaredOffices.length" class="text-sm text-slate-600 dark:text-slate-600">{{ t('Province.NoCouncil') }}</p>
            <div class="grid gap-3 laptop:grid-cols-2">
              <article v-for="office in declaredOffices" :key="office.key" class="rounded-lg border border-slate-200" data-testid="province-office">
                <p class="px-3 py-2 border-b border-slate-200 bg-indigo-50 text-sm font-bold text-indigo-900 dark:text-indigo-900">{{ label(office.label) }}</p>
                <ul class="divide-y divide-slate-100">
                  <li v-for="(holder, index) in office.holders" :key="index" class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm" data-testid="province-holder">
                    <span class="font-semibold text-slate-800">{{ holder.pseudo }}</span>
                    <span class="tabular-nums text-slate-600">
                      {{ holder.ongoing
                        ? t('Province.Since', { from: fieldDate('history_started_at', holder.started_at) })
                        : t('Province.FromTo', { from: fieldDate('history_started_at', holder.started_at), to: fieldDate('history_ended_at', holder.ended_at) }) }}
                    </span>
                    <span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold" :class="causeClass(holder)">
                      {{ holder.ongoing ? t('Province.Ongoing') : label(holder.end_reason_label) }}
                    </span>
                  </li>
                </ul>
              </article>
            </div>
            <p v-if="emptyOffices.length && declaredOffices.length" class="mt-3 text-xs text-slate-600 dark:text-slate-600">
              {{ t('Province.OfficesWithout', { offices: emptyOffices.map(o => label(o.label)).join(', ') }) }}
            </p>
          </section>

          <!-- Maires, par ville (Q3) -->
          <section class="rounded-xl bg-white shadow-md p-4" aria-labelledby="province-mayors">
            <h3 id="province-mayors" class="mt-0 mb-3 text-base font-bold text-slate-800 dark:text-slate-800">{{ t('Province.Mayors') }}</h3>
            <p v-if="!history.mayors.length" class="text-sm text-slate-600 dark:text-slate-600">{{ t('Province.NoMayor') }}</p>
            <div class="grid gap-3 laptop:grid-cols-2">
              <article v-for="group in history.mayors" :key="group.city.id" class="rounded-lg border border-slate-200" data-testid="province-city">
                <p class="px-3 py-2 border-b border-slate-200 bg-teal-50 text-sm font-bold text-teal-900 dark:text-teal-900">{{ group.city.name }}</p>
                <ul class="divide-y divide-slate-100">
                  <li v-for="(holder, index) in group.holders" :key="index" class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                    <span class="font-semibold text-slate-800">{{ holder.pseudo }}</span>
                    <span class="tabular-nums text-slate-600">
                      {{ holder.ongoing
                        ? t('Province.Since', { from: fieldDate('history_started_at', holder.started_at) })
                        : t('Province.FromTo', { from: fieldDate('history_started_at', holder.started_at), to: fieldDate('history_ended_at', holder.ended_at) }) }}
                    </span>
                    <span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold" :class="causeClass(holder)">
                      {{ holder.ongoing ? t('Province.Ongoing') : label(holder.end_reason_label) }}
                    </span>
                  </li>
                </ul>
              </article>
            </div>
            <!-- Jamais masquées : un compteur dépliable (Q3). -->
            <details v-if="history.cities_without_mandate.length" class="group mt-3 text-sm" data-testid="province-cities-without">
              <summary class="inline-flex cursor-pointer list-none items-center gap-1 font-semibold text-slate-700 dark:text-slate-700 [&::-webkit-details-marker]:hidden">
                <v-icon name="fa-chevron-right" class="w-2.5 h-2.5 transition-transform group-open:rotate-90" />
                {{ t('Province.CitiesWithout', { count: history.cities_without_mandate.length }, history.cities_without_mandate.length) }}
              </summary>
              <p class="mt-1 pl-4 text-slate-600 dark:text-slate-600">{{ history.cities_without_mandate.join(', ') }}</p>
            </details>
          </section>
        </template>
      </template>
    </div>
  </div>
</template>
