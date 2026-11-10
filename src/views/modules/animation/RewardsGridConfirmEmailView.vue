<script setup>
  import { ref, onMounted } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, RouterLink } from 'vue-router'
  import { apiMessage } from '@/stores/mandateStore'
  import useRewardsGrid from '@/use/useRewardsGrid'
  import ChestLoader from '@/components/loading/ChestLoader.vue'
  import RewardsGridHero from '@/components/anim/RewardsGridHero.vue'

  /*
    Grille des lots — confirmation de l'adresse email (mode sans compte). Le lien de l'email
    pointe ICI (jamais vers l'API ni le domaine d'administration) : la page rappelle l'API en JSON
    avec les paramètres du lien signé. Une adresse non confirmée n'est jamais utilisée. Cette page
    ne demande aucun mot de passe.
  */
  const { t, locale } = useI18n()
  const route = useRoute()
  const api = useRewardsGrid()

  const state = ref('loading') // loading | ok | error
  const message = ref('')

  onMounted(async () => {
    const { slug, hash, expires, signature } = route.query
    if (!slug || !hash || !expires || !signature) { state.value = 'error'; return }
    try {
      await api.confirmEmail({ slug: String(slug), hash: String(hash), expires: String(expires), signature: String(signature) })
      state.value = 'ok'
    } catch (e) {
      message.value = apiMessage(e, locale.value, t('Animation.Grid.ConfirmEmail.Error'))
      state.value = 'error'
    }
  })
</script>

<template>
  <div class="w-full text-slate-800 dark:text-slate-800">
    <RewardsGridHero :title="t('Animation.Grid.ConfirmEmail.Title')" :divider="false" title-testid="grid-confirm-title" class="mb-5" />

    <div class="mx-auto max-w-3xl rounded-xl border border-slate-300 bg-white p-5">
      <ChestLoader :loading="state === 'loading'" accent="teal">
        <p v-if="state === 'ok'" role="status" class="!mt-0 flex items-center gap-2 font-semibold text-green-900 dark:text-green-900" data-testid="grid-confirm-ok">
          <v-icon name="fa-check-circle" class="text-teal-700" aria-hidden="true" />{{ t('Animation.Grid.ConfirmEmail.Ok') }}
        </p>
        <p v-else role="alert" class="!mt-0 font-semibold text-red-700 dark:text-red-700" data-testid="grid-confirm-error">{{ message || t('Animation.Grid.ConfirmEmail.Error') }}</p>
        <RouterLink :to="{ name: 'animation-rewards-manage' }" class="mt-3 odc-btn odc-btn--soft odc-btn--rect odc--teal" data-testid="grid-confirm-manage">
          <v-icon name="gi-chest" aria-hidden="true" />{{ t('Animation.Grid.Manage.Open') }}
        </RouterLink>
      </ChestLoader>
    </div>
  </div>
</template>
