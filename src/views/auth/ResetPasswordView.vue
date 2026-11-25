<script setup>
/*
  « Mot de passe oublié » — choix du nouveau mot de passe. Le lien de l'email arrive ici :
  /reset-password?token=…&email=… (jamais vers l'API ni le domaine d'administration). Le jeton ne sert qu'une fois et 60 minutes : un jeton faux, expiré ou
  déjà utilisé donne UNE seule réponse du serveur (`invalid_token`), dite sans détail, avec le chemin pour redemander un lien. Rien n'est gardé dans le navigateur.
*/
  import { reactive, ref } from 'vue'
  import { RouterLink, useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import InputPassword from '@/components/forms/InputPassword.vue'
  import InputConfirm from '@/components/forms/InputConfirm.vue'
  import SelectorMenu from '@/components/SelectorMenu.vue'
  import logoHorizontal from '@/assets/logo/logo-horizontal.svg'
  import validation from '@/directives/validation'
  import useNavigationLoading from '@/use/useNavigationLoading'
  import { useAuthStore } from '@/stores/authStore'
  import { push } from 'notivue'

  const { t } = useI18n()
  const route = useRoute()
  const authStore = useAuthStore()
  const { trackApiCall } = useNavigationLoading()

  const token = String(route.query.token ?? '')
  const email = String(route.query.email ?? '')
  // Sans jeton ou sans adresse, le lien est incomplet : inutile d'interroger le serveur.
  const incomplete = !token || !email

  const form = reactive({ password: '', confirmation: '' })
  const done = ref(false)
  const invalid = ref(incomplete)
  const isSubmitting = ref(false)

  const submit = () => {
    if (isSubmitting.value) return
    if (validation(!form.password || !form.confirmation, t('Auth.Errors.RequiredFields'))) {
      // erreur déjà affichée par validation()
    } else if (validation(form.password.length < 8, t('Auth.Errors.PasswordTooShort'))) {
      // erreur déjà affichée par validation()
    } else if (validation(form.password.length > 190, t('Auth.Errors.PasswordTooLong'))) {
      // erreur déjà affichée par validation()
    } else if (validation(form.password !== form.confirmation, t('Auth.Errors.ConfirmationMismatch'))) {
      // erreur déjà affichée par validation()
    } else {
      isSubmitting.value = true
      trackApiCall(authStore.resetPassword({ token, email, password: form.password, password_confirmation: form.confirmation }))
        .then(() => {
          done.value = true
        })
        .catch((error) => {
          if (error.response?.data?.code === 'invalid_token') {
            invalid.value = true
          } else {
            push.error(error.response?.status === 429 ? t('PasswordReset.TooMany') : (error.response?.data?.message ?? t('Auth.Errors.NetworkError')))
          }
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

    <div class="w-full max-w-md mx-auto px-4 pt-20 tablet:pt-8 pb-8 flex flex-col items-center gap-6">
      <h1 class="m-0 flex justify-center">
        <img :src="logoHorizontal" :alt="t('Common.SiteName')" class="h-16 tablet:h-20 w-auto">
      </h1>

      <section class="w-full rounded-2xl border border-slate-300 bg-slate-50 p-6 tablet:p-8 shadow-xl shadow-black/20">
        <div v-if="done" class="py-2 text-center" role="status" data-testid="reset-done">
          <h2 class="mt-0 mb-4">{{ t('PasswordReset.DoneHeading') }}</h2>
          <p class="mb-5 text-slate-700 dark:text-slate-700">{{ t('PasswordReset.DoneMessage') }}</p>
          <RouterLink to="/login" class="odc-btn odc-btn--soft odc--blue w-full" data-testid="go-login">{{ t('PasswordReset.GoLogin') }}</RouterLink>
        </div>

        <div v-else-if="invalid" class="py-2 text-center" role="alert" data-testid="reset-invalid">
          <h2 class="mt-0 mb-4">{{ t('PasswordReset.InvalidHeading') }}</h2>
          <p class="mb-5 text-slate-700 dark:text-slate-700">{{ t('PasswordReset.InvalidMessage') }}</p>
          <RouterLink to="/forgot-password" class="odc-btn odc-btn--soft odc--blue w-full" data-testid="ask-again">{{ t('PasswordReset.AskAgain') }}</RouterLink>
        </div>

        <template v-else>
          <h2 class="mt-0 mb-3">{{ t('PasswordReset.ResetHeading') }}</h2>
          <p class="mb-5 text-sm text-slate-700 dark:text-slate-700">{{ t('PasswordReset.ResetIntro') }}</p>
          <form data-testid="reset-form" @submit.prevent="submit">
            <div class="form-group">
              <InputPassword v-model="form.password" name="password" :label="t('PasswordReset.NewPassword')" :placeholder="t('Auth.PasswordPlaceholder')" />
            </div>
            <div class="form-group">
              <InputConfirm v-model="form.confirmation" confirmField="password" :confirmValue="form.password"
                name="confirmation" :label="t('confirmation')" :placeholder="t('Auth.ConfirmationPlaceholder')" />
            </div>
            <button type="submit" class="mt-2 odc-btn odc-btn--soft odc--blue w-full" :disabled="isSubmitting" data-testid="reset-submit">
              {{ t('PasswordReset.Submit') }}
            </button>
          </form>
        </template>
      </section>
    </div>
  </div>
</template>
