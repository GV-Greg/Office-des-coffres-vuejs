<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { push } from 'notivue'
import { apiMessage } from '@/stores/mandateStore'
import { toGameDateIso, toRealDateIso } from '@/modules/gameCalendar'
import { feedPrice } from '@/modules/livestock'

/*
  « Inscrire la naissance » : le lot choisi dans le calculateur, pour un jour du mandat (aujourd'hui par défaut). Montré au seul
  bailli en poste (`can_record`). La date se lit et se saisit en année du JEU ; l'API reçoit la date réelle.
  ⚠️ Aucune règle côté site : la plage proposée et les refus viennent du serveur.
*/
const props = defineProps({
  book: { type: Object, required: true },
  birth: { type: Object, required: true }, // { species, ingredient, quantity, taken, wasted }
  record: { type: Function, required: true },
})
const emit = defineEmits(['recorded'])
const { t, locale } = useI18n()

const day = ref(props.book.today)
const sending = ref(false)
const sealed = ref(false)
watch(() => props.book.today, today => { day.value = today })
watch(() => [props.birth.species, props.birth.ingredient, props.birth.quantity, day.value], () => { sealed.value = false })

const gameDay = computed({
  get: () => toGameDateIso(day.value),
  set: value => { day.value = toRealDateIso(value) },
})
const price = computed(() => (day.value ? feedPrice(props.book.prices, day.value, props.birth.ingredient) : null))
const cost = computed(() => (price.value === null ? null : Math.round(props.birth.taken * price.value * 100) / 100))
const num = value => value.toLocaleString(locale.value, { maximumFractionDigits: 2 })

async function submit() {
  if (sending.value || !day.value) return
  sending.value = true
  try {
    await props.record({ born_on: day.value, ...props.birth })
    sealed.value = true
    push.success(t('EconomyBirths.Record.Saved'))
    emit('recorded')
  } catch (error) {
    push.error(apiMessage(error, locale.value, t('Auth.Errors.NetworkError')))
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <form class="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-slate-300 bg-yellow-50 px-4 py-3" data-testid="births-record" @submit.prevent="submit">
    <label class="flex items-center gap-2 text-sm font-semibold text-slate-700">
      {{ t('EconomyBirths.Record.Day') }}
      <input
        v-model="gameDay"
        type="date"
        :min="toGameDateIso(book.first_day)"
        :max="toGameDateIso(book.today)"
        required
        class="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-slate-800"
        data-testid="births-record-day"
      />
    </label>
    <span class="text-sm text-slate-700" data-testid="births-record-cost">
      {{ cost === null ? t('EconomyBirths.Record.NoPrice') : t('EconomyBirths.Record.Cost', { cost: num(cost) }) }}
    </span>
    <span class="flex items-center gap-3">
      <span v-if="sealed" class="flex items-center gap-1.5 text-sm font-semibold text-green-900" role="status" data-testid="births-record-done">
        <v-icon name="fa-check-circle" aria-hidden="true" />{{ t('EconomyBirths.Record.Done') }}
      </span>
      <button type="submit" class="odc-btn odc-btn--soft odc--green" :disabled="sending || !day" :aria-busy="sending" data-testid="births-record-save">
        <v-icon name="gi-quill" aria-hidden="true" />{{ t('EconomyBirths.Record.Save') }}
      </button>
    </span>
  </form>
</template>
