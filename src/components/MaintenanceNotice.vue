<script setup>
  import { watch, onBeforeUnmount } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { http } from '@/api'
  import useMaintenance, { clearBypass, isMaintenanceError } from '@/use/useMaintenance'
  import GateIllustration from '@/components/loading/GateIllustration.vue'
  import logoVertical from '@/assets/logo/logo-vertical.svg'

  /*
    Mode maintenance (brief admin/content/brief-mode-maintenance.md, 18/11/2026) : deux pièces, une seule monture dans App.vue.
    - La page de maintenance : plein écran, le logo de l'Office (Greg, 18/11/2026), la porte de la salle et un message, sans lien ni navigation. Embarquée dans
      l'application, elle s'affiche sans aucun appel à l'API (celle-ci répond 503). La langue est celle déjà appliquée par
      main.js (préférence mémorisée, sinon navigateur) — l'API n'est pas consultée.
    - Un liseré pour l'administrateur qui est entré par `/maintenance/<secret>` : il voit l'Office alors qu'il est fermé au
      public, et doit le savoir (et pouvoir en sortir).
  */
  const { t } = useI18n()
  const { isMaintenance, hasBypass } = useMaintenance()

  // Rouverture : on sonde une route publique toute légère ; dès qu'elle répond autrement que par la
  // maintenance, on recharge — l'interface retrouve l'Office sans que le joueur ait à y penser.
  const POLL_MS = 30000
  let timer = null

  const probe = async () => {
    try {
      await http.get('anim/activity-types')
      window.location.reload()
    } catch (error) {
      // Toujours fermé (l'intercepteur de api.js garde la page), ou réseau coupé : on retente.
      if (!isMaintenanceError(error)) return
    }
  }

  const stopPolling = () => {
    clearInterval(timer)
    timer = null
  }

  watch(isMaintenance, (active) => {
    stopPolling()
    if (active) timer = setInterval(probe, POLL_MS)
  }, { immediate: true })

  onBeforeUnmount(stopPolling)

  const leaveBypass = () => {
    clearBypass()
    window.location.reload()
  }
</script>

<template>
  <div
    v-if="isMaintenance"
    class="fixed inset-0 z-[10000] overflow-y-auto bg-slate-200 dark:bg-slate-800"
    role="status"
    data-testid="maintenance-page"
  >
    <!-- Défilement possible (petit écran, texte long) : le centrage est porté par ce conteneur, qui prend au moins la hauteur de l'écran. -->
    <div class="min-h-full flex flex-col items-center justify-center gap-6 px-4 py-8 text-center">
      <img :src="logoVertical" :alt="t('Common.SiteName')" class="h-32 tablet:h-40 w-auto" data-testid="maintenance-logo">
      <GateIllustration />
      <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-50">{{ t('Maintenance.Title') }}</h1>
      <!-- dark: répété sur chaque <p>, la règle globale `.dark p` écraserait la couleur. -->
      <p class="max-w-md text-lg text-slate-700 dark:text-slate-200">{{ t('Maintenance.Message') }}</p>
      <!-- Le descriptif de l'accueil (Welcome.Intro / Welcome.Access), mis au futur : l'Office rouvre bientôt (Greg, 18/11/2026). -->
      <div class="max-w-xl space-y-3">
        <p class="italic text-slate-800 dark:text-slate-200" data-testid="maintenance-intro">{{ t('Maintenance.Intro') }}</p>
        <p class="text-sm text-slate-700 dark:text-slate-300" data-testid="maintenance-access">{{ t('Maintenance.Access') }}</p>
      </div>
      <!-- Le descriptif non officiel de l'accueil (Welcome.Disclaimer), nom du jeu en texte simple : la page n'a ni lien ni navigation. -->
      <i18n-t keypath="Welcome.Disclaimer" tag="p" scope="global" class="max-w-md text-xs text-slate-700 dark:text-slate-200" data-testid="maintenance-descriptor">
        <template #link>Renaissance Kingdoms</template>
      </i18n-t>
    </div>
  </div>

  <div
    v-if="hasBypass"
    class="fixed bottom-0 left-0 right-0 z-[10001] flex flex-wrap items-center justify-center gap-3 px-4 py-2 bg-yellow-200 text-yellow-950 border-t-2 border-yellow-600"
    data-testid="maintenance-bypass-banner"
  >
    <span class="text-sm font-semibold">{{ t('Maintenance.BypassBanner') }}</span>
    <button type="button" class="odc-btn odc-btn--soft odc--slate odc-btn--sm" data-testid="maintenance-bypass-leave" @click="leaveBypass">
      {{ t('Maintenance.BypassLeave') }}
    </button>
  </div>
</template>
