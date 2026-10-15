<script setup>
  import { ref, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { RouterLink } from 'vue-router'
  import { push } from 'notivue'
  import { apiMessage } from '@/stores/mandateStore'
  import { setForDay, setFromComfort } from '@/modules/minePrices'
  import { useCookieStore } from '@/stores/cookieStore'
  import { todayIso } from '@/modules/mineParser'
  import useDialogFocus from '@/use/useDialogFocus'
  import useNavigationLoading from '@/use/useNavigationLoading'
  import useMinePrices from '@/use/useMinePrices'
  import MinePriceForm from '@/components/mines/MinePriceForm.vue'

  /*
    Modale rapide « Prix en vigueur » (lot 2 des prix du Registre) : les prix du jour sont pré-remplis,
    on corrige ce qui a changé et on valide — un nouveau jeu à la date choisie, jamais une réécriture
    des jeux passés (ceux-là se corrigent depuis l'historique). Ouverte depuis le registre, pour qui
    peut gérer les prix (le serveur le dit : `access.prices.write`).
  */
  const props = defineProps({
    show: { type: Boolean, required: true },
    provinceId: { type: Number, default: null },
    prices: { type: Array, default: () => [] }, // jeux déjà chargés par la page
    // Le lien « Voir l'historique » n'a pas de sens sur la page de l'historique elle-même.
    showHistoryLink: { type: Boolean, default: true },
  })
  const emit = defineEmits(['close', 'saved'])

  const { t, locale } = useI18n()
  const api = useMinePrices()
  const cookieStore = useCookieStore()
  const { trackApiCall } = useNavigationLoading()

  const panel = ref(null)
  const close = () => emit('close')
  useDialogFocus(computed(() => props.show), panel, close)

  const error = ref('')
  const submitting = ref(false)
  watch(() => props.show, (open) => { if (open) { error.value = ''; submitting.value = false } })

  // Prix de départ : celui en vigueur aujourd'hui, à défaut le plus récent (rien n'est inventé).
  const saved = computed(() => setForDay(props.prices, todayIso()) ?? props.prices[0] ?? null)
  // Aucun jeu en base : les derniers prix saisis dans le Bilan (confort), s'il y en a — un jeu à créer.
  const fromCookies = computed(() => (saved.value || !props.show ? null : setFromComfort(cookieStore.getComfortData('economy_mines_settings'))))
  const initial = computed(() => saved.value ?? fromCookies.value)

  const submit = (body) => {
    submitting.value = true
    error.value = ''
    // Un jeu existe déjà à cette date : on le corrige plutôt que d'en créer un second (le serveur refuse le doublon).
    const sameDay = props.prices.find(p => p.effective_from === body.effective_from)
    trackApiCall(sameDay ? api.update(props.provinceId, sameDay.id, body) : api.create(props.provinceId, body))
      .then((price) => {
        push.success(t('EconomyMines.RegistryPage.Prices.Saved'))
        emit('saved', price)
        close()
      })
      .catch((e) => {
        error.value = apiMessage(e, locale.value, t('Auth.Errors.NetworkError'))
      })
      .finally(() => { submitting.value = false })
  }
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="price-modal-title">
    <div class="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" @click="close"></div>
    <div ref="panel" class="relative w-full max-w-md flex flex-col bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
      <div class="h-1.5 bg-gradient-to-r from-yellow-400 to-yellow-600 shrink-0"></div>
      <div class="p-6 space-y-4">
        <h3 id="price-modal-title" class="text-lg font-bold text-slate-800 dark:text-slate-100">{{ t('EconomyMines.RegistryPage.Prices.ModalTitle') }}</h3>
        <MinePriceForm
          :initial="initial"
          :is-new="!!fromCookies"
          :note="fromCookies ? t('EconomyMines.RegistryPage.Prices.FromCookies') : ''"
          :date="todayIso()"
          :submit-label="t('EconomyMines.RegistryPage.Prices.Update')"
          :submitting="submitting"
          :error="error"
          id-prefix="quick"
          @submit="submit"
          @cancel="close"
        />
        <RouterLink v-if="showHistoryLink" :to="{ name: 'economy-prices' }" class="block text-sm underline text-slate-700 dark:text-slate-300" data-testid="price-history-link" @click="close">
          {{ t('EconomyMines.RegistryPage.Prices.ViewHistory') }}
        </RouterLink>
      </div>
    </div>
  </div>
</template>
