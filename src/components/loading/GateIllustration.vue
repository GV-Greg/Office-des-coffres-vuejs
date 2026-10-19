<script setup>
  import { computed } from 'vue'
  import { accentOf } from '@/modules/moduleAccents'

  /*
    Le portique de la salle (overlay global : on ENTRE dans la pièce ; le coffre est réservé à l'intérieur de la page).
    Même langage que l'ancien overlay : une silhouette game-icons d'une seule couleur (`gi-dungeon-gate`, l'arche aux deux
    torches), sa lueur et son ombre chaude. Il surgit en 0,6 s, la lueur pulse 2 fois puis reste fixe : rien en boucle
    (charte §8). Orange hors module ; couleur du module sinon (foncée en clair, claire en sombre).
    Maquette : admin/content/demo-animations-chargement.html (proposition « Le portique aux torches »).
  */
  const props = defineProps({ accent: { type: String, default: 'office' } })
  const vars = computed(() => {
    // Hors module : l'orange de l'ancien overlay (orange-500 / orange-400, lueur ambre).
    if (props.accent === 'office') return { '--gate-ink': '#f97316', '--gate-ink-dark': '#fb923c', '--gate-rgb': '251, 191, 36' }
    const { tint, rgb, face } = accentOf(props.accent)
    return { '--gate-ink': face, '--gate-ink-dark': tint, '--gate-rgb': rgb }
  })
</script>

<template>
  <div class="gate" :style="vars" aria-hidden="true">
    <span class="glow"><i /></span>
    <v-icon name="gi-dungeon-gate" scale="6" class="icon" />
  </div>
</template>

<style scoped>
  .gate { position: relative; display: grid; place-items: center; width: 160px; height: 160px; }
  .icon { position: relative; color: var(--gate-ink); filter: drop-shadow(0 0 12px rgba(var(--gate-rgb), 0.5)); animation: gate-in 0.6s cubic-bezier(0.25, 1.3, 0.4, 1) 0.2s 1 both; }
  .glow { position: absolute; width: 128px; height: 128px; border-radius: 50%; filter: blur(24px); pointer-events: none;
    background: radial-gradient(circle, rgba(var(--gate-rgb), 0.55) 0%, rgba(var(--gate-rgb), 0.3) 45%, transparent 70%); }
  /* Deux pulsations puis la lueur reste fixe. */
  .glow i { position: absolute; inset: 0; border-radius: 50%; background: inherit; animation: gate-pulse 0.8s ease-in-out 0.7s 2 alternate both; }
  @keyframes gate-in { from { transform: scale(0.82); opacity: 0; } to { transform: none; opacity: 1; } }
  @keyframes gate-pulse { from { transform: scale(0.9); opacity: 0.6; } to { transform: scale(1.15); opacity: 1; } }
</style>

<!-- Hors `scoped` : `:global(.dark) .icon` est compilé en `.dark { … }` seul (la teinte claire ne s'appliquait jamais en sombre,
     l'icône restait brun foncé sur le fond sombre). -->
<style>
  .dark .gate .icon { color: var(--gate-ink-dark); }
</style>
