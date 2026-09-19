<script setup>
  import { computed } from 'vue'
  import { RouterLink, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import SelectorMenu from '@/components/SelectorMenu.vue'
  import { useAuthStore } from '@/stores/authStore'
  import { goBackOrWelcome } from '@/modules/goBackOrWelcome'

  const { t } = useI18n()
  const router = useRouter()
  const authStore = useAuthStore()

  // Cette route n'a pas de NavBar (pas de named view `Nav`) : le retour doit donc mener là où
  // le visiteur a effectivement sa place — l'app pour un compte connecté, la porte de l'Office
  // sinon.
  const homeRoute = computed(() => (authStore.isLoggedIn ? { name: 'home' } : { name: 'welcome' }))
</script>

<template>
  <div class="relative min-h-screen">
    <!-- Pas de NavBar sur cette route : thème et langue restent accessibles ici, comme sur
         Welcome et les pages légales. -->
    <div class="absolute top-4 right-4">
      <SelectorMenu />
    </div>

    <div class="flex flex-col items-center px-4 pt-16 tablet:pt-24 pb-16">
      <div class="max-w-2xl w-full space-y-6 text-center">
        <v-icon
          name="gi-chest"
          scale="6"
          class="text-slate-700 dark:text-slate-300"
        />

        <!-- Code HTTP : identique dans les deux langues, routé par i18n quand même pour
             cohérence (même traitement que Common.SiteName). -->
        <div class="text-7xl tablet:text-8xl font-extrabold tracking-widest text-slate-400 dark:text-slate-600">
          {{ t('NotFound.Code') }}
        </div>

        <h1>{{ t('NotFound.Title') }}</h1>

        <p class="italic max-w-xl mx-auto">{{ t('NotFound.Lead') }}</p>

        <p class="text-sm text-slate-700 dark:text-slate-300 max-w-xl mx-auto">
          {{ t('NotFound.Hint') }}
        </p>

        <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
          <RouterLink :to="homeRoute" class="btn btn-default no-underline">
            {{ t('NotFound.BackHome') }}
          </RouterLink>

          <button type="button" class="btn btn-grad-slate" @click="goBackOrWelcome(router)">
            <v-icon name="fa-reply" scale="0.9" />
            {{ t('NotFound.BackPrevious') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.min-h-screen {
  min-height: calc(100vh - 2rem);
}
</style>
