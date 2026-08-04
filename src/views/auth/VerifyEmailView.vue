<script setup>
/*
  imports
*/
  import { ref, onMounted, reactive } from 'vue'
  import { useRoute, useRouter, RouterLink } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import InputEmail from '@/components/forms/InputEmail.vue'
  import DefaultSubmitButton from '@/components/buttons/DefaultSubmitButton.vue'
  import { useAuthStore } from '@/stores/authStore'
  import { push } from 'notivue'

  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const authStore = useAuthStore()

  const state = ref('verifying') // 'verifying' | 'error'
  const resendEmail = reactive({ value: '' })
  const resendSent = ref(false)

  onMounted(async () => {
    const token = route.query.token
    const error = route.query.error

    if (token) {
      authStore.setToken(token)
      const ok = await authStore.checkAuth()
      if (ok) {
        router.push(authStore.hasCharacters ? '/app/profil' : '/app/character/new')
        return
      }
    }

    if (error) {
      state.value = 'error'
    }
  })

  const resend = () => {
    authStore.resendVerification(resendEmail.value)
      .then(() => {
        resendSent.value = true
      })
      .catch(error => {
        push.error(error.response?.data?.message ?? t('Auth.Errors.NetworkError'))
      })
  }
</script>

<template>
  <div class="page-container">
    <h1>{{ t('Common.SiteName') }}</h1>
    <div class="page-content grid grid-cols-3 gap-0 justify-items-center">
      <div class="col-start-2 col-span-1 w-full text-center text-white">
        <div v-if="state === 'verifying'" class="my-10">
          {{ t('VerifyEmail.Verifying') }}
        </div>

        <div v-else class="my-5 bg-slate-700 dark:bg-gray-200 shadow-lg flex flex-col items-center justify-center rounded-xl p-6">
          <p class="text-red-400 dark:text-red-600 font-bold mb-4">{{ t('VerifyEmail.InvalidLink') }}</p>

          <template v-if="!resendSent">
            <p class="text-gray-200 dark:text-gray-700 text-sm mb-4">{{ t('VerifyEmail.ResendPrompt') }}</p>
            <form class="w-full" @submit.prevent="resend">
              <InputEmail v-model="resendEmail.value" name="email" :label="t('email')" :placeholder="t('Auth.EmailPlaceholder')" />
              <DefaultSubmitButton :text="t('VerifyEmail.ResendButton')" />
            </form>
          </template>
          <p v-else class="text-green-400 dark:text-green-700 font-bold">{{ t('VerifyEmail.ResendSuccess') }}</p>

          <RouterLink to="/login" class="mt-4 font-bold text-blue-300 dark:text-blue-600">{{ t('Login.Heading') }}</RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>
