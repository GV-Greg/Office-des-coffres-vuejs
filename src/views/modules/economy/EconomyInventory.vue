<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCookieStore } from '@/stores/cookieStore'
import { parseInventoryText, resolveItems } from '@/modules/inventoryParser'
import { suggestCategory, CATEGORY_KEYS, CATEGORY_LABELS_FR } from '@/modules/inventoryCategories'
import { exportInventoryToBBCode, EXPORT_DEFAULT_COLOR } from '@/modules/inventoryBBcode'
import { push } from 'notivue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const { t, locale } = useI18n()
const cookieStore = useCookieStore()
const authStore = useAuthStore()

const COMFORT_PASTE = 'inventory_paste'
const COMFORT_CATS = 'inventory_custom_cats'
const COMFORT_CAT_CONFIG = 'inventory_cat_config'
const COMFORT_VISIBILITY = 'inventory_visibility'

const pastedText = ref(cookieStore.getComfortData(COMFORT_PASTE, ''))
const customCats = ref({ ...cookieStore.getComfortData(COMFORT_CATS, {}) })
const catConfig = ref(cookieStore.getComfortData(COMFORT_CAT_CONFIG, { custom: [] }))
const visibility = ref(cookieStore.getComfortData(COMFORT_VISIBILITY, { hiddenCategories: [], hiddenItems: [] }))

// Options d'export (cookies dédiés, indépendants du catConfig)
const exportQtyFormat = ref(cookieStore.getComfortData('inventory_export_qty_format', 'prefix'))
const exportShowEcus = ref(cookieStore.getComfortData('inventory_export_ecus', true))
const exportWrapper = ref(cookieStore.getComfortData('inventory_export_wrapper', 'none'))

watch(pastedText, val => cookieStore.setComfortData(COMFORT_PASTE, val))
watch(customCats, val => cookieStore.setComfortData(COMFORT_CATS, { ...val }), { deep: true })
watch(catConfig, val => cookieStore.setComfortData(COMFORT_CAT_CONFIG, { ...val }), { deep: true })
watch(visibility, val => cookieStore.setComfortData(COMFORT_VISIBILITY, { ...val }), { deep: true })
watch(exportQtyFormat, val => cookieStore.setComfortData('inventory_export_qty_format', val))
watch(exportShowEcus, val => cookieStore.setComfortData('inventory_export_ecus', val))
watch(exportWrapper, val => cookieStore.setComfortData('inventory_export_wrapper', val))

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

const customCatsList = computed(() => catConfig.value.custom ?? [])
const hiddenBuiltIn = computed(() => new Set(catConfig.value.hiddenBuiltIn ?? []))

const allCategoryKeys = computed(() => [
  ...CATEGORY_KEYS.filter(k => !hiddenBuiltIn.value.has(k)),
  ...customCatsList.value.map(c => c.key),
])

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

// Le <select> s'affiche uniquement si non connecté OU si l'item n'est pas encore catégorisé explicitement.
// Connecté + catégorie explicite (customCats) = réglé via Mon bureau → pas de <select>.
const showCategorySelect = name => !authStore.isLoggedIn || !(name in customCats.value)

const changeCategory = (name, catKey) => {
  customCats.value = { ...customCats.value, [name]: catKey }
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

const hiddenCategoriesSet = computed(() => new Set(visibility.value.hiddenCategories ?? []))
const hiddenItemsSet = computed(() => new Set(visibility.value.hiddenItems ?? []))
const hasHidden = computed(() => hiddenCategoriesSet.value.size > 0 || hiddenItemsSet.value.size > 0)

function toggleCategoryVisibility(catKey) {
  const hidden = new Set(hiddenCategoriesSet.value)
  if (hidden.has(catKey)) hidden.delete(catKey)
  else hidden.add(catKey)
  visibility.value = { ...visibility.value, hiddenCategories: [...hidden] }
}

function toggleItemVisibility(name) {
  const hidden = new Set(hiddenItemsSet.value)
  if (hidden.has(name)) hidden.delete(name)
  else hidden.add(name)
  visibility.value = { ...visibility.value, hiddenItems: [...hidden] }
}

function hideAll() {
  visibility.value = {
    hiddenCategories: groupedItems.value.map(([key]) => key),
    hiddenItems: [],
  }
}

function showAll() {
  visibility.value = { hiddenCategories: [], hiddenItems: [] }
}


async function doExport() {
  const visibleItems = parsedItems.value.filter(item => {
    if (hiddenItemsSet.value.has(item.name)) return false
    return !hiddenCategoriesSet.value.has(getCategory(item.name))
  })
  const exportColor = authStore.isLoggedIn
    ? (catConfig.value.exportColor ?? EXPORT_DEFAULT_COLOR)
    : EXPORT_DEFAULT_COLOR
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

function clear() {
  pastedText.value = ''
  customCats.value = {}
  visibility.value = { hiddenCategories: [], hiddenItems: [] }
}

function updateCatConfig(newConfig) {
  // Nettoyage des mappings item→catégorie orphelins (catégorie supprimée ou masquée)
  const hidden = new Set(newConfig.hiddenBuiltIn ?? [])
  const validKeys = new Set([
    ...CATEGORY_KEYS.filter(k => !hidden.has(k)),
    ...(newConfig.custom ?? []).map(c => c.key),
  ])
  const cleaned = {}
  for (const [name, cat] of Object.entries(customCats.value)) {
    if (validKeys.has(cat)) cleaned[name] = cat
  }
  customCats.value = cleaned
  catConfig.value = newConfig
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
      </div>

      <!-- Colonne droite : actions -->
      <div class="mt-2 laptop:mt-6">
        <!-- Bouton gérer les catégories : toujours visible -->
        <div class="flex items-center gap-2 flex-wrap mb-3">
          <template v-if="parsedItems.length > 0">
            <button
              type="button"
              class="odc-btn odc-btn--soft odc--green odc-btn--sm"
              data-testid="export-btn"
              @click="doExport"
            >
              <v-icon name="fa-copy" aria-hidden="true" />{{ t('EconomyInventory.ExportButton') }}
            </button>
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
            :to="{ name: 'province' }"
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
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1.5 mt-1">
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
