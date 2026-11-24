<script setup>
  import { ref, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { push } from 'notivue'
  import { apiMessage } from '@/stores/mandateStore'
  import { formatFieldDate } from '@/modules/playerDates'
  import customsApi from '@/use/customsApi'
  import useDialogFocus from '@/use/useDialogFocus'
  import ModalCloseButton from '@/components/buttons/ModalCloseButton.vue'
  import CustomsPseudo from '@/components/customs/CustomsPseudo.vue'

  /*
    Les listes rouge et verte d'une province (Registre de douane). Pseudo en TEXTE LIBRE (le personnage peut n'avoir aucun compte), raison
    facultative. La couleur d'un bilan court de la date d'ajout, tant que l'entrée est en liste ; un retrait SUPPRIME la ligne (choix de Greg,
    22/11/2026). ⚠️ Aucune règle ici : qui lit, ajoute, modifie ou retire vient de `customs-access` et de chaque entrée (`can_edit`, `can_remove`) ;
    « ajouté par » n'est servi qu'au trio. Un refus s'affiche tel quel, en FR ou EN.
  */
  const props = defineProps({
    show: { type: Boolean, required: true },
    characterId: { type: Number, required: true },
    access: { type: Object, required: true },
  })
  const emit = defineEmits(['close', 'changed'])

  const { t, locale } = useI18n()
  const api = customsApi()

  const panel = ref(null)
  const close = () => emit('close')
  useDialogFocus(computed(() => props.show), panel, close)

  const entries = ref([])
  const loading = ref(false)
  const form = ref({ pseudo: '', colour: 'red', reason: '' })
  const editing = ref(null) // { id, colour, reason }
  const busy = ref(false)
  const error = ref('')

  // Le juge n'ajoute qu'à la liste rouge ; qui écrit les listes ajoute des deux couleurs. Le serveur tranche, l'écran ne propose que ce qui passera.
  const canAdd = computed(() => props.access.write_lists || props.access.add_red_only)
  const colours = computed(() => (props.access.write_lists ? ['red', 'green'] : ['red']))
  const addedOn = iso => formatFieldDate('customs_list_added_on', iso, locale.value)

  async function load() {
    loading.value = true
    error.value = ''
    try {
      entries.value = await api.lists(props.characterId)
    } catch (e) {
      error.value = apiMessage(e, locale.value, t('Auth.Errors.NetworkError'))
    } finally {
      loading.value = false
    }
  }

  async function run(action, success) {
    busy.value = true
    error.value = ''
    try {
      await action()
      push.success(success)
      editing.value = null
      await load()
      emit('changed')
    } catch (e) {
      error.value = apiMessage(e, locale.value, t('Auth.Errors.NetworkError'))
    } finally {
      busy.value = false
    }
  }

  const add = () => run(async () => {
    await api.addEntry(props.characterId, { pseudo: form.value.pseudo.trim(), colour: form.value.colour, reason: form.value.reason.trim() || null })
    form.value = { pseudo: '', colour: colours.value[0], reason: '' }
  }, t('SecurityCustoms.Lists.Added'))

  const startEdit = entry => { editing.value = { id: entry.id, colour: entry.colour, reason: entry.reason ?? '' } }
  const saveEdit = () => run(() => api.updateEntry(props.characterId, editing.value.id, { colour: editing.value.colour, reason: editing.value.reason.trim() || null }), t('SecurityCustoms.Lists.Saved'))
  const remove = entry => run(() => api.removeEntry(props.characterId, entry.id), t('SecurityCustoms.Lists.Removed'))

  watch(() => props.show, (open) => {
    if (!open) return
    form.value = { pseudo: '', colour: colours.value[0], reason: '' }
    editing.value = null
    load()
  })
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="lists-modal">
    <div class="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" @click="close"></div>
    <div ref="panel" role="dialog" aria-modal="true" :aria-label="t('SecurityCustoms.Lists.Title', { province: access.province.name })"
         class="relative w-full max-w-2xl laptop:max-w-3xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
      <div class="h-1.5 bg-gradient-to-r from-orange-400 to-red-600 shrink-0"></div>
      <div class="p-6 overflow-y-auto space-y-4">
        <div class="flex items-start justify-between gap-4">
          <h3 class="!mb-0 flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100">
            <v-icon name="gi-scroll-unfurled" scale="1.2" class="text-orange-500 shrink-0" aria-hidden="true" />
            {{ t('SecurityCustoms.Lists.Title', { province: access.province.name }) }}
          </h3>
          <ModalCloseButton @click="close" />
        </div>

        <p class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{{ t('SecurityCustoms.Lists.Intro') }}</p>
        <p v-if="!access.write_lists" class="text-sm font-bold text-slate-800 dark:text-slate-100" data-testid="lists-readonly">
          {{ t(access.add_red_only ? 'SecurityCustoms.Lists.JudgeOnly' : 'SecurityCustoms.Lists.ReadOnly') }}
        </p>
        <p v-if="error" role="alert" class="font-bold text-red-700 dark:text-red-300" data-testid="lists-error">{{ error }}</p>

        <form v-if="canAdd" class="grid gap-2 rounded-lg border border-slate-300 dark:border-slate-600 p-3 tablet:grid-cols-[1fr_auto_2fr_auto] items-end text-slate-800 dark:text-slate-100" data-testid="lists-add" @submit.prevent="add">
          <label class="text-sm"><span class="block font-bold">{{ t('SecurityCustoms.Lists.Pseudo') }}</span>
            <input v-model="form.pseudo" type="text" required maxlength="40" pattern="\S{1,40}" autocomplete="off" class="w-full rounded p-1" data-testid="lists-pseudo">
          </label>
          <label class="text-sm"><span class="block font-bold">{{ t('SecurityCustoms.Lists.Colour') }}</span>
            <select v-model="form.colour" class="rounded p-1" data-testid="lists-colour">
              <option v-for="c in colours" :key="c" :value="c">{{ t(`SecurityCustoms.List.${c === 'red' ? 'Red' : 'Green'}`) }}</option>
            </select>
          </label>
          <label class="text-sm"><span class="block font-bold">{{ t('SecurityCustoms.Lists.Reason') }}</span>
            <input v-model="form.reason" type="text" maxlength="300" class="w-full rounded p-1" data-testid="lists-reason">
          </label>
          <button type="submit" class="odc-btn odc-btn--soft odc--green odc-btn--sm" :disabled="busy" data-testid="lists-add-button">
            <v-icon name="fa-plus" aria-hidden="true" />{{ t('SecurityCustoms.Lists.Add') }}
          </button>
        </form>

        <p v-if="loading" class="text-sm text-slate-700 dark:text-slate-300">{{ t('SecurityCustoms.Loading') }}</p>
        <p v-else-if="!entries.length" class="text-sm text-slate-700 dark:text-slate-300" data-testid="lists-empty">{{ t('SecurityCustoms.Lists.Empty') }}</p>
        <ul v-else class="space-y-2" data-testid="lists-entries">
          <li v-for="entry in entries" :key="entry.id" class="rounded-lg border border-slate-200 dark:border-slate-600 p-2" :data-entry="entry.id">
            <div class="flex flex-wrap items-center gap-2">
              <CustomsPseudo :pseudo="entry.pseudo" :colour="entry.colour" />
              <span class="text-xs text-slate-600 dark:text-slate-400">{{ t('SecurityCustoms.Lists.Since', { date: addedOn(entry.added_on) }) }}</span>
              <span v-if="entry.added_by" class="text-xs text-slate-600 dark:text-slate-400" data-testid="added-by">{{ t('SecurityCustoms.Lists.AddedBy', { pseudo: entry.added_by }) }}</span>
              <span v-else-if="entry.by_me" class="text-xs text-slate-600 dark:text-slate-400">{{ t('SecurityCustoms.Lists.ByMe') }}</span>
              <span class="ml-auto flex gap-1">
                <button v-if="entry.can_edit && editing?.id !== entry.id" type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--slate" :disabled="busy" @click="startEdit(entry)">
                  <v-icon name="fa-edit" aria-hidden="true" />{{ t('SecurityCustoms.Lists.Edit') }}
                </button>
                <button v-if="entry.can_remove" type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--red" :disabled="busy" data-testid="lists-remove" @click="remove(entry)">
                  <v-icon name="fa-trash" aria-hidden="true" />{{ t('SecurityCustoms.Lists.Remove') }}
                </button>
              </span>
            </div>
            <p v-if="entry.reason && editing?.id !== entry.id" class="text-sm mt-1 text-slate-800 dark:text-slate-100">{{ entry.reason }}</p>
            <form v-if="editing?.id === entry.id" class="mt-2 flex flex-wrap items-end gap-2" @submit.prevent="saveEdit">
              <select v-model="editing.colour" class="rounded p-1"><option value="red">{{ t('SecurityCustoms.List.Red') }}</option><option value="green">{{ t('SecurityCustoms.List.Green') }}</option></select>
              <input v-model="editing.reason" type="text" maxlength="300" class="flex-1 rounded p-1" :aria-label="t('SecurityCustoms.Lists.Reason')">
              <button type="submit" class="odc-btn odc-btn--soft odc-btn--sm odc--green" :disabled="busy">{{ t('SecurityCustoms.Lists.Save') }}</button>
              <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--red" @click="editing = null">{{ t('SecurityCustoms.Lists.Cancel') }}</button>
            </form>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
