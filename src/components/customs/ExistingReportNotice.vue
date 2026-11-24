<script setup>
  /*
    « Un relevé existe déjà » (Relevé de guet, Greg, 24/11/2026) : sur la ligne de la ville, DEVANT elle, bien en vue, sans détail. Fond ORANGE, texte BLANC,
    peu de padding. L'orange de la signature (charte §3.1), assez foncé (orange-700, 5,2:1 avec le blanc) pour que le texte reste lisible ; le médaillon blanc
    translucide porte l'icône. Même couleur dans les DEUX thèmes (CSS scopé, aucun texte hérité).
  */
  defineProps({
    message: { type: String, required: true },
  })
</script>

<template>
  <p class="existing-plate flex items-center gap-2 rounded-lg px-3 py-1" role="status" data-testid="guet-existing">
    <v-icon name="fa-exclamation-triangle" scale="0.95" class="existing-icon shrink-0" aria-hidden="true" />
    <span class="existing-text text-sm font-bold leading-snug">{{ message }}</span>
  </p>
</template>

<style scoped>
  .existing-plate {
    margin: 0;
    background: linear-gradient(160deg, #c2410c 0%, #b13a0a 100%);
    border: 1px solid #fdba74;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.2);
  }
  .existing-text { color: #fff; }
  .existing-icon { color: #fff; }
</style>
