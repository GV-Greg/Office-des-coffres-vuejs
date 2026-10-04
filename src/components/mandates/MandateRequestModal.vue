<script setup>
  import { ref, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { push } from 'notivue'
  import CityCascadeSelect from '@/components/forms/CityCascadeSelect.vue'
  import { useMandateStore, apiFieldErrors, apiMessage } from '@/stores/mandateStore'
  import useDialogFocus from '@/use/useDialogFocus'
  import useNavigationLoading from '@/use/useNavigationLoading'
  import { toGameDateIso, toRealDateIso } from '@/modules/gameCalendar'

  /*
    Demande de poste — ou renouvellement (`renewOf`) — pour un personnage validé (mandats, lot 2).
    Renouvellement : niveau et lieu verrouillés, date préremplie, lien vide et obligatoire, et
    AUCUN titre — tous les postes sont vidés à l'élection du dirigeant, un renouvellement qui
    reprendrait l'ancien serait faux (fil mandats-lot1, Q14). Le titre d'une première inscription
    est facultatif. Les refus viennent de l'API, déjà dans la langue de l'interface.
  */
  const props = defineProps({
    show: { type: Boolean, required: true },
    character: { type: Object, required: true },   // { id, pseudo, city_id }
    renewOf: { type: Object, default: null },       // mandat renouvelé, ou null
    // { mayor: { can_request, blocked_by }, council: {…} } — règle de l'API (Q6), jamais recodée.
    requestable: { type: Object, default: null },
  })
  const levelOpen = (value) => props.requestable?.[value]?.can_request !== false
  const emit = defineEmits(['close', 'done'])

  const { t, locale } = useI18n()
  const store = useMandateStore()
  const { trackApiCall } = useNavigationLoading()

  const panel = ref(null)
  const close = () => emit('close')
  useDialogFocus(computed(() => props.show), panel, close)

  const isRenewal = computed(() => props.renewOf !== null)
  const level = ref('mayor')
  const cityId = ref('')
  const provinceId = ref('')
  const officeKey = ref('')
  const startedAt = ref('')
  const announcementUrl = ref('')
  const errors = ref({})
  const generalError = ref('')
  const submitting = ref(false)

  // Date du jour dans le fuseau du jeu, au format AAAA-MM-JJ (le serveur tranche).
  // Le joueur lit et saisit l'ANNÉE DU JEU (1474) ; la date part en année réelle à l'API.
  // `startedAt` est donc en année du jeu, les comparaisons se font en année réelle.
  const realDate = (date) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(date)
  const today = computed(() => realDate(new Date()))
  const todayInGame = computed(() => toGameDateIso(today.value))

  watch(() => props.show, (open) => {
    if (!open) return
    errors.value = {}
    generalError.value = ''
    submitting.value = false
    announcementUrl.value = ''
    officeKey.value = ''
    if (isRenewal.value) {
      level.value = props.renewOf.level
      // Préremplie à la fin du mandat renouvelé (date d'élection présumée), jamais dans le futur.
      const end = realDate(new Date(props.renewOf.valid_until))
      startedAt.value = toGameDateIso(end > today.value ? today.value : end)
    } else {
      level.value = levelOpen('mayor') ? 'mayor' : 'council'
      cityId.value = props.character.city_id ?? ''
      provinceId.value = ''
      startedAt.value = ''
    }
    store.fetchOffices().catch(() => {})
  }, { immediate: true })

  const officeOptions = computed(() => store.offices.map(o => ({ key: o.key, label: o.label?.[locale.value] ?? o.key })))

  // Vérifications de confort côté client ; le serveur reste seul juge (et renvoie ses messages).
  const validate = () => {
    const found = {}
    if (!isRenewal.value && level.value === 'mayor' && !cityId.value) found.city_id = t('Profil.Mandates.Form.Errors.PlaceRequired')
    if (!isRenewal.value && level.value === 'council' && !provinceId.value) found.province_id = t('Profil.Mandates.Form.Errors.PlaceRequired')
    if (!startedAt.value) found.started_at = t('Profil.Mandates.Form.Errors.DateRequired')
    else if (toRealDateIso(startedAt.value) > today.value) found.started_at = t('Profil.Mandates.Form.Errors.DateFuture')
    if (!announcementUrl.value) found.announcement_url = t('Profil.Mandates.Form.Errors.UrlRequired')
    else if (!announcementUrl.value.startsWith('https://')) found.announcement_url = t('Profil.Mandates.Form.Errors.UrlHttps')
    errors.value = found
    return Object.keys(found).length === 0
  }

  const submit = () => {
    if (submitting.value || !validate()) return
    submitting.value = true
    generalError.value = ''

    const call = isRenewal.value
      ? store.renew(props.renewOf, { started_at: toRealDateIso(startedAt.value), announcement_url: announcementUrl.value })
      : store.requestMandate(props.character.id, {
          level: level.value,
          ...(level.value === 'mayor' ? { city_id: Number(cityId.value) } : { province_id: Number(provinceId.value) }),
          ...(level.value === 'council' && officeKey.value ? { council_office_key: officeKey.value } : {}),
          started_at: toRealDateIso(startedAt.value),
          announcement_url: announcementUrl.value,
        })

    trackApiCall(call)
      .then(() => {
        emit('done')
        close()
      })
      .catch((error) => {
        const fields = apiFieldErrors(error, locale.value)
        errors.value = fields
        // Un refus sans champ affichable ici (personnage, mandat…) va sous le formulaire.
        const shown = ['city_id', 'province_id', 'council_office_key', 'started_at', 'announcement_url']
        const others = Object.entries(fields).filter(([field]) => !shown.includes(field)).map(([, message]) => message)
        generalError.value = others[0] ?? (Object.keys(fields).length ? '' : apiMessage(error, locale.value, t('Auth.Errors.NetworkError')))
        // Toujours une notification, en plus du message sous le champ : sur un formulaire long, le
        // champ en erreur peut être hors de vue.
        push.error(apiMessage(error, locale.value, t('Auth.Errors.NetworkError')))
      })
      .finally(() => { submitting.value = false })
  }

  const placeName = computed(() => props.renewOf?.place?.name ?? '')
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="mandate-request-title"
  >
    <div class="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" @click="close"></div>

    <div ref="panel" class="relative w-full max-w-lg laptop:max-w-4xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
      <div class="h-1.5 bg-gradient-to-r from-orange-400 to-red-600 shrink-0"></div>

      <form class="p-6 overflow-y-auto space-y-4" novalidate @submit.prevent="submit">
        <h3 id="mandate-request-title" class="text-lg font-bold text-slate-800 dark:text-slate-100">
          {{ isRenewal ? t('Profil.Mandates.Form.RenewTitle', { pseudo: character.pseudo }) : t('Profil.Mandates.Form.Title', { pseudo: character.pseudo }) }}
        </h3>

        <!-- Deux colonnes à partir de laptop (pas de défilement sur ordinateur) : niveau et lieu à
             gauche, titre, date et lien à droite. Empilé en dessous. -->
        <div class="grid grid-cols-1 laptop:grid-cols-2 gap-4 laptop:gap-6">
        <div class="space-y-4">
        <!-- 1. Niveau -->
        <fieldset :disabled="isRenewal">
          <legend class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">{{ t('Profil.Mandates.Form.Level') }}</legend>
          <div class="flex flex-wrap gap-4 text-sm text-slate-800 dark:text-slate-100">
            <label class="inline-flex items-center gap-2"><input v-model="level" type="radio" value="mayor" :disabled="!isRenewal && !levelOpen('mayor')" data-testid="level-mayor"> {{ t('Profil.Mandates.Level.mayor') }}</label>
            <label class="inline-flex items-center gap-2"><input v-model="level" type="radio" value="council" :disabled="!isRenewal && !levelOpen('council')" data-testid="level-council"> {{ t('Profil.Mandates.Level.council') }}</label>
          </div>
        </fieldset>

        <!-- 2. Lieu : présélectionné sur la résidence, modifiable ; verrouillé au renouvellement. -->
        <div>
          <p v-if="isRenewal" class="text-sm text-slate-700 dark:text-slate-300" data-testid="locked-place">
            {{ t('Profil.Mandates.Form.Place') }} : <strong>{{ placeName }}</strong>
          </p>
          <template v-else>
            <CityCascadeSelect v-if="level === 'mayor'" :key="'mayor'" v-model="cityId" />
            <CityCascadeSelect v-else :key="'council'" v-model="provinceId" stop-at="province" :initial-city-id="character.city_id ?? ''" />
            <p class="text-xs text-slate-600 dark:text-slate-400">{{ t('Profil.Mandates.Form.PlaceHelp') }}</p>
            <p v-if="errors.city_id || errors.province_id" class="mt-1 text-sm font-semibold text-red-600 dark:text-red-400" data-testid="error-place">{{ errors.city_id || errors.province_id }}</p>
          </template>
        </div>

        </div>
        <div class="space-y-4">
        <!-- 3. Titre : conseil, première inscription seulement, facultatif. -->
        <div v-if="level === 'council' && !isRenewal">
          <label for="mandate-office" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">{{ t('Profil.Mandates.Form.Office') }}</label>
          <select id="mandate-office" v-model="officeKey" data-testid="office-select" class="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2">
            <option value="">{{ t('Profil.Mandates.Form.OfficeNone') }}</option>
            <option v-for="office in officeOptions" :key="office.key" :value="office.key">{{ office.label }}</option>
          </select>
          <p class="text-xs text-slate-600 dark:text-slate-400">{{ t('Profil.Mandates.Form.OfficeHelp') }}</p>
          <p v-if="errors.council_office_key" class="mt-1 text-sm font-semibold text-red-600 dark:text-red-400">{{ errors.council_office_key }}</p>
        </div>

        <!-- 4. Date de début -->
        <div>
          <label for="mandate-start" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">{{ t('Profil.Mandates.Form.StartedAt') }}</label>
          <input id="mandate-start" v-model="startedAt" type="date" :max="todayInGame" data-testid="started-at" class="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2">
          <p v-if="level === 'council'" class="text-xs text-slate-600 dark:text-slate-400">{{ t('Profil.Mandates.Form.StartedAtCouncilHelp') }}</p>
          <p v-if="errors.started_at" class="mt-1 text-sm font-semibold text-red-600 dark:text-red-400" data-testid="error-started-at">{{ errors.started_at }}</p>
        </div>

        <!-- 5. Lien vers l'annonce publique -->
        <div>
          <label for="mandate-url" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">{{ t('Profil.Mandates.Form.Announcement') }}</label>
          <input id="mandate-url" v-model="announcementUrl" type="url" inputmode="url" placeholder="https://" data-testid="announcement-url" class="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2">
          <p class="text-xs text-slate-600 dark:text-slate-400">{{ t('Profil.Mandates.Form.AnnouncementHelp') }}</p>
          <p v-if="errors.announcement_url" class="mt-1 text-sm font-semibold text-red-600 dark:text-red-400" data-testid="error-url">{{ errors.announcement_url }}</p>
        </div>

        </div>
        </div>

        <!-- 6. Information -->
        <p class="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{{ t('Profil.Mandates.Form.Info') }}</p>

        <p v-if="generalError" class="text-sm font-semibold text-red-600 dark:text-red-400" data-testid="error-general">{{ generalError }}</p>

        <div class="flex flex-wrap items-center justify-end gap-3">
          <button type="button" class="odc-btn odc-btn--quiet odc-btn--sm odc--slate" @click="close">{{ t('Profil.Mandates.Cancel') }}</button>
          <button type="submit" class="odc-btn odc-btn--soft odc--orange" :disabled="submitting" data-testid="submit-request">
            {{ t('Profil.Mandates.Form.Submit') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
