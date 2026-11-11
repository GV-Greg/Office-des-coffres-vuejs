<script setup>
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { push } from 'notivue'
  import { exportResults, exportRules } from '@/modules/rewardsBBcode.js'

  /*
    Les outils de l'organisateur d'une grille, quel que soit l'état (tirée, close) : les deux exports BBCode (règles, résultats) et l'état de
    l'adresse email (sans compte). Écrit UNE fois : la carte de la grille l'affichait deux fois, une par disposition. La liste des lots attribués est
    `RewardsGridClaimed`. « Confier au scribe » copie le BBCode directement dans le presse-papier, prêt à coller sur le forum ; les résultats ne
    contiennent jamais une case non réclamée. ⚠️ Aucune règle ici.
  */
  const props = defineProps({
    grid: { type: Object, required: true },
  })
  const { t } = useI18n()

  const exportable = computed(() => ['drawed', 'confirmed', 'closed'].includes(props.grid.status))
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://officedescoffres.creacube.be'

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text)
      push.success(t('Animation.Mine.Copied'))
    } catch {
      push.error(t('Animation.Mine.CopyFailed'))
    }
  }
  const entrustRules = () => copy(exportRules(props.grid, baseUrl))
  const entrustResults = () => copy(exportResults(props.grid, baseUrl))
</script>

<template>
  <div class="space-y-4">
    <!-- « Confier au scribe » : exporter = vert (charte §6.7), côte à côte, centré. -->
    <div v-if="exportable" class="flex flex-wrap justify-center gap-2" data-testid="grid-export-buttons">
      <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--green" data-testid="grid-export-results" @click="entrustResults">
        <v-icon name="fa-copy" aria-hidden="true" />{{ t('Animation.Grid.EntrustResults') }}
      </button>
      <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--green" data-testid="grid-export-rules" @click="entrustRules">
        <v-icon name="fa-copy" aria-hidden="true" />{{ t('Animation.Grid.EntrustRules') }}
      </button>
    </div>

    <p v-if="grid.mode === 'anonymous' && grid.email" class="!mb-0 text-xs text-slate-700 dark:text-slate-700" data-testid="grid-email-state">
      <template v-if="grid.email.verified">
        <v-icon name="fa-check-circle" class="text-teal-700" aria-hidden="true" />
        {{ t('Animation.Mine.EmailConfirmed') }}
      </template>
      <template v-else>
        <v-icon name="fa-clock" class="text-orange-700" aria-hidden="true" />
        {{ t('Animation.Mine.EmailPending') }}
      </template>
    </p>
  </div>
</template>
