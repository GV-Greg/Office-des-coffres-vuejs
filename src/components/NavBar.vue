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
  import { useCookieStore } from '@/stores/cookieStore'
  import { ADMIN_ORIGIN } from '@/api.js'
  import logoHorizontal from '@/assets/logo/logo-horizontal.svg'
  import logoEcu from '@/assets/logo/ecu.svg'

  const router = useRouter()
  const { t } = useI18n()
  const authStore = useAuthStore()
  const cookieStore = useCookieStore()

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
            <!-- Boutons odc-* au niveau STANDARD (`--soft`, sans laiton : le relief complet est
                 réservé au menu M1), tous à la même hauteur (44 px, taille par défaut). La taille
                 des icônes est fixée par `.odc-btn > svg`, pas par `scale`. -->
            <RouterLink :to="{ name: 'home' }" class="odc-btn odc-btn--soft odc-btn--rect odc--blue">
              <v-icon name="gi-medieval-pavilion" />{{ t('NavBar.Home') }}
            </RouterLink>
            <a
              v-if="authStore.isLoggedIn && authStore.isAdmin"
              :href="`${ADMIN_ORIGIN}/dashboard`"
              target="_blank"
              rel="noopener noreferrer"
              class="odc-btn odc-btn--soft odc-btn--rect odc--dark"
            >
              <v-icon name="ri-home-gear-line" />{{ t('NavBar.Admin') }}
            </a>
            <button
              type="button"
              class="odc-btn odc-btn--soft odc-btn--rect odc--slate"
              @click="cookieStore.openPreferencesModal()"
            >
              <v-icon name="fa-sliders-h" />
              {{ t('Cookies.Button.Preferences') }}
            </button>
          </div>
          <div class="space-x-3 justify-self-center flex items-center">
            <!-- Logo visible sur toutes les pages /app/*, accueil compris (Greg, 27/09/2026 —
                 l'ancien titre texte était masqué sur `home`). Sous `tablet`, l'écu seul : le
                 logo horizontal (≈ 165 px) ne tient pas dans la colonne centrale.
                 Texte du logo vectorisé dans le SVG : aucune police à charger. -->
            <RouterLink
              :to="{ name: 'home' }"
              class="flex items-center"
              data-testid="site-logo"
            >
              <picture>
                <source :srcset="logoHorizontal" media="(min-width: 640px)">
                <img :src="logoEcu" :alt="t('Common.SiteName')" class="h-12 laptop:h-14 w-auto">
              </picture>
            </RouterLink>
          </div>
          <div class="space-x-3 justify-self-end flex items-center">
            <SelectorCharacter />
            <SelectorMenu />
            <button
              v-if="authStore.isLoggedIn"
              type="button"
              @click="logout"
              class="odc-btn odc-btn--soft odc-btn--rect odc-btn--icon odc--red z-50"
              :aria-label="t('NavBar.Logout')"
              :title="t('NavBar.Logout')"
            >
              <v-icon name="fa-power-off" />
            </button>
          </div>
        </nav>
      </div>
    </div>
  </header>
</template>