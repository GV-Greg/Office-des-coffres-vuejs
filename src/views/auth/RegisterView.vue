<script setup>
/*
  imports
*/
  import { reactive } from 'vue'
  import { RouterLink, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import InputText from "@/components/forms/InputText.vue"
  import InputEmail from "@/components/forms/InputEmail.vue"
  import InputPassword from "@/components/forms/InputPassword.vue"
  import InputConfirm from "@/components/forms/InputConfirm.vue"
  import DefaultSubmitButton from "@/components/buttons/DefaultSubmitButton.vue"
  import SelectorMenu from '@/components/SelectorMenu.vue'
  import validation from '@/directives/validation'
  import { useAuthStore } from "@/stores/authStore"
  import { push } from 'notivue'

  const { t } = useI18n()
/*
  form data
*/
  let user = reactive({
    username: "",
    email: "",
    password: "",
    confirmation: "",
  })

/*
  submit form
*/
  const router = useRouter()
  const authStore = useAuthStore()

  const register = async () => {
    if(validation(!user.username || !user.email || !user.password || !user.confirmation, t('Auth.Errors.RequiredFields'))) {
    } else if(validation(user.username.length > 190, t('Auth.Errors.UsernameTooLong'))) {
    } else if(validation(user.email.length > 190, t('Auth.Errors.EmailTooLong'))) {
    } else if(validation(user.password.length < 8, t('Auth.Errors.PasswordTooShort'))) {
    } else if(validation(user.password.length > 190, t('Auth.Errors.PasswordTooLong'))) {
    } else if(validation(user.password !== user.confirmation, t('Auth.Errors.ConfirmationMismatch'))) {
    } else {
      authStore.register(user)
          .then(() => {
            router.push('/login/')
          })
          .catch(error => {
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
    <h1 >{{ t('Common.SiteName') }}</h1>
    <div class="page-content grid grid-cols-3 gap-0 justify-items-center">
      <div class="w-full col-start-2 col-span-1">
          <!-- Bouton retour -->
          <div class="w-full flex justify-center">
            <div class="w-6/12 mb-1 grid grid-cols-1 text-center text-white text-3xl font-black hover:text-gray-800 transform hover:translate-y-px hover:translate-x-px shadow-inner">
              <RouterLink to="/login" class="px-4 pb-2.5 pt-1.5 font-bold bg-gradient-to-br from-red-600 to-orange-400 rounded-xl">
                <v-icon name="fa-arrow-alt-circle-left" scale="2" class="mb-1" />
                <span class="ml-2">{{ t('Register.BackLink') }}</span>
              </RouterLink>
            </div>
          </div>

        <div class="w-12/12 my-5 bg-gray-200 flex flex-col items-center justify-center border-2 border-gray-300 border-dashed rounded-xl">
          <div class="w-full mt-2 md:mt-5 px-7 overflow-y-auto">
            <h2>{{ t('Register.Heading') }}</h2>
            <form class="mt-6" v-on:submit.prevent="register">
              <InputText v-model="user.username" name="username" :label="t('username')" :placeholder="t('Auth.UsernamePlaceholder')" />
              <InputEmail v-model="user.email" name="email" :label="t('email')" :placeholder="t('Auth.EmailPlaceholder')" />
              <InputPassword v-model="user.password" name="password" :label="t('password')" :placeholder="t('Auth.PasswordPlaceholder')"/>
              <InputConfirm v-model="user.confirmation" confirmField="password" :confirmValue="user.password"
                name="confirmation" :label="t('confirmation')" :placeholder="t('Auth.ConfirmationPlaceholder')"/>
              <DefaultSubmitButton :text="t('Register.SubmitButton')" />
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>