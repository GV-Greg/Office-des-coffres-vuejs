<script setup>
  import { ref, computed, watch, nextTick } from 'vue'
  import { useI18n } from 'vue-i18n'
  import useDialogFocus from '@/use/useDialogFocus'
  import ModalCloseButton from '@/components/buttons/ModalCloseButton.vue'

  /*
    Attribuer une case à un personnage : une modale (charte §6.7) — la croix ronde rouge ferme, Échap et le clic sur le fond aussi, jamais de bouton
    « Annuler » ; en bas, le seul bouton qui valide, vert, à droite. Le focus va au champ du nom. ⚠️ Aucune règle ici : le serveur juge l'attribution
    (case déjà prise, grille pas tirée…), la carte affiche ses refus. L'attribution est définitive à l'écran : une case attribuée ne se modifie plus.
  */
  const props = defineProps({
    show: { type: Boolean, required: true },
    cell: { type: Object, default: null }, // { pos, lot }
  })
  const emit = defineEmits(['close', 'assign'])

  const { t } = useI18n()
  const panel = ref(null)
  const input = ref(null)
  const player = ref('')
  const error = ref('')

  const close = () => emit('close')
  useDialogFocus(computed(() => props.show), panel, close)

  watch(() => props.show, async (open) => {
    if (!open) return
    player.value = ''
    error.value = ''
    await nextTick()
    input.value?.focus()
  }, { immediate: true })

  function submit() {
    const name = player.value.trim()
    if (!name) { error.value = t('Animation.Grid.PlayerRequired'); return }
    emit('assign', props.cell.lot.id, name)
  }
</script>

<template>
  <div
    v-if="show && cell"
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="assign-title"
    data-testid="assign-form"
  >
    <div class="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" @click="close"></div>

    <div ref="panel" class="relative w-full max-w-md flex flex-col bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
      <div class="h-1.5 bg-gradient-to-r from-teal-500 to-green-600 shrink-0"></div>

      <form class="p-6 space-y-4" @submit.prevent="submit">
        <div class="flex items-start justify-between gap-4">
          <h3 id="assign-title" class="!m-0 text-lg font-bold text-slate-800 dark:text-slate-100">{{ t('Animation.Grid.AssignModalTitle', { n: cell.pos }) }}</h3>
          <ModalCloseButton @click="close" />
        </div>

        <p class="!m-0 text-sm text-slate-700 dark:text-slate-300">{{ t('Animation.Grid.AssignModalHelp') }}</p>

        <div>
          <label for="assign-player" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">{{ t('Animation.Grid.PlayerName') }}</label>
          <input
            id="assign-player"
            ref="input"
            v-model="player"
            type="text"
            maxlength="40"
            required
            autocomplete="off"
            class="form-field w-full"
            data-testid="assign-player-input"
          />
          <p v-if="error" role="alert" class="!mb-0 mt-1 text-sm font-semibold text-red-600 dark:text-red-400" data-testid="assign-error">{{ error }}</p>
        </div>

        <div class="flex items-center justify-end">
          <button type="submit" class="odc-btn odc-btn--soft odc-btn--sm odc--green" data-testid="assign-submit">
            <v-icon name="fa-check" aria-hidden="true" />{{ t('Animation.Grid.Assign') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
