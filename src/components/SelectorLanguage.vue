<template>
  <button
    @click="toggleLocale"
    class="btn-grad-slate relative z-50 px-3 py-2 cursor-pointer rounded-md border border-slate-300 dark:border-slate-600 focus:outline-none"
    :aria-label="t('Common.Language.Title')"
    type="button"
  >
    <span class="w-6 h-6 text-white font-bold">
      {{ currentLocale.toUpperCase() }}
    </span>
  </button>
</template>

<script setup>
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useCookieStore } from '@/stores/cookieStore'
  import { setLocale, loadFailedMessage } from '@/i18n/index'
  import { push } from 'notivue'

  const { t, locale } = useI18n()
  const cookieStore = useCookieStore()

  const isCurrentFrench = computed(() => locale.value === 'fr')
  const currentLocale = computed(() => isCurrentFrench.value ? 'FR' : 'EN')

  /*
    La restauration de la langue mémorisée ne se fait plus ici. Elle vivait dans un
    `onMounted`, donc après un premier rendu en français : un visiteur anglophone voyait la
    page s'afficher en français avant de basculer. Elle est désormais appliquée dans
    `main.js` avant le montage — ce composant ne fait plus que changer de langue à la
    demande.

    `setLocale` est asynchrone : le fichier de la langue cible est chargé à la demande, et
    la bascule n'a lieu qu'une fois les messages en place, jamais avant. Si le chargement
    échoue, l'interface reste dans la langue courante et la préférence n'est pas mémorisée —
    sinon chaque visite suivante retenterait une langue qui n'a jamais été affichée.
    Un toast le dit : sans lui, le bouton semblait simplement ne pas répondre. Il se dit dans
    la langue DEMANDÉE, pas dans celle restée active — voir `loadFailedMessage` dans
    src/i18n/index.js pour la raison de ces littéraux. notivue l'annonce aux lecteurs d'écran
    (`role="alert"`, `aria-live="assertive"` sur les erreurs).
  */
  const toggleLocale = async () => {
    const newLocale = isCurrentFrench.value ? 'en' : 'fr'
    const applied = await setLocale(newLocale)
    if (applied === newLocale) {
      cookieStore.setLocale(newLocale)
    } else {
      push.error(loadFailedMessage(newLocale))
    }
  }
</script>
