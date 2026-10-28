<script setup>
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'

  /*
    Les propositions d'un coffre, la plus récente en haut : combinaison, personnage, note. Partagé par la page publique et l'écran de
    l'organisateur. L'en-tête est le style de tableau du site (dégradé orange-rouge), titres en blanc.
  */
  const props = defineProps({ proposals: { type: Array, required: true } })
  const { t } = useI18n()
  const rows = computed(() => [...props.proposals].reverse())
</script>

<template>
  <table class="mt-1 w-full text-sm" data-testid="decode-attempts">
    <caption class="sr-only">{{ t('Animation.Public.AttemptsTitle') }}</caption>
    <thead>
      <tr class="text-left">
        <th scope="col" class="text-white dark:text-white">{{ t('Animation.Public.Combination') }}</th>
        <th scope="col" class="text-white dark:text-white">{{ t('Animation.Public.Character') }}</th>
        <th scope="col" class="text-right text-white dark:text-white">{{ t('Animation.Public.Score') }}</th>
      </tr>
    </thead>
    <tbody class="text-slate-800 dark:text-slate-800">
      <tr v-for="(attempt, index) in rows" :key="index" class="border-b border-slate-200 last:border-0">
        <td class="py-1.5 px-2 font-mono text-base font-bold tracking-widest tabular-nums">{{ attempt.combination }}</td>
        <td class="py-1.5 px-2">{{ attempt.character_name }}</td>
        <td class="py-1.5 px-2 text-right font-bold tabular-nums text-teal-800 dark:text-teal-800">{{ t('Animation.Public.Points', { points: attempt.points }) }}</td>
      </tr>
    </tbody>
  </table>
</template>
