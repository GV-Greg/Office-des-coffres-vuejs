<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/authStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import InventoryCategoryPanel from '@/components/economy/InventoryCategoryPanel.vue'
import CopySettingsModal from '@/components/economy/CopySettingsModal.vue'

/*
  « Catégories d'inventaire » de Mon bureau : UN accordéon par inventaire géré — le sien (personnage), celui de la ville dont on est
  le maire, celui de la province dont on est commissaire au commerce (le dirigeant la consulte en lecture seule). Ce que le personnage
  peut ouvrir, le serveur le dit (`scopes`) : le site ne recalcule aucun droit. Sans compte, seul « Personnel » existe, dans le
  navigateur. Avec un compte, tout est enregistré sur le serveur, par personnage.
*/
const { t } = useI18n()
const authStore = useAuthStore()
const store = useInventoryStore()

const levels = computed(() => store.availableLevels)

async function loadAll() {
  if (!store.serverMode) return
  await store.loadScopes()
  await Promise.all(store.availableLevels.map(level => store.load(level)))
}
onMounted(loadAll)
watch(() => store.characterId, loadAll)
// Les niveaux arrivent avec `scopes` : on charge ceux qui viennent d'apparaître.
watch(levels, list => { if (store.serverMode) list.forEach(level => store.load(level)) })

const titleOf = level => {
  if (level === 'city') return t('MonBureau.CatCityPanel', { city: store.scopes?.city?.name ?? '' })
  if (level === 'province') return t('MonBureau.CatProvincePanel', { province: store.scopes?.province?.name ?? '' })
  return t('MonBureau.CatPersoPanel')
}
const idOf = level => (level === 'personal' ? 'panel-cats-perso' : `panel-cats-${level}`)

const docOf = level => store.doc(level)
const catConfigOf = level => {
  const doc = docOf(level)
  return { custom: doc.custom, hiddenBuiltIn: doc.hiddenBuiltIn, order: doc.order, exportColor: doc.exportColor }
}

// ─── Copier les réglages personnels vers un autre personnage du compte (modale) ───
const others = computed(() => authStore.getCharacters.filter(c => c.id !== store.characterId))
const showCopy = ref(false)
const canCopy = level => level === 'personal' && store.serverMode && others.value.length > 0
</script>

<template>
  <div class="flex flex-col" data-testid="cats-levels">
    <details
      v-for="level in levels"
      :key="level"
      :open="level === 'personal'"
      class="group"
      :data-testid="`cats-accordion-${level}`"
    >
      <summary class="flex cursor-pointer list-none items-center gap-2 px-4 py-2 bg-yellow-800 border-b border-yellow-900 [&::-webkit-details-marker]:hidden">
        <v-icon name="fa-tag" class="text-yellow-200 shrink-0" aria-hidden="true" />
        <h2 :id="idOf(level)" class="flex-1 !mt-0 !mb-0 text-base font-bold text-white dark:text-white leading-tight">
          {{ titleOf(level) }}
        </h2>
        <v-icon name="fa-chevron-down" class="text-yellow-200 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div class="p-3">
        <p v-if="store.serverMode && store.status(level) === 'loading'" class="text-sm text-slate-600 dark:text-slate-600" data-testid="cats-loading">
          {{ t('MonBureau.LoadingSettings') }}
        </p>
        <div v-else-if="store.serverMode && store.status(level) === 'error'" class="text-sm text-slate-700 dark:text-slate-700" data-testid="cats-error">
          <p>{{ t('MonBureau.SettingsLoadError') }}</p>
          <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--violet mt-2" @click="store.load(level, true)">{{ t('Common.Retry') }}</button>
        </div>
        <template v-else>
          <p v-if="!store.canWrite(level)" role="note" class="text-xs italic text-slate-600 dark:text-slate-600 mb-2" data-testid="cats-readonly">
            {{ t('EconomyInventory.ReadOnlyScope') }}
          </p>
          <InventoryCategoryPanel
            :cat-config="catConfigOf(level)"
            :item-categories="docOf(level).itemCategories"
            :readonly="!store.canWrite(level)"
            @update:catConfig="config => store.update(level, config)"
            @update:itemCategories="map => store.update(level, { itemCategories: map })"
          >
            <!-- Copie vers un autre personnage du compte : le niveau personnel seulement, à droite des couleurs. -->
            <template v-if="canCopy(level)" #actions>
              <button type="button" class="odc-btn odc-btn--soft odc--green odc-btn--sm" data-testid="cats-copy-open" @click="showCopy = true">
                <v-icon name="fa-copy" aria-hidden="true" />{{ t('MonBureau.CopyOpen') }}
              </button>
            </template>
          </InventoryCategoryPanel>
        </template>
      </div>
    </details>
    <CopySettingsModal :show="showCopy" @close="showCopy = false" />
  </div>
</template>
