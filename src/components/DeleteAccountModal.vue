<script setup>
  import { ref, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'

  // Modale de suppression de compte, en deux étapes délibérément séparées (art. 17 RGPD, spec
  // admin/content/feature-account-deletion.md) : l'étape 1 dit ce qui va disparaître, l'étape 2
  // redemande le mot de passe. Le jeton seul ne suffit pas pour une action irréversible — une
  // session laissée ouverte sur un poste partagé ne doit pas pouvoir effacer le compte.
  const props = defineProps({
    show: { type: Boolean, required: true },
    // Pseudos des personnages du compte : les nommer rend concret ce qui va être perdu.
    characterNames: { type: Array, default: () => [] },
  })
  const emit = defineEmits(['close', 'confirm'])

  const { t } = useI18n()

  const step = ref(1)
  const password = ref('')
  const errorMessage = ref('')
  const isSubmitting = ref(false)

  const canConfirm = computed(() => password.value.length > 0 && !isSubmitting.value)

  // Rouvrir la modale ne doit jamais rouvrir l'étape 2 ni réafficher un mot de passe saisi.
  watch(() => props.show, (isOpen) => {
    if (isOpen) {
      step.value = 1
      password.value = ''
      errorMessage.value = ''
      isSubmitting.value = false
    }
  })

  const close = () => emit('close')

  const submit = () => {
    if (!canConfirm.value) return

    isSubmitting.value = true
    errorMessage.value = ''

    // L'appel API vit dans le parent (ProfilView) : la modale ne connaît ni le store ni la
    // redirection, elle ne fait que rendre le verdict.
    emit('confirm', password.value, {
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
    :aria-label="t('Profil.DeleteAccount.Step1Title')"
  >
    <div class="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" @click="close"></div>

    <div class="relative w-full max-w-lg max-h-[85vh] flex flex-col bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
      <!-- Liseré rouge au lieu du dégradé de marque : cette modale n'est pas une action ordinaire. -->
      <div class="h-1.5 bg-gradient-to-r from-red-400 to-red-600 shrink-0"></div>

      <div class="p-6 overflow-y-auto">
        <!-- Étape 1 — ce qui va disparaître -->
        <template v-if="step === 1">
          <h3 class="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">
            <v-icon name="fa-times" scale="1.1" class="text-red-500 shrink-0" />
            {{ t('Profil.DeleteAccount.Step1Title') }}
          </h3>

          <p class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
            {{ t('Profil.DeleteAccount.Step1Text') }}
          </p>

          <ul class="text-sm text-slate-700 dark:text-slate-300 list-disc list-inside space-y-1 mb-5">
            <li>{{ t('Profil.DeleteAccount.Step1ItemEmail') }}</li>
            <li v-if="characterNames.length">
              {{ t('Profil.DeleteAccount.Step1ItemCharacters', { names: characterNames.join(', ') }) }}
            </li>
            <li>{{ t('Profil.DeleteAccount.Step1ItemPreferences') }}</li>
          </ul>

          <div class="flex flex-wrap items-center justify-end gap-3">
            <button type="button" class="btn btn-grad-slate" @click="close">
              {{ t('Profil.DeleteAccount.Step1Cancel') }}
            </button>
            <button
              type="button"
              class="btn btn-grad-red"
              data-testid="delete-account-continue"
              @click="step = 2"
            >
              {{ t('Profil.DeleteAccount.Step1Continue') }}
            </button>
          </div>
        </template>

        <!-- Étape 2 — preuve que c'est bien le titulaire -->
        <template v-else>
          <h3 class="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">
            <v-icon name="ri-lock-password-fill" scale="1.1" class="text-red-500 shrink-0" />
            {{ t('Profil.DeleteAccount.Step2Title') }}
          </h3>

          <p class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
            {{ t('Profil.DeleteAccount.Step2Text') }}
          </p>

          <form @submit.prevent="submit">
            <label for="delete-account-password" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {{ t('Profil.DeleteAccount.Step2PasswordLabel') }}
            </label>
            <input
              id="delete-account-password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              data-testid="delete-account-password"
              class="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2"
            />

            <p v-if="errorMessage" data-testid="delete-account-error" class="mt-2 text-sm font-semibold text-red-600">
              {{ errorMessage }}
            </p>

            <div class="mt-5 flex flex-wrap items-center justify-end gap-3">
              <button type="button" class="btn btn-grad-slate" @click="close">
                {{ t('Profil.DeleteAccount.Step1Cancel') }}
              </button>
              <button
                type="submit"
                class="btn btn-grad-red"
                data-testid="delete-account-confirm"
                :disabled="!canConfirm"
              >
                {{ t('Profil.DeleteAccount.Step2Confirm') }}
              </button>
            </div>
          </form>
        </template>
      </div>
    </div>
  </div>
</template>
