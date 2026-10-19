<script setup>
  import { ref, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { RouterLink } from 'vue-router'
  import { http } from '@/api.js'
  import { useAuthStore } from '@/stores/authStore'
  import { apiMessage } from '@/stores/mandateStore'

  import { push } from 'notivue'
  import { levelHistory, mandateBilans, daysWithoutData, currentPeriodBilan, weekRange, weeklyBilan, shiftWeek } from '@/modules/mineRegistry'
  import { bilanToBBcode } from '@/modules/mineBBcode'
  import { formatDateFr } from '@/modules/mineParser'
  import { toGameDateIso } from '@/modules/gameCalendar'
  import useMinePrices from '@/use/useMinePrices'
  import BilanTable from '@/components/mines/BilanTable.vue'
  import ChestLoader from '@/components/loading/ChestLoader.vue'
  import MinePricesModal from '@/components/mines/MinePricesModal.vue'

  /*
    Registre des mines — lecture (PR 4b ; brief admin/content/brief-registre-mines.md §7 ; fil
    admin/echanges/registre-mines, R4). Pour le commissaire aux mines, le bailli et le dirigeant.

    Le serveur sert les FAITS (GET characters/{id}/mine-registry/reports) : relevés, estampilles,
    mandat du lecteur, prédécesseur. Ici, seulement de l'affichage et des lectures de ces faits avec
    le parseur qui les a produits. ⚠️ Le prédécesseur se dit comme un fait — « relevés de X » —,
    jamais « votre prédécesseur était X » : le registre sait qui a écrit, pas qui occupait le poste.
    Dates en jour/mois, comme les alertes du Bilan : un relevé est un jour du jeu.
  */

  const { t, locale } = useI18n()
  const authStore = useAuthStore()

  const character = computed(() => authStore.activeCharacter)
  const registry = ref(null)
  const error = ref(null)
  const loading = ref(false)
  // Prix par période (lot 2) : les jeux de la province, et si le personnage peut en écrire. Une lecture
  // qui échoue n'empêche pas le registre : les bilans retombent alors sur les prix des relevés.
  const minePrices = useMinePrices()
  const priceSets = ref([])
  const canManagePrices = ref(false)
  const showPrices = ref(false)
  const selectedMonday = ref(null) // null = le bilan en cours du mois de mandat (affichage par défaut)

  const auth = () => ({ headers: { Authorization: `Bearer ${authStore.getToken}` } })

  async function load() {
    registry.value = null
    error.value = null
    if (!character.value) return
    loading.value = true
    try {
      const { data } = await http.get(`characters/${character.value.id}/mine-registry/reports`, auth())
      registry.value = data
      selectedMonday.value = null
      await loadPrices()
    } catch (e) {
      error.value = apiMessage(e, locale.value, t('Auth.Errors.NetworkError'))
    } finally {
      loading.value = false
    }
  }
  async function loadPrices() {
    priceSets.value = []
    canManagePrices.value = false
    try {
      const access = await minePrices.access(character.value.id)
      canManagePrices.value = !!access?.prices?.write
      const sets = await minePrices.list(registry.value.province.id)
      priceSets.value = Array.isArray(sets) ? sets : []
    } catch {
      priceSets.value = []
    }
  }
  watch(() => character.value?.id, load, { immediate: true })

  const dayMonth = iso => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '')
  const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000)
  const author = a => `${a.pseudo ?? t('EconomyMines.Registry.DeletedCharacter')} (${a.office_label?.[locale.value] ?? a.office_key})`

  const active = computed(() => (registry.value?.reports ?? []).filter(r => r.active))
  const latest = computed(() => active.value[0] ?? null)

  /** Âge du dernier relevé : aujourd'hui, hier, il y a N jours. */
  const lastAge = computed(() => {
    if (!latest.value) return null
    const n = daysBetween(latest.value.reported_at, registry.value.today)
    return n <= 0 ? t('EconomyMines.RegistryPage.Today') : n === 1 ? t('EconomyMines.RegistryPage.Yesterday') : t('EconomyMines.RegistryPage.DaysAgo', { n })
  })

  /** Bilan en cours du mois de mandat (Greg, 09/10) — remplace l'état des seuils ; modules/mineRegistry.js. */
  const current = computed(() => currentPeriodBilan(registry.value, priceSets.value))

  /** Jours SANS DONNÉES depuis l'entrée en fonction du lecteur (Greg, 09/10) — modules/mineRegistry.js. */
  const gaps = computed(() => daysWithoutData(registry.value))

  /** Historique des niveaux (+1 crédité, −1 constaté) et bilans du mandat — modules/mineRegistry.js. */
  const levels = computed(() => levelHistory(registry.value?.reports))
  const bilans = computed(() => mandateBilans(registry.value, priceSets.value))
  const num = n => Number(n || 0).toLocaleString(locale.value === 'fr' ? 'fr-FR' : 'en-GB', { maximumFractionDigits: 1 })
  const dayBefore = iso => new Date(Date.parse(`${iso}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)
  const bilanLabel = kind => t(kind === 'mid' ? 'EconomyMines.RegistryPage.BilanMid' : 'EconomyMines.RegistryPage.BilanEnd')
  const levelEvent = (e) => {
    const params = { date: dayMonth(e.date), from: e.from, to: e.to, previous: dayMonth(e.previous) }
    return t({ up: 'EconomyMines.RegistryPage.LevelUp', down: 'EconomyMines.RegistryPage.LevelDown', failure: 'EconomyMines.RegistryPage.LevelFailure' }[e.type], params)
  }

  /** Dernier relevé de deux jours ou plus : on travaille à l'aveugle (brief §7) — l'en-tête le signale. */
  const stale = computed(() => !!latest.value && daysBetween(latest.value.reported_at, registry.value.today) >= 2)
  /** Net signé, comme dans le Bilan : +501 / −13,6. */
  const signed = n => `${n >= 0 ? '+' : '−'}${num(Math.abs(n))} ${t('EconomyMines.Currency')}`

  /*
    Navigation des bilans hebdomadaires (lot 2) : semaine par semaine dans le mandat du lecteur, chaque
    bilan recalculé jour par jour avec les prix en vigueur ce jour-là. « Période en cours » (le bilan du
    mois) reste l'affichage par défaut.
  */
  const range = computed(() => weekRange(registry.value))
  const week = computed(() => (selectedMonday.value && registry.value ? weeklyBilan(registry.value, priceSets.value, selectedMonday.value) : null))
  const canGoPrevious = computed(() => !!range.value && (selectedMonday.value ? selectedMonday.value > range.value.first : true))
  const canGoNext = computed(() => !!selectedMonday.value)
  function previousWeek() {
    if (!range.value) return
    selectedMonday.value = selectedMonday.value ? shiftWeek(selectedMonday.value, -1) : range.value.last
  }
  function nextWeek() {
    if (!selectedMonday.value) return
    const next = shiftWeek(selectedMonday.value, 1)
    selectedMonday.value = next > range.value.last ? null : next
  }
  const gameDate = iso => formatDateFr(toGameDateIso(iso))
  const weekLabel = computed(() => (week.value
    ? t('EconomyMines.WeekLabel', { monday: gameDate(week.value.monday), sunday: gameDate(week.value.sunday) })
    : ''))

  /** Seule une semaine complète s'exporte, comme dans le Bilan public (§2.4). */
  function exportWeek() {
    if (!week.value?.complete) return
    const text = bilanToBBcode(week.value.bilan, { title: t('EconomyMines.Title'), week: weekLabel.value, t })
    navigator.clipboard.writeText(text)
      .then(() => push.success(t('EconomyMines.RegistryPage.Export.Copied')))
      .catch(() => push.error(t('EconomyMines.CopyError')))
  }
  const onPricesSaved = async () => { await loadPrices() }

  /** Jours consécutifs regroupés en plages : « du 23/09 au 07/10 », un jour isolé reste seul. */
  const ranges = (days) => {
    const out = []
    for (const d of days) {
      const last = out[out.length - 1]
      if (last && daysBetween(last.to, d) === 1) last.to = d
      else out.push({ from: d, to: d })
    }
    return out.map(r => (r.from === r.to ? dayMonth(r.from) : t('EconomyMines.RegistryPage.Range', { from: dayMonth(r.from), to: dayMonth(r.to) }))).join(', ')
  }
</script>

<template>
  <!-- Mise en page (Greg, 09/10) : trois questions dans l'ordre où un titulaire se les pose — le parc
       va-t-il bien (pleine largeur, le point fort), le registre est-il à jour (en tête, à droite), où en
       est mon mandat (colonne gauche) — puis la mémoire (colonne droite). Pas de cartes : des sections
       séparées par un filet. Couleurs de texte posées sur CHAQUE élément (règle globale `.dark p`). -->
  <div class="w-full text-slate-800 dark:text-slate-800">
    <p v-if="!character" class="text-slate-700 dark:text-slate-700">{{ t('EconomyMines.RegistryPage.NoCharacter') }}</p>
    <ChestLoader v-else :loading="loading" :error="error || ''" accent="gold" error-testid="registry-error" block-class="laptop:mt-14 laptop:w-[calc((100%-2rem)*3/5)]" @retry="load">
    <template v-if="registry">
      <header class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-slate-300 pb-2">
        <h2 class="!mb-0 text-2xl font-bold text-slate-800 dark:text-slate-800">{{ t('EconomyMines.RegistryPage.Title', { province: registry.province.name }) }}</h2>
        <div class="flex flex-wrap items-center gap-3">
          <RouterLink :to="{ name: 'economy-prices' }" class="odc-btn odc-btn--soft odc-btn--sm odc--slate" data-testid="prices-history-link">
            <v-icon name="fa-history" aria-hidden="true" />{{ t('EconomyMines.RegistryPage.Prices.PageTitleShort') }}
          </RouterLink>
          <button v-if="canManagePrices" type="button" class="odc-btn odc-btn--soft odc--gold odc-btn--sm" data-testid="manage-prices" @click="showPrices = true">
            <v-icon name="fa-tag" aria-hidden="true" />{{ t('EconomyMines.RegistryPage.Prices.ManageButton') }}
          </button>
        </div>
        <!-- Âge du dernier relevé, toujours visible (brief §7) ; orange dès deux jours : on travaille à l'aveugle. -->
        <p class="text-sm italic" :class="stale ? 'font-bold text-orange-800 dark:text-orange-800' : 'text-slate-700 dark:text-slate-700'" data-testid="registry-age">
          <template v-if="latest">{{ t('EconomyMines.RegistryPage.LastReport', { age: lastAge, date: dayMonth(latest.reported_at) }) }}</template>
          <template v-else>
            {{ t('EconomyMines.RegistryPage.NoReport') }}
            <RouterLink :to="{ name: 'economy-mines' }" class="underline">{{ t('EconomyMines.RegistryPage.ToBilan') }}</RouterLink>
          </template>
        </p>
      </header>

      <!-- Page pensée pour tenir SANS défilement sur ordinateur (Greg, 15/10) et prendre toute la largeur :
           à gauche tout ce qui sert à décider — le bilan (le point fort, avec son sélecteur de période), les
           bilans de mandat, les jours sans données, le prédécesseur ; à droite la mémoire — l'historique des
           niveaux (accordéon par mine) et les relevés inscrits, repliés (Greg, 15/10).
           Sous `laptop`, une seule colonne dans le même ordre. -->
      <div class="mt-5 grid gap-x-8 gap-y-5 laptop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div class="space-y-5">
      <!-- UN seul tableau de bilan, un seul sélecteur (Greg, 15/10 : combiner le bilan du mois et les semaines
           pour gagner de la place). Par défaut : le bilan EN COURS du mois de mandat (Greg, 09/10), PROVISOIRE,
           titré comme tel, couverture dite. ◀ ▶ le remplacent par une semaine du mandat, recalculée jour par jour
           avec les prix en vigueur ce jour-là ; « Période en cours » revient au mois. -->
      <section v-if="current || range" data-testid="registry-current">
        <div class="flex flex-wrap items-center gap-3">
          <button v-if="range" type="button" class="odc-btn odc-btn--soft odc-btn--rect odc-btn--icon odc-btn--sm odc--slate" :disabled="!canGoPrevious"
                  :aria-label="t('EconomyMines.RegistryPage.Navigation.Previous')" data-testid="week-previous" @click="previousWeek">
            <v-icon name="fa-chevron-left" scale="0.9" />
          </button>
          <h3 class="!mb-0 text-lg font-bold text-slate-800 dark:text-slate-800" data-testid="week-label">
            <template v-if="week">{{ weekLabel }}</template>
            <template v-else-if="current">{{ t('EconomyMines.RegistryPage.CurrentTitle', { month: current.month, from: dayMonth(current.from), to: dayMonth(current.to) }, current.month) }}</template>
            <template v-else>{{ t('EconomyMines.RegistryPage.Navigation.CurrentPeriod') }}</template>
          </h3>
          <button v-if="range" type="button" class="odc-btn odc-btn--soft odc-btn--rect odc-btn--icon odc-btn--sm odc--slate" :disabled="!canGoNext"
                  :aria-label="t('EconomyMines.RegistryPage.Navigation.Next')" data-testid="week-next" @click="nextWeek">
            <v-icon name="fa-chevron-right" scale="0.9" />
          </button>
          <button v-if="week" type="button" class="text-sm underline text-slate-700 dark:text-slate-700" data-testid="week-reset" @click="selectedMonday = null">
            {{ t('EconomyMines.RegistryPage.Navigation.CurrentPeriod') }}
          </button>
          <button v-if="week?.complete" type="button" class="ml-auto odc-btn odc-btn--soft odc--green odc-btn--sm" data-testid="week-export" @click="exportWeek">
            <v-icon name="fa-copy" aria-hidden="true" />{{ t('EconomyMines.RegistryPage.Export.Button') }}
          </button>
        </div>

        <div v-if="week" data-testid="registry-week">
          <p v-if="!week.complete" class="mt-2 text-sm font-bold text-orange-800 dark:text-orange-800" data-testid="week-incomplete">{{ t('EconomyMines.IncompleteWeekTitle') }}</p>
          <BilanTable :bilan="week.bilan" total-testid="registry-week-total" />
          <p class="mt-1 text-xs text-slate-600 dark:text-slate-600">
            {{ t('EconomyMines.RegistryPage.BilanCoverage', { covered: week.bilan.covered, days: week.bilan.days }, week.bilan.covered) }}
          </p>
          <p v-if="week.bilan.unpricedDays.length" role="note" class="mt-1 text-xs font-semibold text-orange-800 dark:text-orange-800" data-testid="week-unpriced">
            {{ t('EconomyMines.RegistryPage.Prices.Unpriced', { count: week.bilan.unpricedDays.length }, week.bilan.unpricedDays.length) }}
          </p>
        </div>
        <template v-else-if="current">
          <BilanTable :bilan="current.bilan" :levels="current.levels" total-testid="registry-current-total" />
          <p class="mt-1 text-xs text-slate-600 dark:text-slate-600">
            {{ t('EconomyMines.RegistryPage.BilanCoverage', { covered: current.bilan.covered, days: current.bilan.days }, current.bilan.covered) }}
            {{ t('EconomyMines.RegistryPage.CurrentPrices') }}
          </p>
          <p v-if="current.bilan.unpricedDays.length" role="note" class="mt-1 text-xs font-semibold text-orange-800 dark:text-orange-800" data-testid="registry-unpriced">
            {{ t('EconomyMines.RegistryPage.Prices.Unpriced', { count: current.bilan.unpricedDays.length }, current.bilan.unpricedDays.length) }}
          </p>
        </template>
      </section>

          <!-- Sous le tableau : trois lectures courtes côte à côte (auto-fit), pour tenir sans défilement. -->
          <div class="grid gap-x-8 gap-y-4 grid-cols-[repeat(auto-fit,minmax(15rem,1fr))]">
          <!-- Bilans (R4) : calés sur le mandat du lecteur ; avant la date, « dans N jours », jamais un bilan partiel. -->
          <section v-if="bilans.length" class="registry-section" data-testid="registry-bilans">
            <h3 class="registry-heading">{{ t('EconomyMines.RegistryPage.BilansTitle') }}</h3>
            <div v-for="b in bilans" :key="b.kind" class="mt-2 text-sm" :data-testid="`registry-bilan-${b.kind}`">
              <p v-if="b.status === 'pending'" class="text-slate-700 dark:text-slate-700">
                {{ t('EconomyMines.RegistryPage.BilanPending', { label: bilanLabel(b.kind), date: dayMonth(b.at), n: b.inDays }, b.inDays) }}
              </p>
              <template v-else>
                <p class="font-bold text-slate-800 dark:text-slate-800">{{ t('EconomyMines.RegistryPage.BilanPeriod', { label: bilanLabel(b.kind), from: dayMonth(b.from), to: dayMonth(dayBefore(b.at)) }) }}</p>
                <p class="text-slate-700 dark:text-slate-700">
                  {{ t('EconomyMines.RegistryPage.BilanFigures', { valeur: num(b.bilan.total.valeur), salaire: num(b.bilan.total.salaire), entretien: num(b.bilan.total.entretien) }) }}
                  <span :class="['font-bold', b.bilan.net >= 0 ? 'text-green-800' : 'text-red-700']">{{ signed(b.bilan.net) }}</span>
                </p>
                <p class="text-xs text-slate-600 dark:text-slate-600">
                  {{ t('EconomyMines.RegistryPage.BilanCoverage', { covered: b.bilan.covered, days: b.bilan.days }, b.bilan.covered) }}
                  {{ t('EconomyMines.RegistryPage.BilanPrices') }}
                </p>
              </template>
            </div>
          </section>

          <section v-if="gaps" class="registry-section" data-testid="registry-gaps">
            <h3 class="registry-heading">{{ t('EconomyMines.RegistryPage.GapsTitle') }}</h3>
            <p class="mt-1 text-sm text-slate-700 dark:text-slate-700">
              <template v-if="gaps.length === 0">{{ t('EconomyMines.RegistryPage.GapsNone', { date: dayMonth(registry.mandate.in_office_from) }) }}</template>
              <template v-else>{{ t('EconomyMines.RegistryPage.GapsSome', { count: gaps.length, date: dayMonth(registry.mandate.in_office_from) }, gaps.length) }}
                {{ ranges(gaps) }}</template>
            </p>
          </section>

          <!-- Prédécesseur : des estampilles écrites, jamais « qui occupait le poste » (R4). -->
          <section v-if="registry.mandate && registry.predecessor.length" class="registry-section" data-testid="registry-predecessor">
            <h3 class="registry-heading">{{ t('EconomyMines.RegistryPage.PredecessorTitle') }}</h3>
            <ul class="mt-1 list-disc list-inside text-sm text-slate-700 dark:text-slate-700">
              <li v-for="p in registry.predecessor" :key="`${p.pseudo}-${p.office_key}`">
                {{ t('EconomyMines.RegistryPage.PredecessorLine', { author: author(p), first: dayMonth(p.first), last: dayMonth(p.last), count: p.count }, p.count) }}
              </li>
            </ul>
          </section>
          </div>
        </div>

        <!-- Rail de droite descendu de la ligne des flèches (2,75 rem ≈ bouton 36 px + marge du tableau) : « Historique »
             commence au niveau des titres de colonne du tableau (Greg, 15/10). -->
        <div class="space-y-5 laptop:pt-11">
          <!-- Historique des niveaux (brief §7) : le registre crédite les améliorations et CONSTATE le reste.
               Une mine qui a plus d'un événement se replie en accordéon (Greg, 15/10) : son dernier événement
               reste lisible sur la ligne, l'historique complet s'ouvre au clic. -->
          <section v-if="levels.length" class="registry-section registry-section--first" data-testid="registry-levels">
            <h3 class="registry-heading">{{ t('EconomyMines.RegistryPage.LevelsTitle') }}</h3>
            <ul class="mt-1 space-y-1 text-sm text-slate-700 dark:text-slate-700">
              <li v-for="m in levels" :key="m.key">
                <details v-if="m.events.length > 1" :data-testid="`level-accordion-${m.number}`">
                  <summary class="cursor-pointer">
                    <span class="font-bold">#{{ m.number }} {{ m.label }}</span> — {{ levelEvent(m.events[m.events.length - 1]) }}
                  </summary>
                  <ul class="ml-4 mt-1 list-disc list-inside">
                    <li v-for="e in m.events" :key="e.date" :class="e.type === 'failure' ? 'font-bold text-red-700 dark:text-red-700' : ''" :data-testid="`level-${e.type}`">
                      {{ levelEvent(e) }}
                    </li>
                  </ul>
                </details>
                <template v-else>
                  <span class="font-bold">#{{ m.number }} {{ m.label }}</span><template v-if="!m.events.length"> — {{ t('EconomyMines.RegistryPage.LevelsNone') }}</template>
                  <ul v-if="m.events.length" class="ml-4 list-disc list-inside">
                    <li v-for="e in m.events" :key="e.date" :class="e.type === 'failure' ? 'font-bold text-red-700 dark:text-red-700' : ''" :data-testid="`level-${e.type}`">
                      {{ levelEvent(e) }}
                    </li>
                  </ul>
                </template>
              </li>
            </ul>
          </section>

          <!-- Tout ce qui est inscrit, remplacements compris : rien ne s'efface (brief §3). -->
          <details v-if="registry.reports.length" class="registry-section" data-testid="registry-history">
            <summary class="registry-heading cursor-pointer">{{ t('EconomyMines.RegistryPage.HistoryTitle') }} ({{ registry.reports.length }})</summary>
            <ul class="mt-1 text-sm text-slate-700 dark:text-slate-700">
              <li v-for="r in registry.reports" :key="r.id" :class="r.active ? '' : 'text-slate-600 dark:text-slate-600'">
                <span class="tabular-nums">{{ dayMonth(r.reported_at) }}</span> — {{ author(r.author) }}
                <span v-if="!r.active" class="ml-1 italic">{{ t('EconomyMines.RegistryPage.Replaced') }}</span>
              </li>
            </ul>
          </details>
        </div>
      </div>
    </template>
    </ChestLoader>
    <MinePricesModal :show="showPrices" :province-id="registry?.province?.id ?? null" :prices="priceSets" @close="showPrices = false" @saved="onPricesSaved" />
  </div>
</template>

<style scoped>
  /* Sections : un filet fin au-dessus, pas de carte — la structure porte l'information, pas le décor. */
  .registry-section { border-top: 1px solid #cbd5e1; padding-top: 0.75rem; }
  /* Première section d'une colonne : rien au-dessus, donc pas de filet (Greg, 15/10). */
  .registry-section--first { border-top: 0; padding-top: 0; }
  .registry-heading { font-weight: 700; font-size: 1rem; line-height: 1.4; color: #1e293b; margin-bottom: 0; }
</style>
