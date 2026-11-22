<script setup>
  import { ref, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { push } from 'notivue'
  import { apiMessage } from '@/stores/mandateStore'
  import { formatFieldDate } from '@/modules/playerDates'
  import { buildSections } from '@/modules/customsPaste'
  import customsApi from '@/use/customsApi'

  /*
    Saisie du bilan du jour (Registre de douane). Trois zones de collage ; le parseur est ICI (frontend, comme les mines), le serveur reçoit
    l'analyse ET le brut gardé, valide la forme, ne re-parse jamais. L'écran DIT la ville et le jour avant l'envoi : un bilan se corrige,
    il ne s'efface pas. ⚠️ Aucune règle ici : qui peut saisir, où et quel jour, vient de `customs-access` ; les refus arrivent en FR et EN.
    Trois façons d'écrire (le serveur tranche, l'écran propose) : créer (le guet est obligatoire), compléter (même auteur, le jour même :
    seules les sections manquantes) ou corriger (prévôt, connétable : une section déjà saisie se remplace).
  */
  const props = defineProps({
    characterId: { type: Number, required: true },
    cityId: { type: Number, required: true },
    cityName: { type: String, required: true },
    day: { type: String, required: true },
    today: { type: String, required: true },
    mode: { type: String, required: true }, // create | complete | correct
    present: { type: Array, default: () => [] }, // sections déjà saisies
  })
  const emit = defineEmits(['saved'])

  const { t, locale } = useI18n()
  const api = customsApi()

  const pastes = ref({ guet: '', visions: '', armiesGroups: '' })
  const sending = ref(false)

  // En mode « compléter », une section déjà saisie n'est plus à coller : le serveur la refuserait.
  const shows = key => props.mode !== 'complete' || !props.present.includes(key)
  const built = computed(() => buildSections(pastes.value, props.day))
  const sectionCount = computed(() => Object.keys(built.value.sections).length)
  const needsGuet = computed(() => props.mode === 'create' && !built.value.sections.guet)
  const canSend = computed(() => sectionCount.value > 0 && !needsGuet.value && !sending.value)
  const dayLabel = computed(() => formatFieldDate('customs_report_day', props.day, locale.value))

  watch(() => [props.cityId, props.day], () => { pastes.value = { guet: '', visions: '', armiesGroups: '' } })

  async function send() {
    if (!canSend.value) return
    sending.value = true
    try {
      const body = { city_id: props.cityId, sections: built.value.sections }
      if (props.day !== props.today) body.date = props.day
      const result = await api.saveReport(props.characterId, body)
      push.success(t(`SecurityCustoms.Form.Sent.${result.mode}`))
      pastes.value = { guet: '', visions: '', armiesGroups: '' }
      emit('saved')
    } catch (error) {
      push.error(apiMessage(error, locale.value, t('Auth.Errors.NetworkError')))
    } finally {
      sending.value = false
    }
  }
</script>

<template>
  <form class="space-y-3 rounded-lg border border-slate-300 bg-white p-4" data-testid="customs-form" @submit.prevent="send">
    <h3 class="!mb-0 text-lg font-bold text-slate-800 dark:text-slate-800">{{ t(`SecurityCustoms.Form.Title.${mode}`) }}</h3>
    <!-- Ville et jour DITS avant l'envoi. -->
    <p class="text-sm text-slate-700 dark:text-slate-700" data-testid="form-target">{{ t('SecurityCustoms.Form.WritesIn', { city: cityName, date: dayLabel }) }}</p>

    <label v-if="shows('guet')" class="block">
      <span class="font-bold text-sm">{{ t(mode === 'create' ? 'SecurityCustoms.Form.GuetRequired' : 'SecurityCustoms.Form.Guet') }}</span>
      <textarea v-model="pastes.guet" rows="6" class="w-full rounded-lg p-2" :placeholder="t('SecurityCustoms.Form.Placeholder')" data-testid="paste-guet"></textarea>
    </label>
    <label v-if="shows('visions')" class="block">
      <span class="font-bold text-sm">{{ t('SecurityCustoms.Form.Visions') }}</span>
      <textarea v-model="pastes.visions" rows="4" class="w-full rounded-lg p-2" :placeholder="t('SecurityCustoms.Form.Placeholder')" data-testid="paste-visions"></textarea>
    </label>
    <label v-if="shows('armies_groups')" class="block">
      <span class="font-bold text-sm">{{ t('SecurityCustoms.Form.ArmiesGroups') }}</span>
      <textarea v-model="pastes.armiesGroups" rows="5" class="w-full rounded-lg p-2" :placeholder="t('SecurityCustoms.Form.Placeholder')" data-testid="paste-armies-groups"></textarea>
    </label>

    <!-- Ce que le serveur recevra, dit avant l'envoi. -->
    <ul class="text-sm space-y-0.5" data-testid="form-summary" aria-live="polite">
      <li v-if="built.summary.guet" :class="built.summary.guet.matches === false ? 'font-bold text-orange-800' : ''">
        {{ t('SecurityCustoms.Form.SummaryGuet', { read: built.summary.guet.read }) }}
        <template v-if="built.summary.guet.matches === false"> — {{ t('SecurityCustoms.Report.TotalMismatch', { declared: built.summary.guet.declared, read: built.summary.guet.read }) }}</template>
      </li>
      <li v-if="built.summary.visions">{{ t('SecurityCustoms.Form.SummaryVisions', { kept: built.summary.visions.kept, other: built.summary.visions.otherDays }) }}</li>
      <li v-if="built.summary.armiesGroups">{{ t('SecurityCustoms.Form.SummaryArmies', { armies: built.summary.armiesGroups.armies, groups: built.summary.armiesGroups.groups }) }}</li>
      <li v-for="problem in built.problems" :key="problem" class="font-bold text-orange-800" role="alert">{{ t(`SecurityCustoms.Form.Problem.${problem}`) }}</li>
      <li v-if="needsGuet && (pastes.visions || pastes.armiesGroups)" class="font-bold text-orange-800" role="alert">{{ t('SecurityCustoms.Form.NeedsGuet') }}</li>
    </ul>

    <button type="submit" class="odc-btn odc-btn--soft odc--green" :disabled="!canSend" data-testid="customs-send">
      <v-icon name="gi-quill" aria-hidden="true" />{{ sending ? t('SecurityCustoms.Form.Sending') : t('SecurityCustoms.Form.Send') }}
    </button>
  </form>
</template>
