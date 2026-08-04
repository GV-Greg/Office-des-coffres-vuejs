<script setup>
  import NavMenu from '@/components/NavMenu.vue'
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useCookieStore } from '@/stores/cookieStore'

  const { t } = useI18n()
  const cookieStore = useCookieStore()
  const canUserLogin = computed(() => cookieStore.canUserLogin)
</script>

<template>
  <main>
    <div class="overflow-y-auto flex flex-col flex-grow">
      <i18n-t keypath="Home.WelcomeMessage" tag="h2" scope="global">
        <template #brand>
          <span class="font-bold text-transparent bg-clip-text bg-gradient-to-br from-orange-400 to-red-600">{{ t('Common.SiteName') }}</span>
        </template>
      </i18n-t>
      <p class="text-slate-800 dark:text-slate-800">{{ t('Home.Description') }}</p>
      <p class="text-blue-500 dark:text-blue-500 font-bold mt-10 italic text-center">{{ t('Home.UnderConstruction') }}</p>
    </div>
    <NavMenu />
  </main>
</template>

<style scoped>
  h2 {
    @apply font-normal
  }
</style>