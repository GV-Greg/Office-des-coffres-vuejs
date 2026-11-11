<script setup>
  import { ref, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import RewardsAssignModal from '@/components/anim/RewardsAssignModal.vue'

  /*
    Le plateau de la grille : une mosaïque de cases carrées numérotées. Une case LIBRE est un sceau ardoise (son numéro) ; une case ATTRIBUÉE est
    un coffre ouvert, doré (le joueur est dans l'infobulle et le nom accessible, la liste complète est à côté du plateau). L'organisateur d'une grille
    TIRÉE (`editable`) clique une case libre pour l'attribuer ; les cases attribuées ne se modifient plus.
    Les cases s'élargissent avec la place disponible, jusqu'à 4 rem ; un plateau large défile dans son cadre au lieu de déborder de la page.
    ⚠️ Aucune règle ici (les bornes des dimensions sont au serveur) : le site dessine ce que le serveur envoie.

    Props :
      - grid : { width, height, status, lots: [{ id, place, name, player, is_taken }] } — sur la page publique, `lots` ne porte que les cases dévoilées
      - editable : vrai si l'organisateur peut cliquer les cases libres (mode `confirmed`)
    Émet `assign(lotId, player)` quand l'organisateur valide la modale d'attribution (RewardsAssignModal).
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

  const total = computed(() => props.grid.width * props.grid.height)
  const claimedCount = computed(() => cells.value.filter(c => c.lot?.player).length)

  // Colonnes : de 2,25 rem (1,75 rem au-delà de 12 colonnes) à 4 rem, et jamais plus grandes que ce qui laisse TOUTES les lignes à l'écran en hauteur
  // (24 rem pour l'en-tête, le titre et le bilan) : la grille tient sans faire défiler la page. Le style est le seul endroit où le nombre de colonnes existe.
  const columns = computed(() => {
    const min = props.grid.width > 12 ? '1.75rem' : '2.25rem'
    return `repeat(${props.grid.width}, minmax(${min}, min(4rem, calc((100vh - 24rem) / ${props.grid.height}))))`
  })

  const assigningId = ref(null)
  const assigningCell = computed(() => cells.value.find(c => c.lot?.id === assigningId.value) ?? null)

  const startAssign = lotId => { assigningId.value = lotId }
  const cancelAssign = () => { assigningId.value = null }
  function submitAssign(lotId, player) {
    emit('assign', lotId, player)
    assigningId.value = null
  }

  const canClick = lot => props.editable && lot && !lot.player && props.grid.status === 'confirmed'

  const cellLabel = ({ pos, lot }) => `${t('Animation.Grid.Cell', { n: pos })}${lot?.player ? ` — ${lot.player}` : ''}`
</script>

<template>
  <div>
    <!-- Le plateau : un groupe de boutons (pas un `grid` ARIA, qui exigerait des lignes). -->
    <div class="max-w-full overflow-x-auto pb-1.5" data-testid="board-scroll">
      <div
        class="grid gap-1.5 w-max max-w-full"
        :style="{ gridTemplateColumns: columns }"
        :aria-label="t('Animation.Grid.BoardLabel')"
        role="group"
        data-testid="board-cells"
      >
        <button
          v-for="cell in cells"
          :key="cell.pos"
          type="button"
          class="relative aspect-square w-full rounded-lg border-2 flex items-center justify-center select-none transition-colors motion-safe:transition-transform"
          :class="[
            cell.lot?.player
              ? 'bg-orange-100 border-orange-500 text-slate-800 cursor-default'
              : canClick(cell.lot)
                ? 'bg-slate-800 border-teal-600 text-white cursor-pointer hover:bg-slate-700 hover:border-teal-300 motion-safe:hover:-translate-y-0.5'
                : 'bg-slate-800 border-slate-600 text-slate-200 cursor-default',
          ]"
          :aria-label="cellLabel(cell)"
          :title="cell.lot?.player ? cellLabel(cell) : undefined"
          :disabled="!canClick(cell.lot)"
          @click="canClick(cell.lot) ? startAssign(cell.lot.id) : null"
        >
          <template v-if="cell.lot?.player">
            <!-- Case dévoilée : un grand coffre ouvert, le numéro en coin (la légende, `RewardsGridLegend`, est sur la page publique). -->
            <v-icon name="gi-open-treasure-chest" scale="1.9" aria-hidden="true" />
            <span class="absolute left-1 top-0.5 font-mono text-[10px] leading-none font-bold" aria-hidden="true">{{ cell.pos }}</span>
          </template>
          <span v-else class="font-mono text-sm leading-none font-bold">{{ cell.pos }}</span>
        </button>
      </div>
    </div>

    <p class="mt-2 mb-0 text-sm font-semibold text-slate-800 dark:text-slate-800" data-testid="board-progress">
      {{ t('Animation.Grid.BoardProgress', { claimed: claimedCount, total }, claimedCount) }}
    </p>

    <!-- L'attribution d'une case : une modale (charte §6.7), qui ne cache rien d'autre qu'elle-même. -->
    <RewardsAssignModal :show="assigningId !== null" :cell="assigningCell" @close="cancelAssign" @assign="submitAssign" />
  </div>
</template>
