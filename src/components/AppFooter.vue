<script setup>
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useCookieStore } from '@/stores/cookieStore'

// Footer légal — un seul design réutilisé partout (App.vue), en dehors du cadre de contenu de
// chaque page (`<main>` sur /app/*, cf. Cookies #12). "Gérer mes préférences" et la mention
// "outil non officiel" sont omis sur /app/* (déjà dans la NavBar / non pertinent une fois dans
// l'app) et sur Welcome (contenu déjà présent dans son propre disclaimer, voir WelcomeView.vue).
const props = defineProps({
  showPreferences: { type: Boolean, default: true },
  showUnofficialTag: { type: Boolean, default: true },
})

const { t } = useI18n()
const cookieStore = useCookieStore()
</script>

<template>
  <footer class="w-full bg-slate-300 dark:bg-slate-900 py-3 px-4">
    <div class="max-w-screen-lg mx-auto flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
      <RouterLink :to="{ name: 'legal-cookies' }" class="hover:underline">{{ t('Legal.Privacy.CookiesPolicyLink') }}</RouterLink>
      <span aria-hidden="true">&middot;</span>
      <RouterLink :to="{ name: 'legal-privacy' }" class="hover:underline">{{ t('Legal.Cookies.PrivacyPolicyLink') }}</RouterLink>
      <span aria-hidden="true">&middot;</span>
      <RouterLink :to="{ name: 'legal-mentions' }" class="hover:underline">{{ t('Legal.Mentions.PageTitle') }}</RouterLink>
      <template v-if="props.showPreferences">
        <span aria-hidden="true">&middot;</span>
        <button type="button" class="hover:underline" @click="cookieStore.openPreferencesModal()">
          {{ t('Cookies.Button.Preferences') }}
        </button>
      </template>
      <template v-if="props.showUnofficialTag">
        <span aria-hidden="true">&middot;</span>
        <span>{{ t('Common.Footer.UnofficialTool') }}</span>
      </template>
    </div>
  </footer>
</template>
