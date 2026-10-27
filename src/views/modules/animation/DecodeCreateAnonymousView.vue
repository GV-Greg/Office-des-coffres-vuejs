<script setup>
  import { ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { RouterLink } from 'vue-router'
  import { apiMessage, apiFieldErrors } from '@/stores/mandateStore'
  import { useCookieStore } from '@/stores/cookieStore'
  import useDecodeActivities from '@/use/useDecodeActivities'
  import useNavigationLoading from '@/use/useNavigationLoading'
  import DecodeCreateForm from '@/components/anim/DecodeCreateForm.vue'
  import DecodeHero from '@/components/anim/DecodeHero.vue'
  import { push } from 'notivue'

  /*
    Décode le code — organiser une activité SANS COMPTE (D2) : aucun compte requis. Le formulaire et son écran de confirmation
    sont ceux de DecodeCreateForm (mode « anonymous »). ⚠️ Aucune règle ici : adresse libre, mot de passe, pseudo, une seule activité
    ouverte par connexion… tout est jugé par le serveur et ses refus s'affichent tels quels.
    Le mot de passe n'est ni conservé ni mémorisé : seule l'ADRESSE de l'activité est retenue sur cet appareil (D4, D22), et seulement
    si les cookies « Préférences » sont acceptés.
  */
  const { t, locale } = useI18n()
  const api = useDecodeActivities()
  const cookieStore = useCookieStore()
  const { trackApiCall } = useNavigationLoading()

  const fieldErrors = ref({})
  const creating = ref(false)
  const created = ref(null) // { activity, email_pending }

  function create(payload) {
    creating.value = true
    fieldErrors.value = {}
    trackApiCall(api.createAnonymous(payload))
      .then((result) => {
        created.value = result
        cookieStore.setComfortData('anim_decode_slug', result.activity.slug)
      })
      .catch((e) => {
        fieldErrors.value = apiFieldErrors(e, locale.value)
        if (!Object.keys(fieldErrors.value).length) push.error(apiMessage(e, locale.value, t('Auth.Errors.NetworkError')))
      })
      .finally(() => { creating.value = false })
  }
</script>

<template>
  <div class="w-full text-slate-800 dark:text-slate-800">
    <!-- Le même encadré de tête que l'entrée des salles : les cinq cases et le titre, qui rappelle l'activité. -->
    <DecodeHero :title="`${t('Animation.Types.decode.Name')} — ${t('Animation.Create.Title')}`" :divider="false" title-testid="create-title" cells-testid="create-visual" />

    <section v-if="created" class="mt-5 rounded-xl border border-teal-700 bg-white p-5" role="status" data-testid="create-done">
      <h3 class="!mt-0 text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-red-700 to-orange-600">{{ t('Animation.Create.DoneTitle') }}</h3>
      <p class="mt-1" data-testid="create-done-address">{{ t('Animation.Create.DoneAddress') }} <code class="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono">{{ created.activity.slug }}</code></p>
      <p v-if="created.email_pending" class="mt-1 text-sm" data-testid="create-done-email">{{ t('Animation.Create.DoneEmail') }}</p>
      <p class="mt-1 text-sm">{{ t('Animation.Create.DonePassword') }}</p>
      <div class="mt-4 flex flex-wrap gap-3">
        <RouterLink :to="{ name: 'animation-manage' }" class="odc-btn odc-btn--soft odc-btn--rect flex-col !gap-1 !min-h-[5.5rem] min-w-[10rem] px-8 text-base odc--teal" data-testid="create-done-manage">
          <v-icon name="gi-entry-door" scale="2" aria-hidden="true" />{{ t('Animation.Create.DoneManage') }}
        </RouterLink>
        <RouterLink :to="{ name: 'animation-public', params: { slug: created.activity.slug } }" target="_blank" rel="noopener" class="odc-btn odc-btn--soft odc-btn--rect flex-col !gap-1 !min-h-[5.5rem] min-w-[10rem] px-8 text-base odc--slate" data-testid="create-done-public">
          <v-icon name="fa-eye" scale="2" aria-hidden="true" />{{ t('Animation.Mine.ViewPublic') }}
        </RouterLink>
      </div>
    </section>

    <section v-else class="mt-5 rounded-xl border border-slate-300 bg-white p-5" data-testid="create-anonymous">
      <p class="!mt-0 text-sm text-slate-700 dark:text-slate-700">{{ t('Animation.Create.Intro') }}</p>
      <DecodeCreateForm mode="anonymous" :errors="fieldErrors" :submitting="creating" @confirm="create" />
    </section>
  </div>
</template>
