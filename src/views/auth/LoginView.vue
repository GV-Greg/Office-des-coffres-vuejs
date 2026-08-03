<script setup>
/*
  imports
*/
  import { reactive } from 'vue'
  import { RouterLink, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import InputText from '@/components/forms/InputText.vue'
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
    username: '',
    password: '',
  })

  const error_message = reactive({
    value: ''
  })
/*
  submit form
*/
  const router = useRouter()
  const authStore = useAuthStore()

  const connect = () => {
    if(validation(!user.username || !user.password, t('Auth.Errors.RequiredFields'))) {
    } else if(validation(user.username.length > 190, t('Auth.Errors.UsernameTooLong'))) {
    } else if(validation(user.password.length < 8, t('Auth.Errors.PasswordTooShort'))) {
    } else if(validation(user.password.length > 190, t('Auth.Errors.PasswordTooLong'))) {
    } else {
      authStore.login(user)
          .then(() => {
            router.push('/app/')
          })
          .catch(error => {
            error_message.value = error.response.data.message
            push.error(error.response.data.message)
          })
    }
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
        <div class="w-12/12 my-5 bg-gray-200 flex flex-col items-center justify-center border-2 border-gray-300 border-dashed rounded-xl">
          <div class="w-full mt-2 md:mt-5 px-7 overflow-y-auto">
            <h2>{{ t('Login.Heading') }}</h2>
            <form class="mt-6" @submit.prevent="connect">
              <div class="form-group">
                <InputText v-model="user.username" name="username" :label="t('username')" :placeholder="t('Auth.UsernamePlaceholder')" />
              </div>
              <div class="form-group">
                <InputPassword v-model="user.password" name="password" :label="t('password')" :placeholder="t('Auth.PasswordPlaceholder')" />
              </div>
              <DefaultSubmitButton :text="t('Login.SubmitButton')" />
            </form>

            <!-- Lien d'inscription -->
            <div class="my-5 flex flex-col laptop:flex-row justify-center text-center">
              <span class="text-base text-gray-500">
                {{ t('Login.NoAccount') }}
              </span>
              <span class="mt-2 laptop:mt-0 text-xl laptop:text-lg">
                <RouterLink
                  to="/register"
                  class="ml-1 font-bold text-blue-600"
                >
                  {{ t('Login.RegisterLink') }}
                </RouterLink>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Message de validation -->
      <div class="w-10/12 col-start-3 col-span-1 place-self-center bg-red-500 opacity-80 py-6 px-7 rounded-xl"
            data-testid="unvalidated-warning"
            v-show="error_message.value === 'Compte non validé.'">
          <div class="opacity-100 text-xl text-white text-justify">
            {{ t('Login.UnvalidatedWarning') }}
        </div>
      </div>
    </div>
  </div>
</template>