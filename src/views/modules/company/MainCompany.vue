<script setup>
  import { RouterLink } from 'vue-router'
  import { useI18n } from 'vue-i18n'

  const { t } = useI18n()
</script>

<template>
  <main class="md:w-3/4 overflow-y-scroll">
    <div class="overflow-y-auto flex flex-col flex-grow">
      <h2>{{ t('Company.Title') }}</h2>
    </div>
  </main>
</template>