<script setup>
  import { ref, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { push } from 'notivue'
  import { apiMessage } from '@/stores/mandateStore'
  import { formatFieldDate } from '@/modules/playerDates'
  import customsApi from '@/use/customsApi'

  /*
    « Valider les douaniers » de sa province : les demandes en attente (le demandeur l'a voulue, son pseudo n'est donc pas celui d'un tiers), les douaniers
    en vigueur, et la durée d'inactivité. Cascade de validation : niveau 1 = prévôt ou connétable ; niveau 2 = capitaine, dirigeant ou maire, SEULEMENT
    si ni prévôt ni connétable n'est connu de l'Office — l'état COURANT d'une province, dit à l'écran. ⚠️ Aucune règle ici : le serveur dit le niveau et
    qui peut décider ; un refus s'affiche tel quel. Avec un trio connu, l'inactivité est SIGNALÉE et le trio décide ; sans trio, l'accès est retiré
    automatiquement (avis à 7 jours).
  */
  const props = defineProps({
    character: { type: Object, required: true },
    decider: { type: Object, required: true }, // state.decider
  })
  const emit = defineEmits(['changed'])

  const { t, locale } = useI18n()
  const api = customsApi()

  const days = ref(props.decider.inactivity_days)
  const busy = ref(false)
  const confirmingRevoke = ref(null)
  const date = (field, value) => formatFieldDate(field, value, locale.value)

  watch(() => props.decider.inactivity_days, value => { days.value = value })

  const daysValid = computed(() => Number.isInteger(Number(days.value)) && days.value >= props.decider.inactivity_min && days.value <= props.decider.inactivity_max)

  async function run(action, success) {
    busy.value = true
    try {
      await action()
      push.success(success)
      confirmingRevoke.value = null
      emit('changed')
    } catch (error) {
      push.error(apiMessage(error, locale.value, t('Auth.Errors.NetworkError')))
    } finally {
      busy.value = false
    }
  }

  const decide = (action, officer, success) => run(() => api.decideOfficer(action, officer.id), success)
  const saveDays = () => run(() => api.setInactivityDays(props.character.id, Number(days.value)), t('SecurityOfficers.Decisions.DaysSaved'))
</script>

<template>
  <!-- Le titre (« Valider les douaniers de {province} ») est celui de l'onglet de Mon bureau : pas de second cadre ni de second titre ici. Deux colonnes sur
       ordinateur — à gauche ce qu'on traite (demandes, puis douaniers en vigueur), à droite le réglage de la province. Fond toujours clair : textes
       répétés en `dark:` à cause de `.dark p`. -->
  <div class="space-y-4" data-testid="officer-decisions">
    <div class="space-y-2">
      <p class="text-sm text-slate-800 dark:text-slate-800" data-testid="decider-level">{{ t(`SecurityOfficers.Decisions.Level${decider.level}`) }}</p>
      <p v-if="!decider.has_security_trio" class="rounded border border-orange-500 bg-orange-100 px-3 py-2 text-sm text-orange-900 dark:text-orange-900" role="note" data-testid="decider-no-trio">
        {{ t('SecurityOfficers.Decisions.NoTrio') }}
      </p>
    </div>

    <div class="grid gap-5 laptop:grid-cols-3 items-start">
      <div class="laptop:col-span-2 space-y-5">
        <!-- Demandes en attente. -->
        <section aria-labelledby="officers-pending-title">
          <div class="flex items-center gap-2 pb-2 mb-3 border-b border-violet-200">
            <span class="w-1 h-5 bg-violet-500 rounded-full shrink-0" aria-hidden="true"></span>
            <h3 id="officers-pending-title" class="!mt-0 !mb-0 text-sm font-bold text-violet-800 dark:text-violet-800">{{ t('SecurityOfficers.Decisions.Pending', { count: decider.pending.length }) }}</h3>
          </div>
          <p v-if="!decider.pending.length" class="text-sm text-slate-700 dark:text-slate-700" data-testid="decider-no-pending">{{ t('SecurityOfficers.Decisions.NoPending') }}</p>
          <ul v-else class="space-y-2" data-testid="decider-pending">
            <li v-for="row in decider.pending" :key="row.id" class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2" :data-officer="row.id">
              <span class="font-bold text-slate-800">{{ row.pseudo }}</span>
              <span class="text-sm text-slate-700">{{ t('SecurityOfficers.Decisions.PendingLine', { city: row.city.name, date: date('customs_requested_at', row.requested_at) }) }}</span>
              <span class="ml-auto flex gap-2">
                <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--green" :disabled="busy" data-testid="officer-approve" @click="decide('approve', row, t('SecurityOfficers.Decisions.Approved'))">
                  <v-icon name="fa-check" aria-hidden="true" />{{ t('SecurityOfficers.Decisions.Approve') }}
                </button>
                <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--red" :disabled="busy" data-testid="officer-reject" @click="decide('reject', row, t('SecurityOfficers.Decisions.Rejected'))">
                  <v-icon name="fa-times" aria-hidden="true" />{{ t('SecurityOfficers.Decisions.Reject') }}
                </button>
              </span>
            </li>
          </ul>
        </section>

        <!-- Douaniers en vigueur. -->
        <section aria-labelledby="officers-active-title">
          <div class="flex items-center gap-2 pb-2 mb-3 border-b border-violet-200">
            <span class="w-1 h-5 bg-violet-500 rounded-full shrink-0" aria-hidden="true"></span>
            <h3 id="officers-active-title" class="!mt-0 !mb-0 text-sm font-bold text-violet-800 dark:text-violet-800">{{ t('SecurityOfficers.Decisions.Officers', { count: decider.officers.length }) }}</h3>
          </div>
          <p v-if="!decider.officers.length" class="text-sm text-slate-700 dark:text-slate-700" data-testid="decider-no-officers">{{ t('SecurityOfficers.Decisions.NoOfficers') }}</p>
          <ul v-else class="space-y-2" data-testid="decider-officers">
            <li v-for="row in decider.officers" :key="row.id" class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2" :data-officer="row.id">
              <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span class="font-bold text-slate-800">{{ row.pseudo }}</span>
                <span class="text-sm text-slate-700">{{ t('SecurityOfficers.Decisions.OfficerLine', { city: row.city.name, date: date('customs_in_office_from', row.in_office_from) }) }}</span>
                <span class="ml-auto flex items-center gap-2">
                  <template v-if="confirmingRevoke === row.id">
                    <span class="text-sm font-bold text-slate-800">{{ t('SecurityOfficers.Decisions.RevokeConfirm') }}</span>
                    <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--red" :disabled="busy" data-testid="officer-revoke-confirm" @click="decide('revoke', row, t('SecurityOfficers.Decisions.Revoked'))">{{ t('SecurityOfficers.Decisions.RevokeYes') }}</button>
                    <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--slate" @click="confirmingRevoke = null">{{ t('SecurityOfficers.Cancel') }}</button>
                  </template>
                  <button v-else type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--red" :disabled="busy" data-testid="officer-revoke" @click="confirmingRevoke = row.id">{{ t('SecurityOfficers.Decisions.Revoke') }}</button>
                </span>
              </div>
              <!-- Le SENS est dans le texte, jamais dans la couleur seule. -->
              <p v-if="row.inactive" class="mt-1 text-sm font-bold text-orange-800 dark:text-orange-800" data-testid="officer-inactive">
                <v-icon name="fa-exclamation-triangle" scale="0.7" aria-hidden="true" />
                {{ t(decider.has_security_trio ? 'SecurityOfficers.Decisions.InactiveSignal' : 'SecurityOfficers.Decisions.InactiveAuto', { date: date('customs_lapses_at', row.lapses_at) }) }}
              </p>
              <p v-else-if="row.last_report_at" class="mt-1 text-xs text-slate-600 dark:text-slate-600">{{ t('SecurityOfficers.Decisions.LastReport', { date: date('customs_last_report_at', row.last_report_at) }) }}</p>
            </li>
          </ul>
        </section>
      </div>

      <!-- Durée d'inactivité de la province : un réglage, à part de la file. -->
      <form class="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2" data-testid="officer-settings" @submit.prevent="saveDays">
        <label class="block text-sm font-bold text-slate-800" for="inactivity-days">{{ t('SecurityOfficers.Decisions.DaysLabel') }}</label>
        <p class="text-xs text-slate-700 dark:text-slate-700">{{ t('SecurityOfficers.Decisions.DaysHelp', { min: decider.inactivity_min, max: decider.inactivity_max, default: decider.inactivity_default }) }}</p>
        <div class="flex items-center gap-2">
          <input id="inactivity-days" v-model.number="days" type="number" :min="decider.inactivity_min" :max="decider.inactivity_max" class="w-24 rounded p-1" data-testid="inactivity-days">
          <button type="submit" class="odc-btn odc-btn--soft odc-btn--sm odc--green" :disabled="busy || !daysValid" data-testid="inactivity-save">{{ t('SecurityOfficers.Decisions.DaysSave') }}</button>
        </div>
      </form>
    </div>
  </div>
</template>
