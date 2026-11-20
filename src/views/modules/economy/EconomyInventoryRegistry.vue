<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { parseInventoryText, resolveItems } from '@/modules/inventoryParser'
import { compareInventories, formatDiff, formatEcusDiff, STATUS } from '@/modules/inventoryCompare'
import { formatFieldDate } from '@/modules/playerDates'
import { useInventoryStore } from '@/stores/inventoryStore'

/*
  Le Registre des stocks (PR 3a ; fil admin/echanges/registre-stocks, brief admin/content/brief-registre-et-reorganisation-sdc.md §3.9) :
  la mémoire d'une ville ou d'une province, transmise d'un titulaire au suivant. LECTURE : l'historique des inventaires inscrits depuis
  le Bilan des stocks, navigable dans le temps, et la comparaison de deux inscriptions (le moteur de La Balance, `inventoryCompare.js`).
  Les bilans de mandat, la fiche de prise de poste, les trous d'inscription et l'export BBCode viennent en PR 3b.

  ⚠️ Aucune règle côté site : qui lit quoi, le serveur le dit (`GET inventory-scopes`, puis le registre du niveau) ; un refus s'affiche tel quel.
  Les calculs se font ICI, avec le parseur : le serveur sert les textes déchiffrés. Rien n'est gardé dans le navigateur.
  L'auteur d'une inscription en vigueur n'est jamais nommé (politique §3) : seulement « inscrit par vous » et le rédacteur d'une inscription
  REMPLACÉE.
*/
const { t, locale } = useI18n()
const store = useInventoryStore()

const ready = ref(false)
const level = ref(null)
const selectedId = ref(null)
const compareId = ref('')

// Les niveaux de registre que le personnage actif peut ouvrir MAINTENANT : la ville (maire) et la province (commissaire au commerce, dirigeant).
const levels = computed(() => ['city', 'province'].filter(lv => store.scopes?.[lv]))
const levelLabel = lv => t(lv === 'city' ? 'EconomyInventory.LevelCity' : 'EconomyInventory.LevelProvince', { name: store.scopes?.[lv]?.name ?? '' })

const registry = computed(() => (level.value ? store.registryOf(level.value) : null))
const snapshots = computed(() => registry.value?.snapshots ?? [])
const canWrite = computed(() => registry.value?.can_write === true)

const dateOf = snapshot => formatFieldDate('inventory_snapshot_date', snapshot.taken_on, locale.value)
const pseudoOf = author => author?.pseudo ?? t('EconomyInventoryRegistry.DeletedCharacter')

const inventoryOf = (raw) => {
  const { totalEcus, items } = parseInventoryText(raw ?? '')
  return { totalEcus, items: resolveItems(items) }
}

async function openLevel(lv) {
  if (!lv) return
  await store.loadRegistry(lv)
}

onMounted(async () => {
  if (store.serverMode) {
    await store.loadScopes()
    level.value = levels.value[0] ?? null
    await openLevel(level.value)
  }
  ready.value = true
})

watch(level, async (lv, previous) => {
  if (!ready.value || lv === previous) return
  selectedId.value = null
  compareId.value = ''
  await openLevel(lv)
})
// Le personnage actif change : le store repart de zéro, on rouvre.
watch(() => store.characterId, async () => {
  if (!store.serverMode) return
  ready.value = false
  selectedId.value = null
  compareId.value = ''
  await store.loadScopes()
  level.value = levels.value[0] ?? null
  await openLevel(level.value)
  ready.value = true
})

// Première inscription (la plus récente) ouverte d'office.
watch(snapshots, list => {
  if (!list.some(s => s.id === selectedId.value)) selectedId.value = list[0]?.id ?? null
}, { immediate: true })
watch(selectedId, () => { compareId.value = '' })

const selectedIndex = computed(() => snapshots.value.findIndex(s => s.id === selectedId.value))
const selected = computed(() => snapshots.value[selectedIndex.value] ?? null)
// La liste va du plus récent au plus ancien : « plus ancien » = l'indice suivant.
const olderSnapshot = computed(() => snapshots.value[selectedIndex.value + 1] ?? null)
const newerSnapshot = computed(() => (selectedIndex.value > 0 ? snapshots.value[selectedIndex.value - 1] : null))

const contents = computed(() => (selected.value ? inventoryOf(selected.value.raw) : null))
const contentsRows = computed(() => [...(contents.value?.items ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'fr')))
const summary = computed(() => {
  if (!contents.value) return ''
  const count = contents.value.items.length
  return contents.value.totalEcus != null
    ? t('EconomyInventoryRegistry.Summary', { count, ecus: contents.value.totalEcus.toLocaleString('fr-FR') })
    : t('EconomyInventoryRegistry.SummaryNoEcus', { count })
})

// ─── Comparaison de deux inscriptions : l'ancienne est « avant », la récente « après », quel que soit l'ordre choisi ───
const compareCandidates = computed(() => snapshots.value.filter(s => s.id !== selectedId.value))
const other = computed(() => snapshots.value.find(s => String(s.id) === String(compareId.value)) ?? null)
const comparison = computed(() => {
  if (!selected.value || !other.value) return null
  const [older, newer] = selected.value.taken_on < other.value.taken_on ? [selected.value, other.value] : [other.value, selected.value]
  return { older, newer, result: compareInventories(inventoryOf(older.raw), inventoryOf(newer.raw)) }
})

// Flèche ET signe : la couleur n'est qu'un repère (même présentation que La Balance des stocks). Une quantité identique n'affiche rien.
const STATUS_VIEW = {
  [STATUS.UP]: { arrow: '▲', cls: 'text-green-700 dark:text-green-400', label: 'EconomyBalance.Increased' },
  [STATUS.NEW]: { arrow: '▲', cls: 'text-green-700 dark:text-green-400', label: 'EconomyBalance.Increased' },
  [STATUS.DOWN]: { arrow: '▼', cls: 'text-red-700 dark:text-red-400', label: 'EconomyBalance.Decreased' },
}
const changedRows = computed(() => (comparison.value?.result.rows ?? []).filter(row => row.status !== STATUS.SAME))
const ecusView = computed(() => {
  const e = comparison.value?.result.ecus
  if (!e) return null
  const view = e.diff > 0 ? STATUS_VIEW[STATUS.UP] : e.diff < 0 ? STATUS_VIEW[STATUS.DOWN] : null
  return { ...(view ?? { arrow: '', cls: '', label: '' }), amount: e.after.toLocaleString('fr-FR'), diff: view ? formatEcusDiff(e.diff) : '' }
})
</script>

<template>
  <div data-testid="inventory-registry">
    <h2 class="text-lg font-semibold text-yellow-600 dark:text-yellow-500 mb-1">{{ t('EconomyInventoryRegistry.PageTitle') }}</h2>
    <p class="text-sm italic text-slate-600 dark:text-slate-400 mb-4">{{ t('EconomyInventoryRegistry.Intro') }}</p>

    <p v-if="!ready" role="status" class="text-sm text-slate-500 dark:text-slate-400" data-testid="registry-loading">{{ t('EconomyInventoryRegistry.Loading') }}</p>

    <p v-else-if="!levels.length" role="note" class="text-sm text-slate-600 dark:text-slate-400" data-testid="registry-no-access">{{ t('EconomyInventoryRegistry.NoAccess') }}</p>

    <template v-else>
      <!-- Niveau : seulement si le personnage actif a un poste pour chacun (ville ET province). -->
      <div v-if="levels.length > 1" role="group" :aria-label="t('EconomyInventory.LevelNav')" class="flex flex-wrap gap-2 mb-3" data-testid="registry-levels">
        <button
          v-for="lv in levels"
          :key="lv"
          type="button"
          class="odc-btn odc-btn--soft odc-btn--sm"
          :class="level === lv ? 'odc--gold' : 'odc--slate'"
          :aria-pressed="level === lv"
          :data-testid="`registry-level-${lv}`"
          @click="level = lv"
        >{{ levelLabel(lv) }}</button>
      </div>
      <p v-else class="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3" data-testid="registry-place">{{ levelLabel(levels[0]) }}</p>

      <p v-if="registry && !canWrite" role="note" class="text-xs italic text-slate-600 dark:text-slate-400 mb-3" data-testid="registry-readonly">{{ t('EconomyInventory.ReadOnlyScope') }}</p>

      <p v-if="!registry" role="status" class="text-sm text-slate-500 dark:text-slate-400" data-testid="registry-unavailable">{{ t('EconomyInventoryRegistry.LoadError') }}</p>

      <p v-else-if="!snapshots.length" class="text-sm text-slate-600 dark:text-slate-400" data-testid="registry-empty">
        {{ t('EconomyInventoryRegistry.Empty') }}
        <RouterLink :to="{ name: 'economy-inventory' }" class="underline">{{ t('Economy.InventoryLink') }}</RouterLink>
      </p>

      <div v-else class="laptop:grid laptop:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] laptop:gap-6 laptop:items-start">
        <!-- Les inscriptions, de la plus récente à la plus ancienne. -->
        <nav :aria-label="t('EconomyInventoryRegistry.ListTitle')" data-testid="registry-list">
          <h3 class="text-xs font-bold uppercase tracking-wide mb-1 border-b border-yellow-200 dark:border-yellow-900 pb-0.5 text-yellow-700 dark:text-yellow-500">
            {{ t('EconomyInventoryRegistry.ListTitle') }}
          </h3>
          <ul class="max-h-80 overflow-y-auto">
            <li v-for="snapshot in snapshots" :key="snapshot.id">
              <button
                type="button"
                class="w-full text-left text-sm px-2 py-1 rounded hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                :class="snapshot.id === selectedId ? 'font-bold bg-yellow-100 dark:bg-yellow-900/30' : ''"
                :aria-current="snapshot.id === selectedId ? 'true' : undefined"
                :data-testid="`registry-entry-${snapshot.id}`"
                @click="selectedId = snapshot.id"
              >{{ dateOf(snapshot) }}<span v-if="snapshot.by_me" class="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">·&nbsp;{{ t('EconomyInventoryRegistry.ByMe') }}</span></button>
            </li>
          </ul>
        </nav>

        <section v-if="selected" class="mt-4 laptop:mt-0" aria-live="polite" data-testid="registry-detail">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-1">
            <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200" data-testid="registry-detail-title">{{ t('EconomyInventoryRegistry.EntryOf', { date: dateOf(selected) }) }}</h3>
            <div class="flex gap-2">
              <button type="button" class="odc-btn odc-btn--soft odc--slate odc-btn--sm" :disabled="!olderSnapshot" data-testid="registry-older" @click="selectedId = olderSnapshot.id">
                <v-icon name="fa-chevron-left" aria-hidden="true" />{{ t('EconomyInventoryRegistry.Older') }}
              </button>
              <button type="button" class="odc-btn odc-btn--soft odc--slate odc-btn--sm" :disabled="!newerSnapshot" data-testid="registry-newer" @click="selectedId = newerSnapshot.id">
                {{ t('EconomyInventoryRegistry.Newer') }}<v-icon name="fa-chevron-right" aria-hidden="true" />
              </button>
            </div>
          </div>
          <p v-if="selected.by_me" class="text-xs text-slate-600 dark:text-slate-400" data-testid="registry-by-me">{{ t('EconomyInventoryRegistry.ByMe') }}</p>
          <p v-if="selected.replaced" class="text-xs italic text-slate-600 dark:text-slate-400" data-testid="registry-replaced-note">
            {{ t('EconomyInventoryRegistry.Replaced', { pseudo: pseudoOf(selected.replaced), office: selected.replaced.office_label?.[locale] ?? '' }) }}
          </p>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-400" data-testid="registry-summary">{{ summary }}</p>

          <!-- Comparaison avec une autre inscription : le moteur de La Balance des stocks. -->
          <label v-if="compareCandidates.length" class="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <span>{{ t('EconomyInventoryRegistry.CompareLabel') }}</span>
            <select v-model="compareId" class="text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 dark:text-slate-100 py-0.5 px-1 cursor-pointer" data-testid="registry-compare">
              <option value="">{{ t('EconomyInventoryRegistry.CompareNone') }}</option>
              <option v-for="snapshot in compareCandidates" :key="snapshot.id" :value="snapshot.id">{{ dateOf(snapshot) }}</option>
            </select>
          </label>

          <div v-if="comparison" class="mt-3" data-testid="registry-compare-result">
            <h4 class="text-xs font-bold uppercase tracking-wide mb-1 border-b border-yellow-200 dark:border-yellow-900 pb-0.5 text-yellow-700 dark:text-yellow-500">
              {{ t('EconomyInventoryRegistry.CompareTitle', { from: dateOf(comparison.older), to: dateOf(comparison.newer) }) }}
            </h4>
            <p class="text-sm text-slate-600 dark:text-slate-400" data-testid="registry-compare-summary">
              {{ t('EconomyBalance.Summary', { up: comparison.result.counts.up, down: comparison.result.counts.down, added: comparison.result.counts.new, gone: comparison.result.counts.disappeared }) }}
            </p>
            <p v-if="ecusView" class="mt-1 text-sm" data-testid="registry-compare-ecus">
              {{ t('EconomyBalance.Treasury', { ecus: ecusView.amount }) }}
              <span v-if="ecusView.diff" :class="ecusView.cls">
                <span aria-hidden="true">{{ ecusView.arrow }}</span>
                <span class="sr-only">{{ t(ecusView.label) }}</span>
                {{ ecusView.diff }}
              </span>
            </p>
            <p v-if="!comparison.result.hasChanges" class="mt-1 text-sm font-medium text-slate-700 dark:text-slate-300" data-testid="registry-compare-nochange">{{ t('EconomyBalance.NoChange') }}</p>
            <ul class="mt-2 grid grid-cols-1 desktop:grid-cols-2 gap-x-6 gap-y-0.5">
              <li v-for="row in changedRows" :key="row.name" class="flex items-center gap-2 text-sm" data-testid="registry-compare-row">
                <span class="tabular-nums text-right w-14 shrink-0 text-yellow-600 dark:text-yellow-500 font-medium">{{ row.quantity }}</span>
                <span class="flex-1 min-w-0 truncate">{{ row.name }}</span>
                <span v-if="row.status === 'new'" class="shrink-0 rounded px-1 text-[0.65rem] font-semibold uppercase bg-green-100 text-green-900 border border-green-300">{{ t('EconomyBalance.New') }}</span>
                <span class="shrink-0 tabular-nums font-medium" :class="STATUS_VIEW[row.status].cls">
                  <span aria-hidden="true">{{ STATUS_VIEW[row.status].arrow }}</span>
                  <span class="sr-only">{{ t(STATUS_VIEW[row.status].label) }}</span>
                  {{ formatDiff(row.diff) }}
                </span>
              </li>
              <li v-for="item in comparison.result.disappeared" :key="`gone-${item.name}`" class="flex items-center gap-2 text-sm" data-testid="registry-compare-gone">
                <span class="tabular-nums text-right w-14 shrink-0 line-through text-slate-500 dark:text-slate-400">{{ item.before }}</span>
                <span class="flex-1 min-w-0 truncate line-through text-slate-500 dark:text-slate-400">{{ item.name }}</span>
                <span class="shrink-0 tabular-nums font-medium text-red-700 dark:text-red-400">
                  <span aria-hidden="true">▼</span>
                  <span class="sr-only">{{ t('EconomyBalance.Disappeared') }}</span>
                  {{ formatDiff(-item.before) }}
                </span>
              </li>
            </ul>
          </div>

          <!-- Le contenu de l'inscription ouverte. -->
          <div v-else class="mt-3" data-testid="registry-contents">
            <h4 class="text-xs font-bold uppercase tracking-wide mb-1 border-b border-yellow-200 dark:border-yellow-900 pb-0.5 text-yellow-700 dark:text-yellow-500">
              {{ t('EconomyInventoryRegistry.ContentsTitle') }}
            </h4>
            <p v-if="!contentsRows.length" class="text-sm text-slate-500 dark:text-slate-400">{{ t('EconomyInventory.NoItems') }}</p>
            <ul class="grid grid-cols-1 desktop:grid-cols-2 gap-x-6 gap-y-0.5">
              <li v-for="item in contentsRows" :key="item.name" class="flex items-center gap-2 text-sm" data-testid="registry-content-row">
                <span class="tabular-nums text-right w-14 shrink-0 text-yellow-600 dark:text-yellow-500 font-medium">{{ item.quantity }}</span>
                <span class="flex-1 min-w-0 truncate">{{ item.name }}</span>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
