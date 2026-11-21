<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { parseInventoryText, resolveItems } from '@/modules/inventoryParser'
import { compareInventories, formatEcusDiff, STATUS } from '@/modules/inventoryCompare'
import { daysBetween, departure, mandateBilans, predecessorEntries, emptyPeriods } from '@/modules/inventoryRegistry'
import { placeLabelFr, entryTitle, bilanTitle, comparisonTitle, withTitle } from '@/modules/registryBBcode'
import useRegistryExport from '@/use/useRegistryExport'
import InventoryDiffTable from '@/components/registry/InventoryDiffTable.vue'
import { formatFieldDate } from '@/modules/playerDates'
import { useInventoryStore } from '@/stores/inventoryStore'
import ChestLoader from '@/components/loading/ChestLoader.vue'
import AccessDenied from '@/components/loading/AccessDenied.vue'

/*
  Le Registre des stocks (PR 3a ; fil admin/echanges/registre-stocks, brief admin/content/brief-registre-et-reorganisation-sdc.md §3.9) :
  la mémoire d'une ville ou d'une province, transmise d'un titulaire au suivant. LECTURE : l'historique des inventaires inscrits depuis
  le Bilan des stocks, navigable dans le temps, et la comparaison de deux inscriptions (le moteur de La Balance, `inventoryCompare.js`).
  PR 3b : la fiche de prise de poste, les bilans de mi-mandat et de fin de mandat (évolution entre l'inventaire hérité et la dernière inscription
  avant la date), les jours sans inscription, et l'export BBCode (une inscription, un bilan, la comparaison libre). Tout vient des dates du
  serveur (`mandate`) ; les calculs vivent dans `modules/inventoryRegistry.js`.

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
// Les chiffres clés de l'inscription ouverte : le nombre d'articles et, si le texte du jeu le porte, le trésor.
const placeName = computed(() => (level.value ? store.scopes?.[level.value]?.name ?? '' : ''))
// « Dernière inscription : il y a 2 jours, le 24/05. » — même format et mêmes mots que « Dernier relevé » du Registre des mines. Le jour
// du jeu en cours vient du serveur (`today`, bascule à 04:00). Orange et gras dès deux jours, comme les mines (Greg, 21/11/2026).
const dayMonth = iso => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '')
const last = computed(() => snapshots.value[0] ?? null)
const stale = computed(() => !!last.value && !!registry.value?.today && daysBetween(last.value.taken_on, registry.value.today) >= 2)
const lastAge = computed(() => {
  if (!last.value || !registry.value?.today) return null
  const n = daysBetween(last.value.taken_on, registry.value.today)
  return n <= 0 ? t('EconomyMines.RegistryPage.Today') : n === 1 ? t('EconomyMines.RegistryPage.Yesterday') : t('EconomyMines.RegistryPage.DaysAgo', { n })
})
const itemCount = computed(() => contents.value?.items.length ?? 0)
const ecusAmount = computed(() => (contents.value?.totalEcus != null ? contents.value.totalEcus.toLocaleString('fr-FR') : null))

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
  [STATUS.UP]: { arrow: '▲', cls: 'text-green-800 dark:text-green-800', label: 'EconomyBalance.Increased' },
  [STATUS.NEW]: { arrow: '▲', cls: 'text-green-800 dark:text-green-800', label: 'EconomyBalance.Increased' },
  [STATUS.DOWN]: { arrow: '▼', cls: 'text-red-800 dark:text-red-800', label: 'EconomyBalance.Decreased' },
}
// ─── PR 3b : les lectures du mandat DU LECTEUR (repères dits par le serveur) ─────────────────────────────────────────────────────────────
const mandate = computed(() => registry.value?.mandate ?? null)
const today = computed(() => registry.value?.today ?? null)
const dateShort = iso => dayMonth(iso) // JJ/MM, comme les lectures du Registre des mines

// Prise de poste : l'inventaire hérité (ou, à défaut, la première inscription du mandat) et ce que d'autres ont inscrit juste avant.
const start = computed(() => departure(snapshots.value, mandate.value))
const startInventory = computed(() => (start.value ? inventoryOf(start.value.raw) : null))
const inherited = computed(() => !!start.value && !!mandate.value && start.value.taken_on <= mandate.value.in_office_from)
const startGap = computed(() => (start.value && mandate.value ? Math.abs(daysBetween(start.value.taken_on, mandate.value.in_office_from)) : 0))
const predecessors = computed(() => predecessorEntries(snapshots.value, mandate.value))
const predecessorDays = computed(() => (mandate.value?.predecessor_from ? daysBetween(mandate.value.predecessor_from, mandate.value.in_office_from) : 0))
const hasTakeOver = computed(() => !!start.value || predecessors.value.length > 0)

// Bilans de mi-mandat et de fin de mandat : l'évolution entre deux photos. Le détail s'ouvre à la demande.
const bilans = computed(() => mandateBilans(snapshots.value, mandate.value, today.value))
const openedBilan = ref(null)
const bilanLabel = kind => t(`EconomyInventoryRegistry.Bilan.${kind}`)
const missingLabel = missing => t(`EconomyInventoryRegistry.Missing.${missing.join('_')}`)
const bilanEcus = result => {
  const e = result.ecus
  if (!e) return null
  const view = e.diff > 0 ? STATUS_VIEW[STATUS.UP] : e.diff < 0 ? STATUS_VIEW[STATUS.DOWN] : null
  return { ...(view ?? { arrow: '', cls: '', label: '' }), amount: e.after.toLocaleString('fr-FR'), diff: view ? formatEcusDiff(e.diff) : '' }
}
watch([selectedId, level], () => { openedBilan.value = null })

// Jours sans inscription : un fait, en périodes, sans seuil ni couleur.
const gaps = computed(() => emptyPeriods(snapshots.value, mandate.value, today.value))

// ─── Exports BBCode : une inscription, un bilan, la comparaison libre (français fixe ; options du joueur, catégories du niveau) ──────────────
const registryExport = useRegistryExport()
const dateFr = iso => formatFieldDate('inventory_snapshot_date', iso, 'fr')
const placeFr = computed(() => placeLabelFr(level.value, placeName.value))
async function exportInscription() {
  if (!selected.value) return
  const bbcode = await registryExport.inscriptionBBcode(level.value, inventoryOf(selected.value.raw))
  await registryExport.copy(withTitle(entryTitle(dateFr(selected.value.taken_on), placeFr.value), bbcode))
}
async function exportBilan(bilan) {
  const bbcode = await registryExport.evolutionBBcode(level.value, bilan.result, inventoryOf(bilan.end.raw).totalEcus)
  await registryExport.copy(withTitle(bilanTitle(bilan.kind, dateFr(bilan.start.taken_on), dateFr(bilan.end.taken_on)), bbcode))
}
async function exportComparison() {
  if (!comparison.value) return
  const { older, newer, result } = comparison.value
  const bbcode = await registryExport.evolutionBBcode(level.value, result, inventoryOf(newer.raw).totalEcus)
  await registryExport.copy(withTitle(comparisonTitle(dateFr(older.taken_on), dateFr(newer.taken_on)), bbcode))
}

const ecusView = computed(() => {
  const e = comparison.value?.result.ecus
  if (!e) return null
  const view = e.diff > 0 ? STATUS_VIEW[STATUS.UP] : e.diff < 0 ? STATUS_VIEW[STATUS.DOWN] : null
  return { ...(view ?? { arrow: '', cls: '', label: '' }), amount: e.after.toLocaleString('fr-FR'), diff: view ? formatEcusDiff(e.diff) : '' }
})
</script>

<template>
  <!-- Mise en page de la page sœur, le Registre des mines : titre et filet, deux colonnes — à gauche ce qui sert à lire (l'inscription ouverte,
       sa comparaison), à droite la mémoire (les inscriptions) —, sections séparées par un filet, pas de cartes. Couleurs de texte posées sur
       CHAQUE élément (règle globale `.dark p`). -->
  <div class="w-full text-slate-800 dark:text-slate-800" data-testid="inventory-registry">
    <!-- Le coffre s'ouvre pendant que le serveur dit les niveaux ouverts ; sans poste de lecture : le cadenas fermé et le message, pas une panne. -->
    <ChestLoader :loading="!ready" accent="gold" error-testid="registry-chest-error">
    <AccessDenied v-if="!levels.length" :message="t('EconomyInventoryRegistry.NoAccess')" testid="registry-no-access" />

    <template v-else>
      <header class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-slate-300 pb-2">
        <h2 class="!mb-0 text-2xl font-bold text-slate-800 dark:text-slate-800">{{ t('EconomyInventoryRegistry.PageTitle', { name: placeName }) }}</h2>
        <!-- Niveau : deux boutons si le personnage a un poste pour chacun (ville ET province), sinon le lieu seul. -->
        <div v-if="levels.length > 1" role="group" :aria-label="t('EconomyInventory.LevelNav')" class="flex flex-wrap items-center gap-2" data-testid="registry-levels">
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
        <!-- Âge de la dernière inscription, toujours visible (comme l'âge du dernier relevé des mines) : un fait, jamais un jugement. -->
        <p class="text-sm italic" :class="stale ? 'font-bold text-orange-800 dark:text-orange-800' : 'text-slate-700 dark:text-slate-700'" data-testid="registry-last">
          <template v-if="last">{{ t('EconomyInventoryRegistry.LastEntry', { age: lastAge ?? '', date: dayMonth(last.taken_on) }) }}</template>
          <template v-else>{{ t('EconomyInventoryRegistry.NoEntry') }}</template>
        </p>
      </header>

      <p v-if="registry && !canWrite" role="note" class="mt-3 text-xs italic text-slate-700 dark:text-slate-700" data-testid="registry-readonly">{{ t('EconomyInventory.ReadOnlyScope') }}</p>

      <p v-if="!registry" role="status" class="mt-4 text-slate-700 dark:text-slate-700" data-testid="registry-unavailable">{{ t('EconomyInventoryRegistry.LoadError') }}</p>

      <p v-else-if="!snapshots.length" class="mt-4 text-slate-700 dark:text-slate-700" data-testid="registry-empty">
        {{ t('EconomyInventoryRegistry.Empty') }}
        <RouterLink :to="{ name: 'economy-inventory' }" class="underline">{{ t('Economy.InventoryLink') }}</RouterLink>
      </p>

      <!-- Trois colonnes au large : l'inscription ouverte, la comparaison, puis les inscriptions dans une petite colonne tout à droite. Sur laptop, deux
             colonnes (les inscriptions sous la comparaison) ; en dessous, une seule. -->
      <div v-else class="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 laptop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_11rem]">
        <section v-if="selected" class="min-w-0 laptop:row-span-2 desktop:row-span-1" aria-live="polite" data-testid="registry-detail">
          <!-- ◀ ▶ avant et après le titre, comme les semaines du Registre des mines : toujours là, grisés quand il n'y a rien de plus ancien ou de plus récent. -->
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <button type="button" class="odc-btn odc-btn--soft odc-btn--rect odc-btn--icon odc-btn--sm odc--slate" :disabled="!olderSnapshot"
                    :aria-label="t('EconomyInventoryRegistry.Older')" data-testid="registry-older" @click="selectedId = olderSnapshot.id">
              <v-icon name="fa-chevron-left" scale="0.9" />
            </button>
            <h3 class="!mb-0 text-lg font-bold text-slate-800 dark:text-slate-800" data-testid="registry-detail-title">{{ t('EconomyInventoryRegistry.EntryOf', { date: dateOf(selected) }) }}</h3>
            <button type="button" class="odc-btn odc-btn--soft odc-btn--rect odc-btn--icon odc-btn--sm odc--slate" :disabled="!newerSnapshot"
                    :aria-label="t('EconomyInventoryRegistry.Newer')" data-testid="registry-newer" @click="selectedId = newerSnapshot.id">
              <v-icon name="fa-chevron-right" scale="0.9" />
            </button>
            <!-- Les infos de l'inscription, juste après le chevron de droite : qui l'a inscrite, ce qu'elle remplace, combien d'articles. -->
            <div class="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-sm text-slate-700 dark:text-slate-700" data-testid="registry-info">
              <span v-if="selected.by_me" data-testid="registry-by-me">{{ t('EconomyInventoryRegistry.ByMe') }}</span>
              <span v-if="selected.replaced" class="italic" data-testid="registry-replaced-note">
                {{ t('EconomyInventoryRegistry.Replaced', { pseudo: pseudoOf(selected.replaced), office: selected.replaced.office_label?.[locale] ?? '' }) }}
              </span>
              <span class="text-slate-800 dark:text-slate-800" data-testid="registry-summary">
                <strong class="font-bold tabular-nums" data-testid="registry-count">{{ itemCount }}</strong>{{ ' ' }}{{ t('EconomyInventoryRegistry.ItemsLabel', itemCount) }}<template v-if="ecusAmount !== null">, <strong class="font-bold tabular-nums" data-testid="registry-ecus">{{ ecusAmount }}</strong>{{ ' ' }}{{ t('EconomyInventoryRegistry.EcusLabel') }}</template>
              </span>
            </div>
            <button type="button" class="odc-btn odc-btn--soft odc--green odc-btn--sm ml-auto" data-testid="registry-export" @click="exportInscription">
              <v-icon name="fa-copy" aria-hidden="true" />{{ t('EconomyInventory.ExportButton') }}
            </button>
          </div>

          <!-- Le contenu de l'inscription ouverte : des colonnes compactes (il peut y avoir des centaines d'articles), lues de haut en bas, par nom. -->
          <div class="mt-3" data-testid="registry-contents">
            <p v-if="!contentsRows.length" class="text-sm text-slate-700 dark:text-slate-700">{{ t('EconomyInventory.NoItems') }}</p>
            <ul class="columns-1 gap-x-6 tablet:columns-2 desktop:columns-3 laptop:columns-2">
              <li v-for="item in contentsRows" :key="item.name" class="-mx-1 flex break-inside-avoid items-center gap-2 rounded px-1 text-sm text-slate-800 hover:bg-yellow-50 dark:text-slate-800" data-testid="registry-content-row">
                <span class="w-14 shrink-0 text-right font-medium tabular-nums text-yellow-700 dark:text-yellow-700">{{ item.quantity }}</span>
                <span class="min-w-0 flex-1 truncate">{{ item.name }}</span>
              </li>
            </ul>
          </div>

          <!-- Sous l'inscription : trois lectures courtes côte à côte (auto-fit), au gabarit du Registre des mines. Faits seulement : aucun score. -->
          <div v-if="mandate" class="mt-6 grid gap-x-8 gap-y-4 grid-cols-[repeat(auto-fit,minmax(15rem,1fr))]" data-testid="registry-readings">
            <!-- Prise de poste : l'inventaire hérité, et ce que d'autres ont inscrit juste avant l'entrée en fonction. Rien sans inscription connue. -->
            <section v-if="hasTakeOver" class="registry-section" data-testid="registry-takeover">
              <h3 class="registry-heading">{{ t('EconomyInventoryRegistry.TakeOverTitle') }}</h3>
              <p v-if="start" class="mt-2 text-sm text-slate-800 dark:text-slate-800" data-testid="registry-takeover-start">
                <template v-if="inherited">{{ t('EconomyInventoryRegistry.TakeOverInherited', { date: dateShort(start.taken_on), gap: t('EconomyInventoryRegistry.DaysBefore', startGap) }) }}</template>
                <template v-else>{{ t('EconomyInventoryRegistry.TakeOverFirst', { date: dateShort(start.taken_on) }) }}</template>
                {{ ' ' }}<strong class="font-bold tabular-nums">{{ startInventory.items.length }}</strong>{{ ' ' }}{{ t('EconomyInventoryRegistry.ItemsLabel', startInventory.items.length) }}<template v-if="startInventory.totalEcus != null">, <strong class="font-bold tabular-nums">{{ startInventory.totalEcus.toLocaleString('fr-FR') }}</strong>{{ ' ' }}{{ t('EconomyInventoryRegistry.EcusLabel') }}</template>.
                <button type="button" class="ml-1 text-sm font-semibold text-yellow-800 underline dark:text-yellow-800" data-testid="registry-takeover-open" @click="selectedId = start.id">{{ t('EconomyInventoryRegistry.OpenEntry') }}</button>
              </p>
              <div v-if="predecessors.length" class="mt-2 text-sm text-slate-800 dark:text-slate-800" data-testid="registry-predecessors">
                <p>{{ t('EconomyInventoryRegistry.PredecessorsLead', { days: predecessorDays, date: dateShort(mandate.in_office_from) }, predecessors.length) }}</p>
                <ul class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  <li v-for="entry in predecessors" :key="entry.id">
                    <button type="button" class="font-semibold text-yellow-800 underline dark:text-yellow-800" :data-testid="`registry-predecessor-${entry.id}`" @click="selectedId = entry.id">{{ dateShort(entry.taken_on) }}</button>
                  </li>
                </ul>
              </div>
            </section>

            <!-- Bilans de votre mandat : mi-mandat et fin de mandat, de l'inventaire hérité à la dernière inscription avant la date. Jamais partiel. -->
            <section v-if="bilans.length" class="registry-section" data-testid="registry-bilans">
              <h3 class="registry-heading">{{ t('EconomyInventoryRegistry.BilansTitle') }}</h3>
              <div v-for="bilan in bilans" :key="bilan.kind" class="mt-2 text-sm text-slate-800 dark:text-slate-800" :data-testid="`registry-bilan-${bilan.kind}`">
                <p v-if="bilan.status === 'pending'" data-testid="registry-bilan-pending">
                  {{ t('EconomyInventoryRegistry.BilanPending', { label: bilanLabel(bilan.kind), date: dateShort(bilan.at), n: bilan.inDays }, bilan.inDays) }}
                </p>
                <p v-else-if="bilan.status === 'insufficient'" data-testid="registry-bilan-insufficient">
                  {{ t('EconomyInventoryRegistry.BilanInsufficient', { label: bilanLabel(bilan.kind), missing: missingLabel(bilan.missing) }) }}
                </p>
                <template v-else>
                  <p class="font-bold">{{ bilanLabel(bilan.kind) }}{{ t('EconomyInventoryRegistry.BilanRange', { from: dateShort(bilan.start.taken_on), to: dateShort(bilan.end.taken_on) }) }}</p>
                  <p class="mt-0.5" :data-testid="`registry-bilan-${bilan.kind}-summary`">
                    {{ t('EconomyBalance.Summary', { up: bilan.result.counts.up, down: bilan.result.counts.down, added: bilan.result.counts.new, gone: bilan.result.counts.disappeared }) }}
                  </p>
                  <p v-if="bilanEcus(bilan.result)" class="mt-0.5">
                    {{ t('EconomyBalance.Treasury', { ecus: bilanEcus(bilan.result).amount }) }}
                    <span v-if="bilanEcus(bilan.result).diff" :class="bilanEcus(bilan.result).cls">
                      <span aria-hidden="true">{{ bilanEcus(bilan.result).arrow }}</span>
                      <span class="sr-only">{{ t(bilanEcus(bilan.result).label) }}</span>
                      {{ bilanEcus(bilan.result).diff }}
                    </span>
                  </p>
                  <p v-if="!bilan.result.hasChanges" class="mt-0.5 font-medium">{{ t('EconomyBalance.NoChange') }}</p>
                  <div class="mt-1.5 flex flex-wrap items-center gap-2">
                    <button type="button" class="odc-btn odc-btn--soft odc--slate odc-btn--sm" :aria-expanded="openedBilan === bilan.kind" :data-testid="`registry-bilan-${bilan.kind}-toggle`" @click="openedBilan = openedBilan === bilan.kind ? null : bilan.kind">
                      {{ openedBilan === bilan.kind ? t('EconomyInventoryRegistry.BilanHide') : t('EconomyInventoryRegistry.BilanShow') }}
                    </button>
                    <button type="button" class="odc-btn odc-btn--soft odc--green odc-btn--sm" :data-testid="`registry-bilan-${bilan.kind}-export`" @click="exportBilan(bilan)">
                      <v-icon name="fa-copy" aria-hidden="true" />{{ t('EconomyInventory.ExportButton') }}
                    </button>
                  </div>
                  <InventoryDiffTable v-if="openedBilan === bilan.kind" :result="bilan.result" :testid="`registry-bilan-${bilan.kind}`" />
                </template>
              </div>
            </section>

            <!-- Jours sans inscription depuis l'entrée en fonction : un fait, en périodes. Aucun seuil, aucune couleur, aucun jugement. -->
            <section v-if="gaps" class="registry-section" data-testid="registry-gaps">
              <h3 class="registry-heading">{{ t('EconomyInventoryRegistry.GapsTitle') }}</h3>
              <p class="mt-2 text-sm text-slate-800 dark:text-slate-800" data-testid="registry-gaps-summary">
                {{ t('EconomyInventoryRegistry.GapsCount', { date: dateShort(mandate.in_office_from) }, gaps.days) }}
              </p>
              <ul v-if="gaps.periods.length" class="mt-1 max-h-40 overflow-y-auto text-sm text-slate-700 dark:text-slate-700" data-testid="registry-gaps-periods">
                <li v-for="period in gaps.periods" :key="period.from" class="tabular-nums">
                  {{ period.from === period.to ? t('EconomyInventoryRegistry.GapsDay', { date: dateShort(period.from) }) : t('EconomyInventoryRegistry.GapsPeriod', { from: dateShort(period.from), to: dateShort(period.to) }) }}
                </li>
              </ul>
            </section>
          </div>
        </section>

        <!-- La mémoire : les inscriptions, de la plus récente à la plus ancienne. -->
        <!-- La comparaison (colonne du milieu) ; les inscriptions sont leur propre colonne, plus bas dans le gabarit. -->
        <aside v-if="selected" class="min-w-0 laptop:col-start-2 laptop:row-start-1 desktop:col-start-2" data-testid="registry-side">
            <!-- Toujours là, comme les chevrons : grisée tant qu'il n'y a qu'une inscription (rien à comparer), et elle le dit. -->
            <label class="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-800">
              <span>{{ t('EconomyInventoryRegistry.CompareLabel') }}</span>
              <select v-model="compareId" :disabled="!compareCandidates.length" class="cursor-pointer rounded-lg border border-slate-400 bg-white px-2 py-1 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-60" data-testid="registry-compare">
                <option value="">{{ t('EconomyInventoryRegistry.CompareNone') }}</option>
                <option v-for="snapshot in compareCandidates" :key="snapshot.id" :value="snapshot.id">{{ dateOf(snapshot) }}</option>
              </select>
              <span v-if="!compareCandidates.length" class="text-xs font-normal italic text-slate-700 dark:text-slate-700" data-testid="registry-compare-unavailable">{{ t('EconomyInventoryRegistry.CompareUnavailable') }}</span>
            </label>

            <div v-if="comparison" class="registry-section mt-4" data-testid="registry-compare-result">
              <h3 class="registry-heading">{{ t('EconomyInventoryRegistry.CompareTitle', { from: dateOf(comparison.older), to: dateOf(comparison.newer) }) }}</h3>
              <p class="mt-1 text-sm text-slate-800 dark:text-slate-800" data-testid="registry-compare-summary">
                {{ t('EconomyBalance.Summary', { up: comparison.result.counts.up, down: comparison.result.counts.down, added: comparison.result.counts.new, gone: comparison.result.counts.disappeared }) }}
              </p>
              <p v-if="ecusView" class="mt-1 text-sm text-slate-800 dark:text-slate-800" data-testid="registry-compare-ecus">
                {{ t('EconomyBalance.Treasury', { ecus: ecusView.amount }) }}
                <span v-if="ecusView.diff" :class="ecusView.cls">
                  <span aria-hidden="true">{{ ecusView.arrow }}</span>
                  <span class="sr-only">{{ t(ecusView.label) }}</span>
                  {{ ecusView.diff }}
                </span>
              </p>
              <p v-if="!comparison.result.hasChanges" class="mt-1 text-sm font-medium text-slate-800 dark:text-slate-800" data-testid="registry-compare-nochange">{{ t('EconomyBalance.NoChange') }}</p>
              <div class="mt-1.5">
                <button type="button" class="odc-btn odc-btn--soft odc--green odc-btn--sm" data-testid="registry-compare-export" @click="exportComparison">
                  <v-icon name="fa-copy" aria-hidden="true" />{{ t('EconomyInventory.ExportButton') }}
                </button>
              </div>
              <InventoryDiffTable :result="comparison.result" testid="registry-compare" />
            </div>
        </aside>

        <nav class="min-w-0 laptop:col-start-2 laptop:row-start-2 desktop:col-start-3 desktop:row-start-1" :aria-label="t('EconomyInventoryRegistry.ListTitle')" data-testid="registry-list">
          <details open class="registry-section mt-4 desktop:!mt-0 desktop:!border-t-0 desktop:!pt-0" data-testid="registry-index">
            <summary class="registry-heading cursor-pointer">{{ t('EconomyInventoryRegistry.ListTitle') }} ({{ snapshots.length }})</summary>
            <ul class="mt-2 max-h-96 overflow-y-auto">
              <li v-for="snapshot in snapshots" :key="snapshot.id">
                <button
                  type="button"
                  class="block w-full rounded px-2 py-1 text-left text-sm text-slate-800 hover:bg-yellow-50 dark:text-slate-800"
                  :class="snapshot.id === selectedId ? 'bg-yellow-100 font-bold' : ''"
                  :aria-current="snapshot.id === selectedId ? 'true' : undefined"
                  :data-testid="`registry-entry-${snapshot.id}`"
                  @click="selectedId = snapshot.id"
                >
                  {{ dateOf(snapshot) }}
                  <span v-if="snapshot.by_me" class="block text-xs font-normal text-slate-700">{{ t('EconomyInventoryRegistry.ByMe') }}</span>
                </button>
              </li>
            </ul>
          </details>
        </nav>
      </div>
    </template>
    </ChestLoader>
  </div>
</template>

<style scoped>
  /* Mêmes règles que la page sœur (Registre des mines) : un filet fin au-dessus, pas de carte — la structure porte l'information. */
  .registry-section { border-top: 1px solid #cbd5e1; padding-top: 0.75rem; }
  .registry-section--first { border-top: 0; padding-top: 0; }
  .registry-heading { font-weight: 700; font-size: 1rem; line-height: 1.4; color: #1e293b; margin-bottom: 0; }
</style>
