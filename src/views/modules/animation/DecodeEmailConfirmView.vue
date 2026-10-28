<script setup>
  import { ref, onMounted } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, RouterLink } from 'vue-router'
  import { apiMessage } from '@/stores/mandateStore'
  import useDecodeActivities from '@/use/useDecodeActivities'
  import ChestLoader from '@/components/loading/ChestLoader.vue'
  import DecodeHero from '@/components/anim/DecodeHero.vue'

  /*
    Décode le code — confirmation de l'adresse email (D29). Le lien de l'email pointe ICI (jamais vers l'API ni le domaine
    d'administration) : la page rappelle l'API en JSON avec les paramètres du lien signé, comme /verify-email. Une adresse non confirmée
    n'est jamais utilisée. Ce message ne contient, et cette page ne demande, aucun mot de passe.
  */
  const { t, locale } = useI18n()
  const route = useRoute()
  const api = useDecodeActivities()

  const state = ref('loading') // loading | ok | error
  const message = ref('')

  onMounted(async () => {
    const { slug, hash, expires, signature } = route.query
    if (!slug || !hash || !expires || !signature) { state.value = 'error'; return }
    try {
      await api.confirmEmail({ slug: String(slug), hash: String(hash), expires: String(expires), signature: String(signature) })
      state.value = 'ok'
    } catch (e) {
      message.value = apiMessage(e, locale.value, t('Animation.Confirm.Error'))
      state.value = 'error'
    }
  })
</script>

<template>
  <div class="w-full text-slate-800 dark:text-slate-800">
    <DecodeHero :title="t('Animation.Confirm.Title')" :divider="false" title-testid="confirm-title" cells-testid="confirm-visual" />

    <div class="mx-auto mt-5 max-w-3xl rounded-xl border border-slate-300 bg-white p-5">
      <!-- Le lien signé est vérifié par le serveur : la porte s'ouvre pendant l'attente (comme les autres pages du module). -->
      <ChestLoader :loading="state === 'loading'" accent="teal" illustration="gate">
        <p v-if="state === 'ok'" role="status" class="!mt-0 flex items-center gap-2 font-semibold text-green-900 dark:text-green-900" data-testid="confirm-ok"><v-icon name="fa-check-circle" class="text-teal-700" aria-hidden="true" />{{ t('Animation.Confirm.Ok') }}</p>
        <p v-else role="alert" class="!mt-0 font-semibold text-red-700 dark:text-red-700" data-testid="confirm-error">{{ message || t('Animation.Confirm.Error') }}</p>
        <RouterLink :to="{ name: 'animation-manage' }" class="mt-3 odc-btn odc-btn--soft odc-btn--rect flex-col !gap-1 !min-h-[5.5rem] min-w-[10rem] px-8 text-base odc--teal" data-testid="confirm-manage">
          <v-icon name="gi-entry-door" scale="2" aria-hidden="true" />{{ t('Animation.Create.DoneManage') }}
        </RouterLink>
      </ChestLoader>
    </div>
  </div>
</template>
