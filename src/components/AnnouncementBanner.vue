<script setup>
  import { computed, onMounted, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import useAnnouncement, { pickMessage } from '@/use/useAnnouncement'

  /*
    Bandeau d'annonce de l'accueil de l'application (18/11/2026) : le message du serveur (maintenance à venir) défile de DROITE À GAUCHE,
    sur une plaque de proclamation (laiton sur azur, demande de Greg du 18/11/2026 : « un style plus médiéval »).

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
  <!-- Plaque de proclamation : champ d'azur cerclé de laiton (matière de la charte §3.1), médaillon de laiton à gauche, texte crème. -->
  <section
    v-if="text"
    class="announcement-plate"
    :aria-label="t('Announcement.Label')"
    data-testid="announcement-banner"
  >
    <div class="announcement-cap">
      <v-icon name="gi-bugle-call" scale="1.5" class="shrink-0" aria-hidden="true" />
      <span class="announcement-cap__label" data-testid="announcement-heading">{{ t('Announcement.Heading') }}</span>
    </div>

    <!-- Défilement : la copie à plat (sr-only) sert aux lecteurs d'écran, la piste qui bouge leur est cachée. -->
    <div v-if="!finished" class="announcement-body announcement-marquee" data-testid="announcement-marquee">
      <span class="sr-only">{{ text }}</span>
      <div
        :key="locale"
        class="announcement-track"
        :class="{ 'announcement-track--paused': paused }"
        :style="{ '--announcement-duration': `${duration}s`, '--announcement-passes': PASSES }"
        aria-hidden="true"
        data-testid="announcement-track"
        @animationend="finished = true"
      >{{ text }}</div>
    </div>

    <!-- Fini (ou mouvement réduit) : le message en entier, à plat. -->
    <div v-else class="announcement-body" data-testid="announcement-static">{{ text }}</div>

    <div v-if="!finished" class="announcement-action">
      <button
        type="button"
        class="odc-btn odc-btn--icon odc-btn--sm odc--slate"
        :aria-label="t(paused ? 'Announcement.Play' : 'Announcement.Pause')"
        :aria-pressed="paused"
        data-testid="announcement-toggle"
        @click="paused = !paused"
      >
        <v-icon :name="paused ? 'fa-play' : 'fa-pause'" scale="0.9" aria-hidden="true" />
      </button>
    </div>
  </section>
</template>

<style scoped>
  /* Plaque : champ d'AZUR (blue-900 → blue-950, demande de Greg du 18/11/2026) cerclé de laiton — l'or sur l'azur, l'association de
     l'héraldique ; un seul cadre (aucun liseré intérieur : posé sur l'azur il tirait au gris). Contrastes mesurés : crème #fef3c7 sur l'azur ≥ 9:1 ;
     texte #1c0a02 sur le médaillon ≥ 6:1 à son arrêt le plus sombre (#d97706). */
  .announcement-plate {
    display: flex;
    align-items: stretch;
    margin-bottom: 1.5rem;
    overflow: hidden;
    border: 2px solid #b45309;
    border-radius: 0.65rem;
    background: linear-gradient(180deg, #1e3a8a 0%, #1b3277 55%, #172554 100%);
    box-shadow: 0 2px 8px rgba(23, 37, 84, 0.4);
  }

  /* Médaillon de laiton : le cor du crieur et le mot qui dit ce que c'est. */
  .announcement-cap {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.5rem 0.9rem;
    color: #1c0a02;
    font-weight: 700;
    letter-spacing: 0.02em;
    background: linear-gradient(180deg, #fde68a 0%, #fbbf24 50%, #d97706 100%);
    border-right: 2px solid #78350f;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55), inset -1px 0 0 rgba(120, 53, 15, 0.55);
  }
  .announcement-cap__label { display: none; font-size: 0.9rem; white-space: nowrap; }
  @media (min-width: 640px) { .announcement-cap__label { display: inline; } }

  /* Texte : empattements du système (aucune police à charger, charte §4), crème sur le brun. */
  .announcement-body {
    display: flex;
    flex: 1;
    align-items: center;
    min-width: 0;
    padding: 0.5rem 1rem;
    color: #fef3c7;
    font-family: Georgia, 'Palatino Linotype', Palatino, 'Times New Roman', serif;
    font-size: 1.0625rem;
    font-style: italic;
    line-height: 1.4;
  }

  /* Le texte sort de l'ombre à droite et y retourne à gauche. */
  .announcement-marquee {
    position: relative;
    overflow: hidden;
    -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 2.5rem, #000 calc(100% - 2.5rem), transparent 100%);
    mask-image: linear-gradient(90deg, transparent 0, #000 2.5rem, #000 calc(100% - 2.5rem), transparent 100%);
  }

  .announcement-action { display: flex; align-items: center; padding: 0 0.6rem 0 0.25rem; }

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
