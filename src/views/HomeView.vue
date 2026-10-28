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
  <div class="page-card">
    <div class="overflow-y-auto flex flex-col flex-grow">
      <i18n-t keypath="Home.WelcomeMessage" tag="h2" scope="global">
        <template #brand>
          <span class="font-bold text-transparent bg-clip-text bg-gradient-to-br from-orange-400 to-red-600">{{ t('Common.SiteName') }}</span>
        </template>
      </i18n-t>
      <div v-if="!authStore.isLoggedIn" class="flex justify-center mt-4">
        <RouterLink to="/login" class="odc-btn odc-btn--soft odc--orange">
          <v-icon name="fa-unlock-alt" scale="1" />
          {{ t('Home.LoginButton') }}
        </RouterLink>
      </div>
      <div
        v-if="visibleNews.length || visibleFixes.length"
        class="mt-12 max-w-6xl mx-auto w-full px-4 grid grid-cols-1 tablet:grid-cols-2 gap-x-16 gap-y-12"
      >
        <section v-if="visibleNews.length" class="news">
          <h3 id="home-news-title" class="flex items-center gap-2 text-orange-500 dark:text-orange-500 uppercase tracking-widest text-xs font-bold mb-5">
            <v-icon name="gi-scroll-unfurled" scale="1.1" />
            {{ t('Home.News') }}
          </h3>
          <!-- Hauteur plafonnée : la chronique défile dans son cadre au lieu d'allonger la page (et de repousser
               le footer) à chaque entrée. Marge gauche compensée : les pastilles dépassent de la ligne. -->
          <div class="chronicle-scroll max-h-[max(14rem,calc(100vh-31rem))] overflow-y-auto pl-4 -ml-4 pr-3 pb-8" tabindex="0" role="region" aria-labelledby="home-news-title">
          <ol class="relative border-l-2 border-slate-300 dark:border-slate-300 space-y-6">
            <li v-for="item in visibleNews" :key="item.id" class="relative pl-6">
              <span
                class="odc-dot absolute -left-[0.95rem] top-0"
                :class="item.scope === 'private' ? 'odc--green' : 'odc--orange'"
              >
                <v-icon name="gi-bugle-call" />
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
          </div>
        </section>
        <section v-if="visibleFixes.length" class="fixes">
          <h3 id="home-fixes-title" class="flex items-center gap-2 text-slate-500 dark:text-slate-400 uppercase tracking-widest text-xs font-bold mb-5">
            <v-icon name="gi-hammer-nails" scale="1.1" />
            {{ t('Home.Fixes') }}
          </h3>
          <div class="chronicle-scroll max-h-[max(14rem,calc(100vh-31rem))] overflow-y-auto pl-4 -ml-4 pr-3 pb-8" tabindex="0" role="region" aria-labelledby="home-fixes-title">
          <ol class="relative border-l-2 border-slate-300 dark:border-slate-300 space-y-6">
            <li v-for="item in visibleFixes" :key="item.id" class="relative pl-6">
              <span
                class="odc-dot absolute -left-[0.95rem] top-0"
                :class="item.scope === 'private' ? 'odc--violet' : 'odc--blue'"
              >
                <v-icon name="gi-bugle-call" />
              </span>
              <div class="flex items-baseline gap-2 flex-wrap">
                <time class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-500">{{ formatNewsDate(item.date) }}</time>
                <span
                  v-if="item.scope === 'private'"
                  class="text-[0.65rem] uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-100 dark:text-violet-700"
                >
                  {{ t('Home.NewsMembers') }}
                </span>
              </div>
              <p class="text-slate-800 dark:text-slate-800 text-sm mt-1">
                {{ locale === 'fr' ? item.fr : item.en }}
              </p>
            </li>
          </ol>
          </div>
        </section>
      </div>
    </div>
    <NavMenu />
  </div>
</template>

<style scoped>
  h2 {
    @apply font-normal
  }

  /* Cadre de la chronique : barre fine (celle du site, sombre et épaisse, est faite pour la page entière) et
     fondu sur les deux dernières rem, qui dit « la liste continue ». Le pb-8 du cadre laisse la dernière
     entrée hors du fondu une fois en bas. Les propriétés standard l'emportent sur ::-webkit-scrollbar. */
  .chronicle-scroll {
    scrollbar-width: thin;
    scrollbar-color: #94a3b8 transparent; /* slate-400, 2,45:1 contre la carte : voulu par Greg, sous les 3:1 de WCAG 1.4.11 */
    -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 2rem), transparent);
    mask-image: linear-gradient(to bottom, #000 calc(100% - 2rem), transparent);
  }
</style>