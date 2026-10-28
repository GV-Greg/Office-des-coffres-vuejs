<script setup>
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'

  /*
    Le classement cumulé : une barre par personnage, la première en or. Partagé par la page publique et l'écran de l'organisateur.
  */
  const props = defineProps({ ranking: { type: Array, default: () => [] } })
  const { t } = useI18n()
  const topPoints = computed(() => Math.max(1, ...props.ranking.map(r => r.points)))
</script>

<template>
  <section class="rounded-xl border border-slate-300 bg-white p-4" data-testid="decode-ranking">
    <h3 class="!mt-0 text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-red-700 to-orange-600">{{ t('Animation.Public.RankingTitle') }}</h3>
    <p v-if="!ranking.length" class="text-sm italic text-slate-700 dark:text-slate-700">{{ t('Animation.Public.NoRanking') }}</p>
    <ol v-else class="m-0 p-0 list-none space-y-2">
      <li v-for="(row, index) in ranking" :key="row.character_name" class="text-slate-800 dark:text-slate-800">
        <div class="flex items-baseline justify-between gap-2">
          <span :class="index === 0 ? 'font-extrabold' : 'font-semibold'">{{ index + 1 }}. <strong>{{ row.character_name }}</strong></span>
          <span class="text-sm font-bold tabular-nums">{{ t('Animation.Public.Points', { points: row.points }) }}</span>
        </div>
        <div class="mt-0.5 h-1.5 rounded-full bg-slate-200" aria-hidden="true">
          <div class="h-full rounded-full" :class="index === 0 ? 'bg-yellow-500' : 'bg-teal-600'" :style="{ width: Math.max(4, Math.round((row.points / topPoints) * 100)) + '%' }"></div>
        </div>
      </li>
    </ol>
  </section>
</template>
