<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import useNavigationLoading from '@/use/useNavigationLoading'
import GateIllustration from '@/components/loading/GateIllustration.vue'

/*
  Overlay GLOBAL : un changement de page ou un envoi à l'API. Mise en scène (maquette validée,
  admin/content/demo-animations-chargement.html) : on ENTRE dans la salle — le portique aux torches surgit dans une lueur à la
  couleur du module (neutre hors module) ; le coffre est réservé au chargement INTERNE d'une page (ChestLoader).
  Envoi : le parchemin et la plume du greffe apparaissent de haut en bas (une fois). Mouvement fini (charte §8) : le portique surgit, la lueur pulse deux fois puis reste fixe.
*/
const { t } = useI18n()
const { isNavigationLoading, navigationContext, navigationAccent } = useNavigationLoading()

const isApi = computed(() => navigationContext.value === 'api')
const accent = computed(() => (navigationContext.value === 'chest' ? navigationAccent.value : 'office'))
const loadingText = computed(() => t(isApi.value ? 'Common.LoadingApi' : 'Common.LoadingRoom'))

</script>

<template>
  <Transition name="loading-fade">
    <div
      v-if="isNavigationLoading"
      class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-slate-200/95 dark:bg-slate-800/95 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <v-icon
        v-if="isApi"
        name="gi-scroll-unfurled"
        scale="6"
        class="greffe-in text-orange-500 dark:text-orange-400 drop-shadow-[0_0_12px_rgba(251,146,60,0.5)]"
        aria-hidden="true"
      />
      <GateIllustration v-else :accent="accent" />
      <p class="text-slate-800 dark:text-slate-200 text-lg font-medium italic">
        {{ loadingText }}
      </p>
    </div>
  </Transition>
</template>

<style scoped>
.loading-fade-enter-active,
.loading-fade-leave-active {
  transition: opacity 150ms ease;
}
.loading-fade-enter-from,
.loading-fade-leave-to {
  opacity: 0;
}

/* Le parchemin déroulé se dévoilent de haut en bas, une fois, puis restent. */
.greffe-in { animation: greffe-in 1.1s ease-out 0.15s 1 both; }
@keyframes greffe-in {
  from { clip-path: inset(0 0 100% 0); }
  to { clip-path: inset(0); }
}
</style>
