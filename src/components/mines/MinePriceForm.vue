<script setup>
  import { reactive, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { RESOURCES, formFromSet, isDirty, isComplete, bodyFromForm } from '@/modules/minePrices'
  import { todayIso } from '@/modules/mineParser'

  /*
    Formulaire d'un jeu de prix (lot 2 des prix du Registre, brief admin/content/brief-prix-registre.md) :
    date d'effet, cinq prix, taux horaire. Partagé par la modale rapide du registre et par la page de
    l'historique (ajout et correction). Aucune règle : le serveur décide (autorisation, date couverte,
    doublon) et ses refus s'affichent tels quels, dans la langue de l'interface (`error`).

    « Mettre à jour » n'apparaît que si un champ a changé par rapport à ce qui est affiché (brief). Un
    formulaire neuf, sans jeu de départ, la propose dès qu'il est complet.
  */
  const props = defineProps({
    initial: { type: Object, default: null }, // jeu de départ (prix actuels, ou jeu à corriger)
    date: { type: String, default: null },    // date d'effet proposée (aujourd'hui par défaut)
    dateLocked: { type: Boolean, default: false },
    submitLabel: { type: String, required: true },
    submitting: { type: Boolean, default: false },
    error: { type: String, default: '' },
    idPrefix: { type: String, default: 'price' },
  })
  const emit = defineEmits(['submit', 'cancel'])

  const { t } = useI18n()
  const startDate = () => props.date ?? props.initial?.effective_from ?? todayIso()
  const original = computed(() => formFromSet(props.initial, startDate()))
  const form = reactive(formFromSet(props.initial, startDate()))

  // Un autre jeu de départ (rechargement des prix, autre ligne) repart de ses valeurs.
  watch(() => [props.initial, props.date], () => Object.assign(form, formFromSet(props.initial, startDate())))

  // Sans jeu de départ, tout champ rempli est « modifié » : on exige seulement un formulaire complet.
  const canSubmit = computed(() => isComplete(form) && (!props.initial || isDirty(form, original.value)))
  const submit = () => { if (canSubmit.value && !props.submitting) emit('submit', bodyFromForm(form)) }
</script>

<template>
  <form class="space-y-3" data-testid="price-form" @submit.prevent="submit">
    <div>
      <label :for="`${idPrefix}-date`" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">{{ t('EconomyMines.RegistryPage.Prices.EffectiveFrom') }}</label>
      <input :id="`${idPrefix}-date`" v-model="form.effective_from" type="date" :max="todayIso()" :disabled="dateLocked"
             class="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2" data-testid="price-date" />
    </div>

    <div class="grid grid-cols-2 gap-x-4 gap-y-3">
      <div v-for="resource in [...RESOURCES, 'RATE']" :key="resource">
        <label :for="`${idPrefix}-${resource}`" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
          {{ resource === 'RATE' ? t('EconomyMines.RegistryPage.Prices.HourlyRate') : t(`EconomyMines.RegistryPage.Prices.Resource.${resource}`) }}
        </label>
        <div class="flex items-center gap-1">
          <input :id="`${idPrefix}-${resource}`" v-if="resource === 'RATE'" v-model="form.hourly_rate" inputmode="decimal"
                 class="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 tabular-nums" data-testid="price-RATE" />
          <input :id="`${idPrefix}-${resource}`" v-else v-model="form.prices[resource]" inputmode="decimal"
                 class="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 tabular-nums" :data-testid="`price-${resource}`" />
          <span class="text-sm text-slate-700 dark:text-slate-300">{{ t('EconomyMines.Currency') }}</span>
        </div>
      </div>
    </div>

    <p v-if="error" role="alert" class="text-sm font-semibold text-red-600 dark:text-red-400" data-testid="price-error">{{ error }}</p>

    <div class="flex flex-wrap items-center justify-end gap-3">
      <button type="button" class="odc-btn odc-btn--quiet odc-btn--sm odc--slate" @click="emit('cancel')">{{ t('EconomyMines.RegistryPage.Prices.Cancel') }}</button>
      <button v-if="canSubmit" type="submit" class="odc-btn odc-btn--soft odc--gold" :disabled="submitting" data-testid="price-submit">{{ submitLabel }}</button>
    </div>
  </form>
</template>
