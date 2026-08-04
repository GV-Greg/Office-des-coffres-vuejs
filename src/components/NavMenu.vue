<script setup>
/*
  imports
*/
  import { computed } from 'vue'
  import { RouterLink } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { useAuthStore } from '@/stores/authStore'

/*
  User data
*/
  const authUser = useAuthStore()
  const { t } = useI18n()

/*
  Menu items
*/
  const pages = computed(() => [
    { name: t('NavMenu.Home'), link: "/app/", icon:"gi-medieval-pavilion", color: "slate", status: "public"},
    { name: t('NavMenu.Economy'), link: "/app/eco", icon:"gi-crown-coin", color: "yellow", status: "public"},
    { name: t('NavMenu.Security'), link: "/app/secu/guet", icon:"gi-swords-emblem", color: "rose", status: "public"},
    { name: t('NavMenu.Animation'), link: "/app/anim", icon:"gi-rolling-dice-cup", color: "teal", status: "public"},
    { name: t('NavMenu.Profile'), link: "/app/profil", icon:"gi-barbute", color: "slate", status: "private"},
  ])
</script>

<template>
  <nav class="flex flex-wrap justify-center gap-2">
    <RouterLink v-for="(page, index) in pages" :key="index" :to="page.link" v-show="page.status === 'public' || (page.status === 'private' && authUser.isLoggedIn)"
                class="mx-2 md:mx-5 h-20 w-20 p-4 flex flex-col items-center btn-menu-rounded"
                :class="`btn-${page.color}`">
      <v-icon :name="page.icon" scale="2" class="text-4xl" :class="`text-${page.color}-100`"/>
      <span class="text-xs text-gray-100 font-bold">{{ page.name }}</span>
    </RouterLink>
  </nav>
</template>