<script setup>
/*
  imports
*/
  import { ref, onMounted, reactive } from 'vue'
  import { useRoute, useRouter, RouterLink } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import InputEmail from '@/components/forms/InputEmail.vue'
  import logoHorizontal from '@/assets/logo/logo-horizontal.svg'
  import { useAuthStore } from '@/stores/authStore'
  import useNavigationLoading from '@/use/useNavigationLoading'
  import { push } from 'notivue'

  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const authStore = useAuthStore()
  const { trackApiCall } = useNavigationLoading()

  const state = ref('verifying') // 'verifying' | 'error'
  const resendEmail = reactive({ value: '' })
  const resendSent = ref(false)

  // Tout ce qui n'aboutit pas à une connexion bascule sur l'erreur + le formulaire de renvoi.
  // Jusqu'au 27/09/2026, seule la présence de `?error` y menait : sans paramètre (lien tronqué,
  // accès direct) ou avec un jeton refusé par le serveur (expiré, révoqué), la page restait
  // indéfiniment sur « Vérification en cours… », sans rien proposer.
  // Deux formes de lien, depuis le 05/10/2026 :
  // - `?id&hash&expires&signature` : le lien de l'email pointe ici, et la page rappelle l'API ;
  // - `?token` : redirection de l'API, pour les liens envoyés avant (ils pointaient vers l'API).
  onMounted(async () => {
    const { id, hash, expires, signature } = route.query
    let token = route.query.token

    if (!token && id && hash && expires && signature) {
      token = await authStore.confirmEmail({ id, hash, expires, signature }).catch(() => null)
    }

    if (token) {
      authStore.setToken(token)
      const ok = await authStore.checkAuth()
      if (ok) {
        router.push(authStore.hasCharacters ? '/app/profil' : '/app/character/new')
        return
      }
    }

    state.value = 'error'
  })

  const resend = () => {
    trackApiCall(authStore.resendVerification(resendEmail.value))
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
    <!-- Même structure que la connexion (27/09/2026) : logo horizontal, carte claire dans les deux
         thèmes. Le texte « Vérification en cours… » était blanc sur la page claire (1,23:1). -->
    <div class="w-full max-w-md mx-auto px-4 pt-20 tablet:pt-8 pb-8 flex flex-col items-center gap-6">
      <!-- Le <h1> reste : titre de la page, nom accessible par l'alt traduit. -->
      <h1 class="m-0 flex justify-center">
        <img :src="logoHorizontal" :alt="t('Common.SiteName')" class="h-16 tablet:h-20 w-auto">
      </h1>

      <!-- Couleurs de texte répétées en `dark:` à cause de la règle globale `.dark p`. -->
      <section class="w-full rounded-2xl border border-slate-300 bg-slate-50 p-6 tablet:p-8 shadow-xl shadow-black/20 text-center">
        <p v-if="state === 'verifying'" class="my-4 text-slate-700 dark:text-slate-700" role="status">
          {{ t('VerifyEmail.Verifying') }}
        </p>

        <template v-else>
          <p class="mb-4 font-bold text-red-700 dark:text-red-700" role="alert">{{ t('VerifyEmail.InvalidLink') }}</p>

          <template v-if="!resendSent">
            <p class="mb-5 text-sm text-slate-700 dark:text-slate-700">{{ t('VerifyEmail.ResendPrompt') }}</p>
            <form class="w-full text-left" @submit.prevent="resend">
              <div class="form-group">
                <InputEmail v-model="resendEmail.value" name="email" :label="t('email')" :placeholder="t('Auth.EmailPlaceholder')" />
              </div>
              <button type="submit" class="mt-2 odc-btn odc-btn--soft odc--blue w-full">
                {{ t('VerifyEmail.ResendButton') }}
              </button>
            </form>
          </template>
          <p v-else class="font-bold text-green-800 dark:text-green-800">{{ t('VerifyEmail.ResendSuccess') }}</p>

          <p class="mt-6 text-sm">
            <RouterLink to="/login" class="font-bold text-blue-700 hover:underline underline-offset-2">{{ t('Login.Heading') }}</RouterLink>
          </p>
        </template>
      </section>
    </div>
  </div>
</template>
