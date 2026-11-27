<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { push } from 'notivue'
import { useAuthStore } from '@/stores/authStore'
import { apiMessage } from '@/stores/mandateStore'
import { formatFieldDate } from '@/modules/playerDates'
import { FEEDS, feedSetForDay, birthValue, summarizeBirths } from '@/modules/livestock'
import useLivestock from '@/use/useLivestock'
import LivestockTabs from '@/components/livestock/LivestockTabs.vue'
import AccessLoader from '@/components/loading/AccessLoader.vue'
import AccessDenied from '@/components/loading/AccessDenied.vue'

/*
  L'historique des naissances de la province et leur coût. Le bailli et le dirigeant lisent leur province ; un ancien titulaire
  relit sa période (sélecteur de mandat), en lecture seule. Le coût vaut la nourriture prise au prix en vigueur le jour de la
  naissance : sans prix, il est dit absent et le total est annoncé partiel. ⚠️ Aucune règle côté site, aucun auteur n'est servi.
*/
const { t, locale } = useI18n()
const authStore = useAuthStore()
const characterId = computed(() => (authStore.isLoggedIn ? authStore.activeCharacter?.id ?? null : null))
const { book, ready, refresh, pastMandate, withdraw } = useLivestock(characterId)

const pastMandates = computed(() => book.value?.past_mandates ?? [])
const selected = ref('current') // 'current' ou l'id d'un mandat passé
const past = ref(null)
const loadingPast = ref(false)
const confirming = ref(null)
const sending = ref(false)

const canRead = computed(() => !!book.value?.province || pastMandates.value.length > 0)

watch(characterId, () => { selected.value = 'current'; past.value = null; confirming.value = null })
// Sans poste en cours, la page s'ouvre sur le dernier mandat passé.
watch(book, value => {
  if (value && !value.province && value.past_mandates?.length && selected.value === 'current') selected.value = value.past_mandates[0].id
}, { immediate: true })

watch(selected, async value => {
  past.value = null
  confirming.value = null
  if (value === 'current') return
  loadingPast.value = true
  try {
    const data = await pastMandate(value)
    if (selected.value === value) past.value = data
  } catch (error) {
    push.error(apiMessage(error, locale.value, t('Auth.Errors.NetworkError')))
  } finally {
    if (selected.value === value) loadingPast.value = false
  }
})

const shown = computed(() => (selected.value === 'current' ? (book.value?.province ? book.value : null) : past.value))
const births = computed(() => shown.value?.births ?? [])
const prices = computed(() => shown.value?.prices ?? [])
const summary = computed(() => summarizeBirths(births.value, prices.value))
// Prix en cours (ou, pour un mandat passé, à la fin de la période lue).
const latestPrices = computed(() => {
  const day = shown.value?.window?.to ?? book.value?.today
  return day ? feedSetForDay(prices.value, day) : null
})

const num = value => value.toLocaleString(locale.value, { maximumFractionDigits: 2 })
const birthDay = value => formatFieldDate('livestock_birth_day', value, locale.value)
const priceDay = value => formatFieldDate('livestock_price_from', value, locale.value)
const mandateDay = (field, value) => formatFieldDate(field, value, locale.value)
const speciesName = key => t(`EconomyBirths.Species.${key}`)
const unit = key => t(`EconomyBirths.Units.${key}`)
const feedList = feeds => FEEDS.filter(f => feeds[f]).map(f => `${num(feeds[f])} ${unit(f)}`).join(', ')
const value = birth => birthValue(birth, prices.value)

async function remove(birth) {
  if (sending.value) return
  sending.value = true
  try {
    await withdraw(birth.id)
    await refresh()
    push.success(t('EconomyBirths.History.Withdrawn'))
  } catch (error) {
    push.error(apiMessage(error, locale.value, t('Auth.Errors.NetworkError')))
  } finally {
    sending.value = false
    confirming.value = null
  }
}
</script>

<template>
  <div class="w-full max-w-6xl mx-auto">
    <header class="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-slate-300 pb-2">
      <h2 class="!mt-0 !mb-0 text-2xl font-bold text-slate-800 dark:text-slate-800">
        {{ shown?.province ? t('EconomyBirths.History.TitleFor', { province: shown.province.name }) : t('EconomyBirths.History.Title') }}
      </h2>
      <LivestockTabs current="history" />
    </header>

    <AccessLoader v-if="!ready" class="mt-4" icon-class="text-yellow-700 dark:text-yellow-700" />
    <AccessDenied v-else-if="!canRead" class="mt-4" :message="t('EconomyBirths.History.NotReader')" />

    <template v-else>
      <div v-if="pastMandates.length" class="mt-3 flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-700">
          {{ t('EconomyBirths.History.Mandate') }}
          <select v-model="selected" class="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-slate-800" data-testid="births-mandate">
            <option v-if="book.province" value="current">{{ t('EconomyBirths.History.CurrentMandate') }}</option>
            <option v-for="m in pastMandates" :key="m.id" :value="m.id">
              {{ t('EconomyBirths.History.PastMandate', { province: m.province.name, from: mandateDay('livestock_mandate_from', m.in_office_from), to: mandateDay('livestock_mandate_until', m.holds_until) }) }}
            </option>
          </select>
        </label>
        <span v-if="selected !== 'current'" class="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700" data-testid="births-read-only">
          {{ t('EconomyBirths.History.ReadOnly') }}
        </span>
      </div>

      <AccessLoader v-if="loadingPast" class="mt-4" top />

      <div v-else-if="shown" class="mt-4 grid gap-4 laptop:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] laptop:items-start">
        <!-- Ce que les naissances ont coûté, sur la plaque ardoise bordée d'ambre. -->
        <section class="births-plate rounded-2xl px-4 py-4" aria-labelledby="births-total-title">
          <h3 id="births-total-title" class="plate-label !mt-0 !mb-0 text-sm font-bold">{{ t('EconomyBirths.History.TotalTitle') }}</h3>
          <p class="plate-total !m-0 mt-1 text-4xl font-extrabold tabular-nums" data-testid="births-total">
            {{ t('EconomyBirths.History.Ecus', { amount: num(summary.cost) }) }}
          </p>
          <p class="plate-note !m-0 text-sm" data-testid="births-total-animals">{{ t('EconomyBirths.History.Animals', { n: summary.animals }, summary.animals) }}</p>
          <p v-if="summary.unpriced" class="plate-warning mt-2 flex items-start gap-1.5 text-sm font-semibold" data-testid="births-unpriced">
            <v-icon name="fa-exclamation-triangle" class="mt-0.5 shrink-0" aria-hidden="true" />
            {{ t('EconomyBirths.History.Partial', { n: summary.unpriced }, summary.unpriced) }}
          </p>

          <ul v-if="summary.rows.length" class="plate-rule mt-3 space-y-2 pt-3">
            <li v-for="row in summary.rows" :key="row.species" class="flex items-baseline justify-between gap-3" :data-testid="`births-total-${row.species}`">
              <span class="min-w-0">
                <span class="plate-total block text-sm font-bold">{{ speciesName(row.species) }} × {{ row.animals }}</span>
                <span class="plate-note block text-xs">{{ feedList(row.feeds) }}</span>
              </span>
              <span class="plate-label shrink-0 text-sm font-bold tabular-nums">{{ t('EconomyBirths.History.Ecus', { amount: num(row.cost) }) }}</span>
            </li>
          </ul>

          <div class="plate-rule mt-3 pt-3" data-testid="births-current-prices">
            <template v-if="latestPrices">
              <p class="plate-note !m-0 text-xs">{{ t('EconomyBirths.History.PricesSince', { date: priceDay(latestPrices.effective_from) }) }}</p>
              <ul class="plate-total mt-1 grid grid-cols-2 gap-x-4 text-xs tabular-nums">
                <li v-for="feed in FEEDS" :key="feed" class="flex justify-between gap-2">
                  <span>{{ t(`EconomyBirths.Ingredients.${feed}`) }}</span>
                  <span class="font-bold">{{ latestPrices.prices[feed] === null ? '–' : num(latestPrices.prices[feed]) }}</span>
                </li>
              </ul>
            </template>
            <p v-else class="plate-note !m-0 text-xs">{{ t('EconomyBirths.History.NoPrices') }}</p>
          </div>
        </section>

        <!-- Les naissances, les plus récentes d'abord. -->
        <section class="overflow-hidden rounded-2xl border border-slate-300 bg-white" aria-labelledby="births-list-title">
          <h3 id="births-list-title" class="!mt-0 !mb-0 border-b border-slate-300 px-4 py-2 text-sm font-bold text-slate-800 dark:text-slate-800">{{ t('EconomyBirths.History.ListTitle') }}</h3>
          <p v-if="!births.length" class="!m-0 px-4 py-6 text-center text-sm text-slate-600 dark:text-slate-600" data-testid="births-empty">{{ t('EconomyBirths.History.Empty') }}</p>
          <ul v-else class="max-h-[28rem] divide-y divide-slate-200 overflow-y-auto">
            <li v-for="birth in births" :key="birth.id" class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2" data-testid="births-row">
              <span class="text-sm font-semibold tabular-nums text-slate-600">{{ birthDay(birth.born_on) }}</span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-bold text-slate-800">{{ speciesName(birth.species) }} × {{ birth.quantity }}</span>
                <span class="block text-xs text-slate-600">
                  {{ num(birth.taken) }} {{ unit(birth.ingredient) }}<template v-if="birth.wasted > 0">, {{ t('EconomyBirths.Lost', { waste: num(birth.wasted) }) }}</template>
                </span>
              </span>
              <span class="text-sm font-bold tabular-nums text-slate-800">
                {{ value(birth) === null ? t('EconomyBirths.History.Unpriced') : t('EconomyBirths.History.Ecus', { amount: num(value(birth)) }) }}
              </span>
              <template v-if="birth.can_withdraw">
                <span v-if="confirming === birth.id" class="flex w-full flex-wrap items-center justify-end gap-2" role="alert">
                  <span class="text-sm font-semibold text-slate-800">{{ t('EconomyBirths.History.ConfirmWithdraw') }}</span>
                  <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--red" :disabled="sending" data-testid="births-withdraw-confirm" @click="remove(birth)">{{ t('EconomyBirths.History.Withdraw') }}</button>
                  <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--slate" @click="confirming = null">{{ t('EconomyBirths.History.Keep') }}</button>
                </span>
                <button v-else type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--red" data-testid="births-withdraw" @click="confirming = birth.id">
                  <v-icon name="fa-times" aria-hidden="true" />{{ t('EconomyBirths.History.Withdraw') }}
                </button>
              </template>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
  .births-plate {
    background: linear-gradient(160deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid #d97706;
    box-shadow: inset 0 1px 0 rgb(253 230 138 / 0.18), 0 6px 16px -8px rgb(69 26 3 / 0.55);
  }
  .plate-label { color: #fde68a; }
  .plate-total { color: #fef3c7; }
  .plate-note { color: #cbd5e1; }
  .plate-warning { color: #fdba74; }
  .plate-rule { border-top: 1px solid rgb(180 83 9 / 0.6); }
</style>
