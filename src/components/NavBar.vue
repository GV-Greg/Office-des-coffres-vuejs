<script setup>
/*
 imports
*/
  import { RouterLink, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { push } from 'notivue'
  import SelectorMenu from '@/components/SelectorMenu.vue'
  import SelectorCharacter from '@/components/SelectorCharacter.vue'
  import { useAuthStore } from '@/stores/authStore'
  import { ADMIN_ORIGIN } from '@/api.js'

  const router = useRouter()
  const { t } = useI18n()
  const authStore = useAuthStore()

  const logout = async () => {
    await authStore.logout()
    push.success(t('NavBar.LoggedOut'))
    router.push({ name: 'welcome' })
  }
</script>

<template>
  <header class="w-full mx-0 flex flex-col">
    <div class="w-full">
      <div class="flex items-center justify-end p-4">
        <nav class="w-full grid grid-cols-3 justify-items-stretch">
          <div class="space-x-3 justify-self-start flex items-center">
            <RouterLink :to="{ name: 'home' }" class="btn-grad-blue flex items-center rounded-lg pl-1.5 pr-3 py-0.5 no-underline font-semibold">
              <v-icon name="gi-medieval-pavilion" scale="2" class="mr-1"/><span class="font-bold text-xl">{{ t('NavBar.Home') }}</span>
            </RouterLink>
            <a
              v-if="authStore.isLoggedIn && authStore.isAdmin"
              :href="`${ADMIN_ORIGIN}/dashboard`"
              target="_blank"
              rel="noopener noreferrer"
              class="btn-grad-dark flex items-center rounded-lg pl-1.5 pr-3 py-0.5 no-underline font-semibold"
            >
              <v-icon name="ri-home-gear-line" scale="1.3" class="mr-1"/><span class="font-bold text-lg">{{ t('NavBar.Admin') }}</span>
            </a>
          </div>
          <div class="space-x-3 justify-self-center flex items-center">
            <div class="text-3xl font-bold text-transparent"
                 :class="{ 'bg-clip-text bg-gradient-to-br from-orange-400 to-red-600': router.currentRoute._value.name !== 'home' }">
              {{ t('Common.SiteName') }}
            </div>
          </div>
          <div class="space-x-3 justify-self-end flex items-center">
            <SelectorCharacter />
            <SelectorMenu />
            <button
              v-if="authStore.isLoggedIn"
              type="button"
              @click="logout"
              class="btn-grad-red relative z-50 p-2 inline-flex items-center justify-center cursor-pointer rounded-md border border-red-600 hover:border-red-700 transition-colors duration-200 focus:outline-none"
              :aria-label="t('NavBar.Logout')"
              :title="t('NavBar.Logout')"
            >
              <v-icon
                name="fa-power-off"
                class="w-6 h-6 text-white"
                scale="1.2"
              />
            </button>
          </div>
        </nav>
      </div>
    </div>
  </header>
</template>