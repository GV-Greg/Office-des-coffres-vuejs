<script setup>
  import ModalCloseButton from '@/components/buttons/ModalCloseButton.vue'
  import { ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'

  const props = defineProps({
    show: { type: Boolean, required: true },
    currentEmail: { type: String, default: '' },
  })
  const emit = defineEmits(['close', 'confirm'])

  const { t } = useI18n()

  const currentPassword = ref('')
  const newEmail = ref('')
  const errorMessage = ref('')
  const isSubmitting = ref(false)
  const sent = ref(false)
  const showCurrentPassword = ref(false)

  watch(() => props.show, (isOpen) => {
    if (isOpen) {
      currentPassword.value = ''
      newEmail.value = ''
      errorMessage.value = ''
      isSubmitting.value = false
      sent.value = false
      showCurrentPassword.value = false
    }
  })

  const close = () => emit('close')

  const submit = () => {
    if (isSubmitting.value) return
    isSubmitting.value = true
    errorMessage.value = ''

    emit('confirm', { currentPassword: currentPassword.value, newEmail: newEmail.value }, {
      onSuccess: () => {
        sent.value = true
        isSubmitting.value = false
      },
      onError: (message) => {
        errorMessage.value = message
        isSubmitting.value = false
      },
    })
  }
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    :aria-label="t('Profil.Account.EmailModal.Title')"
  >
    <div class="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" @click="close"></div>

    <div class="relative w-full max-w-lg max-h-[85vh] flex flex-col bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
      <div class="h-1.5 bg-gradient-to-r from-orange-400 to-red-600 shrink-0"></div>

      <div class="p-6 overflow-y-auto">
        <template v-if="!sent">
          <div class="flex items-start justify-between gap-4 mb-5">
            <h3 class="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100">
              <v-icon name="ri-mail-settings-line" scale="1.1" class="text-orange-500 shrink-0" />
              {{ t('Profil.Account.EmailModal.Title') }}
            </h3>
            <ModalCloseButton @click="close" />
          </div>

          <!-- Email actuel en lecture seule : contexte avant modification. -->
          <div v-if="currentEmail" class="mb-4 flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2">
            <v-icon name="ri-mail-line" class="w-4 h-4 shrink-0 text-slate-400" />
            <div class="min-w-0">
              <p class="text-xs text-slate-500 dark:text-slate-500 leading-none mb-0.5">{{ t('Profil.Account.Email') }}</p>
              <p class="text-sm font-medium text-slate-700 dark:text-slate-100 break-all leading-snug">{{ currentEmail }}</p>
            </div>
          </div>

          <form @submit.prevent="submit">
            <div class="mb-4">
              <label for="change-email-current-password" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {{ t('Profil.Account.EmailModal.CurrentPasswordLabel') }}
              </label>
              <div class="flex gap-2">
                <input
                  id="change-email-current-password"
                  v-model="currentPassword"
                  :type="showCurrentPassword ? 'text' : 'password'"
                  autocomplete="current-password"
                  data-testid="change-email-current-password"
                  class="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2"
                />
                <button
                  type="button"
                  class="odc-btn odc-btn--soft odc-btn--sm odc--slate shrink-0"
                  :aria-pressed="showCurrentPassword"
                  data-testid="change-email-toggle-password"
                  @click="showCurrentPassword = !showCurrentPassword"
                >
                  <v-icon :name="showCurrentPassword ? 'fa-eye-slash' : 'fa-eye'" aria-hidden="true" />
                  {{ showCurrentPassword ? t('Profil.Account.HidePassword') : t('Profil.Account.ShowPassword') }}
                </button>
              </div>
            </div>

            <div class="mb-4">
              <label for="change-email-new" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {{ t('Profil.Account.EmailModal.NewEmailLabel') }}
              </label>
              <input
                id="change-email-new"
                v-model="newEmail"
                type="email"
                autocomplete="email"
                data-testid="change-email-new"
                class="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2"
              />
            </div>

            <p v-if="errorMessage" data-testid="change-email-error" class="mb-3 text-sm font-semibold text-red-600 dark:text-red-400" role="alert">
              {{ errorMessage }}
            </p>

            <div class="flex flex-wrap items-center justify-end gap-3">
              <button
                type="submit"
                class="odc-btn odc-btn--soft odc--orange"
                data-testid="change-email-submit"
                :disabled="isSubmitting"
              >
                {{ t('Profil.Account.EmailModal.Submit') }}
              </button>
            </div>
          </form>
        </template>

        <template v-else>
          <div class="flex items-start justify-between gap-4 mb-5">
            <h3 class="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100">
              <v-icon name="fa-check-circle" scale="1.1" class="text-green-500 shrink-0" />
              {{ t('Profil.Account.EmailModal.Success') }}
            </h3>
            <ModalCloseButton @click="close" />
          </div>

          <!-- Rappel de la destination : l'utilisateur sait exactement où chercher le lien. -->
          <div v-if="newEmail" class="mb-4 flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-3 py-2">
            <v-icon name="ri-mail-send-line" class="w-4 h-4 shrink-0 text-green-600 dark:text-green-400" />
            <p class="text-sm font-medium text-green-800 dark:text-green-300 break-all">{{ newEmail }}</p>
          </div>

          <p class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
            {{ t('Profil.Account.EmailModal.SuccessText') }}
          </p>
          <p class="text-xs text-slate-500 dark:text-slate-500 italic mb-5">
            {{ t('Profil.Account.EmailModal.SuccessNote') }}
          </p>

          <div class="flex justify-end">
            <button type="button" class="odc-btn odc-btn--soft odc--slate" @click="close">
              {{ t('Profil.Account.EmailModal.Close') }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
