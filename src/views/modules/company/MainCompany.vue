<script setup>
  import { RouterLink } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import NavMenu from '@/components/NavMenu.vue'

  const { t } = useI18n()
</script>

<template>
  <main>
    <div class="overflow-y-auto flex flex-col flex-grow">
      <h2>{{ t('Company.Title') }}</h2>
    </div>
    <NavMenu />
  </main>
</template>