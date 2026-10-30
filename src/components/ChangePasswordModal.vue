<script setup>
  import ModalCloseButton from '@/components/buttons/ModalCloseButton.vue'
  import { ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'

  const props = defineProps({
    show: { type: Boolean, required: true },
  })
  const emit = defineEmits(['close', 'confirm'])

  const { t } = useI18n()

  const currentPassword = ref('')
  const newPassword = ref('')
  const passwordConfirmation = ref('')
  const errorMessage = ref('')
  const isSubmitting = ref(false)
  // Toggles indépendants : l'actuel se cache séparément du nouveau (confidentialité croisée).
  const showCurrentPw = ref(false)
  const showNewPw = ref(false)

  watch(() => props.show, (isOpen) => {
    if (isOpen) {
      currentPassword.value = ''
      newPassword.value = ''
      passwordConfirmation.value = ''
      errorMessage.value = ''
      isSubmitting.value = false
      showCurrentPw.value = false
      showNewPw.value = false
    }
  })

  const close = () => emit('close')

  const submit = () => {
    if (isSubmitting.value) return
    isSubmitting.value = true
    errorMessage.value = ''

    emit('confirm', {
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
      passwordConfirmation: passwordConfirmation.value,
    }, {
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
    :aria-label="t('Profil.Account.PasswordModal.Title')"
  >
    <div class="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" @click="close"></div>

    <div class="relative w-full max-w-lg max-h-[85vh] flex flex-col bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
      <div class="h-1.5 bg-gradient-to-r from-blue-400 to-violet-500 shrink-0"></div>

      <div class="p-6 overflow-y-auto">
        <div class="flex items-start justify-between gap-4 mb-5">
          <h3 class="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100">
            <v-icon name="ri-lock-password-fill" scale="1.1" class="text-blue-500 shrink-0" />
            {{ t('Profil.Account.PasswordModal.Title') }}
          </h3>
          <ModalCloseButton @click="close" />
        </div>

        <form @submit.prevent="submit">
          <!-- Mot de passe actuel : toggle isolé — l'utilisateur peut le révéler sans exposer le nouveau. -->
          <div class="mb-4">
            <label for="change-password-current" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {{ t('Profil.Account.PasswordModal.CurrentPasswordLabel') }}
            </label>
            <div class="flex gap-2">
              <input
                id="change-password-current"
                v-model="currentPassword"
                :type="showCurrentPw ? 'text' : 'password'"
                autocomplete="current-password"
                data-testid="change-password-current"
                class="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2"
              />
              <button
                type="button"
                class="odc-btn odc-btn--soft odc-btn--sm odc--slate shrink-0"
                :aria-pressed="showCurrentPw"
                data-testid="toggle-current-pw"
                @click="showCurrentPw = !showCurrentPw"
              >
                <v-icon :name="showCurrentPw ? 'fa-eye-slash' : 'fa-eye'" aria-hidden="true" />
                {{ showCurrentPw ? t('Profil.Account.HidePassword') : t('Profil.Account.ShowPassword') }}
              </button>
            </div>
          </div>

          <!-- Séparateur visuel : "actuel" vs "nouveau" -->
          <div class="mb-4 flex items-center gap-3">
            <div class="flex-1 h-px bg-slate-100 dark:bg-slate-700"></div>
            <span class="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">{{ t('Profil.Account.PasswordModal.NewSection') }}</span>
            <div class="flex-1 h-px bg-slate-100 dark:bg-slate-700"></div>
          </div>

          <!-- Nouveau mot de passe : toggle partagé avec la confirmation (ils révèlent ensemble). -->
          <div class="mb-4">
            <label for="change-password-new" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {{ t('Profil.Account.PasswordModal.NewPasswordLabel') }}
            </label>
            <div class="flex gap-2">
              <input
                id="change-password-new"
                v-model="newPassword"
                :type="showNewPw ? 'text' : 'password'"
                autocomplete="new-password"
                data-testid="change-password-new"
                class="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2"
              />
              <button
                type="button"
                class="odc-btn odc-btn--soft odc-btn--sm odc--slate shrink-0"
                :aria-pressed="showNewPw"
                data-testid="toggle-new-pw"
                @click="showNewPw = !showNewPw"
              >
                <v-icon :name="showNewPw ? 'fa-eye-slash' : 'fa-eye'" aria-hidden="true" />
                {{ showNewPw ? t('Profil.Account.HidePassword') : t('Profil.Account.ShowPassword') }}
              </button>
            </div>
          </div>

          <div class="mb-4">
            <label for="change-password-confirm" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {{ t('Profil.Account.PasswordModal.ConfirmPasswordLabel') }}
            </label>
            <!-- Pas de bouton toggle ici : le toggle du "nouveau" suffit, les deux révèlent ensemble. -->
            <input
              id="change-password-confirm"
              v-model="passwordConfirmation"
              :type="showNewPw ? 'text' : 'password'"
              autocomplete="new-password"
              data-testid="change-password-confirm"
              class="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2"
            />
          </div>

          <p v-if="errorMessage" data-testid="change-password-error" class="mb-3 text-sm font-semibold text-red-600 dark:text-red-400" role="alert">
            {{ errorMessage }}
          </p>

          <div class="flex flex-wrap items-center justify-end gap-3">
            <button
              type="submit"
              class="odc-btn odc-btn--soft odc--blue"
              data-testid="change-password-submit"
              :disabled="isSubmitting"
            >
              {{ t('Profil.Account.PasswordModal.Submit') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
