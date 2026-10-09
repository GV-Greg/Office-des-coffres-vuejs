<script setup>
  import { ref, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { RouterLink } from 'vue-router'
  import { http } from '@/api.js'
  import { useAuthStore } from '@/stores/authStore'
  import { apiMessage } from '@/stores/mandateStore'

  import { levelHistory, mandateBilans, daysWithoutData, currentPeriodBilan, lineKey } from '@/modules/mineRegistry'

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

  const auth = () => ({ headers: { Authorization: `Bearer ${authStore.getToken}` } })

  async function load() {
    registry.value = null
    error.value = null
    if (!character.value) return
    loading.value = true
    try {
      const { data } = await http.get(`characters/${character.value.id}/mine-registry/reports`, auth())
      registry.value = data
    } catch (e) {
      error.value = apiMessage(e, locale.value, t('Auth.Errors.NetworkError'))
    } finally {
      loading.value = false
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
  const current = computed(() => currentPeriodBilan(registry.value))
  const unit = resource => (resource ? t(`EconomyMines.Units.${resource}`) : '')

  /** Jours SANS DONNÉES depuis l'entrée en fonction du lecteur (Greg, 09/10) — modules/mineRegistry.js. */
  const gaps = computed(() => daysWithoutData(registry.value))

  /** Historique des niveaux (+1 crédité, −1 constaté) et bilans du mandat — modules/mineRegistry.js. */
  const levels = computed(() => levelHistory(registry.value?.reports))
  const bilans = computed(() => mandateBilans(registry.value))
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
  <div class="w-full max-w-5xl text-slate-800 dark:text-slate-800">
    <p v-if="!character" class="text-slate-700 dark:text-slate-700">{{ t('EconomyMines.RegistryPage.NoCharacter') }}</p>
    <p v-else-if="loading" role="status" class="text-slate-700 dark:text-slate-700">{{ t('EconomyMines.RegistryPage.Loading') }}</p>
    <p v-else-if="error" role="alert" class="text-slate-700 dark:text-slate-700" data-testid="registry-error">{{ error }}</p>

    <template v-else-if="registry">
      <header class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-slate-300 pb-2">
        <h2 class="!mb-0 text-2xl font-bold text-slate-800 dark:text-slate-800">{{ t('EconomyMines.RegistryPage.Title', { province: registry.province.name }) }}</h2>
        <!-- Âge du dernier relevé, toujours visible (brief §7) ; orange dès deux jours : on travaille à l'aveugle. -->
        <p class="text-sm italic" :class="stale ? 'font-bold text-orange-800 dark:text-orange-800' : 'text-slate-700 dark:text-slate-700'" data-testid="registry-age">
          <template v-if="latest">{{ t('EconomyMines.RegistryPage.LastReport', { age: lastAge, date: dayMonth(latest.reported_at) }) }}</template>
          <template v-else>
            {{ t('EconomyMines.RegistryPage.NoReport') }}
            <RouterLink :to="{ name: 'economy-mines' }" class="underline">{{ t('EconomyMines.RegistryPage.ToBilan') }}</RouterLink>
          </template>
        </p>
      </header>

      <!-- Bilan en cours du mois de mandat (Greg, 09/10) : PROVISOIRE, titré comme tel, couverture dite. -->
      <section v-if="current" class="mt-5" data-testid="registry-current">
        <h3 class="text-lg font-bold text-slate-800 dark:text-slate-800">
          {{ t('EconomyMines.RegistryPage.CurrentTitle', { month: current.month, from: dayMonth(current.from), to: dayMonth(current.to) }, current.month) }}
        </h3>
        <div class="overflow-x-auto">
          <table class="mt-2 w-full text-sm">
            <thead>
              <tr>
                <th class="text-left">{{ t('EconomyMines.RegistryPage.Mine') }}</th>
                <th class="text-right">{{ t('EconomyMines.RegistryPage.Level') }}</th>
                <th class="text-right">{{ t('EconomyMines.ColumnProduction') }}</th>
                <th class="text-right">{{ t('EconomyMines.ColumnValue') }}</th>
                <th class="text-right">{{ t('EconomyMines.ColumnHours') }}</th>
                <th class="text-right">{{ t('EconomyMines.ColumnSalary') }}</th>
                <th class="text-right">{{ t('EconomyMines.ColumnMaintenanceValue') }}</th>
                <th class="text-right">{{ t('EconomyMines.ColumnBalance') }}</th>
              </tr>
            </thead>
            <tbody class="tabular-nums">
              <tr v-for="line in current.bilan.lines" :key="lineKey(line)" class="border-b border-slate-300">
                <td class="py-2 pr-3 font-bold whitespace-nowrap">#{{ line.number }} {{ line.label }}</td>
                <td class="py-2 text-right">{{ current.levels.get(lineKey(line)) ?? '—' }}</td>
                <td class="py-2 text-right whitespace-nowrap">{{ num(line.production) }} {{ unit(line.resource) }}</td>
                <td class="py-2 text-right">{{ num(line.valeur) }}</td>
                <td class="py-2 text-right">{{ num(line.heures) }}</td>
                <td class="py-2 text-right">{{ num(line.salaire) }}</td>
                <td class="py-2 text-right">{{ num(line.entretien) }}</td>
                <td :class="['py-2 text-right font-bold', line.solde >= 0 ? 'text-green-800' : 'text-red-700']">{{ num(line.solde) }}</td>
              </tr>
              <tr class="font-bold" data-testid="registry-current-total">
                <td class="py-2">{{ t('EconomyMines.TotalLabel') }}</td>
                <td></td>
                <td></td>
                <td class="py-2 text-right">{{ num(current.bilan.total.valeur) }}</td>
                <td class="py-2 text-right">{{ num(current.bilan.total.heures) }}</td>
                <td class="py-2 text-right">{{ num(current.bilan.total.salaire) }}</td>
                <td class="py-2 text-right">{{ num(current.bilan.total.entretien) }}</td>
                <td :class="['py-2 text-right', current.bilan.net >= 0 ? 'text-green-800' : 'text-red-700']">{{ signed(current.bilan.net) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="mt-1 text-xs text-slate-600 dark:text-slate-600">
          {{ t('EconomyMines.RegistryPage.BilanCoverage', { covered: current.bilan.covered, days: current.bilan.days }, current.bilan.covered) }}
          {{ t('EconomyMines.RegistryPage.CurrentPrices') }}
        </p>
      </section>

      <div class="mt-6 grid gap-x-10 gap-y-6 laptop:grid-cols-2">
        <!-- Colonne « mon mandat » -->
        <div class="space-y-6">
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
          <section v-if="registry.mandate" class="registry-section" data-testid="registry-predecessor">
            <h3 class="registry-heading">{{ t('EconomyMines.RegistryPage.PredecessorTitle') }}</h3>
            <ul v-if="registry.predecessor.length" class="mt-1 list-disc list-inside text-sm text-slate-700 dark:text-slate-700">
              <li v-for="p in registry.predecessor" :key="`${p.pseudo}-${p.office_key}`">
                {{ t('EconomyMines.RegistryPage.PredecessorLine', { author: author(p), first: dayMonth(p.first), last: dayMonth(p.last), count: p.count }, p.count) }}
              </li>
            </ul>
            <p v-else class="mt-1 text-sm text-slate-700 dark:text-slate-700">{{ t('EconomyMines.RegistryPage.PredecessorNone') }}</p>
          </section>
        </div>

        <!-- Colonne « la mémoire » -->
        <div class="space-y-6">
          <!-- Historique des niveaux (brief §7) : le registre crédite les améliorations et CONSTATE le reste. -->
          <section v-if="levels.length" class="registry-section" data-testid="registry-levels">
            <h3 class="registry-heading">{{ t('EconomyMines.RegistryPage.LevelsTitle') }}</h3>
            <ul class="mt-1 space-y-1 text-sm text-slate-700 dark:text-slate-700">
              <li v-for="m in levels" :key="m.key">
                <span class="font-bold">#{{ m.number }} {{ m.label }}</span><template v-if="!m.events.length"> — {{ t('EconomyMines.RegistryPage.LevelsNone') }}</template>
                <ul v-if="m.events.length" class="ml-4 list-disc list-inside">
                  <li v-for="e in m.events" :key="e.date" :class="e.type === 'failure' ? 'font-bold text-red-700 dark:text-red-700' : ''" :data-testid="`level-${e.type}`">
                    {{ levelEvent(e) }}
                  </li>
                </ul>
              </li>
            </ul>
          </section>

          <!-- Tout ce qui est inscrit, remplacements compris : rien ne s'efface (brief §3). -->
          <section v-if="registry.reports.length" class="registry-section" data-testid="registry-history">
            <h3 class="registry-heading">{{ t('EconomyMines.RegistryPage.HistoryTitle') }}</h3>
            <ul class="mt-1 text-sm text-slate-700 dark:text-slate-700">
              <li v-for="r in registry.reports" :key="r.id" :class="r.active ? '' : 'text-slate-600 dark:text-slate-600'">
                <span class="tabular-nums">{{ dayMonth(r.reported_at) }}</span> — {{ author(r.author) }}
                <span v-if="!r.active" class="ml-1 italic">{{ t('EconomyMines.RegistryPage.Replaced') }}</span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
  /* Sections : un filet fin au-dessus, pas de carte — la structure porte l'information, pas le décor. */
  .registry-section { border-top: 1px solid #cbd5e1; padding-top: 0.75rem; }
  .registry-heading { font-weight: 700; color: #1e293b; margin-bottom: 0; }
</style>
