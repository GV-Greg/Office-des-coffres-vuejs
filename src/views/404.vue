<script setup>
  import { computed } from 'vue'
  import { useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import SelectorMenu from '@/components/SelectorMenu.vue'
  import { useAuthStore } from '@/stores/authStore'
  import logoVertical from '@/assets/logo/logo-vertical.svg'

  const { t } = useI18n()
  const router = useRouter()
  const authStore = useAuthStore()

  // Cette route n'a pas de NavBar (pas de named view `Nav`) : le retour doit donc mener là où
  // le visiteur a effectivement sa place — l'app pour un compte connecté, la porte de l'Office
  // sinon.
  const homeRoute = computed(() => (authStore.isLoggedIn ? { name: 'home' } : { name: 'welcome' }))

  // Un seul bouton (Greg, 27/09/2026) : retour à la page précédemment visitée. On lit l'historique
  // du NAVIGATEUR, pas celui du routeur : une adresse cassée tapée dans la barre recharge la page,
  // `history.state.back` est alors vide alors que la page précédente existe bien. Seul un onglet
  // neuf (historique d'une seule entrée) n'a rien à remonter → homeRoute.
  const goBack = () => {
    if (window.history.length > 1) window.history.back()
    else router.push(homeRoute.value)
  }
</script>

<template>
  <!-- Pas de hauteur minimale propre : App.vue occupe déjà l'écran et pousse le footer en bas.
       L'ancien `min-height: calc(100vh - 2rem)`, copié de Welcome (qui n'a pas le footer commun),
       ajoutait le footer SOUS un écran plein — la page défilait sans raison. -->
  <div class="relative">
    <!-- Pas de NavBar sur cette route : thème et langue restent accessibles ici, comme sur
         Welcome et les pages légales. -->
    <div class="absolute top-4 right-4">
      <SelectorMenu />
    </div>

    <div class="flex flex-col items-center px-4 pt-16 tablet:pt-24 pb-16">
      <div class="max-w-2xl w-full space-y-6 text-center">
        <!-- Logo à la place du coffre, sans code « 404 » (Greg, 27/09/2026) : le titre suffit, et le
             gros « 404 » grisé était sous le seuil de contraste dans les deux thèmes. -->
        <img :src="logoVertical" :alt="t('Common.SiteName')" class="mx-auto h-40 tablet:h-48 w-auto">

        <h1>{{ t('NotFound.Title') }}</h1>

        <p class="italic max-w-xl mx-auto">{{ t('NotFound.Lead') }}</p>

        <p class="text-sm text-slate-700 dark:text-slate-300 max-w-xl mx-auto">
          {{ t('NotFound.Hint') }}
        </p>

        <!-- Un seul bouton : retour à la page précédente, ou à homeRoute en arrivée directe. -->
        <div class="flex justify-center pt-2">
          <button type="button" class="odc-btn odc-btn--soft odc--orange" @click="goBack">
            <v-icon name="fa-reply" />
            {{ t('NotFound.BackHome') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
