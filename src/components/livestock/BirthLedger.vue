<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { push } from 'notivue'
import { apiMessage } from '@/stores/mandateStore'
import { formatFieldDate } from '@/modules/playerDates'
import { FEEDS, feedSetForDay, birthValue, summarizeBirths, ecusChoice } from '@/modules/livestock'
import AccessLoader from '@/components/loading/AccessLoader.vue'
import ReportCard from '@/components/customs/ReportCard.vue'

/*
  Le registre des naissances, à côté du calculateur, UN JOUR à la fois : la date en grand, ce que la nourriture de ce jour a coûté,
  puis ses naissances. La page s'ouvre sur aujourd'hui ; les flèches vont d'un jour qui a des naissances à l'autre. Le bailli et
  le dirigeant lisent leur province ; un ancien titulaire relit sa période (choix du mandat), en lecture seule. Le coût vaut la
  nourriture prise au prix en vigueur le jour de la naissance : sans prix, il est dit absent et le total est annoncé partiel.
  ⚠️ Aucune règle côté site, aucun auteur n'est servi. Un autre personnage : le parent recrée le composant (`:key`).
*/
const props = defineProps({
  book: { type: Object, required: true },
  api: { type: Object, required: true }, // { pastMandate, withdraw, refresh }
  freshId: { type: Number, default: null }, // la naissance qui vient d'être inscrite : sa ligne s'illumine une fois
})
const { t, locale } = useI18n()

const pastMandates = computed(() => props.book.past_mandates ?? [])
const selected = ref('current') // 'current' ou l'id d'un mandat passé
const past = ref(null)
const loadingPast = ref(false)
const confirming = ref(null)
const sending = ref(false)
const day = ref(null) // le jour affiché (date réelle)

// Sans poste en cours, le registre s'ouvre sur le dernier mandat passé.
watch(() => props.book, book => {
  if (!book.province && selected.value === 'current' && book.past_mandates?.length) selected.value = book.past_mandates[0].id
}, { immediate: true })

watch(selected, async value => {
  past.value = null
  confirming.value = null
  day.value = null
  if (value === 'current') return
  loadingPast.value = true
  try {
    const data = await props.api.pastMandate(value)
    if (selected.value === value) past.value = data
  } catch (error) {
    push.error(apiMessage(error, locale.value, t('Auth.Errors.NetworkError')))
  } finally {
    if (selected.value === value) loadingPast.value = false
  }
}, { immediate: true })

const shown = computed(() => (selected.value === 'current' ? (props.book.province ? props.book : null) : past.value))
const births = computed(() => shown.value?.births ?? [])
const prices = computed(() => shown.value?.prices ?? [])
// Le jour d'ouverture : aujourd'hui pour le mandat en cours, la dernière naissance pour un mandat passé.
const today = computed(() => (selected.value === 'current' ? props.book.today : null))
// Les jours où l'on peut aller : ceux qui ont des naissances, aujourd'hui, et celui qu'on regarde.
const days = computed(() => [...new Set([...births.value.map(b => b.born_on), today.value, day.value].filter(Boolean))].sort())
const position = computed(() => days.value.indexOf(day.value))
const older = computed(() => days.value[position.value - 1] ?? null)
const newer = computed(() => days.value[position.value + 1] ?? null)
watch(shown, value => {
  if (value && !day.value) day.value = today.value ?? days.value[days.value.length - 1] ?? value.window?.to ?? null
}, { immediate: true })
// Une naissance qu'on vient d'inscrire se montre : le registre va à son jour.
watch(() => {
  const fresh = births.value.find(b => b.id === props.freshId)
  return fresh ? `${fresh.id}|${fresh.born_on}` : ''
}, key => { if (key) day.value = key.split('|')[1] })
watch(day, () => { confirming.value = null })

const dayBirths = computed(() => births.value.filter(b => b.born_on === day.value))
const summary = computed(() => summarizeBirths(dayBirths.value, prices.value))
// Les prix en vigueur le jour affiché.
const dayPrices = computed(() => (day.value ? feedSetForDay(prices.value, day.value) : null))

const num = value => value.toLocaleString(locale.value, { maximumFractionDigits: 2 })
const birthDay = value => formatFieldDate('livestock_birth_day', value, locale.value)
const priceDay = value => formatFieldDate('livestock_price_from', value, locale.value)
const mandateDay = (field, value) => formatFieldDate(field, value, locale.value)
const speciesName = key => t(`EconomyBirths.Species.${key}`)
const unit = key => t(`EconomyBirths.Units.${key}`)
const ecus = amount => t('EconomyBirths.History.Ecus', { amount: num(amount) }, ecusChoice(amount, locale.value))
const value = birth => birthValue(birth, prices.value)

async function remove(birth) {
  if (sending.value) return
  sending.value = true
  try {
    await props.api.withdraw(birth.id)
    await props.api.refresh()
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
  <!-- La même carte que le calculateur : la date entre ◀ ▶, un tableau à en-tête de la signature avec sa ligne Total, et au bas
       les prix du jour. Corps clair dans les deux thèmes : couleurs posées en `dark:` (règle globale `.dark p`). -->
  <ReportCard :title="t('EconomyBirths.History.CardTitle')" tone="gold" fill testid="births-ledger">
    <div v-if="pastMandates.length" class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      <label class="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-800">
        {{ t('EconomyBirths.History.Mandate') }}
        <select v-model="selected" class="min-w-0 rounded p-1 font-normal" data-testid="births-mandate">
          <option v-if="book.province" value="current">{{ t('EconomyBirths.History.CurrentMandate') }}</option>
          <option v-for="m in pastMandates" :key="m.id" :value="m.id">
            {{ t('EconomyBirths.History.PastMandate', { province: m.province.name, from: mandateDay('livestock_mandate_from', m.in_office_from), to: mandateDay('livestock_mandate_until', m.holds_until) }) }}
          </option>
        </select>
      </label>
      <p v-if="selected !== 'current'" class="!m-0 text-sm italic text-slate-700 dark:text-slate-700" data-testid="births-read-only">{{ t('EconomyBirths.History.ReadOnly') }}</p>
    </div>

    <div class="flex items-center justify-center gap-3">
      <button type="button" class="odc-btn odc-btn--soft odc-btn--rect odc-btn--icon odc-btn--sm odc--slate" :disabled="!older" :aria-label="t('EconomyBirths.History.Older')" :title="t('EconomyBirths.History.Older')" data-testid="births-older" @click="day = older">
        <v-icon name="fa-chevron-left" scale="0.9" aria-hidden="true" />
      </button>
      <p class="!m-0 text-base font-bold text-slate-800 dark:text-slate-800" aria-live="polite">
        {{ t('EconomyBirths.History.DayTitle') }}
        <span class="ledger-day ml-1 whitespace-nowrap text-2xl font-extrabold tabular-nums" data-testid="births-day">{{ day ? birthDay(day) : '' }}</span>
      </p>
      <button type="button" class="odc-btn odc-btn--soft odc-btn--rect odc-btn--icon odc-btn--sm odc--slate" :disabled="!newer" :aria-label="t('EconomyBirths.History.Newer')" :title="t('EconomyBirths.History.Newer')" data-testid="births-newer" @click="day = newer">
        <v-icon name="fa-chevron-right" scale="0.9" aria-hidden="true" />
      </button>
    </div>

    <AccessLoader v-if="loadingPast" class="mt-3" top />
    <p v-else-if="!dayBirths.length" class="!mb-0 mt-3 text-sm text-slate-700 dark:text-slate-700" data-testid="births-empty">{{ t('EconomyBirths.History.Empty') }}</p>
    <!-- Beaucoup de naissances : la liste défile dans sa case, jamais la page. -->
    <div v-else class="ledger-frame mb-3 mt-3 max-h-[20rem] overflow-auto rounded-lg" tabindex="0" role="region" :aria-label="t('EconomyBirths.History.ListTitle')">
      <table class="ledger-table w-full text-sm">
        <thead class="sticky top-0">
          <tr>
            <th scope="col">{{ t('EconomyBirths.History.Columns.Birth') }}</th>
            <th scope="col">{{ t('EconomyBirths.History.Columns.Food') }}</th>
            <th scope="col" class="!text-right">{{ t('EconomyBirths.History.Columns.Cost') }}</th>
            <th scope="col"><span class="sr-only">{{ t('EconomyBirths.History.Withdraw') }}</span></th>
          </tr>
        </thead>
        <tbody class="tabular-nums">
          <template v-for="birth in dayBirths" :key="birth.id">
            <tr class="ledger-row" :class="{ 'is-fresh': birth.id === freshId }" data-testid="births-row">
              <td class="whitespace-nowrap !py-2 font-bold">{{ speciesName(birth.species) }} × {{ birth.quantity }}</td>
              <td class="!py-2">
                {{ num(birth.taken) }} {{ unit(birth.ingredient) }}
                <span v-if="birth.wasted > 0" class="block text-xs text-slate-600">{{ t('EconomyBirths.Lost', { waste: num(birth.wasted) }) }}</span>
              </td>
              <td class="whitespace-nowrap !py-2 text-right font-bold">{{ value(birth) === null ? t('EconomyBirths.History.Unpriced') : ecus(value(birth)) }}</td>
              <td class="w-px !py-1 text-right">
                <button
                  v-if="birth.can_withdraw"
                  type="button"
                  class="odc-btn odc-btn--soft odc-btn--rect odc-btn--icon odc-btn--sm odc--red"
                  :disabled="confirming === birth.id"
                  :aria-label="t('EconomyBirths.History.WithdrawLabel', { species: speciesName(birth.species), n: birth.quantity })"
                  :title="t('EconomyBirths.History.Withdraw')"
                  data-testid="births-withdraw"
                  @click="confirming = birth.id"
                >
                  <v-icon name="fa-trash-alt" scale="0.9" aria-hidden="true" />
                </button>
              </td>
            </tr>
            <tr v-if="confirming === birth.id" class="ledger-row">
              <td colspan="4" class="!py-2">
                <div class="flex flex-wrap items-center justify-between gap-2" role="alert">
                  <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--red" data-testid="births-withdraw-cancel" @click="confirming = null">{{ t('EconomyBirths.History.Cancel') }}</button>
                  <span class="font-bold">{{ t('EconomyBirths.History.ConfirmWithdraw') }}</span>
                  <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--green" :disabled="sending" data-testid="births-withdraw-confirm" @click="remove(birth)">{{ t('EconomyBirths.History.Confirm') }}</button>
                </div>
              </td>
            </tr>
          </template>
          <tr class="ledger-total font-bold">
            <td class="!py-2">{{ t('EconomyBirths.History.Total') }}</td>
            <td class="!py-2" data-testid="births-total-animals">{{ t('EconomyBirths.History.Animals', { n: summary.animals }, summary.animals) }}</td>
            <td class="whitespace-nowrap !py-2 text-right text-base" data-testid="births-total">{{ ecus(summary.cost) }}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="summary.unpriced" role="note" class="!mb-2 mt-1 text-xs font-semibold text-orange-800 dark:text-orange-800" data-testid="births-unpriced">
      {{ t('EconomyBirths.History.Partial', { n: summary.unpriced }, summary.unpriced) }}
    </p>

    <div v-if="shown && !loadingPast" class="-mx-3 -mb-3 mt-auto flex min-h-[3.5rem] flex-col justify-center rounded-b-lg border-t border-slate-200 bg-slate-50 px-3 py-2" data-testid="births-current-prices">
      <template v-if="dayPrices">
        <p class="!m-0 text-xs font-bold text-slate-700 dark:text-slate-700">{{ t('EconomyBirths.History.PricesSince', { date: priceDay(dayPrices.effective_from) }) }}</p>
        <dl class="flex flex-wrap gap-x-5 text-sm">
          <div v-for="feed in FEEDS" :key="feed" class="flex gap-1">
            <dt class="text-slate-700 dark:text-slate-700">{{ t(`EconomyBirths.Ingredients.${feed}`) }}</dt>
            <dd class="font-bold tabular-nums text-slate-800 dark:text-slate-800">{{ dayPrices.prices[feed] === null ? '–' : ecus(dayPrices.prices[feed]) }}</dd>
          </div>
        </dl>
      </template>
      <p v-else class="!m-0 text-sm text-slate-700 dark:text-slate-700">{{ t('EconomyBirths.History.NoPrices') }}</p>
    </div>
  </ReportCard>
</template>

<style scoped>
  /* Le tableau reprend les matières des cases de la carte voisine : en-tête et ligne Total à l'or foncé comme la case choisie,
     lignes cernées d'un filet sable. Il remplace ici l'en-tête de la signature. */
  .ledger-day { color: #713f12; }
  .ledger-frame { border: 1px solid #c9a26b; }
  .ledger-table thead { background: linear-gradient(180deg, #a16207 0%, #713f12 100%); color: #ffffff; }
  .ledger-row { border-bottom: 1px solid #e7d7c1; }
  .ledger-row:hover { background-color: #ffffff; }
  .ledger-total { background: linear-gradient(180deg, #a16207 0%, #713f12 100%); color: #ffffff; }
  /* La naissance qu'on vient d'inscrire : un éclat doré, une fois (charte §8). */
  .is-fresh { animation: fresh 2.4s ease 1 both; }
  @keyframes fresh { 0%, 40% { background-color: #e9d5b5; } 100% { background-color: transparent; } }
</style>
