<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { parseInventoryText, resolveItems } from '@/modules/inventoryParser'
import { suggestCategory, orderCategoryKeys, CATEGORY_KEYS, CATEGORY_LABELS_FR } from '@/modules/inventoryCategories'
import { exportInventoryToBBCode, EXPORT_DEFAULT_COLOR } from '@/modules/inventoryBBcode'
import { formatFieldDate } from '@/modules/playerDates'
import { apiMessage } from '@/stores/mandateStore'
import { push } from 'notivue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useInventoryStore } from '@/stores/inventoryStore'

/*
  La Salle des comptes. Les réglages (catégories, assignations, ordre, couleur, options d'export, visibilité) et le dernier
  inventaire collé viennent du store des inventaires : le NAVIGATEUR sans compte, le SERVEUR avec un compte (par personnage, et
  par poste pour la ville et la province — voir stores/inventoryStore.js). Le sélecteur de niveau n'apparaît que si le
  personnage actif a un poste qui donne accès à d'autres inventaires que le sien.
*/
const { t, locale } = useI18n()
const authStore = useAuthStore()
const store = useInventoryStore()

const level = ref('personal')
const levels = computed(() => store.availableLevels)
const canWriteLevel = computed(() => store.canWrite(level.value))

// Réglages du niveau affiché ; options d'export et visibilité sont celles du JOUEUR (niveau personnel), quel que soit le niveau.
const doc = computed(() => store.doc(level.value))
const personalDoc = computed(() => store.doc('personal'))

const loadingText = ref(false)
const pastedText = ref(store.serverMode ? '' : store.localPaste())

watch(pastedText, val => {
  if (!loadingText.value) store.savePaste(level.value, val)
})

/** Avec un compte : charge les niveaux, puis le dernier inventaire enregistré du niveau affiché. Sans compte, rien à attendre. */
async function enter(lv) {
  if (!store.serverMode) return
  loadingText.value = true
  try {
    await store.loadScopes()
    await store.load('personal')
    if (lv !== 'personal') await store.load(lv)
    const text = await store.loadPaste(lv)
    if (!pastedText.value) pastedText.value = text
  } finally {
    await nextTick()
    loadingText.value = false
  }
}

onMounted(() => enter(level.value))
onBeforeUnmount(() => store.flush())

watch(level, lv => {
  loadingText.value = true
  pastedText.value = ''
  enter(lv)
})
watch(() => store.characterId, () => {
  if (level.value !== 'personal') {
    level.value = 'personal'
  } else {
    loadingText.value = true
    pastedText.value = ''
    enter('personal')
  }
})

const levelLabel = lv => {
  if (lv === 'city') return t('EconomyInventory.LevelCity', { name: store.scopes?.city?.name ?? '' })
  if (lv === 'province') return t('EconomyInventory.LevelProvince', { name: store.scopes?.province?.name ?? '' })
  return t('EconomyInventory.LevelPersonal')
}

// Options d'export : celles du joueur (niveau personnel).
const exportQtyFormat = computed({
  get: () => personalDoc.value.exportQtyFormat,
  set: v => store.update('personal', { exportQtyFormat: v }),
})
const exportShowEcus = computed({
  get: () => personalDoc.value.exportShowEcus,
  set: v => store.update('personal', { exportShowEcus: v }),
})
const exportWrapper = computed({
  get: () => personalDoc.value.exportWrapper,
  set: v => store.update('personal', { exportWrapper: v }),
})

const exportQtyLabel = computed(() =>
  exportQtyFormat.value === 'prefix'
    ? t('EconomyInventory.ExportQtyPrefix')
    : t('EconomyInventory.ExportQtySuffix')
)
const exportWrapperLabel = computed(() => {
  const map = { rp: 'ExportWrapperRp', quote: 'ExportWrapperQuote' }
  return t(`EconomyInventory.${map[exportWrapper.value] ?? 'ExportWrapperNone'}`)
})

const parsedResult = computed(() => {
  const { totalEcus, items } = parseInventoryText(pastedText.value)
  return { totalEcus, items: resolveItems(items) }
})

const parsedItems = computed(() => parsedResult.value.items)
const totalEcus = computed(() => parsedResult.value.totalEcus)

const customCats = computed(() => doc.value.itemCategories)
const catConfig = computed(() => ({
  custom: doc.value.custom,
  hiddenBuiltIn: doc.value.hiddenBuiltIn,
  order: doc.value.order,
  exportColor: doc.value.exportColor,
}))
const customCatsList = computed(() => catConfig.value.custom ?? [])
const hiddenBuiltIn = computed(() => new Set(catConfig.value.hiddenBuiltIn ?? []))

// L'ordre choisi par le joueur (flèches de Mon bureau, `catConfig.order`) vaut pour l'affichage ET pour le BBCode :
// les deux lisent cette liste.
const allCategoryKeys = computed(() => orderCategoryKeys([
  ...CATEGORY_KEYS.filter(k => !hiddenBuiltIn.value.has(k)),
  ...customCatsList.value.map(c => c.key),
], catConfig.value.order))

const getCategoryLabel = key => {
  const custom = customCatsList.value.find(c => c.key === key)
  if (custom) return locale.value === 'fr' ? custom.fr : (custom.en || custom.fr)
  return t(`EconomyInventory.Categories.${key}`)
}

// Libellé FR fixe pour le BBCode forum (indépendant de la langue de l'UI)
const getCategoryLabelFr = key => {
  const custom = customCatsList.value.find(c => c.key === key)
  if (custom) return custom.fr
  return CATEGORY_LABELS_FR[key] ?? key
}

const getCategory = name => suggestCategory(name, customCats.value) ?? 'divers'

// Un niveau en lecture seule (le dirigeant devant l'inventaire de sa province) ne corrige rien.
const showCategorySelect = () => canWriteLevel.value

// Une correction faite ici est enregistrée tout de suite (avec un compte : sur le serveur) : Mon bureau la retrouve.
const changeCategory = (name, catKey) => {
  store.update(level.value, { itemCategories: { ...customCats.value, [name]: catKey } })
}

const groupedItems = computed(() => {
  const groups = new Map(allCategoryKeys.value.map(k => [k, []]))
  for (const item of parsedItems.value) {
    const cat = getCategory(item.name)
    const bucket = groups.has(cat) ? cat : 'divers'
    groups.get(bucket).push(item)
  }
  for (const items of groups.values()) {
    items.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  }
  return [...groups.entries()].filter(([, items]) => items.length > 0)
})

const hiddenCategoriesSet = computed(() => new Set(personalDoc.value.visibility.hiddenCategories))
const hiddenItemsSet = computed(() => new Set(personalDoc.value.visibility.hiddenItems))
const hasHidden = computed(() => hiddenCategoriesSet.value.size > 0 || hiddenItemsSet.value.size > 0)

const setVisibility = visibility => store.update('personal', { visibility })

function toggleCategoryVisibility(catKey) {
  const hidden = new Set(hiddenCategoriesSet.value)
  if (hidden.has(catKey)) hidden.delete(catKey)
  else hidden.add(catKey)
  setVisibility({ hiddenCategories: [...hidden], hiddenItems: [...hiddenItemsSet.value] })
}

function toggleItemVisibility(name) {
  const hidden = new Set(hiddenItemsSet.value)
  if (hidden.has(name)) hidden.delete(name)
  else hidden.add(name)
  setVisibility({ hiddenCategories: [...hiddenCategoriesSet.value], hiddenItems: [...hidden] })
}

function hideAll() {
  setVisibility({ hiddenCategories: groupedItems.value.map(([key]) => key), hiddenItems: [] })
}

function showAll() {
  setVisibility({ hiddenCategories: [], hiddenItems: [] })
}


async function doExport() {
  const visibleItems = parsedItems.value.filter(item => {
    if (hiddenItemsSet.value.has(item.name)) return false
    return !hiddenCategoriesSet.value.has(getCategory(item.name))
  })
  const exportColor = (authStore.isLoggedIn ? catConfig.value.exportColor : undefined) ?? EXPORT_DEFAULT_COLOR
  const bbcode = exportInventoryToBBCode(
    visibleItems,
    name => suggestCategory(name, customCats.value),
    {
      categoryKeys: allCategoryKeys.value,
      getCategoryLabel: getCategoryLabelFr,
      options: {
        qtyFormat: exportQtyFormat.value,
        showEcus: exportShowEcus.value,
        wrapper: exportWrapper.value,
        color: exportColor,
        totalEcus: totalEcus.value,
      },
    },
  )
  try {
    await navigator.clipboard.writeText(bbcode)
    push.success(t('EconomyInventory.CopiedToast'))
  } catch {
    // clipboard non disponible (contexte non sécurisé, iframe…)
  }
}

// « Effacer » vide le CHAMP de collage (et l'état d'affichage des lignes), rien d'autre : ni l'inventaire enregistré, ni les
// catégories et assignations, qui sont des réglages (Greg, 11/11/2026).
function clear() {
  pastedText.value = ''
  setVisibility({ hiddenCategories: [], hiddenItems: [] })
}

// ─── Province : l'historique ────────────────────────────────────────────────
const snapshots = computed(() => store.history?.snapshots ?? [])
const snapshotDate = s => formatFieldDate('inventory_snapshot_date', s.taken_on, locale.value)
const recording = ref(false)

watch(level, lv => { if (lv === 'province') store.loadHistory() }, { immediate: true })

async function recordProvince() {
  recording.value = true
  try {
    const result = await store.recordProvince(pastedText.value)
    const key = result.unchanged ? 'ProvinceUnchanged' : result.replaced ? 'ProvinceReplaced' : 'ProvinceRecorded'
    push.success(t(`EconomyInventory.${key}`, { date: formatFieldDate('inventory_snapshot_date', result.snapshot.taken_on, locale.value) }))
  } catch (error) {
    push.error(apiMessage(error, locale.value, t('EconomyInventory.SaveError')))
  } finally {
    recording.value = false
  }
}

function loadSnapshot(event) {
  const snapshot = snapshots.value.find(s => String(s.id) === event.target.value)
  event.target.value = ''
  if (snapshot) pastedText.value = snapshot.raw
}
</script>

<template>
  <div>
    <h2 class="text-lg font-semibold text-yellow-600 dark:text-yellow-500 mb-3">
      {{ t('EconomyInventory.PageTitle') }}
    </h2>

    <!-- Ligne du haut : input (moitié) + contrôles (moitié) -->
    <div class="laptop:grid laptop:grid-cols-2 laptop:gap-6 laptop:items-start">
      <!-- Colonne gauche : saisie -->
      <div>
        <!-- Niveau d'inventaire : seulement si le personnage actif a un poste qui en ouvre d'autres que le sien. -->
        <div v-if="levels.length > 1" role="group" :aria-label="t('EconomyInventory.LevelNav')" class="flex flex-wrap gap-2 mb-2" data-testid="inventory-levels">
          <button
            v-for="lv in levels"
            :key="lv"
            type="button"
            class="odc-btn odc-btn--soft odc-btn--sm"
            :class="level === lv ? 'odc--gold' : 'odc--slate'"
            :aria-pressed="level === lv"
            :data-testid="`inventory-level-${lv}`"
            @click="level = lv"
          >{{ levelLabel(lv) }}</button>
        </div>
        <p v-if="!canWriteLevel" role="note" class="text-xs italic text-slate-600 dark:text-slate-400 mb-2" data-testid="inventory-readonly">
          {{ t('EconomyInventory.ReadOnlyScope') }}
        </p>
        <label class="block text-sm font-medium mb-1" for="inventory-paste">
          {{ t('EconomyInventory.PasteLabel') }}
        </label>
        <textarea
          id="inventory-paste"
          v-model="pastedText"
          :placeholder="t('EconomyInventory.PastePlaceholder')"
          class="textarea-autoresize w-full h-36 p-2 rounded-xl bg-white text-sm font-mono resize-y"
          data-testid="inventory-paste"
        />

        <!-- Province : l'historique des inventaires du commissaire au commerce (un par jour, le second du jour remplace le premier). -->
        <div v-if="level === 'province'" class="mt-2 flex flex-wrap items-center gap-2" data-testid="province-history-block">
          <button
            v-if="canWriteLevel"
            type="button"
            class="odc-btn odc-btn--soft odc--green odc-btn--sm"
            :disabled="recording || parsedItems.length === 0"
            data-testid="province-record"
            @click="recordProvince"
          >
            <v-icon name="fa-save" aria-hidden="true" />{{ t('EconomyInventory.ProvinceRecord') }}
          </button>
          <label v-if="snapshots.length" class="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
            <span>{{ t('EconomyInventory.ProvinceHistory', { count: snapshots.length }) }}</span>
            <select
              class="text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 dark:text-slate-100 py-0.5 px-1 cursor-pointer"
              data-testid="province-history"
              @change="loadSnapshot"
            >
              <option value="">{{ t('EconomyInventory.ProvinceHistoryLoad') }}</option>
              <option v-for="snapshot in snapshots" :key="snapshot.id" :value="snapshot.id">{{ snapshotDate(snapshot) }}</option>
            </select>
          </label>
          <span v-else class="text-xs italic text-slate-500 dark:text-slate-400" data-testid="province-history-empty">{{ t('EconomyInventory.ProvinceHistoryEmpty') }}</span>
        </div>
      </div>

      <!-- Colonne droite : actions -->
      <div class="mt-2 laptop:mt-6">
        <!-- Bouton gérer les catégories : toujours visible -->
        <div class="flex items-center gap-2 flex-wrap mb-3">
          <template v-if="parsedItems.length > 0">
            <button
              type="button"
              class="odc-btn odc-btn--soft odc--red odc-btn--sm"
              data-testid="clear-btn"
              @click="clear"
            >
              <v-icon name="fa-trash-alt" aria-hidden="true" />{{ t('EconomyInventory.ClearButton') }}
            </button>
            <button
              type="button"
              class="odc-btn odc-btn--soft odc--slate odc-btn--sm"
              data-testid="hide-all-btn"
              @click="hideAll"
            >
              <v-icon name="fa-eye-slash" aria-hidden="true" />{{ t('EconomyInventory.HideAll') }}
            </button>
            <button
              type="button"
              class="odc-btn odc-btn--soft odc--yellow odc-btn--sm"
              data-testid="show-all-btn"
              :disabled="!hasHidden"
              @click="showAll"
            >
              <v-icon name="fa-eye" aria-hidden="true" />{{ t('EconomyInventory.ShowAll') }}
            </button>
          </template>
          <RouterLink
            :to="{ name: 'province', params: { section: 'categories' } }"
            class="odc-btn odc-btn--soft odc--violet odc-btn--sm"
          >
            <v-icon name="fa-tag" aria-hidden="true" />{{ t('EconomyInventory.SettingsInDesk') }}
          </RouterLink>
        </div>

        <!-- Toggles d'export : visibles uniquement quand des items sont parsés -->
        <fieldset
          v-if="parsedItems.length > 0"
          class="border border-slate-300 dark:border-slate-600 rounded-lg px-3 pt-1.5 pb-2.5 mb-3"
        >
          <legend class="px-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 select-none">
            {{ t('EconomyInventory.ExportOptionsTitle') }}
          </legend>
          <!-- Options à gauche, « Confier au scribe » à droite : l'action principale de l'encart (Greg, 11/11/2026). -->
          <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mt-1">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <!-- Format de quantité (overlay select) -->
            <div class="relative inline-flex">
              <span class="odc-btn odc-btn--soft odc--slate odc-btn--sm pointer-events-none select-none gap-1">
                <span>{{ exportQtyLabel }}</span>
                <v-icon name="fa-chevron-down" scale="0.7" aria-hidden="true" />
              </span>
              <select
                v-model="exportQtyFormat"
                class="absolute inset-0 opacity-0 cursor-pointer w-full"
                :aria-label="t('EconomyInventory.ExportQtyFormat')"
                data-testid="export-qty-format"
              >
                <option value="suffix">{{ t('EconomyInventory.ExportQtySuffix') }}</option>
                <option value="prefix">{{ t('EconomyInventory.ExportQtyPrefix') }}</option>
              </select>
            </div>

            <!-- Afficher le trésor (toggle) -->
            <button
              type="button"
              class="odc-btn odc-btn--soft odc-btn--sm gap-1"
              :class="exportShowEcus ? 'odc--gold' : 'odc--slate'"
              :aria-pressed="exportShowEcus"
              @click="exportShowEcus = !exportShowEcus"
            >
              <v-icon v-if="exportShowEcus" name="fa-check" scale="0.7" aria-hidden="true" />
              <span>{{ t('EconomyInventory.ExportShowEcus') }}</span>
            </button>
            <input
              v-model="exportShowEcus"
              type="checkbox"
              class="sr-only"
              data-testid="export-show-ecus"
            />

            <!-- Wrapper (overlay select) -->
            <div class="relative inline-flex">
              <span class="odc-btn odc-btn--soft odc--slate odc-btn--sm pointer-events-none select-none gap-1">
                <span>{{ exportWrapperLabel }}</span>
                <v-icon name="fa-chevron-down" scale="0.7" aria-hidden="true" />
              </span>
              <select
                v-model="exportWrapper"
                class="absolute inset-0 opacity-0 cursor-pointer w-full"
                :aria-label="t('EconomyInventory.ExportWrapper')"
                data-testid="export-wrapper"
              >
                <option value="none">{{ t('EconomyInventory.ExportWrapperNone') }}</option>
                <option value="rp">{{ t('EconomyInventory.ExportWrapperRp') }}</option>
                <option value="quote">{{ t('EconomyInventory.ExportWrapperQuote') }}</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            class="odc-btn odc-btn--soft odc--green"
            data-testid="export-btn"
            @click="doExport"
          >
            <v-icon name="fa-copy" aria-hidden="true" />{{ t('EconomyInventory.ExportButton') }}
          </button>
          </div>
        </fieldset>

        <p v-if="parsedItems.length > 0" class="text-sm text-slate-600 dark:text-slate-400">
          <template v-if="totalEcus !== null">
            {{ t('EconomyInventory.Summary', { count: parsedItems.length, ecus: totalEcus.toLocaleString('fr-FR') }) }}
          </template>
          <template v-else>
            {{ t('EconomyInventory.SummaryNoEcus', { count: parsedItems.length }) }}
          </template>
        </p>

        <!-- Texte collé mais aucun item reconnu -->
        <p
          v-else-if="pastedText.trim()"
          class="text-sm text-slate-500 dark:text-slate-400"
          data-testid="no-items-msg"
        >
          {{ t('EconomyInventory.NoItems') }}
        </p>
      </div>
    </div>

    <!-- Items groupés par catégorie : pleine largeur, en dessous -->
    <template v-if="parsedItems.length > 0">
      <div class="mt-4">
        <div
          v-for="[catKey, groupItems] in groupedItems"
          :key="catKey"
          class="mb-4"
        >
          <h3 class="flex items-center justify-between text-xs font-bold uppercase tracking-wide mb-1 border-b border-yellow-200 dark:border-yellow-900 pb-0.5"
            :class="hiddenCategoriesSet.has(catKey) ? 'text-slate-400 dark:text-slate-500' : 'text-yellow-700 dark:text-yellow-500'"
          >
            <span>{{ getCategoryLabel(catKey) }}</span>
            <span class="flex items-center gap-2 font-normal normal-case tracking-normal">
              <span class="text-slate-400 dark:text-slate-500">{{ groupItems.length }}</span>
              <button
                type="button"
                class="odc-btn odc-btn--soft odc-btn--rect odc-btn--icon odc-btn--sm shrink-0"
                :class="hiddenCategoriesSet.has(catKey) ? 'odc--yellow' : 'odc--slate'"
                :aria-label="hiddenCategoriesSet.has(catKey) ? t('EconomyInventory.ShowCategory') : t('EconomyInventory.HideCategory')"
                @click="toggleCategoryVisibility(catKey)"
              >
                <v-icon :name="hiddenCategoriesSet.has(catKey) ? 'fa-eye' : 'fa-eye-slash'" aria-hidden="true" />
              </button>
            </span>
          </h3>
          <ul class="grid grid-cols-1 laptop:grid-cols-2 desktop:grid-cols-3 gap-x-6 gap-y-0.5">
            <li
              v-for="item in groupItems"
              :key="item.name"
              class="flex items-center gap-2 text-sm rounded px-1 -mx-1 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors"
              :class="{'opacity-40': hiddenCategoriesSet.has(catKey) || hiddenItemsSet.has(item.name)}"
            >
              <span
                class="tabular-nums text-right w-14 shrink-0 text-yellow-600 dark:text-yellow-500 font-medium"
                :class="{'line-through': hiddenCategoriesSet.has(catKey) || hiddenItemsSet.has(item.name)}"
              >
                {{ item.quantity }}
              </span>
              <span class="flex-1 min-w-0 flex items-center gap-1 overflow-hidden">
                <span
                  class="truncate"
                  :class="{'line-through': hiddenCategoriesSet.has(catKey) || hiddenItemsSet.has(item.name)}"
                >{{ item.name }}</span>
                <span
                  v-if="item.truncated"
                  class="shrink-0 text-yellow-600 dark:text-yellow-400"
                  :title="t('EconomyInventory.TruncatedHint')"
                  aria-hidden="true"
                >✂</span>
              </span>
              <select
                v-if="showCategorySelect(item.name)"
                :value="getCategory(item.name)"
                :aria-label="t('EconomyInventory.CategoryAriaLabel', { name: item.name })"
                class="shrink-0 w-32 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 dark:text-slate-100 py-0.5 px-1 cursor-pointer"
                @change="e => changeCategory(item.name, e.target.value)"
              >
                <option v-for="cat in allCategoryKeys" :key="cat" :value="cat">
                  {{ getCategoryLabel(cat) }}
                </option>
              </select>
              <button
                type="button"
                class="odc-btn odc-btn--soft odc-btn--rect odc-btn--icon odc-btn--sm odc--slate shrink-0"
                :aria-label="hiddenItemsSet.has(item.name) ? t('EconomyInventory.ShowItem') : t('EconomyInventory.HideItem')"
                @click="toggleItemVisibility(item.name)"
              >
                <v-icon :name="hiddenItemsSet.has(item.name) ? 'fa-eye' : 'fa-eye-slash'" aria-hidden="true" />
              </button>
            </li>
          </ul>
        </div>
      </div>

    </template>

  </div>
</template>
