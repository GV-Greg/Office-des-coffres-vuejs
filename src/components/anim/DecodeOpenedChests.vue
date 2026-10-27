<script setup>
  import { useI18n } from 'vue-i18n'
  import DecodeCodeVisual from '@/components/anim/DecodeCodeVisual.vue'

  /*
    Les coffres déjà percés : la combinaison révélée, en or, et celui qui l'a trouvée. Partagé par la page publique et l'écran de l'organisateur.
    Le texte accessible (« Coffre n°1 : 98765 ») est porté en lecture d'écran ; les cases sont décoratives.
  */
  defineProps({ opened: { type: Array, default: () => [] } })
  const { t } = useI18n()
</script>

<template>
  <section class="rounded-xl border border-slate-300 bg-white p-4" data-testid="decode-opened">
    <h3 class="!mt-0 text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-red-700 to-orange-600">{{ t('Animation.Public.OpenedTitle') }}</h3>
    <p v-if="!opened.length" class="text-sm italic text-slate-700 dark:text-slate-700">{{ t('Animation.Public.NoOpened') }}</p>
    <ul v-else class="m-0 p-0 list-none grid gap-3">
      <li v-for="chest in opened" :key="chest.number" class="rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-800 dark:text-slate-800">
        <span class="sr-only">{{ t('Animation.Public.OpenedLine', { number: chest.number, code: chest.code }) }}</span>
        <p class="!m-0 text-xs font-bold text-slate-700 dark:text-slate-700" aria-hidden="true">{{ t('Animation.Public.ChestNumber', { number: chest.number }) }}</p>
        <DecodeCodeVisual :digits="String(chest.code)" size="medium" class="mt-1" testid="decode-opened-cells" />
        <p v-if="chest.discoverer" class="!mt-2 !mb-0 text-sm">{{ t('Animation.Public.DiscoveredBy', { name: chest.discoverer }) }}</p>
      </li>
    </ul>
  </section>
</template>
