<script setup>
/*
  imports
*/
  import { reactive, ref } from 'vue'
  import { RouterLink } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import InputEmail from "@/components/forms/InputEmail.vue"
  import InputPassword from "@/components/forms/InputPassword.vue"
  import InputConfirm from "@/components/forms/InputConfirm.vue"
  import SelectorMenu from '@/components/SelectorMenu.vue'
  import logoHorizontal from '@/assets/logo/logo-horizontal.svg'
  import validation from '@/directives/validation'
  import useNavigationLoading from '@/use/useNavigationLoading'
  import { useAuthStore } from "@/stores/authStore"
  import { push } from 'notivue'

  const { t } = useI18n()
/*
  form data
*/
  let user = reactive({
    email: "",
    password: "",
    confirmation: "",
  })
  const registered = ref(false)

/*
  submit form
*/
  const authStore = useAuthStore()
  const { trackApiCall } = useNavigationLoading()

  const register = async () => {
    if(validation(!user.email || !user.password || !user.confirmation, t('Auth.Errors.RequiredFields'))) {
      // erreur déjà affichée par validation()
    } else if(validation(user.email.length > 190, t('Auth.Errors.EmailTooLong'))) {
      // erreur déjà affichée par validation()
    } else if(validation(user.password.length < 8, t('Auth.Errors.PasswordTooShort'))) {
      // erreur déjà affichée par validation()
    } else if(validation(user.password.length > 190, t('Auth.Errors.PasswordTooLong'))) {
      // erreur déjà affichée par validation()
    } else if(validation(user.password !== user.confirmation, t('Auth.Errors.ConfirmationMismatch'))) {
      // erreur déjà affichée par validation()
    } else {
      trackApiCall(authStore.register(user))
          .then(() => {
            registered.value = true
          })
          .catch(error => {
            push.error(error.response?.data?.message ?? t('Auth.Errors.NetworkError'))
          })
    }
  }
</script>

<template>
  <div class="page-container relative">
    <div class="absolute top-4 right-4">
      <SelectorMenu />
    </div>

    <!-- Même structure que la connexion (revue le 27/09/2026) : une colonne, une carte claire dans
         les deux thèmes (elle s'inversait avec le thème et ses libellés passaient sous 4,5:1), le
         retour vers la connexion en lien au bas de la carte plutôt qu'en bouton isolé. -->
    <div class="w-full max-w-md mx-auto px-4 pt-20 tablet:pt-8 pb-8 flex flex-col items-center gap-6">
      <!-- Logo horizontal à la place du titre texte (Greg, 27/09/2026). Le <h1> reste : c'est le
           titre de la page, son nom accessible vient de l'alt traduit. -->
      <h1 class="m-0 flex justify-center">
        <img :src="logoHorizontal" :alt="t('Common.SiteName')" class="h-16 tablet:h-20 w-auto">
      </h1>

      <!-- Couleurs de texte répétées en `dark:` à cause de la règle globale `.dark p`. -->
      <section class="w-full rounded-2xl border border-slate-300 bg-slate-50 p-6 tablet:p-8 shadow-xl shadow-black/20">
        <template v-if="!registered">
          <h2 class="mt-0 mb-5">{{ t('Register.Heading') }}</h2>
          <form v-on:submit.prevent="register">
            <div class="form-group">
              <InputEmail v-model="user.email" name="email" :label="t('email')" :placeholder="t('Auth.EmailPlaceholder')" />
            </div>
            <div class="form-group">
              <InputPassword v-model="user.password" name="password" :label="t('password')" :placeholder="t('Auth.PasswordPlaceholder')"/>
            </div>
            <div class="form-group">
              <InputConfirm v-model="user.confirmation" confirmField="password" :confirmValue="user.password"
                name="confirmation" :label="t('confirmation')" :placeholder="t('Auth.ConfirmationPlaceholder')"/>
            </div>
            <button type="submit" class="mt-2 odc-btn odc-btn--soft odc--blue w-full">
              {{ t('Register.SubmitButton') }}
            </button>
          </form>

          <p class="mt-6 text-center text-sm text-slate-700 dark:text-slate-700">
            {{ t('Register.HasAccount') }}
            <RouterLink to="/login" class="font-bold text-blue-700 hover:underline underline-offset-2">
              {{ t('Register.LoginLink') }}
            </RouterLink>
          </p>
        </template>
        <div v-else class="py-2 text-center" data-testid="check-email-message">
          <h2 class="mt-0 mb-4">{{ t('Register.CheckEmailTitle') }}</h2>
          <p class="text-slate-700 dark:text-slate-700 whitespace-pre-line">{{ t('Register.CheckEmailMessage') }}</p>
        </div>
      </section>

      <p v-if="!registered" class="text-sm text-slate-700 dark:text-slate-300 text-center">
        <i18n-t keypath="Register.Modules.Intro" scope="global">
          <template #privacyLink>
            <RouterLink
              :to="{ name: 'legal-privacy' }"
              class="italic underline hover:text-slate-900 dark:hover:text-slate-100"
            >{{ t('Legal.Cookies.PrivacyPolicyLink') }}</RouterLink>
          </template>
        </i18n-t>
      </p>
    </div>
  </div>
</template>
