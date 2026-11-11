<script setup>
  import AnimPublicShell from '@/components/anim/AnimPublicShell.vue'
  import DecodeActivityView from '@/views/modules/animation/DecodeActivityView.vue'

  /*
    Décode le code — la page PUBLIQUE d'une activité, à partager avec la communauté (`/public/activite/decode/<adresse>`) : la coquille
    commune des pages publiques (AnimPublicShell) autour du contenu de `DecodeActivityView`.
  */
</script>

<template>
  <AnimPublicShell>
    <DecodeActivityView />
  </AnimPublicShell>
</template>
