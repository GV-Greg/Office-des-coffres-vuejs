<script setup>
  import { onMounted } from 'vue'
  import { RouterView, useRoute } from 'vue-router'
  import { Notivue, Notification, materialTheme } from 'notivue'
  import { useCookieStore } from './stores/cookieStore'
  import CookiesBanner from './components/CookiesBanner.vue'
  import LoadingOverlay from './components/LoadingOverlay.vue'
  import AppFooter from './components/AppFooter.vue'

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
    <div class="flex-1 flex flex-col">
      <RouterView />
    </div>
    <!-- Un seul design de footer partout (Cookies #12), toujours hors du cadre de contenu.
         WelcomeView a son propre footer fusionné (disclaimer + liens légaux, voir WelcomeView.vue).
         Sur /app/*, contenu réduit : "Gérer mes préférences" est déjà dans la NavBar. -->
    <AppFooter
      v-if="route.name !== 'welcome'"
      :show-preferences="!!route.meta.public"
      :show-unofficial-tag="!!route.meta.public"
    />

    <CookiesBanner />
    <LoadingOverlay />
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

/* Notivue : Rules for mobile devices */
@media (max-width: 768px) {
  :root {
    --nv-root-x-align: center;
  }
}
</style>
