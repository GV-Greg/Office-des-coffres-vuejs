<script setup>
  import { ref, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { push } from 'notivue'
  import { useMandateStore, apiMessage } from '@/stores/mandateStore'
  import useDialogFocus from '@/use/useDialogFocus'
  import useNavigationLoading from '@/use/useNavigationLoading'

  /*
    « Déclarer mon poste » sur un mandat de conseiller EN FONCTION (fil mandats-lot2, Q3). La PERTE
    du poste actuel prend effet à l'envoi, sans preuve ; le GAIN attend la validation de Greg. Pas
    de seconde étape — un poste peut changer deux fois par jour —, mais l'avertissement dit les
    trois temps en entier : entre les deux, le joueur n'a aucun poste (tour 19 du lot 1).
  */
  const props = defineProps({
    show: { type: Boolean, required: true },
    mandate: { type: Object, default: null },
  })
  const emit = defineEmits(['close', 'done'])

  const { t, locale } = useI18n()
  const store = useMandateStore()
  const { trackApiCall } = useNavigationLoading()

  const panel = ref(null)
  const close = () => emit('close')
  useDialogFocus(computed(() => props.show), panel, close)

  const NONE = '__none__'
  const choice = ref('')
  const error = ref('')
  const submitting = ref(false)

  watch(() => props.show, (open) => {
    if (!open) return
    choice.value = ''
    error.value = ''
    submitting.value = false
    store.fetchOffices().catch(() => {})
  }, { immediate: true })

  const currentKey = computed(() => props.mandate?.office_key ?? null)
  const currentLabel = computed(() => props.mandate?.office_label?.[locale.value] ?? '')
  const options = computed(() => store.offices
    .filter(o => o.key !== currentKey.value)
    .map(o => ({ key: o.key, label: o.label?.[locale.value] ?? o.key })))

  const submit = () => {
    if (!choice.value || submitting.value) return
    submitting.value = true
    error.value = ''
    trackApiCall(store.declareOffice(props.mandate, choice.value === NONE ? null : choice.value))
      .then(() => {
        emit('done')
        close()
      })
      .catch((e) => {
        error.value = apiMessage(e, locale.value, t('Auth.Errors.NetworkError'))
        push.error(error.value)
      })
      .finally(() => { submitting.value = false })
  }
</script>

<template>
  <div
    v-if="show && mandate"
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="declare-office-title"
  >
    <div class="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" @click="close"></div>

    <div ref="panel" class="relative w-full max-w-md flex flex-col bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
      <div class="h-1.5 bg-gradient-to-r from-orange-400 to-red-600 shrink-0"></div>

      <form class="p-6 space-y-4" @submit.prevent="submit">
        <h3 id="declare-office-title" class="text-lg font-bold text-slate-800 dark:text-slate-100">
          {{ currentKey ? t('Profil.Mandates.Declare.ChangeTitle') : t('Profil.Mandates.Declare.Title') }}
        </h3>

        <div>
          <label for="declare-office" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">{{ t('Profil.Mandates.Declare.Label') }}</label>
          <select id="declare-office" v-model="choice" data-testid="declare-select" class="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2">
            <option value="" disabled>{{ t('Profil.Mandates.Declare.Placeholder') }}</option>
            <option v-for="office in options" :key="office.key" :value="office.key">{{ office.label }}</option>
            <option v-if="currentKey" :value="NONE">{{ t('Profil.Mandates.Declare.None') }}</option>
          </select>
        </div>

        <!-- Les trois temps, au-dessus du bouton : perte immédiate, gain après validation, rien entre. -->
        <p v-if="currentKey" role="note" data-testid="declare-warning" class="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm font-semibold text-yellow-900 dark:text-yellow-900">
          {{ t('Profil.Mandates.Declare.Warning', { office: currentLabel }) }}
        </p>
        <p v-else class="text-sm text-slate-700 dark:text-slate-300">{{ t('Profil.Mandates.Declare.NoCurrent') }}</p>

        <p v-if="error" class="text-sm font-semibold text-red-600 dark:text-red-400" data-testid="declare-error">{{ error }}</p>

        <div class="flex flex-wrap items-center justify-end gap-3">
          <button type="button" class="odc-btn odc-btn--quiet odc-btn--sm odc--slate" @click="close">{{ t('Profil.Mandates.Cancel') }}</button>
          <button type="submit" class="odc-btn odc-btn--soft odc--orange" :disabled="!choice || submitting" data-testid="declare-submit">
            {{ t('Profil.Mandates.Declare.Submit') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
