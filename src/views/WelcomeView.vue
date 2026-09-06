<script setup>
  import { computed } from 'vue'
  import { RouterLink, useRouter } from 'vue-router'
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

        <p class="text-slate-700 dark:text-slate-300 text-center max-w-2xl mx-auto text-sm">
          {{ t('Welcome.Access.Text') }}
        </p>
      </div>
    </div>

    <!-- Footer : fusionne le disclaimer/copyright d'origine avec les liens légaux (Cookies #12).
         Pas de bouton "Gérer mes préférences" ni de mention "outil non officiel" séparée ici —
         déjà couverts par le disclaimer ci-dessous, pas de doublon (retour de Greg). -->
    <div class="absolute bottom-0 inset-x-0 bg-slate-300 dark:bg-slate-900 py-3 px-4 text-center space-y-1">
      <nav class="flex flex-wrap items-center justify-center gap-x-2 text-xs text-slate-700 dark:text-slate-200">
        <RouterLink :to="{ name: 'legal-cookies' }" class="hover:underline">{{ t('Legal.Privacy.CookiesPolicyLink') }}</RouterLink>
        <span aria-hidden="true">&middot;</span>
        <RouterLink :to="{ name: 'legal-privacy' }" class="hover:underline">{{ t('Legal.Cookies.PrivacyPolicyLink') }}</RouterLink>
        <span aria-hidden="true">&middot;</span>
        <RouterLink :to="{ name: 'legal-mentions' }" class="hover:underline">{{ t('Legal.Mentions.PageTitle') }}</RouterLink>
      </nav>
      <i18n-t keypath="Welcome.Disclaimer" tag="p" scope="global" class="text-slate-700 dark:text-slate-200 text-xs">
        <template #link>
          <a href="https://www.renaissancekingdoms.com/" target="_blank" rel="noopener noreferrer" class="underline hover:text-orange-500">Renaissance Kingdoms</a>
        </template>
      </i18n-t>
      <p class="text-slate-700 dark:text-slate-200 text-xs">
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