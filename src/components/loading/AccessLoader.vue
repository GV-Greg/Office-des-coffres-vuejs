<script setup>
  import { useI18n } from 'vue-i18n'

  /*
    Attente INLINE d'une zone dont le contenu dépend d'un droit (formulaire de prix du Bilan, par exemple) : la place est
    réservée, un cadenas fermé dit ce qui se passe, et la zone n'est remplacée qu'une fois la réponse du serveur connue —
    plus de formulaire qui apparaît puis change. Pour un chargement de PAGE, voir ChestLoader.
  */
  defineProps({ minHeight: { type: String, default: '7.5rem' } })
  const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col justify-center gap-3" :style="{ minHeight }" role="status" aria-live="polite" data-testid="access-loader">
    <div class="flex items-center gap-3 font-bold text-slate-800 dark:text-slate-800">
      <v-icon name="gi-padlock" scale="1.6" class="text-yellow-700 dark:text-yellow-700" aria-hidden="true" />
      <span>{{ t('Chest.Access') }}</span>
    </div>
    <div class="space-y-2" aria-hidden="true">
      <span class="skeleton block h-2.5 w-3/4 rounded bg-slate-200" />
      <span class="skeleton block h-2.5 w-1/2 rounded bg-slate-200" />
    </div>
  </div>
</template>

<style scoped>
  /* Brillance qui passe deux fois puis s'arrête : jamais en boucle (charte §8). */
  .skeleton { background: linear-gradient(90deg, #e2e8f0 0%, #f1f5f9 40%, #e2e8f0 80%) 0 0 / 220% 100%; animation: access-sheen 1s linear 2; }
  @keyframes access-sheen { from { background-position: 100% 0; } to { background-position: -100% 0; } }
</style>
