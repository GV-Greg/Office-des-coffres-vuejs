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
    email: "",
    password: "",
    confirmation: "",
  })
  const registered = ref(false)

/*
  submit form
*/
  const authStore = useAuthStore()

  const register = async () => {
    if(validation(!user.email || !user.password || !user.confirmation, t('Auth.Errors.RequiredFields'))) {
    } else if(validation(user.email.length > 190, t('Auth.Errors.EmailTooLong'))) {
    } else if(validation(user.password.length < 8, t('Auth.Errors.PasswordTooShort'))) {
    } else if(validation(user.password.length > 190, t('Auth.Errors.PasswordTooLong'))) {
    } else if(validation(user.password !== user.confirmation, t('Auth.Errors.ConfirmationMismatch'))) {
    } else {
      authStore.register(user)
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
    <h1 >{{ t('Common.SiteName') }}</h1>
    <div class="page-content grid grid-cols-3 gap-0 justify-items-center">
      <div class="w-full col-start-2 col-span-1">
          <!-- Bouton retour -->
          <div class="w-full flex justify-center mb-1">
            <RouterLink to="/login" class="btn btn-grad-slate">
              <v-icon name="fa-arrow-alt-circle-left" scale="1" />
              {{ t('Register.BackLink') }}
            </RouterLink>
          </div>

        <div class="w-12/12 my-5 bg-slate-700 dark:bg-gray-200 shadow-lg flex flex-col items-center justify-center rounded-xl">
          <div class="w-full mt-2 laptop:mt-5 px-7 overflow-y-auto">
            <template v-if="!registered">
              <h2 class="text-white dark:text-blue-800">{{ t('Register.Heading') }}</h2>
              <form class="mt-6" v-on:submit.prevent="register">
                <InputEmail v-model="user.email" name="email" :label="t('email')" :placeholder="t('Auth.EmailPlaceholder')" />
                <InputPassword v-model="user.password" name="password" :label="t('password')" :placeholder="t('Auth.PasswordPlaceholder')"/>
                <InputConfirm v-model="user.confirmation" confirmField="password" :confirmValue="user.password"
                  name="confirmation" :label="t('confirmation')" :placeholder="t('Auth.ConfirmationPlaceholder')"/>
                <DefaultSubmitButton :text="t('Register.SubmitButton')" />
              </form>
            </template>
            <div v-else class="py-6 text-center" data-testid="check-email-message">
              <h2 class="text-white dark:text-blue-800">{{ t('Register.CheckEmailTitle') }}</h2>
              <p class="text-gray-200 dark:text-gray-700 whitespace-pre-line">{{ t('Register.CheckEmailMessage') }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
