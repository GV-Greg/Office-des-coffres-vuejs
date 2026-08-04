<script setup>
  import { RouterLink } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import NavMenu from '../../../components/NavMenu.vue'

  const { t } = useI18n()
</script>

<template>
  <main>
    <div class="w-full flex flex-cols-2 flex-grow mb-2">
      <div class="w-1/6 flex flex-col justify-start text-teal-600">
        <h3 class="text-center">{{ t('Animation.Title') }}</h3>
        <v-icon name="gi-chest" scale="2" class="mr-1"/>
      </div>
      <div class="w-5/6 ml-2 p-1">
        {{ t('Common.Placeholder') }}
      </div>
    </div>
    <NavMenu />
  </main>
</template>