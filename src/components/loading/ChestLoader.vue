<script setup>
  import { ref, computed, watch, onBeforeUnmount } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { effectiveTiming } from '@/modules/chestTiming'
  import ChestIllustration from '@/components/loading/ChestIllustration.vue'

  /*
    Coffre de chargement INTERNE à la page (ouverture d'un module, pas changement de route : celui-là reste
    l'overlay global). Il entoure le contenu de la page :

      <ChestLoader :loading :error accent block-class @retry="load"> …contenu… </ChestLoader>

    - `loading` : la page attend ses données. Rien ne s'affiche avant `showDelay` (150 ms) : une page rapide n'a pas de coffre.
    - Le coffre n'est jamais coupé en plein mouvement : même si les données sont déjà là, le contenu attend la fin de
      l'ouverture (~1,4 s). Pas d'étapes affichées : le coffre seul.
    - `error` : message d'un chargement raté → coffre refermé qui tressaille, message, « Réessayer » (`retry`).
    - Au-delà de `timeout` (10 s) : même issue, sans attendre le délai d'axios (20 s).
    - Le titre « Ouverture du coffre… » ne change pas jusqu'au bout.
    - Prêt : la lueur jaillit, le coffre s'efface, PUIS le contenu apparaît d'un bloc (slot) — jamais les deux en même temps.
    Une seule annonce `role="status"`. Durées : modules/chestTiming.js.
    Maquette validée : admin/content/demo-animations-chargement.html.
  */
  const props = defineProps({
    loading: { type: Boolean, default: false },
    error: { type: String, default: '' },
    accent: { type: String, default: 'gold' },
    errorTestid: { type: String, default: 'chest-error' },
    // Place du coffre : par défaut au centre du conteneur ; une page à colonnes le cale sur la zone qu'il remplace
    // (ex. le tableau du registre, pas toute la largeur) en passant des classes LITTÉRALES.
    blockClass: { type: String, default: '' },
  })
  const emit = defineEmits(['retry'])
  const { t } = useI18n()

  const showChest = ref(false)
  const contentVisible = ref(!props.loading && !props.error)
  const burst = ref(false)
  const open = ref(false)
  const opened = ref(false)
  const finishing = ref(false)
  const timedOut = ref(false)
  const shake = ref(false)
  let timers = []

  const clearTimers = () => { timers.forEach(clearTimeout); timers = [] }
  // Une durée nulle (tests, mouvement réduit) s'exécute tout de suite : rien à attendre.
  const later = (fn, ms) => { if (ms <= 0) fn(); else timers.push(setTimeout(fn, ms)) }
  onBeforeUnmount(clearTimers)

  const failed = computed(() => !!props.error && !props.loading)
  const stuck = computed(() => props.loading && timedOut.value)
  const visible = computed(() => showChest.value || failed.value || stuck.value)
  const closed = computed(() => failed.value || stuck.value)

  function armTimeout() {
    later(() => { timedOut.value = true }, effectiveTiming().timeout)
  }

  function start() {
    clearTimers()
    const tm = effectiveTiming()
    contentVisible.value = false
    burst.value = open.value = opened.value = finishing.value = timedOut.value = false
    showChest.value = false
    later(() => {
      showChest.value = true
      later(() => { open.value = true }, tm.showDelay === 0 ? 0 : 350)
      later(() => { opened.value = true; tryFinish() }, tm.openDone === 0 ? 0 : tm.openDone + 350)
    }, tm.showDelay)
    armTimeout()
  }

  function tryFinish() {
    if (props.loading || props.error || !opened.value || !showChest.value || finishing.value) return
    finishing.value = true
    const tm = effectiveTiming()
    later(() => { burst.value = true }, tm.burst)
    later(() => { showChest.value = false }, tm.reveal)
    later(() => { contentVisible.value = true }, tm.content)
  }

  watch(() => props.loading, (now) => {
    if (now) { start(); return }
    if (props.error) { clearTimers(); contentVisible.value = false; return }
    if (showChest.value) { tryFinish(); return }
    clearTimers() // fini avant que le coffre ne paraisse : le contenu s'affiche directement
    contentVisible.value = true
  }, { immediate: true })

  watch(() => props.error, (message) => {
    if (message && !props.loading) { clearTimers(); contentVisible.value = false }
  })

  watch(closed, (isClosed) => {
    if (!isClosed) return
    shake.value = true
    later(() => { shake.value = false }, 600)
  })

  function onRetry() {
    if (stuck.value) { timedOut.value = false; armTimeout() }
    emit('retry')
  }

  const title = computed(() => {
    if (failed.value) return t('Chest.Failed')
    if (stuck.value) return t('Chest.Slow')
    return t('Chest.Opening') // le texte ne change pas à la fin de l'ouverture
  })
  // Classes littérales (jamais construites) : la couleur du bouton est celle du module (charte §6.7).
  const BUTTON_COLORS = { gold: 'odc--gold', rose: 'odc--rose', teal: 'odc--teal', violet: 'odc--violet', blue: 'odc--blue', orange: 'odc--orange' }
  const buttonColor = computed(() => BUTTON_COLORS[props.accent] ?? 'odc--gold')
</script>

<template>
  <div class="relative w-full">
    <Transition name="chest-fade">
      <div
        v-if="visible"
        :class="['min-h-[340px]', blockClass]"
        class="flex flex-col items-center justify-center gap-2 py-4"
        role="status"
        aria-live="polite"
        data-testid="chest-loader"
      >
        <ChestIllustration :open="open && !closed" :burst="burst" :shake="shake" :accent="accent" />
        <p class="mt-1 text-lg font-bold text-slate-800 dark:text-slate-800" data-testid="chest-title">{{ title }}</p>
        <p v-if="failed" class="max-w-sm text-center text-sm text-slate-700 dark:text-slate-700" :data-testid="errorTestid">{{ error }}</p>
        <p v-else-if="stuck" class="max-w-sm text-center text-sm text-slate-700 dark:text-slate-700">{{ t('Chest.SlowText') }}</p>
        <button v-if="closed" type="button" class="odc-btn odc-btn--soft odc-btn--sm mt-2" :class="buttonColor" data-testid="chest-retry" @click="onRetry">
          <v-icon name="fa-sync-alt" />{{ t('Chest.Retry') }}
        </button>
      </div>
    </Transition>
    <Transition name="chest-fade">
      <div v-if="contentVisible"><slot /></div>
    </Transition>
  </div>
</template>

<style scoped>
  .chest-fade-enter-active, .chest-fade-leave-active { transition: opacity 0.35s ease; }
  .chest-fade-enter-from, .chest-fade-leave-to { opacity: 0; }
</style>
