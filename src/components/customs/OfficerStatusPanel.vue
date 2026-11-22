<script setup>
  import { ref, computed, nextTick } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { push } from 'notivue'
  import { apiMessage } from '@/stores/mandateStore'
  import { formatFieldDate } from '@/modules/playerDates'
  import customsApi from '@/use/customsApi'
  import { bumpCustoms } from '@/use/customsRefresh'

  /*
    Statut de douanier d'un personnage, dans sa carte du Profil : demande EN ATTENTE ou accès EN VIGUEUR. La demande elle-même se fait dans la modale
    « Demander un poste » (Greg, 22/11/2026), comme celle d'un poste. Le douanier n'existe PAS en jeu, c'est un rôle de l'Office : jamais nommé d'office ;
    le trio de sécurité de la province le valide, en cascade (prévôt ou connétable ; en leur absence connue, capitaine, dirigeant ou maire ; en dernier
    recours l'administrateur). ⚠️ Aucune règle ici : quand l'accès s'éteint, le serveur le dit (`GET characters/{id}/customs`) ; un refus s'affiche tel
    quel, en FR ou EN. Un seul rôle ou demande en cours par personnage.
  */
  const props = defineProps({
    character: { type: Object, required: true },
    state: { type: Object, required: true }, // GET characters/{id}/customs
  })
  const emit = defineEmits(['changed'])

  const { t, locale } = useI18n()
  const api = customsApi()

  const busy = ref(false)
  const confirming = ref(false)
  // Infobulle « i » (cascade de validation) : survol, focus ou clic (tactile) ; Échap la ferme. Pas de composant partagé existant : gardée ici.
  const tipOpen = ref(false)
  // La carte et la zone du Profil rognent leur contenu (overflow) : l'infobulle est téléportée au <body> et placée en fixe sous le bouton « i »,
  // recalée dans la fenêtre (à droite de l'icône (à gauche si la place manque), jamais coupée).
  const tipButton = ref(null)
  const tipPos = ref({ top: 0, left: 0 })
  const TIP_WIDTH = 256
  const TIP_HEIGHT = 130 // hauteur approchée de l'infobulle (5 lignes), pour la recaler dans la fenêtre
  async function placeTip() {
    await nextTick()
    const rect = tipButton.value?.getBoundingClientRect()
    if (!rect) return
    // À DROITE de l'icône ; à gauche si la fenêtre manque de place à droite ; recalée dans la fenêtre dans les deux sens.
    const onRight = rect.right + 8 + TIP_WIDTH <= window.innerWidth - 8
    const left = onRight ? rect.right + 8 : Math.max(8, rect.left - 8 - TIP_WIDTH)
    const top = Math.max(8, Math.min(rect.top - 6, window.innerHeight - TIP_HEIGHT - 8))
    tipPos.value = { left, top }
  }
  const showTip = () => { tipOpen.value = true; placeTip() }
  const toggleTip = () => (tipOpen.value ? (tipOpen.value = false) : showTip())

  const officer = computed(() => props.state.officer ?? null)
  const date = (field, value) => formatFieldDate(field, value, locale.value)

  async function run(action, success) {
    busy.value = true
    try {
      await action()
      push.success(success)
      confirming.value = false
      emit('changed')
      bumpCustoms()
    } catch (error) {
      push.error(apiMessage(error, locale.value, t('Auth.Errors.NetworkError')))
    } finally {
      busy.value = false
    }
  }

  const withdraw = () => run(() => api.withdrawOfficer(props.character.id), t(officer.value?.status === 'pending' ? 'SecurityOfficers.Status.Withdrawn' : 'SecurityOfficers.Status.Renounced'))
</script>

<template>
  <!-- Même gabarit qu'une ligne de poste (CharacterMandates) : pastille d'icône, titre en gras, badge de statut à droite, précisions, actions compactes.
       Fond toujours clair : textes répétés en `dark:` à cause de `.dark p`. -->
  <div class="rounded-lg border border-slate-200 bg-white p-3 text-sm" data-testid="officer-status">
    <div class="flex items-start gap-3">
      <span class="mt-0.5 h-8 w-8 shrink-0 rounded-full flex items-center justify-center bg-rose-100 text-rose-800" aria-hidden="true">
        <!-- `!block` : l'icône est « inline-block, vertical-align -0.2em » par défaut, ce qui la décale vers le bas dans la pastille. -->
        <v-icon name="fa-user-shield" scale="1.05" class="!block" />
      </span>
      <div class="flex-1 min-w-0">
        <div class="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <p class="font-bold text-slate-900 dark:text-slate-900" data-testid="officer-title">{{ t('SecurityOfficers.Status.CardTitle', { province: officer.province.name }) }}</p>
          <span class="shrink-0 inline-flex items-center gap-1.5">
            <span
              class="shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold"
              :class="officer.status === 'pending' ? 'border-blue-200 bg-blue-50 text-blue-800' : (officer.inactive ? 'border-orange-300 bg-orange-50 text-orange-900' : 'border-green-200 bg-green-50 text-green-800')"
              data-testid="officer-badge"
            >
              {{ officer.status === 'pending' ? t('Profil.Mandates.Status.pending') : (officer.inactive ? t('SecurityOfficers.Status.BadgeInactive') : t('SecurityOfficers.Status.BadgeActive')) }}
            </span>
            <!-- Qui valide la demande : infobulle « i » sur la demande en attente. -->
            <span v-if="officer.status === 'pending'" class="inline-flex" @mouseenter="showTip" @mouseleave="tipOpen = false">
              <button
                ref="tipButton"
                type="button"
                class="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                :aria-label="t('SecurityOfficers.Status.CascadeLabel')"
                :aria-expanded="tipOpen"
                aria-describedby="officer-cascade-tip"
                data-testid="officer-cascade-button"
                @click="toggleTip"
                @focus="showTip"
                @blur="tipOpen = false"
                @keydown.esc="tipOpen = false"
              >
                <v-icon name="fa-info-circle" scale="0.9" aria-hidden="true" />
              </button>
              <Teleport to="body">
                <span
                  v-show="tipOpen"
                  id="officer-cascade-tip"
                  role="tooltip"
                  class="fixed z-[60] w-64 rounded-md bg-slate-800 px-3 py-2 text-xs font-normal leading-relaxed text-white shadow-lg"
                  :style="{ top: tipPos.top + 'px', left: tipPos.left + 'px' }"
                  data-testid="officer-cascade"
                >{{ t('SecurityOfficers.Status.PendingCascade') }}</span>
              </Teleport>
            </span>
          </span>
        </div>

        <!-- Demande en attente. -->
        <template v-if="officer.status === 'pending'">
          <p class="mt-1 text-xs text-slate-700 dark:text-slate-700" data-testid="officer-pending">
            {{ t('SecurityOfficers.Status.Pending', { city: officer.city.name, date: date('customs_requested_at', officer.requested_at) }) }}
          </p>
          <div class="mt-2 flex flex-wrap gap-2">
            <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--red" :disabled="busy" data-testid="officer-withdraw" @click="withdraw">
              <v-icon name="fa-times" aria-hidden="true" />{{ t('SecurityOfficers.Status.Withdraw') }}
            </button>
          </div>
        </template>

        <!-- Douanier en vigueur. -->
        <template v-else>
          <p class="mt-1 text-xs text-slate-700 dark:text-slate-700" data-testid="officer-approved">
            {{ t('SecurityOfficers.Status.Approved', { city: officer.city.name, date: date('customs_in_office_from', officer.in_office_from) }) }}
          </p>
          <p class="mt-1 text-xs text-slate-700 dark:text-slate-700" data-testid="officer-lapse">
            <template v-if="officer.inactive">
              <span class="font-bold text-orange-800 dark:text-orange-800">{{ t('SecurityOfficers.Status.Inactive', { date: date('customs_lapses_at', officer.lapses_at) }) }}</span>
            </template>
            <template v-else-if="officer.lapses_at">{{ t('SecurityOfficers.Status.Lapses', { date: date('customs_lapses_at', officer.lapses_at) }) }}</template>
            <template v-if="officer.last_report_at"> {{ t('SecurityOfficers.Status.LastReport', { date: date('customs_last_report_at', officer.last_report_at) }) }}</template>
          </p>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <button v-if="!confirming" type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--red" :disabled="busy" data-testid="officer-renounce" @click="confirming = true">
              {{ t('SecurityOfficers.Status.Renounce') }}
            </button>
            <template v-else>
              <span class="text-xs font-bold text-slate-800 dark:text-slate-800">{{ t('SecurityOfficers.Status.RenounceConfirm') }}</span>
              <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--red" :disabled="busy" data-testid="officer-renounce-confirm" @click="withdraw">{{ t('SecurityOfficers.Status.RenounceYes') }}</button>
              <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--slate" @click="confirming = false">{{ t('SecurityOfficers.Cancel') }}</button>
            </template>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
