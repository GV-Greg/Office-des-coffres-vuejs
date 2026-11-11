<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { push } from 'notivue'
import { apiMessage } from '@/stores/mandateStore'
import { useAuthStore } from '@/stores/authStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import useDialogFocus from '@/use/useDialogFocus'
import ModalCloseButton from '@/components/buttons/ModalCloseButton.vue'

/*
  Copie des réglages d'inventaire PERSONNELS du personnage actif vers un autre personnage du même compte (Greg, 11/11/2026).
  Seuls les réglages sont copiés, jamais le texte de l'inventaire. Si la cible en a déjà, le serveur le dit (409) : la modale
  demande alors confirmation avant de remplacer — le site ne décide de rien.
*/
const props = defineProps({ show: { type: Boolean, required: true } })
const emit = defineEmits(['close'])

const { t, locale } = useI18n()
const authStore = useAuthStore()
const store = useInventoryStore()

const panel = ref(null)
const close = () => emit('close')
useDialogFocus(computed(() => props.show), panel, close)

const others = computed(() => authStore.getCharacters.filter(c => c.id !== store.characterId))
const target = ref('')
const busy = ref(false)
const pendingConfirm = ref(null) // message du serveur : la cible a déjà des réglages

watch(() => props.show, open => {
  if (!open) return
  target.value = ''
  busy.value = false
  pendingConfirm.value = null
})

async function copy(confirm = false) {
  const character = others.value.find(c => String(c.id) === String(target.value))
  if (!character) return
  busy.value = true
  try {
    await store.copyPersonalTo(character.id, confirm)
    push.success(t('MonBureau.CopyDone', { name: character.pseudo }))
    close()
  } catch (error) {
    if (error?.response?.status === 409 && error.response.data?.code === 'copy_needs_confirmation') {
      pendingConfirm.value = apiMessage(error, locale.value, t('MonBureau.CopyError'))
    } else {
      push.error(apiMessage(error, locale.value, t('MonBureau.CopyError')))
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="copy-settings-title"
      data-testid="cats-copy"
    >
      <div class="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" @click="close"></div>

      <div ref="panel" class="relative w-full max-w-md flex flex-col bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        <div class="h-1.5 bg-gradient-to-r from-violet-400 to-violet-700 shrink-0"></div>

        <form class="p-6 space-y-4" @submit.prevent="copy(false)">
          <div class="flex items-start justify-between gap-4">
            <h3 id="copy-settings-title" class="text-lg font-bold text-slate-800 dark:text-slate-100">{{ t('MonBureau.CopyTitle') }}</h3>
            <ModalCloseButton @click="close" />
          </div>

          <p class="text-sm text-slate-700 dark:text-slate-300">{{ t('MonBureau.CopyHint') }}</p>

          <div>
            <label for="copy-settings-target" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">{{ t('MonBureau.CopyTarget') }}</label>
            <select
              id="copy-settings-target"
              v-model="target"
              class="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 px-2 py-1.5 text-sm"
              data-testid="cats-copy-target"
              @change="pendingConfirm = null"
            >
              <option value="" disabled>{{ t('MonBureau.CopyChoose') }}</option>
              <option v-for="c in others" :key="c.id" :value="c.id">{{ c.pseudo }}</option>
            </select>
          </div>

          <p v-if="pendingConfirm" role="alert" class="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm font-semibold text-yellow-900" data-testid="cats-copy-confirm">
            {{ pendingConfirm }}
          </p>

          <div class="flex flex-wrap items-center justify-end gap-3">
            <template v-if="pendingConfirm">
              <button type="button" class="odc-btn odc-btn--soft odc--red" :disabled="busy" data-testid="cats-copy-cancel" @click="pendingConfirm = null">{{ t('MonBureau.CopyCancel') }}</button>
              <button type="button" class="odc-btn odc-btn--soft odc--orange" :disabled="busy" data-testid="cats-copy-replace" @click="copy(true)">{{ t('MonBureau.CopyConfirm') }}</button>
            </template>
            <button v-else type="submit" class="odc-btn odc-btn--soft odc--green" :disabled="!target || busy" data-testid="cats-copy-button">
              <v-icon name="fa-copy" aria-hidden="true" />{{ t('MonBureau.CopyButton') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
