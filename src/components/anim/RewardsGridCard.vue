<script setup>
  import { ref, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { push } from 'notivue'
  import { apiMessage, apiFieldErrors } from '@/stores/mandateStore'
  import RewardsGridHero from '@/components/anim/RewardsGridHero.vue'
  import RewardsGridBoard from '@/components/anim/RewardsGridBoard.vue'
  import { exportResults, exportRules } from '@/modules/rewardsBBcode.js'

  /*
    Écran de l'organisateur pour UNE grille : le même composant pour les deux modes (privé et sans
    compte). La carte reçoit les `gestures` (asOrganizer ou asAnonymous) et les délègue sans
    connaître le mode. ⚠️ Aucune règle ici : le serveur juge, ses refus s'affichent tels quels.
  */
  const props = defineProps({
    grid: { type: Object, required: true },
    gestures: { type: Object, required: true },
  })
  const emit = defineEmits(['update', 'removed'])
  const { t, locale } = useI18n()

  // Champs pour l'ajout d'un lot
  const lotName = ref('')
  const lotError = ref({})
  const addingLot = ref(false)

  async function addLot() {
    if (!lotName.value.trim()) return
    addingLot.value = true
    lotError.value = {}
    try {
      const updated = await props.gestures.addLot(props.grid, { name: lotName.value.trim() })
      emit('update', updated)
      lotName.value = ''
      push.success(t('Animation.Grid.LotAdded'))
    } catch (e) {
      lotError.value = apiFieldErrors(e, locale.value)
      if (!Object.keys(lotError.value).length) push.error(apiMessage(e, locale.value, t('Auth.Errors.NetworkError')))
    } finally { addingLot.value = false }
  }

  async function removeLot(lotId) {
    try {
      const updated = await props.gestures.removeLot(props.grid, lotId)
      if (updated) emit('update', updated)
      else emit('update', { ...props.grid, lots: props.grid.lots.filter(l => l.id !== lotId) })
    } catch (e) {
      push.error(apiMessage(e, locale.value, t('Auth.Errors.NetworkError')))
    }
  }

  // Import en liste (virgules / tabulations / retours à la ligne)
  const showBulk = ref(false)
  const bulkText = ref('')
  const bulkAdding = ref(false)

  async function addBulk() {
    const names = bulkText.value
      .split(/[,\t\n]+/)
      .map(n => n.trim())
      .filter(n => n.length > 0)
    if (!names.length) return

    const remaining = totalCells.value - lots.value.length
    const toAdd = names.slice(0, remaining)
    const skipped = names.length - toAdd.length

    bulkAdding.value = true
    let added = 0
    for (const name of toAdd) {
      try {
        const updated = await props.gestures.addLot(props.grid, { name })
        emit('update', updated)
        added++
      } catch (e) {
        const errs = apiFieldErrors(e, locale.value)
        push.error(errs.name ?? apiMessage(e, locale.value, t('Auth.Errors.NetworkError')))
        break
      }
    }
    bulkAdding.value = false
    bulkText.value = ''
    if (added > 0 && skipped === 0) push.success(t('Animation.Grid.LotsAdded', { count: added }))
    if (added > 0 && skipped > 0) push.success(t('Animation.Grid.LotsAddedWithSkipped', { added, skipped }))
    if (added === 0 && skipped > 0) push.error(t('Animation.Grid.GridFilled'))
  }

  async function draw() {
    try {
      emit('update', await props.gestures.draw(props.grid))
    } catch (e) { push.error(apiMessage(e, locale.value, t('Auth.Errors.NetworkError'))) }
  }

  async function assign(lotId, player) {
    try {
      emit('update', await props.gestures.assign(props.grid, lotId, { player }))
    } catch (e) { push.error(apiMessage(e, locale.value, t('Auth.Errors.NetworkError'))) }
  }

  async function markTaken(lotId, isTaken) {
    try {
      emit('update', await props.gestures.markTaken(props.grid, lotId, { is_taken: isTaken }))
    } catch (e) { push.error(apiMessage(e, locale.value, t('Auth.Errors.NetworkError'))) }
  }

  const closeConfirming = ref(false)
  async function close() {
    if (props.grid.mode === 'anonymous' && !closeConfirming.value) {
      closeConfirming.value = true
      return
    }
    closeConfirming.value = false
    try {
      emit('update', await props.gestures.close(props.grid))
    } catch (e) { push.error(apiMessage(e, locale.value, t('Auth.Errors.NetworkError'))) }
  }

  async function reopen() {
    try {
      emit('update', await props.gestures.reopen(props.grid))
    } catch (e) { push.error(apiMessage(e, locale.value, t('Auth.Errors.NetworkError'))) }
  }

  const deleteConfirming = ref(false)
  async function remove() {
    if (!deleteConfirming.value) { deleteConfirming.value = true; return }
    deleteConfirming.value = false
    try {
      await props.gestures.remove(props.grid)
      emit('removed', props.grid)
    } catch (e) { push.error(apiMessage(e, locale.value, t('Auth.Errors.NetworkError'))) }
  }

  const bbcode = ref('')
  const bbcodeVisible = ref(false)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://officedescoffres.creacube.be'

  function showExport(type) {
    bbcode.value = type === 'results' ? exportResults(props.grid, baseUrl) : exportRules(props.grid, baseUrl)
    bbcodeVisible.value = true
  }
  async function copyBbcode() {
    try {
      await navigator.clipboard.writeText(bbcode.value)
      push.success(t('Animation.Mine.Copied'))
    } catch {
      push.error(t('Animation.Mine.CopyFailed'))
    }
  }

  const lots = computed(() => props.grid.lots ?? [])
  const totalCells = computed(() => props.grid.width * props.grid.height)
  const isFilled = computed(() => lots.value.length >= totalCells.value)
  const canDraw = computed(() => isFilled.value && props.grid.status === 'filled')

  const isConfirmed = computed(() => props.grid.status === 'confirmed')
  const isClosed = computed(() => props.grid.status === 'closed')
  const isEditable = computed(() => isConfirmed.value && !isClosed.value)
  const canRemoveLots = computed(() => ['new', 'incomplete', 'filled'].includes(props.grid.status))
  const publicPath = computed(() => `/public/activite/grille/${props.grid.slug}`)
</script>

<template>
  <div :data-testid="`grid-card-${grid.id}`">

    <!-- Héros : titre, dimensions, statut, actions -->
    <RewardsGridHero
      :title="grid.name"
      :status-label="t(`Animation.GridStatus.${grid.status}`)"
      :badge="`${grid.width} × ${grid.height}`"
      :status-testid="`grid-status-${grid.id}`"
      :title-testid="`grid-title-${grid.id}`"
      :divider="false"
    >
      <!-- Lien page publique -->
      <a
        v-if="['drawed','confirmed','closed'].includes(grid.status)"
        :href="publicPath"
        target="_blank"
        rel="noopener noreferrer"
        class="odc-btn odc-btn--soft odc-btn--sm odc--slate"
        data-testid="grid-view-public"
      >
        <v-icon name="fa-external-link-alt" aria-hidden="true" />{{ t('Animation.Mine.ViewPublic') }}
      </a>

      <!-- Clore -->
      <template v-if="!isClosed">
        <template v-if="closeConfirming">
          <span class="text-xs text-orange-200">{{ t('Animation.Mine.CloseConfirmAnonymous') }}</span>
          <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--slate" data-testid="grid-close-cancel" @click="closeConfirming = false">{{ t('Animation.Mine.DeleteCancel') }}</button>
          <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--orange" data-testid="grid-close-confirm" @click="close">{{ t('Animation.Mine.CloseConfirmButton') }}</button>
        </template>
        <button v-else type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--orange" data-testid="grid-close-btn" @click="close">
          {{ grid.mode === 'anonymous' ? t('Animation.Grid.CloseDefinitive') : t('Animation.Grid.Close') }}
        </button>
      </template>

      <!-- Rouvrir / Supprimer -->
      <button v-if="isClosed && grid.can_reopen" type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--slate" data-testid="grid-reopen" @click="reopen">{{ t('Animation.Mine.Reopen') }}</button>
      <button
        v-if="isClosed && grid.mode === 'private'"
        type="button"
        class="odc-btn odc-btn--soft odc-btn--sm odc--slate"
        :data-testid="`grid-delete-${grid.id}`"
        @click="remove"
      >{{ deleteConfirming ? t('Animation.Mine.DeleteConfirmButton') : t('Animation.Mine.Delete') }}</button>
    </RewardsGridHero>

    <!-- CONFIRMED : 3 colonnes — gauche (lots attribués), centre (grille), droite (guide) -->
    <div v-if="isConfirmed" class="mt-5 grid grid-cols-1 laptop:grid-cols-[1fr_auto_1fr] gap-5 items-start text-slate-800 dark:text-slate-200">

      <!-- GAUCHE : lots attribués + export + BBCode + email -->
      <div class="space-y-4">
        <section class="rounded-xl border border-slate-200 dark:border-slate-600 p-4" data-testid="grid-taken-section">
          <h3 class="text-sm font-bold mb-2">{{ t('Animation.Grid.TakenTitle') }}</h3>
          <ul v-if="lots.some(l => l.player)" class="space-y-1.5">
            <li v-for="lot in lots.filter(l => l.player)" :key="`taken-${lot.id}`" class="flex items-center gap-2 text-xs">
              <span class="flex-1 min-w-0">
                <span class="font-semibold">Case {{ lot.place }}</span> — {{ lot.name }}
                <span class="text-slate-500 dark:text-slate-400"> → {{ lot.player }}</span>
              </span>
              <button
                type="button"
                class="odc-btn odc-btn--soft odc-btn--sm text-xs shrink-0"
                :class="lot.is_taken ? 'odc--teal' : 'odc--slate'"
                @click="markTaken(lot.id, !lot.is_taken)"
              >{{ lot.is_taken ? t('Animation.Grid.Taken') : t('Animation.Grid.NotTaken') }}</button>
            </li>
          </ul>
          <p v-else class="text-xs italic text-slate-400 dark:text-slate-500">{{ t('Animation.Grid.TakenEmpty') }}</p>
        </section>
        <div class="flex flex-col gap-2">
          <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--slate w-full" data-testid="grid-export-rules" @click="showExport('rules')">
            {{ t('Animation.Mine.ExportRules') }}
          </button>
        </div>
        <div v-if="bbcodeVisible" class="rounded-lg border border-slate-300 dark:border-slate-600 p-3" data-testid="grid-bbcode">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-semibold">{{ t('Animation.Mine.ExportTitle') }}</span>
            <div class="flex gap-2">
              <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--teal" @click="copyBbcode">{{ t('Common.Copy') }}</button>
              <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--slate" @click="bbcodeVisible = false">×</button>
            </div>
          </div>
          <textarea class="w-full font-mono text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-2 h-32 resize-y" readonly :value="bbcode" data-testid="bbcode-textarea" />
        </div>
        <p v-if="grid.mode === 'anonymous' && grid.email" class="text-xs text-slate-500 dark:text-slate-400">
          <template v-if="grid.email.verified">
            <v-icon name="fa-check-circle" class="text-teal-600" aria-hidden="true" />
            {{ t('Animation.Mine.EmailConfirmed') }}
          </template>
          <template v-else>
            <v-icon name="fa-clock" class="text-orange-600" aria-hidden="true" />
            {{ t('Animation.Mine.EmailPending') }}
          </template>
        </p>
      </div>

      <!-- CENTRE : grille -->
      <section data-testid="grid-board">
        <RewardsGridBoard :grid="grid" :editable="isEditable" @assign="assign" />
      </section>

      <!-- DROITE : guide -->
      <div class="rounded-xl border border-teal-200/50 dark:border-teal-700/50 bg-gradient-to-r from-teal-50 to-sky-50/30 dark:from-teal-900/25 dark:to-sky-900/10 px-5 py-4" data-testid="grid-confirmed-guide">
        <div class="flex items-center gap-2 mb-3">
          <v-icon name="fa-check-circle" class="text-teal-500 dark:text-teal-400 shrink-0" aria-hidden="true" />
          <p class="text-sm font-semibold text-teal-700 dark:text-teal-300">{{ t('Animation.Grid.ConfirmedGuideTitle') }}</p>
        </div>
        <ol class="space-y-2">
          <li v-for="n in 3" :key="n" class="flex items-start gap-3">
            <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-500 text-white text-xs font-bold leading-none select-none" aria-hidden="true">{{ n }}</span>
            <span class="text-sm text-slate-700 dark:text-slate-300">{{ t(`Animation.Grid.ConfirmedGuideStep${n}`) }}</span>
          </li>
        </ol>
      </div>

    </div>

    <!-- NON-CONFIRMED : 2 colonnes dès laptop -->
    <div
      v-else
      class="mt-5 grid laptop:grid-cols-3 gap-5 items-start text-slate-800 dark:text-slate-200"
    >

      <!-- Colonne principale (2/3) -->
      <div class="laptop:col-span-2 space-y-5">

        <!-- Grille graphique (drawed / closed) -->
        <section v-if="['drawed','closed'].includes(grid.status)" data-testid="grid-board">
          <h3 class="text-sm font-bold mb-1">{{ t('Animation.Grid.BoardTitle') }}</h3>
          <RewardsGridBoard :grid="grid" :editable="isEditable" @assign="assign" />
        </section>

        <!-- Lots (phases new / incomplete / filled) -->
        <section v-if="canRemoveLots" data-testid="grid-lots-section">
          <div>
            <h3 class="text-sm font-bold">
              {{ t('Animation.Grid.LotsTitle') }}
              <span class="ml-1 font-normal text-slate-500 text-xs">({{ lots.length }}&thinsp;/&thinsp;{{ totalCells }})</span>
            </h3>
            <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-600" aria-hidden="true">
              <div
                class="h-full rounded-full bg-teal-500 motion-safe:transition-all motion-safe:duration-300"
                :style="{ width: `${Math.min((lots.length / totalCells) * 100, 100)}%` }"
              />
            </div>
          </div>

          <!-- Formulaire lot unique -->
          <form v-if="!showBulk" class="flex flex-col gap-2 mt-3" @submit.prevent="addLot" :data-testid="`grid-add-lot-form-${grid.id}`">
            <input
              v-model="lotName"
              type="text"
              maxlength="50"
              :placeholder="t('Animation.Grid.LotNamePlaceholder')"
              class="form-field w-full"
              data-testid="lot-name-input"
              :disabled="isFilled"
            />
            <div class="flex gap-2">
              <button type="submit" class="odc-btn odc-btn--soft odc-btn--sm odc--teal flex-1" :disabled="isFilled || addingLot" data-testid="add-lot-btn">
                {{ t('Animation.Grid.AddLot') }}
              </button>
              <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--slate" :disabled="isFilled" data-testid="show-bulk-btn" @click="showBulk = true">
                {{ t('Animation.Grid.AddList') }}
              </button>
            </div>
          </form>

          <!-- Import en liste -->
          <div v-else class="flex flex-col gap-2 mt-3" data-testid="grid-bulk-form">
            <textarea
              v-model="bulkText"
              rows="4"
              :placeholder="t('Animation.Grid.BulkPlaceholder')"
              class="form-field w-full text-xs resize-none"
              data-testid="bulk-textarea"
              :disabled="isFilled || bulkAdding"
            />
            <div class="flex gap-2">
              <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--teal flex-1" :disabled="isFilled || bulkAdding || !bulkText.trim()" data-testid="bulk-submit-btn" @click="addBulk">
                {{ t('Animation.Grid.AddBulk') }}
              </button>
              <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--slate" :disabled="bulkAdding" data-testid="bulk-cancel-btn" @click="showBulk = false; bulkText = ''">
                {{ t('Animation.Grid.Cancel') }}
              </button>
            </div>
          </div>

          <p v-if="lotError.name" role="alert" class="text-xs text-red-700 mt-1">{{ lotError.name }}</p>
          <p v-if="isFilled" class="text-sm font-semibold text-teal-700 dark:text-teal-400 mt-2" data-testid="grid-filled">{{ t('Animation.Grid.GridFilled') }}</p>

          <!-- Chips des lots -->
          <ul v-if="lots.length" class="mt-3 grid grid-cols-2 tablet:grid-cols-3 gap-1.5">
            <li
              v-for="lot in lots"
              :key="lot.id"
              class="flex items-center justify-between gap-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-2.5 py-1.5"
            >
              <span class="truncate text-xs font-medium text-slate-800 dark:text-slate-200">{{ lot.name }}</span>
              <button
                type="button"
                class="shrink-0 flex h-4 w-4 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 transition-colors"
                data-testid="remove-lot-btn"
                @click="removeLot(lot.id)"
              >×</button>
            </li>
          </ul>
        </section>

      </div>

      <!-- Barre latérale (1/3) -->
      <div class="space-y-4">

        <!-- Tirer au sort -->
        <div v-if="canDraw" class="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 p-4">
          <button type="button" class="odc-btn odc-btn--soft odc-btn--rect odc--teal w-full" data-testid="grid-draw-btn" @click="draw">
            <v-icon name="gi-rolling-dice-cup" aria-hidden="true" />{{ t('Animation.Grid.Draw') }}
          </button>
        </div>

        <!-- Remis / Non remis (état closed) -->
        <section v-if="lots.some(l => l.player)" class="rounded-xl border border-slate-200 dark:border-slate-600 p-4" data-testid="grid-taken-section">
          <h3 class="text-sm font-bold mb-2">{{ t('Animation.Grid.TakenTitle') }}</h3>
          <ul class="space-y-1.5">
            <li v-for="lot in lots.filter(l => l.player)" :key="`taken-${lot.id}`" class="flex items-center gap-2 text-xs">
              <span class="flex-1 min-w-0">
                <span class="font-semibold">Case {{ lot.place }}</span> — {{ lot.name }}
                <span class="text-slate-500 dark:text-slate-400"> → {{ lot.player }}</span>
              </span>
              <button
                type="button"
                class="odc-btn odc-btn--soft odc-btn--sm text-xs shrink-0"
                :class="lot.is_taken ? 'odc--teal' : 'odc--slate'"
                @click="markTaken(lot.id, !lot.is_taken)"
              >{{ lot.is_taken ? t('Animation.Grid.Taken') : t('Animation.Grid.NotTaken') }}</button>
            </li>
          </ul>
        </section>

        <!-- Export BBCode -->
        <div v-if="['drawed','closed'].includes(grid.status)" class="flex flex-col gap-2">
          <button v-if="isClosed" type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--slate w-full" data-testid="grid-export-results" @click="showExport('results')">
            {{ t('Animation.Mine.ExportResults') }}
          </button>
          <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--slate w-full" data-testid="grid-export-rules" @click="showExport('rules')">
            {{ t('Animation.Mine.ExportRules') }}
          </button>
        </div>

        <!-- Bloc BBCode -->
        <div v-if="bbcodeVisible" class="rounded-lg border border-slate-300 dark:border-slate-600 p-3" data-testid="grid-bbcode">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-semibold">{{ t('Animation.Mine.ExportTitle') }}</span>
            <div class="flex gap-2">
              <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--teal" @click="copyBbcode">{{ t('Common.Copy') }}</button>
              <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--slate" @click="bbcodeVisible = false">×</button>
            </div>
          </div>
          <textarea class="w-full font-mono text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-2 h-32 resize-y" readonly :value="bbcode" data-testid="bbcode-textarea" />
        </div>

        <!-- Email (sans compte seulement) -->
        <p v-if="grid.mode === 'anonymous' && grid.email" class="text-xs text-slate-500 dark:text-slate-400">
          <template v-if="grid.email.verified">
            <v-icon name="fa-check-circle" class="text-teal-600" aria-hidden="true" />
            {{ t('Animation.Mine.EmailConfirmed') }}
          </template>
          <template v-else>
            <v-icon name="fa-clock" class="text-orange-600" aria-hidden="true" />
            {{ t('Animation.Mine.EmailPending') }}
          </template>
        </p>

      </div>
    </div>
  </div>
</template>
