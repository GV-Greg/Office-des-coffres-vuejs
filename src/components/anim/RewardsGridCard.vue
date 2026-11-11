<script setup>
  import { ref, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { push } from 'notivue'
  import { apiMessage, apiFieldErrors } from '@/stores/mandateStore'
  import RewardsGridHero from '@/components/anim/RewardsGridHero.vue'
  import RewardsGridBoard from '@/components/anim/RewardsGridBoard.vue'
  import RewardsGridAside from '@/components/anim/RewardsGridAside.vue'
  import RewardsGridClaimed from '@/components/anim/RewardsGridClaimed.vue'
  import { parseLotList } from '@/modules/rewardsLotList.js'

  /*
    Écran de l'organisateur pour UNE grille : le même composant pour les deux modes (privé et sans
    compte). La carte reçoit les `gestures` (asOrganizer ou asAnonymous) et les délègue sans
    connaître le mode. ⚠️ Aucune règle ici : le serveur juge, ses refus s'affichent tels quels.
    Le tirage fait passer la grille directement à `confirmed` (décision de Greg, 10/11/2026) : `drawed` n'existe pas à l'écran.
  */
  const props = defineProps({
    grid: { type: Object, required: true },
    gestures: { type: Object, required: true },
  })
  const emit = defineEmits(['update', 'removed'])
  const { t, locale } = useI18n()
  const fail = e => push.error(apiMessage(e, locale.value, t('Auth.Errors.NetworkError')))

  // Champs pour l'ajout d'un lot : son nom et sa QUANTITÉ (n exemplaires = n lots, donc n cases : le serveur ne connaît pas la quantité, il reçoit n noms).
  const lotName = ref('')
  const lotQty = ref(1)
  const lotError = ref({})
  const addingLot = ref(false)

  /**
   * Ajoute les lots en UNE requête, sans dépasser les cases libres (le surplus est compté, pas envoyé). Tout ou rien : un refus du serveur n'a rien
   * ajouté, l'écran n'est donc jamais à moitié rempli par un échec.
   */
  async function addMany(names) {
    const free = totalCells.value - lots.value.length
    const toAdd = names.slice(0, Math.max(free, 0))
    const skipped = names.length - toAdd.length
    if (!toAdd.length) return { added: 0, skipped, failure: null }
    try {
      emit('update', await props.gestures.addLots(props.grid, toAdd))
      return { added: toAdd.length, skipped, failure: null }
    } catch (failure) {
      return { added: 0, skipped, failure }
    }
  }

  // Les messages de fin d'ajout, les mêmes pour un lot, une quantité ou une liste.
  function reportAdded({ added, skipped }) {
    if (added === 1 && skipped === 0) push.success(t('Animation.Grid.LotAdded'))
    else if (added > 0 && skipped === 0) push.success(t('Animation.Grid.LotsAdded', { count: added }))
    else if (added > 0) push.success(t('Animation.Grid.LotsAddedWithSkipped', { added, skipped }))
    else if (skipped > 0) push.error(t('Animation.Grid.GridFilled'))
  }

  async function addLot() {
    const name = lotName.value.trim()
    if (!name) return
    const quantity = Math.max(1, Math.floor(Number(lotQty.value)) || 1) // de la forme seulement : un entier d'au moins 1
    addingLot.value = true
    lotError.value = {}
    const result = await addMany(Array.from({ length: quantity }, () => name))
    if (result.failure) {
      lotError.value = apiFieldErrors(result.failure, locale.value)
      if (!Object.keys(lotError.value).length) fail(result.failure)
    }
    if (result.added > 0) {
      lotName.value = ''
      lotQty.value = 1
    }
    if (!result.failure) reportAdded(result)
    addingLot.value = false
  }

  async function removeLot(lotId) {
    try {
      const updated = await props.gestures.removeLot(props.grid, lotId)
      if (updated) { emit('update', updated); return }
      // Le serveur ne renvoie pas la grille : on la met à jour ici, statut compris (une grille remplie qui perd un lot n'est plus remplie).
      const remaining = props.grid.lots.filter(l => l.id !== lotId)
      emit('update', { ...props.grid, lots: remaining, status: remaining.length ? 'incomplete' : 'new' })
    } catch (e) { fail(e) }
  }

  // Import en liste (virgules / tabulations / retours à la ligne), lu par `parseLotList`
  const showBulk = ref(false)
  const bulkText = ref('')
  const bulkAdding = ref(false)

  async function addBulk() {
    const names = parseLotList(bulkText.value)
    if (!names.length) return

    bulkAdding.value = true
    const result = await addMany(names)
    if (result.failure) {
      const errs = apiFieldErrors(result.failure, locale.value)
      push.error(errs.name ?? apiMessage(result.failure, locale.value, t('Auth.Errors.NetworkError')))
    }
    bulkAdding.value = false
    if (!result.failure) {
      bulkText.value = ''
      reportAdded(result)
    }
  }

  async function draw() {
    try { emit('update', await props.gestures.draw(props.grid)) } catch (e) { fail(e) }
  }

  async function assign(lotId, player) {
    try { emit('update', await props.gestures.assign(props.grid, lotId, { player })) } catch (e) { fail(e) }
  }

  async function markTaken(lotId, isTaken) {
    try { emit('update', await props.gestures.markTaken(props.grid, lotId, { is_taken: isTaken })) } catch (e) { fail(e) }
  }

  const closeConfirming = ref(false)
  async function close() {
    if (props.grid.mode === 'anonymous' && !closeConfirming.value) {
      closeConfirming.value = true
      return
    }
    closeConfirming.value = false
    try { emit('update', await props.gestures.close(props.grid)) } catch (e) { fail(e) }
  }

  async function reopen() {
    try { emit('update', await props.gestures.reopen(props.grid)) } catch (e) { fail(e) }
  }

  const deleteConfirming = ref(false)
  async function remove() {
    if (!deleteConfirming.value) { deleteConfirming.value = true; return }
    deleteConfirming.value = false
    try {
      await props.gestures.remove(props.grid)
      emit('removed', props.grid)
    } catch (e) { fail(e) }
  }

  const lots = computed(() => props.grid.lots ?? [])
  const totalCells = computed(() => props.grid.width * props.grid.height)
  const isFilled = computed(() => lots.value.length >= totalCells.value)
  const canDraw = computed(() => isFilled.value && props.grid.status === 'filled')

  const isConfirmed = computed(() => props.grid.status === 'confirmed')
  const isClosed = computed(() => props.grid.status === 'closed')
  const canEditLots = computed(() => ['new', 'incomplete', 'filled'].includes(props.grid.status))
  const publicPath = computed(() => `/public/activite/grille/${props.grid.slug}`)
    const hasAssigned = computed(() => lots.value.some(l => l.player))
  const published = computed(() => ['drawed', 'confirmed', 'closed'].includes(props.grid.status))
</script>

<template>
  <div :data-testid="`grid-card-${grid.id}`">

    <!-- Héros : titre, dimensions, statut, actions -->
    <RewardsGridHero
      :title="t('Animation.Grid.CardTitle', { name: grid.name })"
      :status-label="t(`Animation.GridStatus.${grid.status}`)"
      :badge="`${grid.width} × ${grid.height}`"
      :status-testid="`grid-status-${grid.id}`"
      :title-testid="`grid-title-${grid.id}`"
      :divider="false"
    >
      <!-- Lien page publique -->
      <a
        v-if="published"
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

    <!-- Tirée : la liste des résultats à gauche, le plateau au milieu, l'explication et les exports à droite. Les cases se réduisent avec la hauteur de la grille
         pour qu'elle tienne à l'écran. -->
    <div
      v-if="isConfirmed"
      class="mt-5 grid grid-cols-1 gap-5 items-start text-slate-800 dark:text-slate-800 laptop:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
    >
      <section class="min-w-0 laptop:order-2" data-testid="grid-board">
        <h2 class="sr-only">{{ t('Animation.Grid.BoardTitle') }}</h2>
        <RewardsGridBoard :grid="grid" editable @assign="assign" />
      </section>

      <div class="laptop:order-1">
        <RewardsGridClaimed :grid="grid" @mark-taken="markTaken" />
      </div>

      <div class="space-y-4 laptop:order-3">
        <!-- Le guide : ouvert tant qu'aucune case n'est attribuée, replié ensuite (il a servi). -->
        <details :open="!hasAssigned" class="rounded-xl border border-teal-700 bg-teal-50 px-4 py-3" data-testid="grid-confirmed-guide">
          <summary class="cursor-pointer text-sm font-bold text-teal-900 dark:text-teal-900">{{ t('Animation.Grid.ConfirmedGuideTitle') }}</summary>
          <ol class="mt-3 mb-0 list-none space-y-2 p-0">
            <li v-for="n in 3" :key="n" class="flex items-start gap-3">
              <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-700 text-xs font-bold leading-none text-white select-none" aria-hidden="true">{{ n }}</span>
              <span class="text-sm text-slate-800 dark:text-slate-800">{{ t(`Animation.Grid.ConfirmedGuideStep${n}`) }}</span>
            </li>
          </ol>
        </details>

        <RewardsGridAside :grid="grid" />
      </div>
    </div>

    <!-- Remplissage ou grille close : deux colonnes dès laptop -->
    <!-- Remplissage : le formulaire et l'explicatif, moitié-moitié ; grille close : le plateau (2/3) et la barre latérale (1/3). -->
    <div v-else class="mt-5 grid items-start text-slate-800 dark:text-slate-800" :class="canEditLots ? 'gap-x-5 gap-y-1 laptop:grid-cols-2' : 'gap-5 laptop:grid-cols-3'">

      <!-- Colonne principale (2/3) -->
      <div class="space-y-5" :class="canEditLots ? '' : 'laptop:col-span-2'">

        <!-- Plateau (grille close : tous les lots révélés) -->
        <section v-if="isClosed" data-testid="grid-board">
          <h3 class="sr-only">{{ t('Animation.Grid.BoardTitle') }}</h3>
          <RewardsGridBoard :grid="grid" />
        </section>

        <!-- Lots (phases new / incomplete / filled) -->
        <section v-if="canEditLots" data-testid="grid-lots-section">
          <div>
            <h3 class="text-sm font-bold">
              {{ t('Animation.Grid.LotsTitle') }}
              <span class="ml-1 font-normal text-slate-600 dark:text-slate-600 text-xs">({{ lots.length }}&thinsp;/&thinsp;{{ totalCells }})</span>
            </h3>
            <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-300" aria-hidden="true">
              <div
                class="h-full rounded-full bg-teal-500 motion-safe:transition-all motion-safe:duration-300"
                :style="{ width: `${Math.min((lots.length / totalCells) * 100, 100)}%` }"
              />
            </div>
          </div>

          <!-- Formulaire lot unique -->
          <form v-if="!showBulk" class="mt-6" :data-testid="`grid-add-lot-form-${grid.id}`" @submit.prevent="addLot">
            <label :for="`lot-name-${grid.id}`" class="sr-only">{{ t('Animation.Grid.LotName') }}</label>
            <div class="flex flex-wrap items-center gap-2">
              <input
                v-model.number="lotQty"
                type="number"
                min="1"
                inputmode="numeric"
                :aria-label="t('Animation.Grid.LotQuantity')"
                :title="t('Animation.Grid.LotQuantity')"
                class="form-field w-20 shrink-0"
                data-testid="lot-quantity-input"
                :disabled="isFilled"
              />
              <span class="shrink-0 font-bold text-slate-600 dark:text-slate-600" aria-hidden="true">×</span>
              <input
                :id="`lot-name-${grid.id}`"
                v-model="lotName"
                type="text"
                maxlength="50"
                :placeholder="t('Animation.Grid.LotNamePlaceholder')"
                class="form-field w-full tablet:w-[28rem] max-w-full"
                data-testid="lot-name-input"
                :disabled="isFilled"
              />
              <button type="submit" class="odc-btn odc-btn--soft odc-btn--sm odc--teal" :disabled="isFilled || addingLot" data-testid="add-lot-btn">
                {{ t('Animation.Grid.AddLot') }}
              </button>
              <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--slate" :disabled="isFilled" data-testid="show-bulk-btn" @click="showBulk = true">
                {{ t('Animation.Grid.AddList') }}
              </button>
            </div>
          </form>

          <!-- Import en liste -->
          <div v-else class="mt-3 mb-2" data-testid="grid-bulk-form">
            <label :for="`bulk-${grid.id}`" class="sr-only">{{ t('Animation.Grid.AddList') }}</label>
            <!-- Les deux boutons à droite du champ (dessous sur un écran étroit). -->
            <div class="flex flex-wrap items-center gap-2">
              <textarea
                :id="`bulk-${grid.id}`"
                v-model="bulkText"
                rows="4"
                :placeholder="t('Animation.Grid.BulkPlaceholder')"
                class="form-field min-w-[12rem] flex-1 text-xs resize-none"
                data-testid="bulk-textarea"
                :disabled="isFilled || bulkAdding"
              ></textarea>
              <div class="flex shrink-0 flex-col gap-2">
                <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--teal" :disabled="isFilled || bulkAdding || !bulkText.trim()" data-testid="bulk-submit-btn" @click="addBulk">
                  {{ t('Animation.Grid.AddBulk') }}
                </button>
                <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--slate" :disabled="bulkAdding" data-testid="bulk-cancel-btn" @click="showBulk = false; bulkText = ''">
                  {{ t('Animation.Grid.Cancel') }}
                </button>
              </div>
            </div>
          </div>

          <p v-if="lotError.name" role="alert" class="text-xs text-red-700 dark:text-red-700 mt-1">{{ lotError.name }}</p>
          <p v-if="isFilled" class="text-sm font-semibold text-teal-700 dark:text-teal-800 mt-2" data-testid="grid-filled">{{ t('Animation.Grid.GridFilled') }}</p>
        </section>

      </div>

      <!-- Barre latérale (la moitié en remplissage, 1/3 sinon) -->
      <div class="space-y-4">

        <!-- L'explicatif évolue avec la grille : comment la remplir tant qu'il reste des cases, puis — toutes les cases remplies — le tirage, avec son bouton. -->
        <section v-if="canEditLots" class="rounded-xl border border-teal-700 bg-teal-50 px-4 py-3" data-testid="grid-add-guide">
          <template v-if="isFilled">
            <h3 class="!mt-0 mb-2 text-sm font-bold text-teal-900 dark:text-teal-900" data-testid="grid-ready-title">{{ t('Animation.Grid.AddGuideReadyTitle') }}</h3>
            <p class="!mt-0 mb-3 text-sm text-slate-800 dark:text-slate-800">{{ t('Animation.Grid.AddGuideReady') }}</p>
            <button v-if="canDraw" type="button" class="odc-btn odc-btn--soft odc-btn--rect odc--teal w-full" data-testid="grid-draw-btn" @click="draw">
              <v-icon name="gi-rolling-dice-cup" aria-hidden="true" />{{ t('Animation.Grid.Draw') }}
            </button>
          </template>
          <template v-else>
            <h3 class="!mt-0 mb-3 text-sm font-bold text-teal-900 dark:text-teal-900">{{ t('Animation.Grid.AddGuideTitle') }}</h3>
            <ol class="m-0 list-none space-y-2 p-0">
              <li v-for="n in 2" :key="n" class="flex items-start gap-3">
                <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-700 text-xs font-bold leading-none text-white select-none" aria-hidden="true">{{ n }}</span>
                <span class="text-sm text-slate-800 dark:text-slate-800">{{ t(`Animation.Grid.AddGuideStep${n}`, { total: totalCells, width: grid.width, height: grid.height }) }}</span>
              </li>
            </ol>
          </template>
        </section>

        <RewardsGridClaimed :grid="grid" @mark-taken="markTaken" />
        <RewardsGridAside :grid="grid" />
      </div>

      <!-- La liste des lots, sur toute la largeur sous le formulaire et l'explicatif : plus de colonnes, moins de défilement, aucun vide à droite. -->
      <!-- La liste défile dans son cadre dès qu'elle dépasse l'écran (la page, elle, ne défile pas) ; focalisable pour défiler au clavier. -->
      <section
        v-if="canEditLots && lots.length"
        class="laptop:col-span-2 max-h-[calc(100vh-38rem)] min-h-[8rem] overflow-y-auto pr-1"
        role="region"
        tabindex="0"
        :aria-label="t('Animation.Grid.LotsListLabel')"
        data-testid="grid-lots-list"
      >
        <ul class="m-0 grid list-none grid-cols-2 gap-1.5 p-0 tablet:grid-cols-4 laptop:grid-cols-6">
          <li
            v-for="lot in lots"
            :key="lot.id"
            class="flex items-center justify-between gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5"
          >
            <span class="truncate text-xs font-medium text-slate-800 dark:text-slate-800">{{ lot.name }}</span>
            <button
              type="button"
              class="shrink-0 flex h-5 w-5 items-center justify-center rounded text-slate-500 hover:bg-red-50 hover:text-red-700 transition-colors"
              :aria-label="t('Animation.Grid.RemoveLot', { name: lot.name })"
              data-testid="remove-lot-btn"
              @click="removeLot(lot.id)"
            ><span aria-hidden="true">×</span></button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
