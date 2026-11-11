<script setup>
  import { useI18n } from 'vue-i18n'

  /*
    La légende du plateau, pour qui le LIT sans le manier (page publique) : ce que sont une case libre et une case dévoilée, avec leur propre dessin
    (le même que sur le plateau). L'écran de l'organisateur n'en a pas besoin : c'est lui qui dévoile les cases.
  */
  defineProps({
    bare: { type: Boolean, default: false }, // sans cadre ni fond blanc : la page publique laisse la légende sur le fond de la page
  })
  const { t } = useI18n()
</script>

<template>
  <section :class="bare ? 'p-4' : 'rounded-xl border border-slate-300 bg-white p-4'" data-testid="board-legend">
    <h3 class="!mt-0 mb-3 text-base font-bold text-slate-800 dark:text-slate-800">{{ t('Animation.Grid.LegendTitle') }}</h3>
    <ul class="m-0 list-none space-y-3 p-0 text-sm text-slate-800 dark:text-slate-800">
      <li class="flex items-center gap-3">
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-slate-600 bg-slate-800 font-mono text-sm font-bold text-slate-200" aria-hidden="true">7</span>
        <span><strong>{{ t('Animation.Grid.LegendFree') }}</strong><br /><span class="text-slate-700 dark:text-slate-700">{{ t('Animation.Grid.LegendFreeText') }}</span></span>
      </li>
      <li class="flex items-center gap-3">
        <span class="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-orange-500 bg-orange-100 text-slate-800" aria-hidden="true">
          <v-icon name="gi-open-treasure-chest" scale="1.5" />
          <span class="absolute left-1 top-0.5 font-mono text-[10px] leading-none font-bold">7</span>
        </span>
        <span><strong>{{ t('Animation.Grid.LegendRevealed') }}</strong><br /><span class="text-slate-700 dark:text-slate-700">{{ t('Animation.Grid.LegendRevealedText') }}</span></span>
      </li>
    </ul>
  </section>
</template>
