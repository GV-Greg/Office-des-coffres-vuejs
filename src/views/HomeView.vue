<script setup>
  import NavMenu from '@/components/NavMenu.vue'
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useCookieStore } from '@/stores/cookieStore'
  import { useAuthStore } from '@/stores/authStore'
  import whatsNew from '@/data/whatsNew.json'

  const { t, locale } = useI18n()
  const cookieStore = useCookieStore()
  const authStore = useAuthStore()
  const canUserLogin = computed(() => cookieStore.canUserLogin)

  const visibleNews = computed(() => {
    return whatsNew
      .filter((item) => item.scope === 'public' || authStore.isLoggedIn)
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  })

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
      <section v-if="visibleNews.length" class="news mt-12 max-w-2xl mx-auto w-full px-4">
        <h3 class="flex items-center gap-2 text-orange-500 dark:text-orange-500 uppercase tracking-widest text-xs font-bold mb-5">
          <v-icon name="gi-scroll-unfurled" scale="1.1" />
          {{ t('Home.News') }}
        </h3>
        <ol class="relative border-l-2 border-slate-300 dark:border-slate-300 space-y-6">
          <li v-for="item in visibleNews" :key="item.date + item.fr" class="relative pl-6">
            <span
              class="absolute -left-[0.95rem] top-0 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-gray-200 dark:ring-gray-200"
              :class="item.scope === 'private' ? 'bg-green-600 dark:bg-green-600' : 'bg-gradient-to-br from-orange-400 to-red-600'"
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
    </div>
    <NavMenu />
  </main>
</template>

<style scoped>
  h2 {
    @apply font-normal
  }
</style>