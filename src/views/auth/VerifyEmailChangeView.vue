<script setup>
  import { ref, onMounted } from 'vue'
  import { useRoute, RouterLink } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import logoHorizontal from '@/assets/logo/logo-horizontal.svg'
  import { useAuthStore } from '@/stores/authStore'

  const { t } = useI18n()
  const route = useRoute()
  const authStore = useAuthStore()

  const state = ref('verifying') // 'verifying' | 'success' | 'error'

  onMounted(async () => {
    const { id, hash, expires, signature } = route.query

    if (id && hash && expires && signature) {
      try {
        await authStore.confirmEmailChange({ id, hash, expires, signature })
        authStore.clearSession()
        state.value = 'success'
      } catch {
        state.value = 'error'
      }
      return
    }

    state.value = 'error'
  })
</script>

<template>
  <div class="page-container">
    <div class="w-full max-w-md mx-auto px-4 pt-20 tablet:pt-8 pb-8 flex flex-col items-center gap-6">
      <h1 class="m-0 flex justify-center">
        <img :src="logoHorizontal" :alt="t('Common.SiteName')" class="h-16 tablet:h-20 w-auto">
      </h1>

      <section class="w-full rounded-2xl border border-slate-300 bg-slate-50 p-6 tablet:p-8 shadow-xl shadow-black/20 text-center">
        <p v-if="state === 'verifying'" class="my-4 text-slate-700 dark:text-slate-700" role="status">
          {{ t('VerifyEmailChange.Verifying') }}
        </p>

        <template v-else-if="state === 'success'">
          <p class="mb-2 font-bold text-green-700 dark:text-green-700" role="status">
            {{ t('VerifyEmailChange.SuccessTitle') }}
          </p>
          <p class="mb-6 text-sm text-slate-700 dark:text-slate-700">
            {{ t('VerifyEmailChange.SuccessText') }}
          </p>
          <RouterLink to="/login" class="odc-btn odc-btn--soft odc--blue">
            {{ t('VerifyEmailChange.LoginButton') }}
          </RouterLink>
        </template>

        <template v-else>
          <p class="mb-4 font-bold text-red-700 dark:text-red-700" role="alert">
            {{ t('VerifyEmailChange.InvalidLink') }}
          </p>
          <p class="mt-4 text-sm">
            <RouterLink to="/login" class="font-bold text-blue-700 hover:underline underline-offset-2">
              {{ t('Login.Heading') }}
            </RouterLink>
          </p>
        </template>
      </section>
    </div>
  </div>
</template>
