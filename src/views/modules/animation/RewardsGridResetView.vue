<script setup>
  import { ref, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, RouterLink } from 'vue-router'
  import { apiMessage, apiFieldErrors } from '@/stores/mandateStore'
  import { useCookieStore } from '@/stores/cookieStore'
  import { passwordStrength } from '@/modules/passwordStrength'
  import useRewardsGrid from '@/use/useRewardsGrid'
  import useNavigationLoading from '@/use/useNavigationLoading'
  import PasswordField from '@/components/anim/PasswordField.vue'
  import RewardsGridHero from '@/components/anim/RewardsGridHero.vue'

  /*
    Grille des lots — choisir un nouveau mot de passe avec le lien à usage unique. Le lien arrive
    par email (auteur avec adresse confirmée) ou par message en jeu (sans email) : `?slug=…&token=…`.
    L'auteur CHOISIT lui-même son mot de passe ; aucun mot de passe ne circule. Lien valable 24 h,
    à usage unique. Aucune règle ici : le serveur juge.
  */
  const { t, locale } = useI18n()
  const route = useRoute()
  const api = useRewardsGrid()
  const cookieStore = useCookieStore()
  const { trackApiCall } = useNavigationLoading()

  const slug = computed(() => String(route.query.slug ?? ''))
  const token = computed(() => String(route.query.token ?? ''))
  const password = ref('')
  const confirmation = ref('')
  const errors = ref({})
  const done = ref(false)
  const submitting = ref(false)

  const missing = computed(() => !slug.value || !token.value)
  const canSubmit = computed(() => !missing.value
    && passwordStrength(password.value, { slug: slug.value }).meetsMinimum
    && password.value === confirmation.value)

  function submit() {
    submitting.value = true
    errors.value = {}
    trackApiCall(api.completeReset(slug.value, { token: token.value, password: password.value, password_confirmation: confirmation.value }))
      .then(() => {
        done.value = true
        cookieStore.setComfortData('anim_rewards_slug', slug.value)
        password.value = ''
        confirmation.value = ''
      })
      .catch((e) => {
        errors.value = apiFieldErrors(e, locale.value)
        if (!Object.keys(errors.value).length) errors.value = { token: apiMessage(e, locale.value, t('Auth.Errors.NetworkError')) }
      })
      .finally(() => { submitting.value = false })
  }
</script>

<template>
  <div class="w-full text-slate-800 dark:text-slate-800">
    <RewardsGridHero :title="t('Animation.Grid.Reset.Title')" :divider="false" title-testid="grid-reset-title" class="mb-5" />

    <div class="mx-auto max-w-3xl">
      <p v-if="missing" role="alert" class="rounded-xl border border-red-700 bg-white p-4 font-semibold text-red-700 dark:text-red-700" data-testid="grid-reset-missing">{{ t('Animation.Grid.Reset.Missing') }}</p>

      <section v-else-if="done" class="rounded-xl border border-teal-700 bg-white p-5" role="status" data-testid="grid-reset-done">
        <p class="!mt-0 font-bold text-green-900 dark:text-green-900">{{ t('Animation.Grid.Reset.Done') }}</p>
        <RouterLink :to="{ name: 'animation-rewards-manage' }" class="mt-2 odc-btn odc-btn--soft odc-btn--rect odc--teal" data-testid="grid-reset-manage">
          <v-icon name="gi-chest" aria-hidden="true" />{{ t('Animation.Grid.Manage.Open') }}
        </RouterLink>
      </section>

      <section v-else class="rounded-xl border border-slate-300 bg-white p-5" data-testid="grid-reset-form">
        <p class="!mt-0 text-sm text-slate-700 dark:text-slate-700">{{ t('Animation.Grid.Reset.Intro', { slug }) }}</p>
        <form class="mt-3 space-y-3" @submit.prevent="submit">
          <PasswordField v-model="password" v-model:confirmation="confirmation" :slug="slug" :error="errors.password" id-prefix="grid-reset" />
          <p v-if="errors.token" role="alert" class="text-sm text-red-700 dark:text-red-700" data-testid="grid-reset-error">{{ errors.token }}</p>
          <button type="submit" class="odc-btn odc-btn--soft odc-btn--sm odc--green" :disabled="!canSubmit || submitting" data-testid="grid-reset-submit">
            <v-icon name="fa-check" aria-hidden="true" />{{ t('Animation.Grid.Reset.Submit') }}
          </button>
        </form>
      </section>
    </div>
  </div>
</template>
