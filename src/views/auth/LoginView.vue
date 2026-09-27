<script setup>
/*
  imports
*/
  import { reactive, ref } from 'vue'
  import { RouterLink, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import InputEmail from '@/components/forms/InputEmail.vue'
  import InputPassword from '@/components/forms/InputPassword.vue'
  import SelectorMenu from '@/components/SelectorMenu.vue'
  import logoHorizontal from '@/assets/logo/logo-horizontal.svg'
  import { useAuthStore } from '@/stores/authStore'
  import { useCookieStore } from '@/stores/cookieStore'
  import validation from '@/directives/validation'
  import { push } from 'notivue'

  const { t } = useI18n()
  const cookieStore = useCookieStore()
/*
  form data
*/
  // Pré-remplissage "Refinement Option B" : reflète la dernière préférence mémorisée
  // (cookieStore.comfortData, écrite par authStore.login() après un login réussi). Vide/
  // décoché par défaut si rien n'a été mémorisé (pas de consentement Préférences, ou
  // consentement retiré depuis — voir cookieStore._syncComfortPersistence).
  let user = reactive({
    email: cookieStore.getComfortData('last_login_email', '') ?? '',
    password: '',
  })
  const rememberMe = ref(!!cookieStore.getComfortData('remember_me_preference', false))

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
      authStore.login({ ...user, remember_me: rememberMe.value })
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

    <!-- Structure revue le 27/09/2026 : une colonne, le formulaire au centre de l'attention.
         « Entrer sans compte » garde sa place en tête, en bouton de la charte au lieu du grand bloc
         en dégradé qui écrasait l'action principale. -->
    <div class="w-full max-w-md mx-auto px-4 pt-20 tablet:pt-8 pb-8 flex flex-col items-center gap-6">
      <!-- Logo horizontal à la place du titre texte (Greg, 27/09/2026). Le <h1> reste : c'est le
           titre de la page, son nom accessible vient de l'alt traduit. -->
      <h1 class="m-0 flex justify-center">
        <img :src="logoHorizontal" :alt="t('Common.SiteName')" class="h-16 tablet:h-20 w-auto">
      </h1>

      <!-- Entrée sans compte : au-dessus de la carte, bouton de la charte avec un dégradé
           orange-rouge plus lumineux (Greg, 27/09/2026) — voir `.enter-free` plus bas. -->
      <div class="w-full flex flex-col items-center gap-3">
        <RouterLink to="/app/" class="odc-btn odc-btn--soft odc--orange enter-free w-full">
          {{ t('Login.EnterWithoutAccount') }}
        </RouterLink>
        <div class="w-full flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300" aria-hidden="true">
          <span class="h-px flex-1 bg-slate-400/50" />
          {{ t('Login.Or') }}
          <span class="h-px flex-1 bg-slate-400/50" />
        </div>
      </div>

      <!-- Carte claire dans les deux thèmes, comme les cartes de contenu (.page-card) : elle
           s'inversait avec le thème, et ses libellés passaient sous 4,5:1. Les couleurs de texte
           sont répétées en `dark:` à cause de la règle globale `.dark p`. -->
      <section class="w-full rounded-2xl border border-slate-300 bg-slate-50 p-6 tablet:p-8 shadow-xl shadow-black/20">
        <h2 class="mt-0 mb-5">{{ t('Login.Heading') }}</h2>

        <!-- Email non vérifié : en tête du formulaire, là où l'on agit, et annoncé
             (role="alert") — il vivait dans une colonne à part, loin du formulaire. -->
        <div
          v-show="error_message.value === 'Email non vérifié.'"
          role="alert"
          data-testid="unverified-warning"
          class="mb-5 rounded-lg border border-red-200 bg-red-50 p-4"
        >
          <p class="text-sm text-red-800 dark:text-red-800">{{ t('Login.UnverifiedWarning') }}</p>
          <button
            v-if="!resendSent"
            type="button"
            class="mt-3 odc-btn odc-btn--quiet odc-btn--sm odc--red"
            @click="resendVerification"
          >
            {{ t('Login.ResendButton') }}
          </button>
          <p v-else class="mt-3 text-sm font-bold text-green-800 dark:text-green-800">{{ t('VerifyEmail.ResendSuccess') }}</p>
        </div>

        <form @submit.prevent="connect">
          <div class="form-group">
            <InputEmail v-model="user.email" name="email" :label="t('email')" :placeholder="t('Auth.EmailPlaceholder')" />
          </div>
          <div class="form-group">
            <InputPassword v-model="user.password" name="password" :label="t('password')" :placeholder="t('Auth.PasswordPlaceholder')" />
          </div>
          <div class="mb-5 flex items-center gap-2.5">
            <input id="remember-me" v-model="rememberMe" type="checkbox" name="remember_me" class="remember-check" />
            <label for="remember-me" class="text-sm text-slate-700 cursor-pointer">
              {{ t('Auth.RememberMe') }}
            </label>
          </div>
          <button type="submit" class="odc-btn odc-btn--soft odc--blue w-full">
            {{ t('Login.SubmitButton') }}
          </button>
        </form>

        <p class="mt-6 text-center text-sm text-slate-700 dark:text-slate-700">
          {{ t('Login.NoAccount') }}
          <RouterLink to="/register" class="font-bold text-blue-700 hover:underline underline-offset-2">
            {{ t('Login.RegisterLink') }}
          </RouterLink>
        </p>
      </section>

    </div>
  </div>
</template>

<style scoped>
/*
  « Entrez sans compte » : dégradé orange-rouge diagonal, plus lumineux que la face `odc--orange`
  (Greg, 27/09/2026). Seules les couleurs changent. Contraste du texte blanc, arrêt par arrêt :
  red-600 4,83:1 · orange-600 3,56:1 — grand texte (20 px gras ≥ 18,66 px), seuil 3:1.
  ⚠️ Ne pas pousser jusqu'à orange-500 (2,80:1) ni orange-400 (2,26:1, l'ancien bloc) : sous le
  seuil même en grand texte. Et garder le texte ≥ 18,66 px en gras, sinon le seuil repasse à 4,5:1.
*/
.enter-free {
  background: linear-gradient(135deg, #dc2626 0%, #ea580c 100%);
  font-size: 20px;
  font-weight: 800;
}

/*
  « Rester connecté » : case à cocher native (clavier, lecteur d'écran, tests), dessinée aux
  couleurs du formulaire. Bord slate-500 (≥ 3:1 sur la carte slate-50, contraste non textuel) ;
  cochée : blue-600, la couleur de « Se connecter », coche blanche en SVG inline (data: autorisé
  par la CSP, img-src). Transitions coupées en mouvement réduit par la règle globale de base.css.
*/
.remember-check {
  appearance: none;
  flex: none;
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid #64748b;
  border-radius: 5px;
  background: #fff center / 80% no-repeat;
  cursor: pointer;
  transition: background-color .15s ease, border-color .15s ease;
}
.remember-check:hover { border-color: #2563eb; }
.remember-check:checked {
  border-color: #2563eb;
  background-color: #2563eb;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 8.5l3 3 6-7' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
}
.remember-check:focus-visible { outline: 2px solid #1d4ed8; outline-offset: 2px; }
</style>
