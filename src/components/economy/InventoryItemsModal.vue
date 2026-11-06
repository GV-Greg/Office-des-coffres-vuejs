<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import useDialogFocus from '@/use/useDialogFocus'

const props = defineProps({
  show: Boolean,
  catLabel: { type: String, required: true },
  items: { type: Array, default: () => [] },
  autocompleteItems: { type: Array, default: () => [] },
  catKey: { type: String, required: true },
})

const emit = defineEmits(['close', 'add', 'remove'])

const { t } = useI18n()

const panelRef = ref(null)
const isOpen = computed(() => props.show)
useDialogFocus(isOpen, panelRef, () => emit('close'))

const newItemName = ref('')
const addItemError = ref('')

function tryAdd() {
  const name = newItemName.value.trim()
  if (!name) return
  emit('add', name)
  newItemName.value = ''
  addItemError.value = ''
}

function handleAddError(msg) {
  addItemError.value = msg
}

defineExpose({ handleAddError })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      @click.self="emit('close')"
    >
      <div
        ref="panelRef"
        role="dialog"
        aria-modal="true"
        :aria-label="t('EconomyInventory.ExpandItemsFor', { cat: catLabel })"
        class="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm flex flex-col max-h-[80vh]"
      >
        <!-- En-tête -->
        <div class="flex items-center justify-between gap-2 px-4 pt-4 pb-3 border-b border-slate-200 dark:border-slate-700">
          <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <v-icon name="fa-tag" scale="0.85" class="text-violet-500" aria-hidden="true" />
            {{ catLabel }}
          </h3>
          <button
            type="button"
            class="odc-btn odc-btn--soft odc-btn--rect odc-btn--icon odc-btn--sm odc--slate shrink-0"
            :aria-label="t('EconomyInventory.CloseModal')"
            @click="emit('close')"
          >
            <v-icon name="fa-times" aria-hidden="true" />
          </button>
        </div>

        <!-- Corps -->
        <div class="flex-1 overflow-y-auto px-4 py-3">
          <p class="text-xs font-medium text-violet-700 dark:text-violet-300 mb-2">
            {{ t('EconomyInventory.ItemsInCategory') }}
          </p>

          <ul v-if="items.length > 0" class="mb-3 space-y-1">
            <li
              v-for="item in items"
              :key="item"
              class="flex items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-200 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <span class="flex-1 truncate">{{ item }}</span>
              <button
                type="button"
                class="shrink-0 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors"
                :aria-label="t('EconomyInventory.RemoveItem', { item })"
                @click="emit('remove', item)"
              >
                <v-icon name="fa-times" scale="0.8" aria-hidden="true" />
              </button>
            </li>
          </ul>
          <p v-else class="text-sm text-slate-400 dark:text-slate-500 italic mb-3">
            {{ t('EconomyInventory.NoItemsYet') }}
          </p>

          <!-- Ajout -->
          <div class="flex gap-2 items-center">
            <input
              v-model="newItemName"
              type="text"
              :list="`items-modal-autocomplete-${catKey}`"
              :placeholder="t('EconomyInventory.AddItemPlaceholder')"
              class="flex-1 min-w-0 text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-400"
              @keydown.enter="tryAdd"
            />
            <datalist :id="`items-modal-autocomplete-${catKey}`">
              <option v-for="opt in autocompleteItems" :key="opt" :value="opt" />
            </datalist>
            <button
              type="button"
              class="odc-btn odc-btn--soft odc--violet odc-btn--sm shrink-0"
              @click="tryAdd"
            >
              <v-icon name="fa-plus" aria-hidden="true" />
              {{ t('EconomyInventory.AddItemBtn') }}
            </button>
          </div>
          <p v-if="addItemError" class="mt-1.5 text-xs text-red-500 dark:text-red-400">{{ addItemError }}</p>
        </div>

        <!-- Pied -->
        <div class="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button
            type="button"
            class="odc-btn odc-btn--soft odc--slate odc-btn--sm"
            @click="emit('close')"
          >
            {{ t('EconomyInventory.CloseModal') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
