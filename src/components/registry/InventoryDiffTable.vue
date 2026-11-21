<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatDiff, STATUS } from '@/modules/inventoryCompare'

/*
  Le tableau d'une évolution entre deux inventaires — Article, Avant, Après, Écart — pour la comparaison de deux inscriptions et pour les bilans de
  mandat du Registre des stocks. N'affiche que ce qui a bougé ; les articles disparus sont barrés. Flèche ET signe : la couleur n'est qu'un repère.
  Une quantité identique n'affiche rien. Couleurs fixes (la carte est claire dans les deux thèmes). `testid` préfixe les marqueurs de test.
*/
const props = defineProps({
  result: { type: Object, required: true }, // compareInventories(...) : { rows, disappeared, ... }
  testid: { type: String, default: 'diff' },
})
const { t } = useI18n()

const STATUS_VIEW = {
  [STATUS.UP]: { arrow: '▲', cls: 'text-green-800 dark:text-green-800', label: 'EconomyBalance.Increased' },
  [STATUS.NEW]: { arrow: '▲', cls: 'text-green-800 dark:text-green-800', label: 'EconomyBalance.Increased' },
  [STATUS.DOWN]: { arrow: '▼', cls: 'text-red-800 dark:text-red-800', label: 'EconomyBalance.Decreased' },
}
const changedRows = computed(() => props.result.rows.filter(row => row.status !== STATUS.SAME))
</script>

<template>
  <div class="overflow-x-auto">
    <table class="mt-2 w-full text-sm" :data-testid="`${testid}-table`">
      <thead>
        <tr>
          <th class="text-left">{{ t('EconomyInventoryRegistry.ColumnItem') }}</th>
          <th class="text-right">{{ t('EconomyInventoryRegistry.ColumnBefore') }}</th>
          <th class="text-right">{{ t('EconomyInventoryRegistry.ColumnAfter') }}</th>
          <th class="text-right">{{ t('EconomyInventoryRegistry.ColumnDiff') }}</th>
        </tr>
      </thead>
      <tbody class="tabular-nums">
        <tr v-for="row in changedRows" :key="row.name" class="border-b border-slate-300" :data-testid="`${testid}-row`">
          <td class="py-1.5 pr-3 font-bold">
            {{ row.name }}
            <span v-if="row.status === 'new'" class="ml-1 rounded border border-green-300 bg-green-100 px-1 text-[0.65rem] font-semibold uppercase text-green-900">{{ t('EconomyBalance.New') }}</span>
          </td>
          <td class="py-1.5 text-right">{{ row.before ?? '—' }}</td>
          <td class="py-1.5 text-right">{{ row.quantity }}</td>
          <td class="py-1.5 text-right font-medium" :class="STATUS_VIEW[row.status].cls">
            <span aria-hidden="true">{{ STATUS_VIEW[row.status].arrow }}</span>
            <span class="sr-only">{{ t(STATUS_VIEW[row.status].label) }}</span>
            {{ formatDiff(row.diff) }}
          </td>
        </tr>
        <tr v-for="item in result.disappeared" :key="`gone-${item.name}`" class="border-b border-slate-300" :data-testid="`${testid}-gone`">
          <td class="py-1.5 pr-3 font-bold text-slate-700 line-through">{{ item.name }}</td>
          <td class="py-1.5 text-right text-slate-700">{{ item.before }}</td>
          <td class="py-1.5 text-right text-slate-700">—</td>
          <td class="py-1.5 text-right font-medium text-red-800 dark:text-red-800">
            <span aria-hidden="true">▼</span>
            <span class="sr-only">{{ t('EconomyBalance.Disappeared') }}</span>
            {{ formatDiff(-item.before) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
