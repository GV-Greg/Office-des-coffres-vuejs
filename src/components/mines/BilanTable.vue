<script setup>
  import { useI18n } from 'vue-i18n'
  import { lineKey } from '@/modules/mineRegistry'

  /*
    Table d'un bilan du registre (une ligne par mine, un total) — partagée par le bilan en cours du mois
    de mandat et par les bilans hebdomadaires revus (lot 2 des prix). `levels` (clé de mine → niveau) est
    facultatif : sans lui, la colonne « Niveau » n'est pas affichée (un bilan de semaine passée ne dit pas
    le niveau d'aujourd'hui). Couleurs de texte posées sur chaque élément (règle globale `.dark p`).
  */
  defineProps({
    bilan: { type: Object, required: true },
    levels: { type: Map, default: null },
    totalTestid: { type: String, default: 'bilan-total' },
  })

  const { t, locale } = useI18n()
  const num = n => Number(n || 0).toLocaleString(locale.value === 'fr' ? 'fr-FR' : 'en-GB', { maximumFractionDigits: 1 })
  const unit = resource => (resource ? t(`EconomyMines.Units.${resource}`) : '')
  const signed = n => `${n >= 0 ? '+' : '−'}${num(Math.abs(n))} ${t('EconomyMines.Currency')}`
</script>

<template>
  <div class="overflow-x-auto">
    <table class="mt-2 w-full text-sm">
      <thead>
        <tr>
          <th class="text-left">{{ t('EconomyMines.RegistryPage.Mine') }}</th>
          <th v-if="levels" class="text-right">{{ t('EconomyMines.RegistryPage.Level') }}</th>
          <th class="text-right">{{ t('EconomyMines.ColumnProduction') }}</th>
          <th class="text-right">{{ t('EconomyMines.ColumnValue') }}</th>
          <th class="text-right">{{ t('EconomyMines.ColumnHours') }}</th>
          <th class="text-right">{{ t('EconomyMines.ColumnSalary') }}</th>
          <th class="text-right">{{ t('EconomyMines.ColumnMaintenanceValue') }}</th>
          <th class="text-right">{{ t('EconomyMines.ColumnBalance') }}</th>
        </tr>
      </thead>
      <tbody class="tabular-nums">
        <tr v-for="line in bilan.lines" :key="lineKey(line)" class="border-b border-slate-300">
          <td class="py-2 pr-3 font-bold whitespace-nowrap">#{{ line.number }} {{ line.label }}</td>
          <td v-if="levels" class="py-2 text-right">{{ levels.get(lineKey(line)) ?? '—' }}</td>
          <td class="py-2 text-right whitespace-nowrap">{{ num(line.production) }} {{ unit(line.resource) }}</td>
          <td class="py-2 text-right">{{ num(line.valeur) }}</td>
          <td class="py-2 text-right">{{ num(line.heures) }}</td>
          <td class="py-2 text-right">{{ num(line.salaire) }}</td>
          <td class="py-2 text-right">{{ num(line.entretien) }}</td>
          <td :class="['py-2 text-right font-bold', line.solde >= 0 ? 'text-green-800' : 'text-red-700']">{{ num(line.solde) }}</td>
        </tr>
        <tr class="font-bold" :data-testid="totalTestid">
          <td class="py-2">{{ t('EconomyMines.TotalLabel') }}</td>
          <td v-if="levels"></td>
          <td></td>
          <td class="py-2 text-right">{{ num(bilan.total.valeur) }}</td>
          <td class="py-2 text-right">{{ num(bilan.total.heures) }}</td>
          <td class="py-2 text-right">{{ num(bilan.total.salaire) }}</td>
          <td class="py-2 text-right">{{ num(bilan.total.entretien) }}</td>
          <td :class="['py-2 text-right', bilan.net >= 0 ? 'text-green-800' : 'text-red-700']">{{ signed(bilan.net) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
