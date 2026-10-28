<script setup>
  import { RouterLink } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import SelectorMenu from '@/components/SelectorMenu.vue'
  import logoHorizontal from '@/assets/logo/logo-horizontal.svg'
  import DecodeActivityView from '@/views/modules/animation/DecodeActivityView.vue'

  /*
    Décode le code — la page PUBLIQUE d'une activité, à partager avec la communauté (`/public/activite/decode/<adresse>`).
    Hors de l'application : pas de NavBar ni de menu du module, thème et langue accessibles comme sur les pages légales, et une
    porte vers l'entrée des salles pour qui voudrait organiser la sienne. Le contenu est celui de `DecodeActivityView`.
  */
  const { t } = useI18n()
</script>

<template>
  <div class="flex-1 flex flex-col">
    <!-- Menu de la page publique : le logo centré (porte vers l'Office), à droite l'invitation à organiser, le thème et la langue. -->
    <header class="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-3" data-testid="public-menu">
      <span aria-hidden="true"></span>
      <RouterLink :to="{ name: 'welcome' }" class="justify-self-center" data-testid="public-logo">
        <img :src="logoHorizontal" :alt="t('Common.SiteName')" class="h-10 tablet:h-12 w-auto" />
      </RouterLink>
      <div class="justify-self-end flex flex-wrap items-center justify-end gap-2">
        <!-- Discret : la page se partage sur le forum, l'invitation reste neutre (porte vers l'Office). -->
        <RouterLink :to="{ name: 'welcome' }" class="odc-btn odc-btn--soft odc-btn--sm odc--slate" data-testid="public-organize">
          <v-icon name="gi-open-gate" aria-hidden="true" />{{ t('Animation.Public.Organize') }}
        </RouterLink>
        <SelectorMenu />
      </div>
    </header>

    <div class="px-2 flex-1 flex flex-col">
      <div class="page-card" data-testid="public-page">
        <div class="w-full">
          <DecodeActivityView />
        </div>
      </div>
    </div>

    <!-- Une ligne discrète tient lieu de footer : la mention « site non officiel » reste sur cette page. -->
    <p class="px-4 py-3 text-center text-xs text-slate-700 dark:text-slate-300" data-testid="public-footer">{{ t('Animation.Public.Footer') }}</p>
  </div>
</template>
