<script setup>
  import { onMounted } from 'vue'
  import { RouterView, useRoute } from 'vue-router'
  import { Notivue, Notification, materialTheme } from 'notivue'
  import { useCookieStore } from './stores/cookieStore'
  import CookiesBanner from './components/CookiesBanner.vue'
  import LoadingOverlay from './components/LoadingOverlay.vue'
  import AppFooter from './components/AppFooter.vue'
  import MaintenanceNotice from './components/MaintenanceNotice.vue'

  const cookieStore = useCookieStore()
  const route = useRoute()

  onMounted(async () => {
    cookieStore.initializeCookies()

    // Appliquer le thème initial
    const theme = cookieStore.comfortData.theme
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  })


</script>

<template>
  <div class="min-h-screen w-full flex flex-col bg-slate-200 dark:bg-slate-800 transition-colors duration-200">
    <RouterView name="Nav" />
    <!-- <main> et non <div> : c'est le repère qui permet aux lecteurs d'écran d'atteindre
         directement le contenu, et il manquait sur toutes les pages. -->
    <main class="flex-1 flex flex-col">
      <RouterView />
    </main>
    <!-- Un seul design de footer partout (Cookies #12), toujours hors du cadre de contenu.
         WelcomeView a son propre footer fusionné (disclaimer + liens légaux, voir WelcomeView.vue).
         Sur /app/*, contenu réduit : "Gérer mes préférences" est déjà dans la NavBar, mais la mention
         « Outil non officiel » reste affichée partout où le footer l'est (Greg, 11/11/2026). -->
    <AppFooter
      v-if="route.name !== 'welcome' && !route.meta.noFooter"
      :show-preferences="!!route.meta.public"
      :show-unofficial-tag="true"
    />

    <CookiesBanner />
    <LoadingOverlay />
    <MaintenanceNotice />
    <Notivue  v-slot="item">
      <Notification :item="item" :theme="materialTheme" />
    </Notivue>
  </div>
</template>

<style>
/* Notivue : Gap & z-index */
:root {
  --nv-gap: 1rem;
  --nv-z: 9999;
}

/* Notivue : les toasts glissent depuis la droite (config `animations` de main.js). Une seule passe, 0,35 s, comme l'animation d'origine ;
   `prefers-reduced-motion` est honoré par la règle globale de base.css (animationend se déclenche toujours : Notivue en dépend). */
.odc-toast-enter {
  animation: odc-toast-enter-kf 0.35s cubic-bezier(0.5, 1, 0.25, 1);
}
.odc-toast-leave {
  animation: odc-toast-leave-kf 0.35s ease;
}
@keyframes odc-toast-enter-kf {
  from { transform: translate3d(120%, 0, 0); opacity: 0; }
  to { transform: translateZ(0); opacity: 1; }
}
@keyframes odc-toast-leave-kf {
  from { transform: translateZ(0); opacity: 0.7; }
  to { transform: translate3d(120%, 0, 0); opacity: 0; }
}

/* Notivue : Rules for mobile devices */
@media (max-width: 768px) {
  :root {
    --nv-root-x-align: center;
  }
}
</style>
