<script setup>
  import { computed } from 'vue'

  /*
    Le visuel propre à « Décode le code » : les cinq cases de la combinaison. Par défaut encore scellées (« ? ») et décoratives
    (aria-hidden) — partagé par la carte de l'accueil du module, le titre de la page de l'activité et la page publique. Avec `digits`,
    les cases montrent une combinaison RÉVÉLÉE (coffre ouvert) : le texte accessible est alors porté par l'appelant, pas par les cases.
    Tailles : `small` (titres de page), `title` (à gauche d'un grand titre), `medium`, `large` (cœur de la page publique).
  */
  const props = defineProps({
    digits: { type: String, default: '' },
    size: { type: String, default: 'small', validator: v => ['small', 'title', 'medium', 'large'].includes(v) },
    testid: { type: String, default: 'decode-visual' },
    // `light` : cases teintées de la couleur d'Animation mais claires, pour un fond blanc (le code du coffre de l'organisateur).
    tone: { type: String, default: 'dark', validator: v => ['dark', 'light'].includes(v) },
  })

  const cells = computed(() => Array.from({ length: 5 }, (_, i) => props.digits[i] ?? '?'))
  const revealed = computed(() => props.digits.length > 0)
  const SIZES = {
    small: 'w-4 h-6 text-xs rounded-sm gap-0.5',
    title: 'w-5 h-8 tablet:w-6 tablet:h-9 text-sm tablet:text-base rounded',
    medium: 'w-8 h-11 text-xl rounded',
    large: 'w-12 h-16 tablet:w-16 tablet:h-20 text-3xl tablet:text-4xl rounded-lg',
  }
</script>

<template>
  <div class="flex" :class="size === 'small' ? 'gap-0.5' : 'gap-1.5 tablet:gap-2'" aria-hidden="true" :data-testid="testid">
    <span
      v-for="(cell, n) in cells"
      :key="n"
      class="grid place-items-center border font-mono font-extrabold leading-none tabular-nums shadow-inner"
      :class="[SIZES[size], revealed
        ? 'border-yellow-600 bg-yellow-200 text-slate-900'
        : tone === 'light' ? 'border-teal-600 bg-teal-100 text-teal-900' : 'border-teal-600 bg-slate-800 text-yellow-200']"
    >{{ cell }}</span>
  </div>
</template>
