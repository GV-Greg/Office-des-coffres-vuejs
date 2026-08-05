<template>
  <div class="flex items-center space-x-2 relative z-50">
    <SelectorCharacter />
    <SelectorTheme />
    <SelectorLanguage />
  </div>
</template>

<script setup>
import SelectorCharacter from './SelectorCharacter.vue'
import SelectorTheme from './SelectorTheme.vue'
import SelectorLanguage from './SelectorLanguage.vue'
</script>
