<script setup>
  /*
    Visuel décoratif de la Grille des lots : une mini-grille 2×2, quelques cases réclamées (coffre ouvert),
    les autres scellées (cadenas). Purement décoratif (aria-hidden), réutilisable sur la carte de l'accueil
    du module Animation et sur la page de l'activité.
    Sizes : `small` (accueil), `title` (en-tête sombre), `medium`, `large`.
  */
  defineProps({
    size: { type: String, default: 'small', validator: v => ['small', 'title', 'medium', 'large'].includes(v) },
  })

  // 2×2 : positions 1–4. Diagonale : coffre en haut-gauche + bas-droite, cadenas en haut-droite + bas-gauche.
  const CLAIMED = new Set([1, 4])
  const cells = Array.from({ length: 4 }, (_, i) => ({ pos: i + 1, claimed: CLAIMED.has(i + 1) }))

  const SIZES = {
    small:  { cell: 'w-5 h-5 rounded-sm text-[10px]', icon: 0.65 },
    title:  { cell: 'w-7 h-7 tablet:w-8 tablet:h-8 rounded text-xs', icon: 0.85 },
    medium: { cell: 'w-8 h-8 rounded text-xs',        icon: 1.0  },
    large:  { cell: 'w-11 h-11 rounded-md text-sm',   icon: 1.3  },
  }
</script>

<template>
  <div
    class="grid gap-1"
    style="grid-template-columns: repeat(2, minmax(0, 1fr))"
    aria-hidden="true"
  >
    <div
      v-for="cell in cells"
      :key="cell.pos"
      class="grid place-items-center border font-mono font-bold leading-none shadow-inner bg-slate-800 border-teal-600 text-teal-300"
      :class="SIZES[size].cell"
    >
      <v-icon v-if="!cell.claimed" name="gi-padlock" :scale="SIZES[size].icon" />
      <span v-else aria-hidden="true" class="font-bold leading-none select-none" :style="{ fontSize: `${SIZES[size].icon * 1.6}rem` }">✕</span>
    </div>
  </div>
</template>
