<script setup>
  import { useI18n } from 'vue-i18n'

  /*
    Attente INLINE d'une zone dont le contenu dépend d'un droit (formulaire de prix du Bilan, par exemple) : la place est
    réservée, un cadenas fermé dit ce qui se passe, et la zone n'est remplacée qu'une fois la réponse du serveur connue —
    plus de formulaire qui apparaît puis change. Pour un chargement de PAGE, voir ChestLoader.
    Aussi pour les BLOCS d'une page qui se rechargent (changer de jour dans le Registre de douane, Greg 24/11/2026) : `icon`, `message` et `iconClass`
    changent l'image et la phrase, `top` l'aligne en haut ; par défaut, le cadenas du Bilan des mines, centré.
  */
  defineProps({
    minHeight: { type: String, default: '7.5rem' },
    icon: { type: String, default: 'gi-padlock' },
    message: { type: String, default: '' },
    iconClass: { type: String, default: 'text-yellow-700 dark:text-yellow-700' },
    top: { type: Boolean, default: false }, // aligné EN HAUT de sa zone (blocs d'une page) au lieu d'être centré (Bilan des mines)
  })
  const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col gap-3" :class="top ? 'justify-start' : 'justify-center'" :style="{ minHeight }" role="status" aria-live="polite" data-testid="access-loader">
    <div class="flex items-center gap-3 font-bold text-slate-800 dark:text-slate-800">
      <v-icon :name="icon" scale="1.6" :class="iconClass" aria-hidden="true" />
      <span>{{ message || t('Chest.Access') }}</span>
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
