<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { CATEGORY_KEYS } from '@/modules/inventoryCategories'
import { EXPORT_DEFAULT_COLOR, EXPORT_COLORS } from '@/modules/inventoryBBcode'
import { useCookieStore } from '@/stores/cookieStore'
import InventoryItemsModal from './InventoryItemsModal.vue'

/*
  Gestion des catégories d'inventaire en format panneau (sans coque modale).
  Un clic sur un chip ouvre InventoryItemsModal pour gérer les items de cette catégorie.
*/
const props = defineProps({
  catConfig: {
    type: Object,
    default: () => ({ custom: [], hiddenBuiltIn: [] }),
  },
})
const emit = defineEmits(['update:catConfig'])

const { t, locale } = useI18n()
const cookieStore = useCookieStore()

const newFr = ref('')
const newEn = ref('')
const addError = ref('')
const pendingDelete = ref(null)

// Modale items : clé de la catégorie ouverte
const modalCatKey = ref(null)
const modalRef = ref(null)

const customCategories = computed(() => props.catConfig.custom ?? [])
const hiddenBuiltInSet = computed(() => new Set(props.catConfig.hiddenBuiltIn ?? []))
const visibleBuiltIn = computed(() => CATEGORY_KEYS.filter(k => !hiddenBuiltInSet.value.has(k)))
const hiddenBuiltInList = computed(() => CATEGORY_KEYS.filter(k => hiddenBuiltInSet.value.has(k)))

const allKeys = computed(() => new Set([
  ...CATEGORY_KEYS,
  ...customCategories.value.map(c => c.key),
]))

// Assignations items → catégories (cookieStore)
const customCats = computed(() => cookieStore.getComfortData('inventory_custom_cats', {}))

function saveCustomCats(map) {
  cookieStore.setComfortData('inventory_custom_cats', map)
}

// Items assignés à une catégorie donnée, triés alphabétiquement
function itemsForCategory(catKey) {
  return Object.entries(customCats.value)
    .filter(([, v]) => v === catKey)
    .map(([k]) => k)
    .sort((a, b) => a.localeCompare(b, locale.value))
}

// Items connus qui ne sont pas dans la catégorie active de la modale
const modalAutocompleteItems = computed(() => {
  if (!modalCatKey.value) return []
  return Object.keys(customCats.value)
    .filter(name => customCats.value[name] !== modalCatKey.value)
    .sort((a, b) => a.localeCompare(b, locale.value))
})

// Label de la catégorie ouverte dans la modale
const modalCatLabel = computed(() => {
  if (!modalCatKey.value) return ''
  if (CATEGORY_KEYS.includes(modalCatKey.value)) {
    return t(`EconomyInventory.Categories.${modalCatKey.value}`)
  }
  const custom = customCategories.value.find(c => c.key === modalCatKey.value)
  return custom ? (locale.value === 'fr' ? custom.fr : (custom.en || custom.fr)) : ''
})

function openModal(catKey) {
  modalCatKey.value = catKey
}

function closeModal() {
  modalCatKey.value = null
}

function addItem(name) {
  const current = customCats.value
  if (current[name] === modalCatKey.value) {
    modalRef.value?.handleAddError(t('EconomyInventory.ItemAlreadyInCategory'))
    return
  }
  saveCustomCats({ ...current, [name]: modalCatKey.value })
}

function removeItem(itemName) {
  const updated = { ...customCats.value }
  delete updated[itemName]
  saveCustomCats(updated)
}

function labelToKey(label) {
  return label
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30)
}

function emitConfig(partial) {
  emit('update:catConfig', { ...props.catConfig, ...partial })
}

function hideBuiltIn(key) {
  emitConfig({ hiddenBuiltIn: [...(props.catConfig.hiddenBuiltIn ?? []), key] })
}

function restoreBuiltIn(key) {
  emitConfig({ hiddenBuiltIn: (props.catConfig.hiddenBuiltIn ?? []).filter(k => k !== key) })
}

function add() {
  const fr = newFr.value.trim()
  if (!fr) return

  const frLower = fr.toLowerCase()
  const labelExists =
    customCategories.value.some(c => c.fr.toLowerCase() === frLower) ||
    CATEGORY_KEYS.some(k => t(`EconomyInventory.Categories.${k}`).toLowerCase() === frLower)
  if (labelExists) { addError.value = t('EconomyInventory.CategoryDuplicate'); return }

  const baseKey = labelToKey(fr)
  if (!baseKey) { addError.value = t('EconomyInventory.CategoryKeyInvalid'); return }

  let key = baseKey
  let i = 2
  while (allKeys.value.has(key)) key = `${baseKey}_${i++}`

  emitConfig({ custom: [...customCategories.value, { key, fr, en: newEn.value.trim() || fr }] })
  newFr.value = ''
  newEn.value = ''
  addError.value = ''
}

const selectedColor = computed(() => props.catConfig.exportColor ?? EXPORT_DEFAULT_COLOR)

function setExportColor(color) {
  emitConfig({ exportColor: color })
}

function doDelete() {
  const keyToDelete = pendingDelete.value
  const updated = Object.fromEntries(
    Object.entries(customCats.value).filter(([, v]) => v !== keyToDelete)
  )
  saveCustomCats(updated)
  if (modalCatKey.value === keyToDelete) closeModal()
  emitConfig({ custom: customCategories.value.filter(c => c.key !== keyToDelete) })
  pendingDelete.value = null
}
</script>

<template>
  <div>
    <!-- Accroche -->
    <p class="text-xs text-slate-400 dark:text-slate-500 italic mb-3 flex items-center gap-1">
      <v-icon name="fa-info-circle" scale="0.75" aria-hidden="true" />
      {{ t('EconomyInventory.ItemsHint') }}
    </p>

    <!-- Corps : 3 colonnes sur tablet+ -->
    <div class="tablet:grid tablet:grid-cols-3 tablet:gap-5">

      <!-- Colonne 1 : prédéfinies visibles -->
      <div>
        <p class="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
          {{ t('EconomyInventory.BuiltInLabel') }}
        </p>
        <div class="grid grid-cols-2 gap-1">
          <div
            v-for="key in visibleBuiltIn"
            :key="key"
            class="flex items-center gap-1 text-sm px-2 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 cursor-pointer hover:border-violet-400 dark:hover:border-violet-500 transition-colors"
            role="button"
            :aria-label="t('EconomyInventory.ExpandItemsFor', { cat: t(`EconomyInventory.Categories.${key}`) })"
            @click="openModal(key)"
          >
            <span class="flex-1 text-slate-800 dark:text-slate-100 truncate text-xs font-medium leading-tight">
              {{ t(`EconomyInventory.Categories.${key}`) }}
            </span>
            <span
              v-if="itemsForCategory(key).length > 0"
              class="shrink-0 text-xs font-semibold text-violet-600 dark:text-violet-300 tabular-nums"
              aria-hidden="true"
            >
              {{ itemsForCategory(key).length }}
            </span>
            <button
              type="button"
              class="odc-btn odc-btn--soft odc-btn--rect odc-btn--icon odc-btn--sm odc--violet shrink-0"
              :aria-label="t('EconomyInventory.HideBuiltIn')"
              @click.stop="hideBuiltIn(key)"
            >
              <v-icon name="fa-eye-slash" aria-hidden="true" />
            </button>
          </div>

          <p v-if="visibleBuiltIn.length === 0" class="text-xs text-slate-400 dark:text-slate-500 italic px-2 py-1">
            {{ t('EconomyInventory.AllHidden') }}
          </p>
        </div>
      </div>

      <!-- Colonne 2 : personnalisées -->
      <div class="mt-4 tablet:mt-0">
        <p class="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
          {{ t('EconomyInventory.CustomLabel') }}
        </p>
        <div v-if="customCategories.length > 0" class="grid grid-cols-2 gap-1">
          <div v-for="cat in customCategories" :key="cat.key">
            <!-- Chip cliquable -->
            <div
              class="flex items-center gap-1 text-sm px-2 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 cursor-pointer hover:border-violet-400 dark:hover:border-violet-500 transition-colors"
              role="button"
              :aria-label="t('EconomyInventory.ExpandItemsFor', { cat: locale === 'fr' ? cat.fr : (cat.en || cat.fr) })"
              @click="pendingDelete !== cat.key && openModal(cat.key)"
            >
              <span class="flex-1 text-slate-800 dark:text-slate-100 truncate text-xs font-medium leading-tight">
                {{ locale === 'fr' ? cat.fr : (cat.en || cat.fr) }}
              </span>
              <span
                v-if="itemsForCategory(cat.key).length > 0 && pendingDelete !== cat.key"
                class="shrink-0 text-xs font-semibold text-violet-600 dark:text-violet-300 tabular-nums"
                aria-hidden="true"
              >
                {{ itemsForCategory(cat.key).length }}
              </span>
              <button
                v-if="pendingDelete !== cat.key"
                type="button"
                class="odc-btn odc-btn--soft odc-btn--rect odc-btn--icon odc-btn--sm odc--red shrink-0"
                :aria-label="t('EconomyInventory.DeleteCategory')"
                @click.stop="pendingDelete = cat.key"
              >
                <v-icon name="fa-trash-alt" aria-hidden="true" />
              </button>
            </div>

            <!-- Confirmation de suppression -->
            <div
              v-if="pendingDelete === cat.key"
              class="mt-1 ml-2 text-xs text-slate-500 dark:text-slate-400"
            >
              <p class="italic mb-2">{{ t('EconomyInventory.DeleteCategoryInfo') }}</p>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="odc-btn odc-btn--soft odc--red odc-btn--sm"
                  @click="doDelete"
                >
                  <v-icon name="fa-trash-alt" aria-hidden="true" />{{ t('EconomyInventory.DeleteCategoryConfirm') }}
                </button>
                <button
                  type="button"
                  class="odc-btn odc-btn--soft odc--slate odc-btn--sm"
                  @click="pendingDelete = null"
                >
                  <v-icon name="fa-times" aria-hidden="true" />{{ t('EconomyInventory.DeleteCategoryCancelBtn') }}
                </button>
              </div>
            </div>
          </div>
        </div>
        <p v-else class="text-xs text-slate-400 dark:text-slate-500 italic px-2 py-1">
          {{ t('EconomyInventory.NoCustomYet') }}
        </p>
      </div>

      <!-- Colonne 3 : masquées -->
      <div class="mt-4 tablet:mt-0">
        <p class="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
          {{ t('EconomyInventory.HiddenBuiltInLabel') }}
        </p>
        <div v-if="hiddenBuiltInList.length > 0" class="grid grid-cols-2 gap-1">
          <div
            v-for="key in hiddenBuiltInList"
            :key="key"
            class="flex items-center gap-1 text-sm px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-dashed border-slate-300 dark:border-slate-500"
          >
            <span class="flex-1 text-slate-500 dark:text-slate-300 line-through truncate text-xs font-medium leading-tight">
              {{ t(`EconomyInventory.Categories.${key}`) }}
            </span>
            <button
              type="button"
              class="odc-btn odc-btn--soft odc-btn--rect odc-btn--icon odc-btn--sm odc--green shrink-0"
              :aria-label="t('EconomyInventory.RestoreBuiltIn')"
              @click="restoreBuiltIn(key)"
            >
              <v-icon name="fa-undo" aria-hidden="true" />
            </button>
          </div>
        </div>
        <p v-else class="text-xs text-slate-400 dark:text-slate-500 italic px-2 py-1">
          {{ t('EconomyInventory.NoneHidden') }}
        </p>
      </div>

    </div>

    <!-- Ajout de catégorie -->
    <div class="border-t border-slate-200 dark:border-slate-600 mt-4 pt-4">
      <p class="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
        {{ t('EconomyInventory.AddCategoryTitle') }}
      </p>
      <div class="flex gap-2 items-center">
        <input
          v-model="newFr"
          type="text"
          :placeholder="t('EconomyInventory.AddCategoryFr')"
          class="flex-1 min-w-0 text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700 dark:text-slate-100"
          @keydown.enter="add"
        />
        <input
          v-model="newEn"
          type="text"
          :placeholder="t('EconomyInventory.AddCategoryEn')"
          class="flex-1 min-w-0 text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700 dark:text-slate-100"
          @keydown.enter="add"
        />
        <button
          type="button"
          class="odc-btn odc-btn--soft odc--green odc-btn--sm shrink-0"
          @click="add"
        >
          <v-icon name="fa-plus" aria-hidden="true" />{{ t('EconomyInventory.AddCategoryBtn') }}
        </button>
      </div>
      <p v-if="addError" class="mt-1 text-xs text-red-500 dark:text-red-400">{{ addError }}</p>
    </div>

    <!-- Couleur des titres à l'export -->
    <div class="border-t border-slate-200 dark:border-slate-600 mt-4 pt-4">
      <p class="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
        {{ t('EconomyInventory.ExportColorTitle') }}
      </p>
      <p class="text-xs text-slate-400 dark:text-slate-500 italic mb-2">
        {{ t('EconomyInventory.ExportColorHint') }}
      </p>
      <div class="flex flex-wrap gap-1.5" role="radiogroup" :aria-label="t('EconomyInventory.ExportColorTitle')">
        <button
          v-for="c in EXPORT_COLORS"
          :key="c.value"
          type="button"
          class="w-6 h-6 rounded-full border-2 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
          :style="{ backgroundColor: c.hex, borderColor: selectedColor === c.value ? '#c2410c' : 'transparent' }"
          :class="selectedColor === c.value ? 'ring-2 ring-orange-600 ring-offset-1 dark:ring-offset-slate-700' : 'hover:border-slate-400 dark:hover:border-slate-300'"
          :aria-label="t('EconomyInventory.ExportColorAriaLabel', { color: c.value }) + (selectedColor === c.value ? ' ' + t('EconomyInventory.ExportColorSelected') : '')"
          :aria-pressed="selectedColor === c.value"
          @click="setExportColor(c.value)"
        />
      </div>
    </div>

    <!-- Modale items -->
    <InventoryItemsModal
      ref="modalRef"
      :show="!!modalCatKey"
      :cat-key="modalCatKey ?? ''"
      :cat-label="modalCatLabel"
      :items="modalCatKey ? itemsForCategory(modalCatKey) : []"
      :autocomplete-items="modalAutocompleteItems"
      @close="closeModal"
      @add="addItem"
      @remove="removeItem"
    />
  </div>
</template>
