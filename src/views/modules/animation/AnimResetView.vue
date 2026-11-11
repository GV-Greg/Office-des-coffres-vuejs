<script setup>
  import { ref, computed } from 'vue'
  import { useRoute, RouterLink } from 'vue-router'
  import { apiMessage, apiFieldErrors } from '@/stores/mandateStore'
  import { useCookieStore } from '@/stores/cookieStore'
  import { passwordStrength } from '@/modules/passwordStrength'
  import useDecodeActivities from '@/use/useDecodeActivities'
  import useRewardsGrid from '@/use/useRewardsGrid'
  import useAnimKind from '@/use/useAnimKind'
  import useNavigationLoading from '@/use/useNavigationLoading'
  import PasswordField from '@/components/anim/PasswordField.vue'
  import { ANIM_COMPONENTS } from '@/components/anim/animHeroes'

  /*
    Choisir un nouveau mot de passe avec le lien à usage unique (D35, D36) — commun à toutes les activités d'Animation (`kind`). Le lien arrive
    par email (auteur avec une adresse confirmée) ou par un message en jeu au pseudo de son personnage (sans email, D36) : `?slug=…&token=…`.
    L'auteur CHOISIT lui-même son mot de passe ; aucun mot de passe ne circule. Le lien est valable 24 h et ne s'emploie qu'une fois. Aucune
    règle ici : le serveur juge (jeton, durée, règles du mot de passe) et ses refus s'affichent tels quels.
  */
  const props = defineProps({ kind: { type: String, required: true } })
  const { kind, kt, t, locale } = useAnimKind(props.kind)
  const route = useRoute()
  const api = props.kind === 'rewards' ? useRewardsGrid() : useDecodeActivities()
  const cookieStore = useCookieStore()
  const { trackApiCall } = useNavigationLoading()
  const Hero = ANIM_COMPONENTS[props.kind].hero

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
        cookieStore.setComfortData(kind.slugKey, slug.value) // l'adresse seulement, jamais le mot de passe (D4)
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
    <component :is="Hero" :title="kt('Reset.Title')" :divider="false" title-testid="reset-title" cells-testid="reset-visual" />

    <div class="mx-auto mt-5 max-w-3xl">
      <p v-if="missing" role="alert" class="rounded-xl border border-red-700 bg-white p-4 font-semibold text-red-700 dark:text-red-700" data-testid="reset-missing">{{ kt('Reset.Missing') }}</p>

      <section v-else-if="done" class="rounded-xl border border-teal-700 bg-white p-5" role="status" data-testid="reset-done">
        <p class="!mt-0 font-bold text-green-900 dark:text-green-900">{{ kt('Reset.Done') }}</p>
        <RouterLink :to="{ name: kind.routes.manage }" class="mt-2 odc-btn odc-btn--soft odc-btn--rect flex-col !gap-1 !min-h-[5.5rem] min-w-[10rem] px-8 text-base odc--teal" data-testid="reset-manage">
          <v-icon :name="kind.icons.manage" scale="2" aria-hidden="true" />{{ kt('Create.DoneManage') }}
        </RouterLink>
      </section>

      <section v-else class="rounded-xl border border-slate-300 bg-white p-5" data-testid="reset-form">
        <h3 class="!mt-0 !mb-1 text-xl font-extrabold" :class="kind.titleClass">{{ kt('Reset.Title') }}</h3>
        <p class="text-sm text-slate-700 dark:text-slate-700">{{ kt('Reset.Intro', { slug }) }}</p>
        <form class="mt-3 space-y-3" @submit.prevent="submit">
          <PasswordField v-model="password" v-model:confirmation="confirmation" :slug="slug" :error="errors.password" id-prefix="reset" />
          <p v-if="errors.token" role="alert" class="text-sm text-red-700 dark:text-red-700" data-testid="reset-error">{{ errors.token }}</p>
          <button type="submit" class="odc-btn odc-btn--soft odc-btn--sm odc--green" :disabled="!canSubmit || submitting" data-testid="reset-submit">
            <v-icon name="fa-check" aria-hidden="true" />{{ kt('Reset.Submit') }}
          </button>
        </form>
      </section>
    </div>
  </div>
</template>
