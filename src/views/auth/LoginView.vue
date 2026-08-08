<script setup>
/*
  imports
*/
  import { reactive, ref } from 'vue'
  import { RouterLink, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import InputEmail from '@/components/forms/InputEmail.vue'
  import InputPassword from '@/components/forms/InputPassword.vue'
  import DefaultSubmitButton from '@/components/buttons/DefaultSubmitButton.vue'
  import SelectorMenu from '@/components/SelectorMenu.vue'
  import { useAuthStore } from '@/stores/authStore'
  import validation from '@/directives/validation'
  import { push } from 'notivue'

  const { t } = useI18n()
/*
  form data
*/
  let user = reactive({
    email: '',
    password: '',
  })

  const error_message = reactive({
    value: ''
  })
  const resendSent = ref(false)
/*
  submit form
*/
  const router = useRouter()
  const authStore = useAuthStore()

  const connect = () => {
    if(validation(!user.email || !user.password, t('Auth.Errors.RequiredFields'))) {
      // erreur déjà affichée par validation()
    } else if(validation(user.email.length > 190, t('Auth.Errors.EmailTooLong'))) {
      // erreur déjà affichée par validation()
    } else if(validation(user.password.length < 8, t('Auth.Errors.PasswordTooShort'))) {
      // erreur déjà affichée par validation()
    } else if(validation(user.password.length > 190, t('Auth.Errors.PasswordTooLong'))) {
      // erreur déjà affichée par validation()
    } else {
      resendSent.value = false
      authStore.login(user)
          .then(() => {
            router.push(authStore.hasCharacters ? '/app/' : '/app/character/new')
          })
          .catch(error => {
            error_message.value = error.response?.data?.message ?? t('Auth.Errors.NetworkError')
            push.error(error_message.value)
          })
    }
  }

  const resendVerification = () => {
    authStore.resendVerification(user.email)
      .then(() => {
        resendSent.value = true
      })
      .catch(error => {
        push.error(error.response?.data?.message ?? t('Auth.Errors.NetworkError'))
      })
  }
</script>

<template>
  <div class="page-container relative">
    <div class="absolute top-4 right-4">
      <SelectorMenu />
    </div>
    <h1>{{ t('Common.SiteName') }}</h1>
    <div class="page-content grid grid-cols-3 gap-0 justify-items-center">
      <div class="col-start-2 col-span-1">
        <!-- Bouton d'entrée sans compte -->
        <div class="w-12/12 mb-1 grid grid-cols-1 text-center text-white text-3xl font-black hover:text-gray-800 transform hover:translate-y-px hover:translate-x-px shadow-inner">
          <RouterLink to="/app/" class="px-4 pb-2.5 pt-1.5 font-bold bg-gradient-to-br from-red-600 to-orange-400 rounded-xl">
            {{ t('Login.EnterWithoutAccount') }}
          </RouterLink>
        </div>

        <!-- Formulaire de connexion -->
        <div class="w-12/12 my-5 bg-slate-700 dark:bg-gray-200 shadow-lg flex flex-col items-center justify-center rounded-xl">
          <div class="w-full mt-2 laptop:mt-5 px-7 overflow-y-auto">
            <h2 class="text-white dark:text-blue-800">{{ t('Login.Heading') }}</h2>
            <form class="mt-6" @submit.prevent="connect">
              <div class="form-group">
                <InputEmail v-model="user.email" name="email" :label="t('email')" :placeholder="t('Auth.EmailPlaceholder')" />
              </div>
              <div class="form-group">
                <InputPassword v-model="user.password" name="password" :label="t('password')" :placeholder="t('Auth.PasswordPlaceholder')" />
              </div>
              <DefaultSubmitButton :text="t('Login.SubmitButton')" />
            </form>

            <!-- Lien d'inscription -->
            <div class="my-5 flex flex-col laptop:flex-row justify-center text-center">
              <span class="text-base text-gray-300 dark:text-gray-500">
                {{ t('Login.NoAccount') }}
              </span>
              <span class="mt-2 laptop:mt-0 text-xl laptop:text-lg">
                <RouterLink
                  to="/register"
                  class="ml-1 font-bold text-blue-300 dark:text-blue-600"
                >
                  {{ t('Login.RegisterLink') }}
                </RouterLink>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Message email non vérifié -->
      <div class="w-10/12 col-start-3 col-span-1 place-self-center bg-red-500 opacity-80 py-6 px-7 rounded-xl"
            data-testid="unverified-warning"
            v-show="error_message.value === 'Email non vérifié.'">
          <div class="opacity-100 text-xl text-white text-justify">
            {{ t('Login.UnverifiedWarning') }}
        </div>
        <button v-if="!resendSent" type="button" @click="resendVerification"
                class="mt-3 px-3 py-1 rounded bg-white text-red-600 text-sm font-bold uppercase">
          {{ t('Login.ResendButton') }}
        </button>
        <p v-else class="mt-3 text-white font-bold">{{ t('VerifyEmail.ResendSuccess') }}</p>
      </div>
    </div>
  </div>
</template>
