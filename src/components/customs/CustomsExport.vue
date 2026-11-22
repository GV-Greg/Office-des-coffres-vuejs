<script setup>
  import { ref, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { push } from 'notivue'
  import { formatFieldDate } from '@/modules/playerDates'
  import { customsReportToBBCode, CUSTOMS_EXPORT_DEFAULTS } from '@/modules/customsBBcode'

  /*
    « Confier au scribe » : le bilan affiché, en BBCode (français fixe), au presse-papiers. Rien n'est enregistré ni gardé : les options ne
    vivent que dans cette zone. Un bilan n'est JAMAIS public (politique §6) : l'exporter sur un forum le rend public, c'est le geste de celui qui
    exporte — l'écran le dit avant. L'auteur du bilan n'est jamais nommé, le brut jamais servi.
  */
  const props = defineProps({
    report: { type: Object, required: true },
    cityName: { type: String, default: '' }, // vide : relevé sans ville (Relevé de guet sans titre de sécurité)
    title: { type: String, default: '' },     // titre du dépliant ; par défaut « Confier au scribe »
  })
  const { t } = useI18n()

  const options = ref({ ...CUSTOMS_EXPORT_DEFAULTS })
  const sections = computed(() => props.report.sections ?? {})
  const has = key => !!sections.value[key]

  // Les dates du forum sont en année du JEU, en français : indépendantes de la langue de l'interface.
  const bbcode = computed(() => customsReportToBBCode(withDates(props.report), {
    cityName: props.cityName,
    dayLabel: formatFieldDate('customs_report_day', props.report.reported_on, 'fr'),
    options: options.value,
  }))

  function withDates(report) {
    const diff = report.sections?.guet?.diff
    if (!diff?.compared_to) return report
    const guet = { ...report.sections.guet, diff: { ...diff, comparedLabel: formatFieldDate('customs_report_day', diff.compared_to, 'fr') } }
    return { ...report, sections: { ...report.sections, guet } }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(bbcode.value)
      push.success(t('SecurityCustoms.Export.Copied'))
    } catch {
      // presse-papiers indisponible (contexte non sécurisé, iframe…) : rien de plus à faire
    }
  }
</script>

<template>
  <details class="rounded-lg border border-slate-300 bg-white p-3" data-testid="customs-export">
    <summary class="cursor-pointer font-bold text-slate-800 dark:text-slate-800">{{ title || t('SecurityCustoms.Export.Title') }}</summary>
    <div class="mt-3 space-y-3">
      <p class="text-sm text-slate-800 dark:text-slate-800" data-testid="export-public-warning">{{ t('SecurityCustoms.Export.PublicWarning') }}</p>
      <fieldset class="space-y-1 text-sm text-slate-800">
        <legend class="font-bold">{{ t('SecurityCustoms.Export.Options') }}</legend>
        <label v-if="has('guet')" class="flex items-center gap-2"><input v-model="options.villagers" type="checkbox" data-testid="opt-villagers">{{ t('SecurityCustoms.Export.Villagers') }}</label>
        <label class="flex items-center gap-2"><input v-model="options.colours" type="checkbox" data-testid="opt-colours">{{ t('SecurityCustoms.Export.Colours') }}</label>
        <label v-if="has('visions')" class="flex items-center gap-2"><input v-model="options.visions" type="checkbox" data-testid="opt-visions">{{ t('SecurityCustoms.Export.Visions') }}</label>
        <label v-if="has('armies_groups')" class="flex items-center gap-2"><input v-model="options.armiesGroups" type="checkbox" data-testid="opt-armies">{{ t('SecurityCustoms.Export.ArmiesGroups') }}</label>
      </fieldset>
      <button type="button" class="odc-btn odc-btn--soft odc--green" data-testid="customs-export-button" @click="copy">
        <v-icon name="gi-quill" aria-hidden="true" />{{ t('SecurityCustoms.Export.Button') }}
      </button>
    </div>
  </details>
</template>
