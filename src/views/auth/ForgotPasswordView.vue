<script setup>
/*
  « Mot de passe oublié » — demande du lien (fil admin/echanges/mot-de-passe-oublie, 24/11/2026). Le serveur répond TOUJOURS pareil, que l'adresse ait un
  compte ou non : la page dit donc la même chose dans les deux cas (« si un compte existe… »), jamais « aucun compte ». Rien n'est gardé dans le navigateur.
*/
  import { reactive, ref } from 'vue'
  import { RouterLink } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import InputEmail from '@/components/forms/InputEmail.vue'
  import SelectorMenu from '@/components/SelectorMenu.vue'
  import logoHorizontal from '@/assets/logo/logo-horizontal.svg'
  import validation from '@/directives/validation'
  import useNavigationLoading from '@/use/useNavigationLoading'
  import { useAuthStore } from '@/stores/authStore'
  import { push } from 'notivue'

  const { t } = useI18n()
  const authStore = useAuthStore()
  const { trackApiCall } = useNavigationLoading()

  const user = reactive({ email: '' })
  const sent = ref(false)
  // Chaque clic de plus pendant l'attente enverrait un email : le limiteur du serveur (3 par minute) le refuserait, autant ne pas l'envoyer.
  const isSubmitting = ref(false)

  const send = () => {
    if (isSubmitting.value) return
    if (validation(!user.email, t('Auth.Errors.RequiredFields'))) {
      // erreur déjà affichée par validation()
    } else if (validation(user.email.length > 190, t('Auth.Errors.EmailTooLong'))) {
      // erreur déjà affichée par validation()
    } else {
      isSubmitting.value = true
      trackApiCall(authStore.forgotPassword(user.email))
        .then(() => {
          sent.value = true
        })
        .catch((error) => {
          push.error(error.response?.status === 429 ? t('PasswordReset.TooMany') : (error.response?.data?.message ?? t('Auth.Errors.NetworkError')))
        })
        .finally(() => {
          isSubmitting.value = false
        })
    }
  }
</script>

<template>
  <div class="page-container relative">
    <div class="absolute top-4 right-4">
      <SelectorMenu />
    </div>

    <!-- Même structure que la connexion : une colonne, une carte claire dans les deux thèmes ; couleurs de texte répétées en `dark:` (règle globale `.dark p`). -->
    <div class="w-full max-w-md mx-auto px-4 pt-20 tablet:pt-8 pb-8 flex flex-col items-center gap-6">
      <h1 class="m-0 flex justify-center">
        <img :src="logoHorizontal" :alt="t('Common.SiteName')" class="h-16 tablet:h-20 w-auto">
      </h1>

      <section class="w-full rounded-2xl border border-slate-300 bg-slate-50 p-6 tablet:p-8 shadow-xl shadow-black/20">
        <template v-if="!sent">
          <h2 class="mt-0 mb-3">{{ t('PasswordReset.ForgotHeading') }}</h2>
          <p class="mb-5 text-sm text-slate-700 dark:text-slate-700">{{ t('PasswordReset.ForgotIntro') }}</p>
          <form data-testid="forgot-form" @submit.prevent="send">
            <div class="form-group">
              <InputEmail v-model="user.email" name="email" :label="t('email')" :placeholder="t('Auth.EmailPlaceholder')" />
            </div>
            <button type="submit" class="mt-2 odc-btn odc-btn--soft odc--blue w-full" :disabled="isSubmitting" data-testid="forgot-submit">
              {{ t('PasswordReset.SendLink') }}
            </button>
          </form>
        </template>
        <div v-else class="py-2 text-center" role="status" data-testid="forgot-sent">
          <h2 class="mt-0 mb-4">{{ t('PasswordReset.SentHeading') }}</h2>
          <p class="text-slate-700 dark:text-slate-700 whitespace-pre-line">{{ t('PasswordReset.SentMessage') }}</p>
        </div>

        <p class="mt-6 text-center text-sm text-slate-700 dark:text-slate-700">
          <RouterLink to="/login" class="font-bold text-blue-700 hover:underline underline-offset-2" data-testid="back-to-login">
            {{ t('PasswordReset.BackToLogin') }}
          </RouterLink>
        </p>
      </section>
    </div>
  </div>
</template>
