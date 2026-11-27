<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { push } from 'notivue'
import { apiMessage } from '@/stores/mandateStore'
import { SPECIES } from '@/modules/birthCosts'
import { formatFieldDate } from '@/modules/playerDates'
import { toGameDateIso, toRealDateIso } from '@/modules/gameCalendar'
import { FEEDS, feedSetForDay, feedFormFrom, feedBodyFromForm } from '@/modules/livestock'

/*
  Mon bureau, « Cheptel » : les espèces élevées dans la province (bailli ou dirigeant) et le prix de la nourriture qui les fait
  naître (bailli, jusqu'au terme de son mandat ; le dirigeant lit). Un jeu de prix vaut à partir de sa date ; il se corrige, il
  ne se supprime pas. ⚠️ Aucune règle côté site : `can_price`, `editable` et les refus viennent du serveur.
*/
const props = defineProps({
  book: { type: Object, required: true },
  api: { type: Object, required: true }, // { saveSpecies, createPrice, updatePrice, refresh }
})
const { t, locale } = useI18n()

// --- Espèces ---
const chosen = ref([])
watch(() => props.book.species, species => { chosen.value = [...(species ?? [])] }, { immediate: true })
const changed = computed(() => props.book.species === null || [...chosen.value].sort().join() !== [...props.book.species].sort().join())
const savingSpecies = ref(false)
const toggle = key => {
  chosen.value = chosen.value.includes(key) ? chosen.value.filter(k => k !== key) : [...chosen.value, key]
}

const fail = error => push.error(apiMessage(error, locale.value, t('Auth.Errors.NetworkError')))

async function saveSpecies() {
  if (savingSpecies.value) return
  savingSpecies.value = true
  try {
    await props.api.saveSpecies(chosen.value)
    await props.api.refresh()
    push.success(t('MonBureau.Livestock.SpeciesSaved'))
  } catch (error) {
    fail(error)
  } finally {
    savingSpecies.value = false
  }
}

// --- Prix de la nourriture ---
const editing = ref(null) // jeu en cours de correction ; null = nouveau jeu
const form = reactive(feedFormFrom(null, ''))
const savingPrice = ref(false)
// Un nouveau jeu repart des prix en vigueur aujourd'hui : on ne change que ce qui a bougé.
const reset = () => {
  editing.value = null
  Object.assign(form, feedFormFrom(feedSetForDay(props.book.prices, props.book.today), props.book.today))
}
watch(() => [props.book.prices, props.book.today], reset, { immediate: true })
const edit = set => {
  editing.value = set
  Object.assign(form, feedFormFrom(set, set.effective_from))
}
const gameDate = computed({
  get: () => toGameDateIso(form.effective_from),
  set: value => { form.effective_from = toRealDateIso(value) },
})
const body = computed(() => feedBodyFromForm(form))

async function savePrice() {
  if (savingPrice.value || !body.value) return
  savingPrice.value = true
  try {
    // Un jeu existe déjà à cette date : on le corrige (le serveur refuse le doublon).
    const target = editing.value ?? props.book.prices.find(p => p.effective_from === body.value.effective_from)
    if (target) await props.api.updatePrice(target.id, body.value)
    else await props.api.createPrice(body.value)
    await props.api.refresh()
    push.success(t('MonBureau.Livestock.PriceSaved'))
  } catch (error) {
    fail(error)
  } finally {
    savingPrice.value = false
  }
}

const day = value => formatFieldDate('livestock_price_from', value, locale.value)
const money = value => (value === null ? '–' : value.toLocaleString(locale.value, { maximumFractionDigits: 2 }))
</script>

<template>
  <div class="flex flex-col gap-5">
    <fieldset data-testid="livestock-species">
      <legend class="mb-1 text-sm font-bold text-slate-800 dark:text-slate-800">{{ t('MonBureau.Livestock.SpeciesTitle') }}</legend>
      <p class="mb-2 text-sm text-slate-600 dark:text-slate-600">{{ t('MonBureau.Livestock.SpeciesDesc') }}</p>
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="s in SPECIES"
          :key="s.key"
          type="button"
          class="odc-btn odc-btn--soft odc-btn--sm"
          :class="chosen.includes(s.key) ? 'odc--gold' : 'odc--slate'"
          :aria-pressed="chosen.includes(s.key)"
          :data-testid="`livestock-species-${s.key}`"
          @click="toggle(s.key)"
        >
          <v-icon v-if="chosen.includes(s.key)" name="fa-check" aria-hidden="true" />{{ t(`EconomyBirths.Species.${s.key}`) }}
        </button>
        <button type="button" class="ml-auto odc-btn odc-btn--soft odc-btn--sm odc--green" :disabled="!changed || savingSpecies" data-testid="livestock-species-save" @click="saveSpecies">
          {{ t('MonBureau.Livestock.Save') }}
        </button>
      </div>
    </fieldset>

    <section class="border-t border-slate-200 pt-4" aria-labelledby="livestock-prices-title">
      <h3 id="livestock-prices-title" class="!mt-0 !mb-1 text-sm font-bold text-slate-800 dark:text-slate-800">{{ t('MonBureau.Livestock.PricesTitle') }}</h3>
      <p class="mb-3 text-sm text-slate-600 dark:text-slate-600">{{ book.can_price ? t('MonBureau.Livestock.PricesDesc') : t('MonBureau.Livestock.PricesReadOnly') }}</p>

      <form v-if="book.can_price" class="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3" data-testid="livestock-price-form" @submit.prevent="savePrice">
        <div class="grid grid-cols-2 gap-3 tablet:grid-cols-5">
          <label class="col-span-2 text-xs font-semibold text-slate-700 tablet:col-span-1">
            {{ t('MonBureau.Livestock.EffectiveFrom') }}
            <input v-model="gameDate" type="date" :max="toGameDateIso(book.today)" :disabled="!!editing" required
                   class="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800" data-testid="livestock-price-date" />
          </label>
          <label v-for="feed in FEEDS" :key="feed" class="text-xs font-semibold text-slate-700">
            {{ t(`EconomyBirths.Ingredients.${feed}`) }}
            <input v-model="form.prices[feed]" inputmode="decimal"
                   class="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm tabular-nums text-slate-800" :data-testid="`livestock-price-${feed}`" />
          </label>
        </div>
        <div class="mt-3 flex flex-wrap items-center justify-end gap-2">
          <button v-if="editing" type="button" class="mr-auto odc-btn odc-btn--soft odc-btn--sm odc--red" data-testid="livestock-price-cancel" @click="reset">{{ t('MonBureau.Livestock.Cancel') }}</button>
          <button type="submit" class="odc-btn odc-btn--soft odc-btn--sm odc--green" :disabled="!body || savingPrice" data-testid="livestock-price-save">
            {{ editing ? t('MonBureau.Livestock.Update') : t('MonBureau.Livestock.AddPrice') }}
          </button>
        </div>
      </form>

      <p v-if="!book.prices.length" class="text-sm text-slate-600 dark:text-slate-600" data-testid="livestock-no-prices">{{ t('MonBureau.Livestock.NoPrices') }}</p>
      <div v-else class="max-h-72 overflow-auto">
        <table class="w-full text-sm text-slate-800">
          <thead>
            <tr class="border-b border-slate-300 text-left text-xs">
              <th scope="col" class="py-1 pr-3">{{ t('MonBureau.Livestock.EffectiveFrom') }}</th>
              <th v-for="feed in FEEDS" :key="feed" scope="col" class="py-1 pr-3 text-right">{{ t(`EconomyBirths.Ingredients.${feed}`) }}</th>
              <th scope="col" class="py-1"><span class="sr-only">{{ t('MonBureau.Livestock.Edit') }}</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="set in book.prices" :key="set.id" class="border-b border-slate-100" data-testid="livestock-price-row">
              <td class="py-1.5 pr-3 font-semibold tabular-nums">{{ day(set.effective_from) }}</td>
              <td v-for="feed in FEEDS" :key="feed" class="py-1.5 pr-3 text-right tabular-nums">{{ money(set.prices[feed]) }}</td>
              <td class="py-1.5 text-right">
                <button v-if="set.editable" type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--green" :data-testid="`livestock-price-edit-${set.id}`" @click="edit(set)">
                  <v-icon name="fa-edit" aria-hidden="true" />{{ t('MonBureau.Livestock.Edit') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
