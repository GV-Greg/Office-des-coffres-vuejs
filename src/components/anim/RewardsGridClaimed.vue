<script setup>
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'

  /*
    La liste des lots attribués — la SEULE de l'écran de l'organisateur (le plateau n'en porte plus) : numéro de case, lot, personnage, et le geste
    « remis / non remis » (page publique : la liste seule, `readonly`). ⚠️ Aucune règle ici : la remise d'un lot est un geste que le serveur juge.
  */
  const props = defineProps({
    grid: { type: Object, required: true },
    readonly: { type: Boolean, default: false }, // page publique : la liste seule, sans le geste de remise
    columns: { type: Boolean, default: false }, // deux colonnes (dès `tablet`) : la page publique, où la liste a de la place ; l'écran de l'organisateur reste en une
    bare: { type: Boolean, default: false }, // sans cadre ni fond blanc : la page publique laisse la liste sur le fond de la page
  })
  const emit = defineEmits(['markTaken'])
  const { t } = useI18n()

  const assigned = computed(() => (props.grid.lots ?? []).filter(l => l.player).sort((a, b) => a.place - b.place))
</script>

<template>
  <section v-if="assigned.length || grid.status === 'confirmed'" :class="bare ? 'p-4' : 'rounded-xl border border-slate-300 bg-white p-4'" data-testid="grid-taken-section">
    <h3 class="!mt-0 mb-2 flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-800">
      {{ t('Animation.Grid.ClaimedTitle') }}
      <!-- Le nombre de lots attribués, en badge (la couleur d'une case encore scellée). -->
      <span v-if="assigned.length" class="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-bold text-white dark:text-white" data-testid="claimed-count">{{ assigned.length }}</span>
    </h3>
    <ul v-if="assigned.length" class="m-0 p-0 list-none" :class="columns ? 'tablet:columns-2 gap-x-6' : ''" data-testid="claimed-list">
      <li v-for="lot in assigned" :key="`taken-${lot.id}`" class="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 break-inside-avoid text-sm">
        <span class="shrink-0 rounded-full border border-orange-500 bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-900 dark:text-orange-900">{{ t('Animation.Grid.Cell', { n: lot.place }) }}</span>
        <span class="min-w-0 flex-1 text-slate-800 dark:text-slate-800"><strong>{{ lot.name }}</strong> <span class="text-slate-600 dark:text-slate-600" aria-hidden="true">→</span> {{ lot.player }}</span>
        <button
          v-if="!readonly"
          type="button"
          class="odc-btn odc-btn--soft odc-btn--sm shrink-0"
          :class="lot.is_taken ? 'odc--teal' : 'odc--slate'"
          :aria-pressed="lot.is_taken"
          @click="emit('markTaken', lot.id, !lot.is_taken)"
        >
          <v-icon :name="lot.is_taken ? 'fa-check-circle' : 'fa-clock'" aria-hidden="true" />{{ lot.is_taken ? t('Animation.Grid.Taken') : t('Animation.Grid.NotTaken') }}
        </button>
      </li>
    </ul>
    <p v-else class="!mb-0 text-sm text-slate-700 dark:text-slate-700" data-testid="grid-taken-empty">{{ readonly ? t('Animation.Grid.NoClaimed') : t('Animation.Grid.TakenEmpty') }}</p>
  </section>
</template>
