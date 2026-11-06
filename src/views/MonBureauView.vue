<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { push } from 'notivue'
import { http } from '@/api.js'
import { useAuthStore } from '@/stores/authStore'
import { useCookieStore } from '@/stores/cookieStore'
import { apiMessage } from '@/stores/mandateStore'
import { formatFieldDate } from '@/modules/playerDates'
import { provinceHistoryToBBcode } from '@/modules/provinceBBcode'
import useMineAccess from '@/use/useMineAccess.js'
import useMinePrices from '@/use/useMinePrices.js'
import NavMenu from '@/components/NavMenu.vue'
import MinePricesModal from '@/components/mines/MinePricesModal.vue'
import InventoryCategoryPanel from '@/components/economy/InventoryCategoryPanel.vue'

const { t, locale } = useI18n()
const authStore = useAuthStore()
const cookieStore = useCookieStore()

// --- Province ---
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

// --- Prix des mines ---
const { access, ready: accessReady } = useMineAccess(computed(() => character.value?.id))
const pricesProvince = computed(() => (accessReady.value ? access.value?.prices?.write : null) ?? null)

const minePrices = useMinePrices()
const priceSets = ref([])
const showPricesModal = ref(false)

const loadPrices = async () => {
  if (!pricesProvince.value) return
  try {
    priceSets.value = await minePrices.list(pricesProvince.value.id)
  } catch {}
}
watch(pricesProvince, (p) => { if (p) loadPrices() }, { immediate: true })

const onPricesSaved = () => {
  showPricesModal.value = false
  loadPrices()
}

// --- Catégories d'inventaire personnelles ---
const catConfig = ref(cookieStore.getComfortData('inventory_cat_config', { custom: [], hiddenBuiltIn: [] }))
const updateCatConfig = (val) => {
  catConfig.value = val
  cookieStore.setComfortData('inventory_cat_config', val)
}

// --- Repli des panneaux (cookieStore : état de repli persisté) ---
// { province: bool, prices: bool, cats_perso: bool } — true = replié
// Les deux panneaux de droite fonctionnent en accordéon : ouvrir l'un ferme l'autre.
const RIGHT_PANELS = ['prices', 'cats_perso']
const panelsState = ref(cookieStore.getComfortData('mon_bureau_panels', {}))
const panelOpen = (key) => panelsState.value[key] !== true
const togglePanel = (key) => {
  const opening = !panelOpen(key)
  const updated = { ...panelsState.value, [key]: !panelsState.value[key] }
  if (opening && RIGHT_PANELS.includes(key)) {
    for (const other of RIGHT_PANELS) {
      if (other !== key) updated[other] = true
    }
  }
  panelsState.value = updated
  cookieStore.setComfortData('mon_bureau_panels', updated)
}
</script>

<template>
  <div class="page-card">
    <div class="w-full flex flex-col gap-4">

      <!-- Aucun personnage -->
      <div v-if="!authStore.hasCharacters" class="rounded-xl bg-white shadow-md p-6 text-center" data-testid="mon-bureau-no-character">
        <p class="text-slate-700 dark:text-slate-700">{{ t('Province.NoCharacter') }}</p>
        <RouterLink to="/app/character/new" class="odc-btn odc-btn--soft odc-btn--sm odc--orange mt-3">
          <v-icon name="fa-user-plus" />
          {{ t('Profil.AddCharacter') }}
        </RouterLink>
      </div>

      <template v-else>
        <header class="text-center">
          <h2 class="mt-0 mb-1">{{ t('MonBureau.Title') }}</h2>
        </header>

        <div class="grid grid-cols-1 laptop:grid-cols-3 gap-4 items-start">

        <!-- Colonne gauche — Ma province (1/3) -->
        <section class="min-w-0 rounded-xl bg-white shadow-md overflow-hidden laptop:col-span-1" aria-labelledby="panel-province">
          <!-- En-tête fort avec identité du module -->
          <div class="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-violet-700 to-violet-800">
            <v-icon name="gi-tower-flag" class="text-violet-200 shrink-0" aria-hidden="true" />
            <h2 id="panel-province" class="flex-1 mt-0 mb-0 text-base font-bold text-white dark:text-white leading-tight">
              {{ province ? t('Province.Title', { province: province.name }) : t('Province.TitleShort') }}
            </h2>
            <button
              type="button"
              class="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors text-white"
              :aria-expanded="panelOpen('province')"
              :aria-label="panelOpen('province') ? t('MonBureau.Collapse') : t('MonBureau.Expand')"
              @click="togglePanel('province')"
            >
              <v-icon :name="panelOpen('province') ? 'fa-chevron-up' : 'fa-chevron-down'" aria-hidden="true" />
            </button>
          </div>

          <!-- Contenu du panneau province -->
          <div v-show="panelOpen('province')" class="p-4">
            <p role="note" class="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm font-semibold text-yellow-900 dark:text-yellow-900 mb-4" data-testid="province-warning">
              <v-icon name="fa-info-circle" class="mr-1" />
              {{ t('Province.Warning') }}
            </p>

            <!-- Squelette pendant le chargement -->
            <template v-if="loading">
              <div class="flex flex-col gap-5">
                <div>
                  <div class="flex items-center gap-2 pb-2 mb-3 border-b border-violet-200">
                    <div class="w-1 h-5 bg-violet-200 rounded-full shrink-0" />
                    <div class="h-3 bg-slate-100 rounded w-28" />
                  </div>
                  <div class="grid gap-3 laptop:grid-cols-2">
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
                <div>
                  <div class="flex items-center gap-2 pb-2 mb-3 border-b border-slate-200">
                    <div class="w-1 h-5 bg-slate-200 rounded-full shrink-0" />
                    <div class="h-3 bg-slate-100 rounded w-16" />
                  </div>
                  <div class="h-9 bg-slate-100 rounded-lg w-full" />
                </div>
                <div class="pt-2 border-t border-slate-100">
                  <div class="h-9 bg-slate-100 rounded-full w-full" />
                </div>
              </div>
            </template>

            <!-- Erreur réseau -->
            <div v-else-if="failed" class="text-center py-4">
              <p class="text-slate-700 dark:text-slate-700" data-testid="province-error">{{ t('Province.LoadError') }}</p>
              <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--violet mt-3" data-testid="chest-retry" @click="load">
                {{ t('Common.Retry') }}
              </button>
            </div>

            <!-- Résidence inconnue -->
            <div v-else-if="history && !province" class="text-center py-4" data-testid="province-no-residence">
              <p class="text-slate-700 dark:text-slate-700">{{ t('Province.NoResidence') }}</p>
              <RouterLink :to="{ name: 'profil' }" class="odc-btn odc-btn--soft odc-btn--sm odc--blue mt-3">{{ t('Province.ToProfile') }}</RouterLink>
            </div>

            <template v-else-if="province">
              <div class="flex flex-col gap-5">

                <!-- Conseil comtal -->
                <section aria-labelledby="province-council">
                  <div class="flex items-center gap-2 pb-2 mb-3 border-b border-violet-200">
                    <span class="w-1 h-5 bg-violet-500 rounded-full shrink-0" aria-hidden="true"></span>
                    <h3 id="province-council" class="mt-0 mb-0 text-xs font-bold text-violet-700 dark:text-violet-700 uppercase tracking-wider">{{ t('Province.Council') }}</h3>
                  </div>
                  <p v-if="!declaredOffices.length" class="text-sm text-slate-600 dark:text-slate-600">{{ t('Province.NoCouncil') }}</p>
                  <div class="grid gap-3 laptop:grid-cols-2">
                    <article v-for="office in declaredOffices" :key="office.key" class="rounded-lg border border-violet-100 overflow-hidden" data-testid="province-office">
                      <p class="px-3 py-2 border-b border-violet-100 bg-violet-50 text-sm font-semibold text-violet-800 dark:text-violet-800">{{ label(office.label) }}</p>
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
                </section>

                <!-- Maires -->
                <section aria-labelledby="province-mayors">
                  <div class="flex items-center gap-2 pb-2 mb-3 border-b border-slate-200">
                    <span class="w-1 h-5 bg-slate-400 rounded-full shrink-0" aria-hidden="true"></span>
                    <h3 id="province-mayors" class="mt-0 mb-0 text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider">{{ t('Province.Mayors') }}</h3>
                  </div>
                  <p v-if="!history.mayors.length" class="text-sm text-slate-600 dark:text-slate-600">{{ t('Province.NoMayor') }}</p>
                  <div class="grid gap-3 laptop:grid-cols-2">
                    <article v-for="group in history.mayors" :key="group.city.id" class="rounded-lg border border-slate-200 overflow-hidden" data-testid="province-city">
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
                  <details v-if="history.cities_without_mandate.length" class="group mt-3 text-sm" data-testid="province-cities-without">
                    <summary class="inline-flex cursor-pointer list-none items-center gap-1 font-semibold text-slate-600 dark:text-slate-600 [&::-webkit-details-marker]:hidden">
                      <v-icon name="fa-chevron-right" class="w-2.5 h-2.5 transition-transform group-open:rotate-90" />
                      {{ t('Province.CitiesWithout', { count: history.cities_without_mandate.length }, history.cities_without_mandate.length) }}
                    </summary>
                    <p class="mt-1 pl-4 text-slate-500 dark:text-slate-500">{{ history.cities_without_mandate.join(', ') }}</p>
                  </details>
                </section>

                <!-- Action province — pleine largeur en bas -->
                <div class="pt-3 border-t border-slate-100">
                  <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--green w-full" data-testid="province-copy" @click="copyForForum">
                    <v-icon name="fa-copy" />
                    {{ t('Province.CopyForForum') }}
                  </button>
                </div>

              </div>
            </template>
          </div>
        </section>

        <!-- Colonne droite — Prix des mines + Catégories (sticky laptop+, 2/3) -->
        <div class="flex flex-col gap-4 laptop:sticky laptop:top-4 laptop:col-span-2">

        <!-- Panneau 2 — Prix et salaires des mines -->
        <section v-if="pricesProvince" class="rounded-xl bg-white shadow-md overflow-hidden" aria-labelledby="panel-prices">
          <div class="flex items-center gap-3 px-5 py-4 bg-yellow-600">
            <v-icon name="fa-coins" class="text-yellow-100 shrink-0" aria-hidden="true" />
            <h2 id="panel-prices" class="flex-1 mt-0 mb-0 text-base font-bold text-white dark:text-white leading-tight">
              {{ t('MonBureau.PricesPanel', { province: pricesProvince.name }) }}
            </h2>
            <button
              type="button"
              class="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors text-white"
              :aria-expanded="panelOpen('prices')"
              :aria-label="panelOpen('prices') ? t('MonBureau.Collapse') : t('MonBureau.Expand')"
              @click="togglePanel('prices')"
            >
              <v-icon :name="panelOpen('prices') ? 'fa-chevron-up' : 'fa-chevron-down'" aria-hidden="true" />
            </button>
          </div>
          <div v-show="panelOpen('prices')" class="p-4">
            <p class="text-sm text-slate-600 dark:text-slate-600 mb-4">{{ t('MonBureau.PricesDesc') }}</p>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="odc-btn odc-btn--soft odc-btn--sm odc--green"
                data-testid="mon-bureau-manage-prices"
                @click="showPricesModal = true"
              >
                <v-icon name="fa-edit" aria-hidden="true" />
                {{ t('MonBureau.ManagePrices') }}
              </button>
              <RouterLink :to="{ name: 'economy-prices' }" class="odc-btn odc-btn--soft odc--slate odc-btn--sm">
                <v-icon name="fa-history" aria-hidden="true" />
                {{ t('MonBureau.PricesHistory') }}
              </RouterLink>
            </div>
          </div>
        </section>

        <!-- Panneau 3 — Catégories d'inventaire personnelles -->
        <section class="rounded-xl bg-white shadow-md overflow-hidden" aria-labelledby="panel-cats-perso">
          <div class="flex items-center gap-3 px-5 py-4 bg-yellow-600">
            <v-icon name="fa-tag" class="text-yellow-100 shrink-0" aria-hidden="true" />
            <h2 id="panel-cats-perso" class="flex-1 mt-0 mb-0 text-base font-bold text-white dark:text-white leading-tight">
              {{ t('MonBureau.CatPersoPanel') }}
            </h2>
            <button
              type="button"
              class="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors text-white"
              :aria-expanded="panelOpen('cats_perso')"
              :aria-label="panelOpen('cats_perso') ? t('MonBureau.Collapse') : t('MonBureau.Expand')"
              @click="togglePanel('cats_perso')"
            >
              <v-icon :name="panelOpen('cats_perso') ? 'fa-chevron-up' : 'fa-chevron-down'" aria-hidden="true" />
            </button>
          </div>
          <div v-show="panelOpen('cats_perso')" class="p-4">
            <InventoryCategoryPanel :cat-config="catConfig" @update:catConfig="updateCatConfig" />
          </div>
        </section>

        </div><!-- fin colonne droite -->
        </div><!-- fin flex 2 colonnes -->

      </template>
    </div>

    <NavMenu />

    <!-- Modale prix des mines -->
    <MinePricesModal
      :show="showPricesModal"
      :province-id="pricesProvince?.id ?? null"
      :prices="priceSets"
      :show-history-link="true"
      @close="showPricesModal = false"
      @saved="onPricesSaved"
    />
  </div>
</template>
