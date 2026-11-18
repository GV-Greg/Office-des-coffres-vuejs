<script setup>
  import { computed, onMounted, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import useAnnouncement, { pickMessage } from '@/use/useAnnouncement'

  /*
    Bandeau d'annonce de l'accueil de l'application (18/11/2026) : le message du serveur (maintenance à venir) défile de DROITE À GAUCHE.

    Mouvement (WCAG 2.2.2, charte §8 : aucune animation sans fin) :
    - le texte défile PASSES fois, puis s'arrête et reste affiché en entier, à plat, centré — jamais coupé ;
    - un bouton met le défilement en pause / le relance (un mouvement de plus de 5 s doit pouvoir être arrêté) ;
    - en mouvement réduit, le texte est à plat d'emblée (la règle globale de base.css coupe aussi l'animation : animationend se déclenche
      aussitôt, l'état « fini » est donc atteint dans tous les cas) ;
    - le texte qui bouge est masqué des lecteurs d'écran (aria-hidden) : ils lisent la copie à plat (sr-only) tant qu'il défile.
  */
  const PASSES = 3
  const { t, locale } = useI18n()
  const { announcement, load } = useAnnouncement()

  const text = computed(() => pickMessage(announcement.value, locale.value))
  const finished = ref(false)
  const paused = ref(false)
  // ~ 70 px par seconde pour une ligne : le temps d'un passage suit la longueur du message (12 à 45 s).
  const duration = computed(() => Math.min(45, Math.max(12, 8 + text.value.length * 0.12)))

  const prefersReducedMotion = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Nouveau texte (annonce chargée, langue changée) : le défilement repart, sauf en mouvement réduit.
  watch(text, () => {
    paused.value = false
    finished.value = prefersReducedMotion()
  })

  onMounted(load)
</script>

<template>
  <section
    v-if="text"
    class="flex items-center gap-3 mb-6 px-3 py-2 rounded-md border border-yellow-500 bg-yellow-100 text-yellow-950"
    :aria-label="t('Announcement.Label')"
    data-testid="announcement-banner"
  >
    <v-icon name="gi-bugle-call" scale="1.4" class="shrink-0" aria-hidden="true" />

    <!-- Défilement : la copie à plat (sr-only) sert aux lecteurs d'écran, la piste qui bouge leur est cachée. -->
    <div v-if="!finished" class="relative flex-1 overflow-hidden" data-testid="announcement-marquee">
      <span class="sr-only">{{ text }}</span>
      <div
        :key="locale"
        class="announcement-track text-sm font-medium"
        :class="{ 'announcement-track--paused': paused }"
        :style="{ '--announcement-duration': `${duration}s`, '--announcement-passes': PASSES }"
        aria-hidden="true"
        data-testid="announcement-track"
        @animationend="finished = true"
      >{{ text }}</div>
    </div>

    <!-- Fini (ou mouvement réduit) : le message en entier, à plat. -->
    <div v-else class="flex-1 text-sm font-medium" data-testid="announcement-static">{{ text }}</div>

    <button
      v-if="!finished"
      type="button"
      class="odc-btn odc-btn--icon odc-btn--sm odc--slate shrink-0"
      :aria-label="t(paused ? 'Announcement.Play' : 'Announcement.Pause')"
      :aria-pressed="paused"
      data-testid="announcement-toggle"
      @click="paused = !paused"
    >
      <v-icon :name="paused ? 'fa-play' : 'fa-pause'" scale="0.9" aria-hidden="true" />
    </button>
  </section>
</template>

<style scoped>
  /* Départ juste hors du bord droit (la piste commence par 100 % de largeur de vide), arrivée hors du bord gauche : de droite à gauche. */
  .announcement-track {
    display: inline-block;
    white-space: nowrap;
    padding-left: 100%;
    animation: announcement-scroll var(--announcement-duration, 20s) linear var(--announcement-passes, 3) both;
  }
  .announcement-track--paused { animation-play-state: paused; }
  @keyframes announcement-scroll {
    from { transform: translateX(0); }
    to { transform: translateX(-100%); }
  }
</style>
