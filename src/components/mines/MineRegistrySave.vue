<script setup>
  import { ref, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { push } from 'notivue'
  import { http } from '@/api.js'
  import { useAuthStore } from '@/stores/authStore'
  import { apiMessage } from '@/stores/mandateStore'
  import { parseMinesText, parseMineStates } from '@/modules/mineParser'

  /*
    Registre des mines — enregistrer le collage du Bilan (PR 2 ; brief admin/content/
    brief-registre-mines.md §2, §6 ; fil admin/echanges/registre-mines, R3).
    « Un collage, deux destinations » : le même texte sert le Bilan public et le Registre ; ce bloc
    n'apparaît que pour un personnage que l'Office connaît comme commissaire aux mines ou bailli.

    ⚠️ Aucune règle ici : qui peut écrire, et dans quelle province, vient de l'API
    (GET characters/{id}/mine-registry) ; les refus arrivent en FR et EN (apiMessage). L'écran DIT la
    province avant l'envoi — avec l'ajout seul, une erreur de province se remplace, elle ne s'efface pas.
  */

  const props = defineProps({
    text: { type: String, required: true },
    prices: { type: Object, required: true },
    rate: { type: [Number, String], default: null },
  })

  const { t, locale } = useI18n()
  const authStore = useAuthStore()

  const character = computed(() => (authStore.isLoggedIn ? authStore.activeCharacter : null))
  const access = ref(null)
  const pending = ref(null) // 409 : remplacement à confirmer { message, existing }
  const sending = ref(false)

  const auth = () => ({ headers: { Authorization: `Bearer ${authStore.getToken}` } })

  async function loadAccess() {
    access.value = null
    pending.value = null
    if (!character.value) return
    try {
      const { data } = await http.get(`characters/${character.value.id}/mine-registry`, auth())
      access.value = data
    } catch {
      access.value = null // pas d'accès connu : le bloc reste caché, le Bilan public fonctionne
    }
  }
  watch(() => character.value?.id, loadAccess, { immediate: true })

  const mines = computed(() => parseMinesText(props.text))
  const province = computed(() => access.value?.write?.name ?? null)
  const visible = computed(() => !!province.value && mines.value.length > 0)

  async function save(confirmReplace = false) {
    if (sending.value) return
    sending.value = true
    try {
      const { data } = await http.post(`characters/${character.value.id}/mine-reports`, {
        raw: props.text.trim(),
        report: { mines: mines.value, states: parseMineStates(props.text) },
        prices: { ...props.prices },
        rate: props.rate,
        confirm_replace: confirmReplace,
      }, auth())
      pending.value = null
      const saved = t('EconomyMines.Registry.Saved', { province: data.report.province_name })
      push.success(data.replaced
        ? `${saved} ${t('EconomyMines.Registry.Replaced', { pseudo: data.replaced.pseudo ?? t('EconomyMines.Registry.DeletedCharacter') })}`
        : saved)
    } catch (error) {
      if (error?.response?.status === 409) {
        pending.value = { message: apiMessage(error, locale.value, ''), existing: error.response.data.existing ?? null }
      } else {
        push.error(apiMessage(error, locale.value, t('Auth.Errors.NetworkError')))
      }
    } finally {
      sending.value = false
    }
  }
</script>

<template>
  <!-- Carte claire dans les deux thèmes : couleurs foncées répétées en dark: (règle `.dark p`). -->
  <section v-if="visible" class="mt-4 rounded-xl border border-orange-300 bg-orange-50 p-3 text-slate-800" data-testid="mine-registry">
    <h3 class="font-bold text-slate-800 dark:text-slate-800">{{ t('EconomyMines.Registry.Title') }}</h3>
    <p class="text-sm text-slate-700 dark:text-slate-700" data-testid="mine-registry-province">
      {{ t('EconomyMines.Registry.Province', { province, character: character.pseudo }) }}
    </p>

    <div v-if="pending" role="alert" class="mt-2 space-y-2" data-testid="mine-registry-confirm">
      <p class="text-sm font-bold text-slate-800 dark:text-slate-800">{{ pending.message }}</p>
      <p v-if="pending.existing" class="text-sm text-slate-700 dark:text-slate-700">
        {{ t('EconomyMines.Registry.RecordedBy', {
          pseudo: pending.existing.pseudo ?? t('EconomyMines.Registry.DeletedCharacter'),
          office: pending.existing.office_label?.[locale] ?? '',
        }) }}
      </p>
      <div class="flex gap-2">
        <button type="button" class="odc-btn odc-btn--soft odc--orange odc-btn--sm" :disabled="sending" @click="save(true)">
          {{ t('EconomyMines.Registry.Confirm') }}
        </button>
        <button type="button" class="odc-btn odc-btn--quiet odc--slate odc-btn--sm" @click="pending = null">
          {{ t('EconomyMines.Registry.Cancel') }}
        </button>
      </div>
    </div>
    <button v-else type="button" class="mt-2 odc-btn odc-btn--soft odc--orange odc-btn--sm" :disabled="sending" @click="save(false)">
      {{ t('EconomyMines.Registry.Save', { province }) }}
    </button>
  </section>
</template>
