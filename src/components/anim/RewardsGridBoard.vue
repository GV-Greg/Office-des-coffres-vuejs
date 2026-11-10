<script setup>
  import { ref, computed } from 'vue'
  import { useI18n } from 'vue-i18n'

  /*
    La grille graphique des lots (vue organisateur).
    Mise en page : mini-grille à gauche (numéro si libre, ✕ si réclamée) + liste des cases
    dévoilées à droite (numéro | lot | joueur).

    Props :
      - grid : { width, height, status, lots: [{ id, place, name, player, is_taken }] }
      - editable : vrai si l'organisateur peut cliquer les cases libres (mode `confirmed`)
    Émet `assign(lotId, player)` quand l'organisateur saisit le nom du joueur.
  */
  const props = defineProps({
    grid: { type: Object, required: true },
    editable: { type: Boolean, default: false },
  })
  const emit = defineEmits(['assign'])
  const { t } = useI18n()

  const cells = computed(() => {
    const { width, height, lots } = props.grid
    const total = width * height
    const byPlace = {}
    for (const lot of lots) {
      if (lot.place != null) byPlace[lot.place] = lot
    }
    return Array.from({ length: total }, (_, i) => {
      const pos = i + 1
      return { pos, lot: byPlace[pos] ?? null }
    })
  })

  const claimedCells = computed(() => cells.value.filter(c => c.lot?.player))

  const assigningId = ref(null)
  const assignPlayer = ref('')
  const assignError = ref('')

  function startAssign(lotId) {
    assigningId.value = lotId
    assignPlayer.value = ''
    assignError.value = ''
  }
  function cancelAssign() {
    assigningId.value = null
    assignPlayer.value = ''
  }
  function submitAssign(lotId) {
    if (!assignPlayer.value.trim()) { assignError.value = t('Animation.Grid.PlayerRequired'); return }
    emit('assign', lotId, assignPlayer.value.trim())
    assigningId.value = null
    assignPlayer.value = ''
  }

  function canClick(lot) {
    return props.editable && lot && !lot.player && props.grid.status === 'confirmed'
  }
</script>

<template>
  <div class="flex flex-col laptop:flex-row gap-5 items-start">

    <!-- Mini-grille : numéro si libre, ✕ si réclamée -->
    <div
      class="grid gap-1 shrink-0"
      :style="{ gridTemplateColumns: `repeat(${grid.width}, minmax(0, 1fr))` }"
      :aria-label="t('Animation.Grid.BoardLabel')"
      role="grid"
    >
      <button
        v-for="{ pos, lot } in cells"
        :key="pos"
        role="gridcell"
        type="button"
        class="w-10 h-10 rounded border font-bold flex items-center justify-center select-none transition-colors"
        :class="{
          'bg-slate-800 border-slate-600 text-slate-500 cursor-default':                    !lot,
          'bg-slate-800 border-teal-700 text-slate-300 hover:border-teal-400 cursor-pointer': lot && !lot.player && canClick(lot),
          'bg-slate-800 border-teal-700 text-slate-400 cursor-default':                     lot && !lot.player && !canClick(lot),
          'bg-teal-900/40 border-teal-600 text-orange-400 cursor-default':                  lot?.player,
        }"
        :aria-label="`${t('Animation.Grid.Cell', { n: pos })}${lot?.player ? ` — ${lot.player}` : ''}`"
        :disabled="!canClick(lot)"
        @click="canClick(lot) ? startAssign(lot.id) : null"
      >
        <span v-if="!lot?.player" class="font-mono text-xs leading-none">{{ pos }}</span>
        <span v-else aria-hidden="true" class="text-sm leading-none">✕</span>
      </button>
    </div>

    <!-- Liste des cases dévoilées -->
    <div class="flex-1 min-w-0">
      <h5 class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
        {{ t('Animation.Grid.ClaimedTitle') }}
        <span v-if="claimedCells.length" class="ml-1 font-normal normal-case text-slate-400">({{ claimedCells.length }}&thinsp;/&thinsp;{{ grid.width * grid.height }})</span>
      </h5>
      <p v-if="!claimedCells.length" class="text-xs text-slate-400 dark:text-slate-500 italic">{{ t('Animation.Grid.NoClaimed') }}</p>
      <ul v-else class="space-y-1.5">
        <li
          v-for="{ pos, lot } in claimedCells"
          :key="pos"
          class="flex items-center gap-2 rounded px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700/60 text-sm"
        >
          <span class="font-mono text-xs text-slate-400 w-5 shrink-0 text-right">#{{ pos }}</span>
          <span class="font-semibold text-slate-800 dark:text-slate-200 truncate flex-1">{{ lot.name }}</span>
          <span class="shrink-0 text-xs text-teal-600 dark:text-teal-400 font-medium">{{ lot.player }}</span>
        </li>
      </ul>
    </div>
  </div>

  <!-- Formulaire d'assignation (en dessous) -->
  <div v-if="assigningId !== null" class="mt-3 rounded-lg border border-teal-400 bg-teal-50 dark:bg-teal-900/30 p-3" data-testid="assign-form">
    <p class="text-sm font-semibold text-teal-800 dark:text-teal-200 mb-2">{{ t('Animation.Grid.AssignTitle') }}</p>
    <form class="flex gap-2 items-end" @submit.prevent="submitAssign(assigningId)">
      <div class="flex-1">
        <label for="assign-player" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{{ t('Animation.Grid.PlayerName') }}</label>
        <input
          id="assign-player"
          v-model="assignPlayer"
          type="text"
          maxlength="40"
          required
          autofocus
          class="form-field w-full"
          data-testid="assign-player-input"
        />
        <p v-if="assignError" role="alert" class="text-xs text-red-700 mt-1">{{ assignError }}</p>
      </div>
      <button type="submit" class="odc-btn odc-btn--soft odc-btn--sm odc--teal" data-testid="assign-submit">{{ t('Animation.Grid.Assign') }}</button>
      <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--slate" data-testid="assign-cancel" @click="cancelAssign">{{ t('Animation.Grid.Cancel') }}</button>
    </form>
  </div>
</template>
