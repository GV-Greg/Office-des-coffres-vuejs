<script setup>
  import { ref, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { RouterLink } from 'vue-router'
  import { http } from '@/api.js'
  import { useAuthStore } from '@/stores/authStore'
  import { apiMessage } from '@/stores/mandateStore'
  import { thresholdAlert } from '@/modules/mineParser'

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

  /** État du parc au dernier relevé, avec le constat de seuil (jamais une prédiction, brief Bilan §4). */
  const park = computed(() => (latest.value?.report?.states ?? []).map(state => ({ state, alert: thresholdAlert(state) })))

  /** Jours sans relevé en vigueur depuis l'entrée en fonction du lecteur, jusqu'à hier. */
  const gaps = computed(() => {
    const start = registry.value?.mandate?.in_office_from
    if (!start) return null
    const covered = new Set(active.value.map(r => r.reported_at))
    const out = []
    for (let n = 0; n < daysBetween(start, registry.value.today); n++) {
      const d = new Date(Date.parse(`${start}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
      if (!covered.has(d)) out.push(d)
    }
    return out
  })
</script>

<template>
  <div class="w-full text-slate-800 dark:text-slate-800">
    <p v-if="!character" class="text-slate-700 dark:text-slate-700">{{ t('EconomyMines.RegistryPage.NoCharacter') }}</p>
    <p v-else-if="loading" role="status" class="text-slate-700 dark:text-slate-700">{{ t('EconomyMines.RegistryPage.Loading') }}</p>
    <p v-else-if="error" role="alert" class="text-slate-700 dark:text-slate-700" data-testid="registry-error">{{ error }}</p>

    <template v-else-if="registry">
      <h2 class="text-xl font-bold text-slate-800 dark:text-slate-800">{{ t('EconomyMines.RegistryPage.Title', { province: registry.province.name }) }}</h2>

      <!-- Âge du dernier relevé, affiché en permanence (brief §7). -->
      <p class="mt-1 text-slate-700 dark:text-slate-700" data-testid="registry-age">
        <template v-if="latest">{{ t('EconomyMines.RegistryPage.LastReport', { age: lastAge, date: dayMonth(latest.reported_at) }) }}</template>
        <template v-else>
          {{ t('EconomyMines.RegistryPage.NoReport') }}
          <RouterLink :to="{ name: 'economy-mines' }" class="underline">{{ t('EconomyMines.RegistryPage.ToBilan') }}</RouterLink>
        </template>
      </p>

      <section v-if="park.length" class="mt-6" data-testid="registry-park">
        <h3 class="font-bold text-slate-800 dark:text-slate-800">{{ t('EconomyMines.RegistryPage.ParkTitle', { date: dayMonth(latest.reported_at) }) }}</h3>
        <div class="overflow-x-auto">
          <table class="mt-2 w-full text-sm">
            <thead>
              <tr>
                <th class="text-left">{{ t('EconomyMines.RegistryPage.Mine') }}</th>
                <th class="text-right">{{ t('EconomyMines.RegistryPage.Level') }}</th>
                <th class="text-left">{{ t('EconomyMines.RegistryPage.Threshold') }}</th>
                <th class="text-left">{{ t('EconomyMines.RegistryPage.Upkeep') }}</th>
                <th class="text-left">{{ t('EconomyMines.RegistryPage.Finding') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="{ state, alert } in park" :key="state.noeud ?? state.number" class="border-b border-slate-300">
                <td class="py-2 font-bold">#{{ state.number }} {{ state.label }}</td>
                <td class="py-2 text-right">{{ state.niveau }}</td>
                <td class="py-2">{{ state.seuilRupture }}</td>
                <td class="py-2">{{ state.entretienNormal }}</td>
                <td class="py-2" :class="alert?.level === 'reached' ? 'font-bold text-red-700 dark:text-red-700' : alert ? 'text-orange-800 dark:text-orange-800' : ''">
                  {{ alert ? t(alert.level === 'reached' ? 'EconomyMines.RegistryPage.Reached' : 'EconomyMines.RegistryPage.Near') : '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="gaps" class="mt-6" data-testid="registry-gaps">
        <h3 class="font-bold text-slate-800 dark:text-slate-800">{{ t('EconomyMines.RegistryPage.GapsTitle') }}</h3>
        <p class="text-sm text-slate-700 dark:text-slate-700">
          <template v-if="gaps.length === 0">{{ t('EconomyMines.RegistryPage.GapsNone', { date: dayMonth(registry.mandate.in_office_from) }) }}</template>
          <template v-else>{{ t('EconomyMines.RegistryPage.GapsSome', { count: gaps.length, date: dayMonth(registry.mandate.in_office_from) }, gaps.length) }}
            {{ gaps.map(dayMonth).join(', ') }}</template>
        </p>
      </section>

      <!-- Prédécesseur : des estampilles écrites, jamais « qui occupait le poste » (R4). -->
      <section v-if="registry.mandate" class="mt-6" data-testid="registry-predecessor">
        <h3 class="font-bold text-slate-800 dark:text-slate-800">{{ t('EconomyMines.RegistryPage.PredecessorTitle') }}</h3>
        <ul v-if="registry.predecessor.length" class="list-disc list-inside text-sm text-slate-700 dark:text-slate-700">
          <li v-for="p in registry.predecessor" :key="`${p.pseudo}-${p.office_key}`">
            {{ t('EconomyMines.RegistryPage.PredecessorLine', {
              author: author(p), first: dayMonth(p.first), last: dayMonth(p.last), count: p.count,
            }, p.count) }}
          </li>
        </ul>
        <p v-else class="text-sm text-slate-700 dark:text-slate-700">{{ t('EconomyMines.RegistryPage.PredecessorNone') }}</p>
        <p class="mt-1 text-xs italic text-slate-600 dark:text-slate-600">{{ t('EconomyMines.RegistryPage.PredecessorNote') }}</p>
      </section>

      <!-- Tout ce qui est inscrit, remplacements compris : rien ne s'efface (brief §3). -->
      <section v-if="registry.reports.length" class="mt-6" data-testid="registry-history">
        <h3 class="font-bold text-slate-800 dark:text-slate-800">{{ t('EconomyMines.RegistryPage.HistoryTitle') }}</h3>
        <ul class="text-sm text-slate-700 dark:text-slate-700">
          <li v-for="r in registry.reports" :key="r.id" :class="r.active ? '' : 'text-slate-600 dark:text-slate-600'">
            {{ dayMonth(r.reported_at) }} — {{ author(r.author) }}
            <span v-if="!r.active" class="ml-1 italic">{{ t('EconomyMines.RegistryPage.Replaced') }}</span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
