<script setup>
  import { ref, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { push } from 'notivue'
  import { useMandateStore, apiMessage } from '@/stores/mandateStore'
  import useNavigationLoading from '@/use/useNavigationLoading'
  import { formatFieldDate } from '@/modules/playerDates'
  import MandateRequestModal from '@/components/mandates/MandateRequestModal.vue'
  import DeclareOfficeModal from '@/components/mandates/DeclareOfficeModal.vue'

  /*
    Bloc « Postes » d'une carte de personnage (mandats, lot 2). Les statuts sont du texte
    d'interface, traduit ici ; les titres, motifs et causes de fin arrivent de l'API en FR et EN
    (fil mandats-lot2, Q11 : le backend les a déjà pour les emails). Rien n'est masqué (Q7) : après
    une expiration, « Renouveler » et « Demander un poste » coexistent.
  */
  const props = defineProps({
    character: { type: Object, required: true },
  })

  const { t, locale } = useI18n()
  const store = useMandateStore()
  const { trackApiCall } = useNavigationLoading()

  // Lecture directe de l'état du store (pas de fonction-accesseur) : robuste aux stores simulés.
  const mandates = computed(() => (store.mandates ?? []).filter(m => m.character?.id === props.character.id))
  // Un refus ou une révocation reste en vue avec son motif ; seuls les mandats expirés et plus
  // renouvelables partent dans l'historique replié.
  // Historique commun aux deux niveaux : les mandats TERMINÉS (expirés ou révoqués) au même poste
  // — même niveau, même mairie ou même conseil — qu'un mandat plus récent a remplacés. Ils ne vivent
  // plus que dans l'historique de ce dernier (avec leur motif). Un refus n'a jamais été un mandat :
  // il n'y entre pas. Un révoqué sans successeur reste en vue, motif compris.
  const ENDED = ['expired', 'revoked']
  const samePost = (a, b) => a.level === b.level && a.place?.id === b.place?.id
  const isNewer = (a, b) => (a.started_at ?? '') > (b.started_at ?? '')
  const isSuperseded = (m) => ENDED.includes(m.status)
    && mandates.value.some(o => o.id !== m.id && samePost(o, m) && o.status !== 'rejected' && isNewer(o, m))
  const previousTerms = (mandate) => isSuperseded(mandate) ? [] : mandates.value
    .filter(m => m.id !== mandate.id && samePost(m, mandate) && ENDED.includes(m.status) && isNewer(mandate, m))
    .sort((a, b) => (b.started_at ?? '').localeCompare(a.started_at ?? ''))

  const isPast = (m) => m.status === 'expired' && !m.renewable
  const current = computed(() => mandates.value.filter(m => !isPast(m) && !isSuperseded(m)))
  const past = computed(() => mandates.value.filter(m => isPast(m) && !isSuperseded(m)))
  const requestable = computed(() => (store.characters ?? []).find(c => c.id === props.character.id)?.requestable ?? null)
  const canRequest = computed(() => !!(requestable.value?.mayor?.can_request || requestable.value?.council?.can_request))

  const label = (labels) => labels?.[locale.value] ?? ''
  // Année d'une date : décidée par le CHAMP (modules/playerDates.js), jamais par ce composant.
  const fieldDate = (field, value) => formatFieldDate(field, value, locale.value)

  const post = (mandate) => mandate.level === 'mayor'
    ? t('Profil.Mandates.Post.mayor', { place: mandate.place.name })
    : t('Profil.Mandates.Post.council', { place: mandate.place.name, office: label(mandate.office_label) })

  // Le libellé porte l'information ; la couleur ne fait que la redoubler.
  const STATUS_CLASS = {
    pending: 'border-blue-200 bg-blue-50 text-blue-800',
    elected: 'border-indigo-200 bg-indigo-50 text-indigo-800',
    active: 'border-green-200 bg-green-50 text-green-800',
    extended: 'border-yellow-300 bg-yellow-50 text-yellow-900',
    expired: 'border-gray-300 bg-gray-50 text-gray-800',
    rejected: 'border-red-200 bg-red-50 text-red-800',
    revoked: 'border-red-200 bg-red-50 text-red-800',
  }
  const statusText = (mandate) => t(`Profil.Mandates.Status.${mandate.status}`, {
    date: mandate.status === 'extended' ? fieldDate('holds_until', mandate.holds_until) : fieldDate('valid_until', mandate.valid_until),
  })

  const isInOffice = (mandate) => mandate.level === 'council' && ['active', 'extended'].includes(mandate.status)

  // Modales
  const requestOpen = ref(false)
  const renewOf = ref(null)
  const declareFor = ref(null)
  const openRequest = () => { renewOf.value = null; requestOpen.value = true }
  const openRenew = (mandate) => { renewOf.value = mandate; requestOpen.value = true }
  const onRequestDone = () => push.success(t(renewOf.value ? 'Profil.Mandates.RenewSent' : 'Profil.Mandates.RequestSent'))

  const cancelRequest = (mandate) => {
    trackApiCall(store.cancel(mandate))
      .then(() => push.success(t('Profil.Mandates.CancelDone')))
      .catch((error) => push.error(apiMessage(error, locale.value, t('Auth.Errors.NetworkError'))))
  }
</script>

<template>
  <!-- Panneau « Postes » : zone droite de la carte du personnage (ProfilView), teintée et séparée par
       un filet. En-tête = titre + « Demander un poste » ; un mandat = une ligne (icône de niveau,
       poste, statut aligné à droite), puis ses précisions et ses actions. Fond toujours clair :
       textes répétés en `dark:` à cause de `.dark p`. -->
  <section :aria-label="t('Profil.Mandates.Title')" data-testid="mandates-block">
    <div class="flex items-center justify-between gap-2 mb-3">
      <h4 class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-600">{{ t('Profil.Mandates.Title') }}</h4>
      <button v-if="character.is_validated && canRequest" type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--orange" data-testid="request-office" @click="openRequest">
        <v-icon name="ri-user-star-fill" />
        {{ t('Profil.Mandates.RequestButton') }}
      </button>
    </div>

    <p v-if="!character.is_validated" class="text-sm text-slate-700 dark:text-slate-700" data-testid="mandates-not-validated">
      {{ t('Profil.Mandates.NotValidated') }}
    </p>

    <template v-else>
      <p v-if="!current.length && !past.length" class="text-sm text-slate-600 dark:text-slate-600">{{ t('Profil.Mandates.Empty') }}</p>

      <ul class="space-y-2">
        <li v-for="mandate in current" :key="mandate.level + mandate.id" class="rounded-lg border border-slate-200 bg-white p-3 text-sm" data-testid="mandate-row">
          <div class="flex items-start gap-3">
            <span class="mt-0.5 h-8 w-8 shrink-0 rounded-full flex items-center justify-center" :class="mandate.level === 'mayor' ? 'bg-teal-100 text-teal-800' : 'bg-indigo-100 text-indigo-800'" aria-hidden="true">
              <v-icon name="ri-user-star-fill" scale="0.9" />
            </span>
            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <!-- Le poste en gras : le titre pour un conseiller, toute la ligne pour un maire. -->
                <p v-if="mandate.level === 'mayor'" class="font-bold text-slate-900 dark:text-slate-900">{{ post(mandate) }}</p>
                <i18n-t v-else keypath="Profil.Mandates.Post.council" tag="p" scope="global" class="text-slate-800 dark:text-slate-800">
                  <template #place>{{ mandate.place.name }}</template>
                  <template #office><strong class="font-bold text-slate-900">{{ label(mandate.office_label) }}</strong></template>
                </i18n-t>
                <span class="shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold" :class="STATUS_CLASS[mandate.status]" data-testid="mandate-status">
                  {{ statusText(mandate) }}
                </span>
              </div>

              <p v-if="mandate.decision_reason" class="mt-1 text-xs text-red-800 dark:text-red-800" data-testid="mandate-reason">
                {{ t('Profil.Mandates.Reason', { reason: label(mandate.decision_reason_label) }) }}
                <template v-if="mandate.decision_message">
                  — « {{ mandate.decision_message }} »
                  <span class="text-slate-600 dark:text-slate-600">({{ t(`Profil.Mandates.WrittenIn.${mandate.decision_message_locale ?? 'fr'}`) }})</span>
                </template>
              </p>
              <p v-if="mandate.office_change_pending" class="mt-1 text-xs text-slate-700 dark:text-slate-700">
                {{ t('Profil.Mandates.OfficePending', { office: label(mandate.pending_office_label) }) }}
              </p>
              <p v-else-if="isInOffice(mandate) && !mandate.office_key" class="mt-1 text-xs text-slate-600 dark:text-slate-600">
                {{ t('Profil.Mandates.NoOfficeWindow') }}
              </p>

              <div v-if="mandate.status === 'pending' || mandate.renewable || isInOffice(mandate)" class="mt-2 flex flex-wrap gap-2">
                <button v-if="isInOffice(mandate)" type="button" class="odc-btn odc-btn--quiet odc-btn--sm odc--blue" data-testid="declare-office" @click="declareFor = mandate">
                  <!-- Avec un poste : le bouton sert à en CHANGER (réattribution par le dirigeant). -->
                  <v-icon :name="mandate.office_key ? 'fa-exchange-alt' : 'ri-user-star-fill'" />
                  {{ mandate.office_key ? t('Profil.Mandates.ChangeOffice') : t('Profil.Mandates.DeclareOffice') }}
                </button>
                <button v-if="mandate.renewable" type="button" class="odc-btn odc-btn--quiet odc-btn--sm odc--green" data-testid="renew" @click="openRenew(mandate)">
                  <v-icon name="fa-sync-alt" />
                  {{ t('Profil.Mandates.Renew') }}
                </button>
                <button v-if="mandate.status === 'pending'" type="button" class="odc-btn odc-btn--quiet odc-btn--sm odc--red" data-testid="cancel-request" @click="cancelRequest(mandate)">
                  <v-icon name="fa-times" />
                  {{ t('Profil.Mandates.CancelRequest') }}
                </button>
              </div>

              <details v-if="mandate.office_history?.length || previousTerms(mandate).length" class="group mt-2 text-xs text-slate-700 dark:text-slate-700" data-testid="mandate-history">
                <summary class="inline-flex cursor-pointer list-none items-center gap-1 font-semibold [&::-webkit-details-marker]:hidden">
                  <v-icon name="fa-chevron-right" class="w-2.5 h-2.5 transition-transform group-open:rotate-90" />
                  {{ t('Profil.Mandates.History') }}
                </summary>
                <div class="mt-1 space-y-2 pl-1">
                  <div v-if="mandate.office_history?.length">
                    <p class="font-semibold text-slate-600 dark:text-slate-600">{{ t('Profil.Mandates.HistoryOffices') }}</p>
                    <ul class="mt-0.5 space-y-0.5 pl-4 list-disc">
                      <li v-for="(period, index) in mandate.office_history" :key="index" data-testid="office-period">
                        {{ t('Profil.Mandates.Period', { office: label(period.office_label), from: fieldDate('period_started_at', period.started_at), to: fieldDate('period_ended_at', period.ended_at), reason: label(period.end_reason_label) }) }}
                      </li>
                    </ul>
                  </div>
                  <div v-if="previousTerms(mandate).length">
                    <p class="font-semibold text-slate-600 dark:text-slate-600">{{ t('Profil.Mandates.HistoryTerms') }}</p>
                    <ul class="mt-0.5 space-y-0.5 pl-4 list-disc">
                      <li v-for="term in previousTerms(mandate)" :key="term.level + term.id" data-testid="previous-term">
                        {{ t('Profil.Mandates.Term', { from: term.in_office_from ? fieldDate('in_office_from', term.in_office_from) : fieldDate('started_at', term.started_at), to: fieldDate('holds_until', term.holds_until), status: t(`Profil.Mandates.Status.${term.status}`) }) }}
                        <template v-if="term.decision_reason_label"> ({{ label(term.decision_reason_label) }})</template>
                      </li>
                    </ul>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </li>
      </ul>

      <details v-if="past.length" class="group mt-3 text-sm">
        <summary class="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-700 [&::-webkit-details-marker]:hidden">
          <v-icon name="fa-chevron-right" class="w-2.5 h-2.5 transition-transform group-open:rotate-90" />
          {{ t('Profil.Mandates.Past', { count: past.length }) }}
        </summary>
        <ul class="mt-2 space-y-1">
          <li v-for="mandate in past" :key="mandate.level + mandate.id" class="flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-1.5 bg-white/60" data-testid="mandate-past">
            <span class="text-slate-700 dark:text-slate-700">{{ post(mandate) }}</span>
            <span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold" :class="STATUS_CLASS[mandate.status]" data-testid="mandate-status">
              {{ statusText(mandate) }}
            </span>
          </li>
        </ul>
      </details>
    </template>

    <MandateRequestModal
      :show="requestOpen"
      :character="character"
      :renew-of="renewOf"
      :requestable="requestable"
      @close="requestOpen = false"
      @done="onRequestDone"
    />
    <DeclareOfficeModal
      :show="declareFor !== null"
      :mandate="declareFor"
      @close="declareFor = null"
      @done="push.success(t('Profil.Mandates.DeclareSent'))"
    />
  </section>
</template>
