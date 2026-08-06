<script setup>
  import { computed } from 'vue'
  import { useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import SelectorMenu from '@/components/SelectorMenu.vue'
  const router = useRouter()
  const { t } = useI18n()

  const START_YEAR = 2026
  const currentYear = new Date().getFullYear()
  const developmentYears = computed(() => (
    currentYear > START_YEAR ? `${START_YEAR}-${currentYear}` : `${START_YEAR}`
  ))
</script>

<template>
  <div class="relative min-h-screen">
    <!-- Settings Menu -->
    <div class="absolute top-4 right-4">
      <SelectorMenu />
    </div>

    <!-- Main Content -->
    <div class="flex flex-col items-center px-4 pt-16 tablet:pt-24">
      <div class="max-w-4xl w-full space-y-12">
        <div class="text-center">
          <h1 class="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-orange-400 to-red-600 mb-6">
            {{ t('Common.SiteName') }}
          </h1>
        </div>

        <div class="flex flex-col items-center space-y-8">
          <button 
            @click="router.push('/login')"
            class="inline-flex items-center justify-center"
          >
            <v-icon 
              name="bi-shield-lock-fill" 
              scale="10" 
              animation="ring" 
              hover 
              class="text-slate-800 dark:text-slate-200"
            />
          </button>
          
          <div class="animate-bounce grid grid-cols-1 justify-items-center">
            <div class="transform rotate-225">
              <v-icon name="gi-broadhead-arrow" scale="2" class="text-slate-800 dark:text-slate-200" />
            </div>
            <p class="text-slate-800 dark:text-slate-200 text-lg font-medium">
              {{ t('Welcome.ClickHint') }}
            </p>
          </div>
        </div>

        <p class="text-slate-800 dark:text-slate-200 text-center max-w-2xl mx-auto italic">
          {{ t('Welcome.Intro') }}
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div class="absolute bottom-4 inset-x-0 text-center space-y-1">
      <i18n-t keypath="Welcome.Disclaimer" tag="p" scope="global" class="text-slate-800 dark:text-slate-200 text-xs">
        <template #link>
          <a href="https://www.renaissancekingdoms.com/" target="_blank" rel="noopener noreferrer" class="underline hover:text-orange-500">Renaissance Kingdoms</a>
        </template>
      </i18n-t>
      <p class="text-slate-800 dark:text-slate-200 text-xs">
        {{ t('Welcome.Copyright', { years: developmentYears }) }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.min-h-screen {
  min-height: calc(100vh - 2rem);
}
</style>