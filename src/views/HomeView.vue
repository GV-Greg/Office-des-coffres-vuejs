<script setup>
  import NavMenu from '@/components/NavMenu.vue'
  import { computed } from 'vue'
  import { RouterLink } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { useAuthStore } from '@/stores/authStore'
  import whatsNew from '@/data/whatsNew.json'

  const { t, locale } = useI18n()
  const authStore = useAuthStore()

  function newsOfType(type) {
    return whatsNew
      .filter((item) => item.type === type && (item.scope === 'public' || authStore.isLoggedIn))
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }

  const visibleNews = computed(() => newsOfType('feature'))
  const visibleFixes = computed(() => newsOfType('fix'))

  function formatNewsDate(dateStr) {
    return new Intl.DateTimeFormat(locale.value === 'fr' ? 'fr-FR' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date(dateStr))
  }
</script>

<template>
  <main>
    <div class="overflow-y-auto flex flex-col flex-grow">
      <i18n-t keypath="Home.WelcomeMessage" tag="h2" scope="global">
        <template #brand>
          <span class="font-bold text-transparent bg-clip-text bg-gradient-to-br from-orange-400 to-red-600">{{ t('Common.SiteName') }}</span>
        </template>
      </i18n-t>
      <div v-if="!authStore.isLoggedIn" class="flex justify-center mt-4">
        <RouterLink to="/login" class="btn btn-primary">
          <v-icon name="fa-unlock-alt" scale="1" />
          {{ t('Home.LoginButton') }}
        </RouterLink>
      </div>
      <div
        v-if="visibleNews.length || visibleFixes.length"
        class="mt-12 max-w-6xl mx-auto w-full px-4 grid grid-cols-1 tablet:grid-cols-2 gap-x-16 gap-y-12"
      >
        <section v-if="visibleNews.length" class="news">
          <h3 class="flex items-center gap-2 text-orange-500 dark:text-orange-500 uppercase tracking-widest text-xs font-bold mb-5">
            <v-icon name="gi-scroll-unfurled" scale="1.1" />
            {{ t('Home.News') }}
          </h3>
          <ol class="relative border-l-2 border-slate-300 dark:border-slate-300 space-y-6">
            <li v-for="item in visibleNews" :key="item.id" class="relative pl-6">
              <span
                class="absolute -left-[0.95rem] top-0 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-gray-200 dark:ring-gray-200"
                :class="item.scope === 'private' ? 'bg-gradient-to-br from-green-400 to-green-600' : 'bg-gradient-to-br from-orange-400 to-red-600'"
              >
                <v-icon name="gi-bugle-call" scale="0.65" class="text-white" />
              </span>
              <div class="flex items-baseline gap-2 flex-wrap">
                <time class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-500">{{ formatNewsDate(item.date) }}</time>
                <span
                  v-if="item.scope === 'private'"
                  class="text-[0.65rem] uppercase tracking-wide px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-100 dark:text-green-700"
                >
                  {{ t('Home.NewsMembers') }}
                </span>
              </div>
              <p class="text-slate-800 dark:text-slate-800 text-sm mt-1">
                {{ locale === 'fr' ? item.fr : item.en }}
              </p>
            </li>
          </ol>
        </section>
        <section v-if="visibleFixes.length" class="fixes">
          <h3 class="flex items-center gap-2 text-slate-500 dark:text-slate-400 uppercase tracking-widest text-xs font-bold mb-5">
            <v-icon name="gi-hammer-nails" scale="1.1" />
            {{ t('Home.Fixes') }}
          </h3>
          <ol class="relative border-l-2 border-slate-300 dark:border-slate-300 space-y-6">
            <li v-for="item in visibleFixes" :key="item.id" class="relative pl-6">
              <span
                class="absolute -left-[0.95rem] top-0 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-gray-200 dark:ring-gray-200"
                :class="item.scope === 'private' ? 'bg-gradient-to-br from-purple-400 to-purple-600' : 'bg-gradient-to-br from-blue-400 to-blue-600'"
              >
                <v-icon name="gi-bugle-call" scale="0.65" class="text-white" />
              </span>
              <div class="flex items-baseline gap-2 flex-wrap">
                <time class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-500">{{ formatNewsDate(item.date) }}</time>
                <span
                  v-if="item.scope === 'private'"
                  class="text-[0.65rem] uppercase tracking-wide px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-100 dark:text-purple-700"
                >
                  {{ t('Home.NewsMembers') }}
                </span>
              </div>
              <p class="text-slate-800 dark:text-slate-800 text-sm mt-1">
                {{ locale === 'fr' ? item.fr : item.en }}
              </p>
            </li>
          </ol>
        </section>
      </div>
    </div>
    <NavMenu />
  </main>
</template>

<style scoped>
  h2 {
    @apply font-normal
  }
</style>