<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { push } from 'notivue'
import { apiMessage } from '@/stores/mandateStore'
import { useAuthStore } from '@/stores/authStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import InventoryCategoryPanel from '@/components/economy/InventoryCategoryPanel.vue'

/*
  « Catégories d'inventaire » de Mon bureau : UN accordéon par inventaire géré — le sien (personnage), celui de la ville dont on est
  le maire, celui de la province dont on est commissaire au commerce (le dirigeant la consulte en lecture seule). Ce que le personnage
  peut ouvrir, le serveur le dit (`scopes`) : le site ne recalcule aucun droit. Sans compte, seul « Personnel » existe, dans le
  navigateur. Avec un compte, tout est enregistré sur le serveur, par personnage.
*/
const { t, locale } = useI18n()
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

// ─── Copier les réglages personnels vers un autre personnage du compte ───────
const others = computed(() => authStore.getCharacters.filter(c => c.id !== store.characterId))
const copyTarget = ref('')
const copyBusy = ref(false)
const pendingConfirm = ref(null) // { id, name, message } : la cible a déjà des réglages, le serveur demande confirmation

async function copy(confirm = false) {
  const target = others.value.find(c => String(c.id) === String(copyTarget.value))
  if (!target) return
  copyBusy.value = true
  try {
    await store.copyPersonalTo(target.id, confirm)
    pendingConfirm.value = null
    push.success(t('MonBureau.CopyDone', { name: target.pseudo }))
  } catch (error) {
    if (error?.response?.status === 409 && error.response.data?.code === 'copy_needs_confirmation') {
      pendingConfirm.value = { id: target.id, name: target.pseudo, message: apiMessage(error, locale.value, '') }
    } else {
      push.error(apiMessage(error, locale.value, t('MonBureau.CopyError')))
    }
  } finally {
    copyBusy.value = false
  }
}
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
          />

          <!-- Copie vers un autre personnage du compte : le niveau personnel seulement. -->
          <div v-if="level === 'personal' && store.serverMode && others.length" class="mt-4 pt-3 border-t border-slate-200 dark:border-slate-600" data-testid="cats-copy">
            <p class="text-xs font-semibold text-yellow-700 dark:text-yellow-700 mb-1">{{ t('MonBureau.CopyTitle') }}</p>
            <p class="text-xs italic text-slate-500 dark:text-slate-500 mb-2">{{ t('MonBureau.CopyHint') }}</p>
            <div class="flex flex-wrap items-center gap-2">
              <select
                v-model="copyTarget"
                :aria-label="t('MonBureau.CopyTarget')"
                class="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700 dark:text-slate-100"
                data-testid="cats-copy-target"
                @change="pendingConfirm = null"
              >
                <option value="">{{ t('MonBureau.CopyChoose') }}</option>
                <option v-for="c in others" :key="c.id" :value="c.id">{{ c.pseudo }}</option>
              </select>
              <button
                type="button"
                class="odc-btn odc-btn--soft odc--green odc-btn--sm"
                :disabled="!copyTarget || copyBusy"
                data-testid="cats-copy-button"
                @click="copy(false)"
              >
                <v-icon name="fa-copy" aria-hidden="true" />{{ t('MonBureau.CopyButton') }}
              </button>
            </div>
            <div v-if="pendingConfirm" role="alert" class="mt-2 text-sm text-slate-800 dark:text-slate-800" data-testid="cats-copy-confirm">
              <p>{{ pendingConfirm.message }}</p>
              <div class="mt-2 flex gap-2">
                <button type="button" class="odc-btn odc-btn--soft odc--red odc-btn--sm" :disabled="copyBusy" data-testid="cats-copy-replace" @click="copy(true)">{{ t('MonBureau.CopyConfirm') }}</button>
                <button type="button" class="odc-btn odc-btn--soft odc--slate odc-btn--sm" @click="pendingConfirm = null">{{ t('MonBureau.CopyCancel') }}</button>
              </div>
            </div>
          </div>
        </template>
      </div>
    </details>
  </div>
</template>
