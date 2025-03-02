<script setup>
  import NavMenu from '@/components/NavMenu.vue'
  import { computed } from 'vue'
  import { useCookieStore } from '@/stores/cookieStore'

  const cookieStore = useCookieStore()
  const canUserLogin = computed(() => cookieStore.canUserLogin)
</script>

<template>
  <main class="md:w-3/4">
    <div class="overflow-y-auto flex flex-col flex-grow">
      <h2>L'<span class="font-bold text-transparent bg-clip-text bg-gradient-to-br from-orange-400 to-red-600">Office des coffres</span> vous souhaite la bienvenue !</h2>
      <p>Elle met à disposition des coffres qui vous aideront dans certaines tâches liées à l'animation, à la sécurité ou à l'économie.</p>
      <p class="text-blue-500 font-bold mt-10 italic text-center">L'Office est actuellement en construction...</p>
    </div>
    <NavMenu />
  </main>
</template>

<style scoped>
  h2 {
    @apply font-normal
  }
</style>