<script setup>
  import { ref, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { push } from 'notivue'
  import { http } from '@/api.js'
  import { useAuthStore } from '@/stores/authStore'
  import { apiMessage } from '@/stores/mandateStore'
  import { formatFieldDate } from '@/modules/playerDates'
  import { provinceHistoryToBBcode } from '@/modules/provinceBBcode'
  import NavMenu from '@/components/NavMenu.vue'

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

        <!-- Squelette pendant le chargement : mime la forme des deux sections + le panneau d'actions. -->
        <template v-if="loading">
          <div class="flex flex-col laptop:flex-row gap-4 items-start">
            <div class="flex-1 min-w-0 flex flex-col gap-6">
              <div class="rounded-xl bg-white shadow-md overflow-hidden">
                <div class="h-12 bg-violet-50 border-b border-violet-100" />
                <div class="p-4 grid gap-3 laptop:grid-cols-2">
                  <div class="rounded-lg border border-slate-200 overflow-hidden">
                    <div class="h-9 bg-slate-100 border-b border-slate-200" />
                    <div class="p-3 flex flex-col gap-2">
                      <div class="h-3.5 bg-slate-100 rounded w-1/2" />
                      <div class="h-3.5 bg-slate-100 rounded w-1/3" />
                    </div>
                  </div>
                  <div class="rounded-lg border border-slate-200 overflow-hidden">
                    <div class="h-9 bg-slate-100 border-b border-slate-200" />
                    <div class="p-3 flex flex-col gap-2">
                      <div class="h-3.5 bg-slate-100 rounded w-2/3" />
                    </div>
                  </div>
                </div>
              </div>
              <div class="rounded-xl bg-white shadow-md overflow-hidden">
                <div class="h-12 bg-slate-100 border-b border-slate-200" />
                <div class="p-4 flex flex-col gap-2">
                  <div class="h-3.5 bg-slate-100 rounded w-1/3" />
                  <div class="h-3.5 bg-slate-100 rounded w-1/2" />
                </div>
              </div>
            </div>
            <div class="w-full laptop:w-52 shrink-0">
              <div class="rounded-xl bg-white shadow-md p-4">
                <div class="h-9 bg-slate-100 rounded-lg" />
              </div>
            </div>
          </div>
        </template>

        <!-- Erreur réseau avec retry. -->
        <div v-else-if="failed" class="rounded-xl bg-white shadow-md p-6 text-center">
          <p class="text-slate-700 dark:text-slate-700" data-testid="province-error">{{ t('Province.LoadError') }}</p>
          <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--violet mt-3" data-testid="chest-retry" @click="load">
            {{ t('Common.Retry') }}
          </button>
        </div>

        <!-- Résidence inconnue : on dit ce qui manque. -->
        <div v-else-if="history && !province" class="rounded-xl bg-white shadow-md p-6 text-center" data-testid="province-no-residence">
          <p class="text-slate-700 dark:text-slate-700">{{ t('Province.NoResidence') }}</p>
          <RouterLink :to="{ name: 'profil' }" class="odc-btn odc-btn--soft odc-btn--sm odc--blue mt-3">{{ t('Province.ToProfile') }}</RouterLink>
        </div>

        <template v-else-if="province">
          <div class="flex flex-col laptop:flex-row gap-4 items-start">

            <!-- Colonnes de contenu : conseil + espace + maires -->
            <div class="flex-1 min-w-0 flex flex-col gap-6">

              <!-- Conseil comtal, par titre (Q2) — violet = couleur du module Province -->
              <section class="rounded-xl bg-white shadow-md overflow-hidden" aria-labelledby="province-council">
                <h3 id="province-council" class="mt-0 mb-0 flex items-center gap-2 px-4 py-3 border-b border-violet-100 bg-violet-50 text-base font-bold text-violet-900 dark:text-violet-900">
                  <v-icon name="gi-tower-flag" class="opacity-70 shrink-0" />
                  {{ t('Province.Council') }}
                </h3>
                <div class="p-4">
                  <p v-if="!declaredOffices.length" class="text-sm text-slate-600 dark:text-slate-600">{{ t('Province.NoCouncil') }}</p>
                  <div class="grid gap-3 laptop:grid-cols-2">
                    <article v-for="office in declaredOffices" :key="office.key" class="rounded-lg border border-slate-200" data-testid="province-office">
                      <p class="px-3 py-2 border-b border-slate-200 bg-violet-50 text-sm font-semibold text-violet-800 dark:text-violet-800">{{ label(office.label) }}</p>
                      <ul class="divide-y divide-slate-100">
                        <li v-for="(holder, index) in office.holders" :key="index" class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm" data-testid="province-holder">
                          <span class="font-semibold text-slate-800 dark:text-slate-800">{{ holder.pseudo }}</span>
                          <span class="tabular-nums text-slate-500 dark:text-slate-500">
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
                  <p v-if="emptyOffices.length && declaredOffices.length" class="mt-3 text-xs text-slate-500 dark:text-slate-500">
                    {{ t('Province.OfficesWithout', { offices: emptyOffices.map(o => label(o.label)).join(', ') }) }}
                  </p>
                </div>
              </section>

              <!-- Maires, par ville (Q3) — slate = niveau ville, hiérarchiquement sous le conseil -->
              <section class="rounded-xl bg-white shadow-md overflow-hidden" aria-labelledby="province-mayors">
                <h3 id="province-mayors" class="mt-0 mb-0 flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-slate-100 text-base font-bold text-slate-700 dark:text-slate-700">
                  <v-icon name="fa-map-marker-alt" class="opacity-60 shrink-0" />
                  {{ t('Province.Mayors') }}
                </h3>
                <div class="p-4">
                  <p v-if="!history.mayors.length" class="text-sm text-slate-600 dark:text-slate-600">{{ t('Province.NoMayor') }}</p>
                  <div class="grid gap-3 laptop:grid-cols-2">
                    <article v-for="group in history.mayors" :key="group.city.id" class="rounded-lg border border-slate-200" data-testid="province-city">
                      <p class="px-3 py-2 border-b border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 dark:text-slate-700">{{ group.city.name }}</p>
                      <ul class="divide-y divide-slate-100">
                        <li v-for="(holder, index) in group.holders" :key="index" class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                          <span class="font-semibold text-slate-800 dark:text-slate-800">{{ holder.pseudo }}</span>
                          <span class="tabular-nums text-slate-500 dark:text-slate-500">
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
                    <summary class="inline-flex cursor-pointer list-none items-center gap-1 font-semibold text-slate-600 dark:text-slate-600 [&::-webkit-details-marker]:hidden">
                      <v-icon name="fa-chevron-right" class="w-2.5 h-2.5 transition-transform group-open:rotate-90" />
                      {{ t('Province.CitiesWithout', { count: history.cities_without_mandate.length }, history.cities_without_mandate.length) }}
                    </summary>
                    <p class="mt-1 pl-4 text-slate-500 dark:text-slate-500">{{ history.cities_without_mandate.join(', ') }}</p>
                  </details>
                </div>
              </section>

            </div>

            <!-- Panneau d'actions : sticky à droite, extensible pour de futures actions. -->
            <aside class="w-full laptop:w-52 shrink-0">
              <div class="sticky top-4 rounded-xl bg-white shadow-md p-4 flex flex-col gap-2">
                <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--violet w-full" data-testid="province-copy" @click="copyForForum">
                  <v-icon name="fa-copy" />
                  {{ t('Province.CopyForForum') }}
                </button>
              </div>
            </aside>

          </div>
        </template>
      </template>
    </div>
    <!-- Le menu circulaire en bas, comme sur toutes les pages /app/* (Ma province en est le 6e bouton). -->
    <NavMenu />
  </div>
</template>
