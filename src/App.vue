<script setup>
  import { onMounted } from 'vue'
  import { RouterView } from 'vue-router'
  import { Notivue, Notification } from 'notivue'
  import { useCookieStore } from './stores/cookieStore'
  import CookiesBanner from './components/CookiesBanner.vue'

  const cookieStore = useCookieStore()

  onMounted(async () => {
    cookieStore.initializeCookies()

    // Appliquer le thème initial
    const theme = cookieStore.essentialCookies.theme
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  })
</script>

<template>
  <div class="min-h-screen w-full bg-slate-200 dark:bg-slate-900 transition-colors duration-200">
    <RouterView name="Nav" />
    <RouterView />

    <CookiesBanner />
    <Notivue v-slot="notivue">
      <Notification v-bind="notivue" />
    </Notivue>
  </div>
</template>

<style>
@import '@/assets/base.css';
@import '@/assets/style.css';

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
