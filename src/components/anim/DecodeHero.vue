<script setup>
  import { useI18n } from 'vue-i18n'
  import DecodeCodeVisual from '@/components/anim/DecodeCodeVisual.vue'

  /*
    L'encadré de tête d'une activité de « Décode le code » — le même sur la page PUBLIQUE et sur l'écran de l'organisateur : les cinq cases
    à gauche du titre, son badge d'état à droite, un filet orné, puis la ligne d'informations. Le slot reçoit ce qui est propre à l'écran
    (l'adresse et la porte vers la page publique, côté organisateur). Police blanche sur fond sombre, dans les deux thèmes.
  */
  defineProps({
    title: { type: String, required: true },
    status: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    closedNotice: { type: String, default: '' },
    divider: { type: Boolean, default: true },
    titleTestid: { type: String, default: 'decode-name' },
    cellsTestid: { type: String, default: 'decode-hero-cells' },
    statusTestid: { type: String, default: 'decode-status' },
    closedTestid: { type: String, default: 'decode-closed' },
  })
  const { t } = useI18n()
</script>

<template>
  <header class="relative overflow-hidden rounded-2xl border border-teal-700 px-5 py-6 tablet:px-8 tablet:py-8 text-white dark:text-white bg-slate-900 shadow-lg" :style="{ backgroundImage: 'radial-gradient(ellipse at 15% 50%, rgba(13,148,136,.5), transparent 60%)' }">
    <div class="flex flex-col items-center text-center">
      <div class="flex flex-wrap items-center justify-center gap-3">
        <DecodeCodeVisual size="title" :testid="cellsTestid" />
        <h2 class="!m-0 text-2xl tablet:text-3xl font-extrabold text-white dark:text-white" :data-testid="titleTestid">{{ title }}</h2>
        <span v-if="status" class="inline-block px-3 py-0.5 rounded-full border border-teal-300 bg-teal-900 text-teal-100 dark:text-teal-100 text-xs font-bold" :data-testid="statusTestid">{{ t(`Animation.Status.${status}`) }}</span>
      </div>
      <!-- Filet orné : le dé d'Animation entre deux traits. -->
      <div v-if="divider" class="my-3 flex w-full max-w-md items-center gap-3" aria-hidden="true" data-testid="decode-divider">
        <span class="h-px flex-1 bg-slate-500"></span>
        <v-icon name="gi-rolling-dice-cup" scale="1.3" class="text-teal-300" />
        <span class="h-px flex-1 bg-slate-500"></span>
      </div>
      <p v-if="subtitle" class="!m-0 text-sm text-slate-200 dark:text-slate-200" :class="divider ? '' : '!mt-2'">{{ subtitle }}</p>
      <p v-if="closedNotice" role="note" class="!mt-3 !mb-0 rounded border border-yellow-300 bg-yellow-900/60 px-3 py-1 text-sm font-semibold text-yellow-100 dark:text-yellow-100" :data-testid="closedTestid">{{ closedNotice }}</p>
      <!-- Les actions propres à l'écran : à droite de l'encadré dès `tablet`, dessous sur petit écran. -->
    <div v-if="$slots.default" class="mt-3 flex flex-wrap items-center justify-center gap-3 tablet:mt-0 tablet:absolute tablet:right-8 tablet:top-1/2 tablet:-translate-y-1/2"><slot /></div>
    </div>
  </header>
</template>
