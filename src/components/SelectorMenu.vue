<template>
  <!-- SelectorCharacter n'est volontairement pas ici : ce composant est partagé avec
       Welcome/Login/Register, où il n'a pas de sens (voir NavBar.vue, pages /app/* uniquement). -->
  <div class="flex items-center space-x-2 relative z-50">
    <SelectorTheme />
    <SelectorLanguage />
  </div>
</template>

<script setup>
import SelectorTheme from './SelectorTheme.vue'
import SelectorLanguage from './SelectorLanguage.vue'
</script>
