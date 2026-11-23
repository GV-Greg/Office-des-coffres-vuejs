<script setup>
  import { ref, reactive, computed, watch, onMounted } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { push } from 'notivue'
  import { useCookieStore } from '@/stores/cookieStore'
  import { useAuthStore } from '@/stores/authStore'
  import { apiMessage } from '@/stores/mandateStore'
  import { formatFieldDate } from '@/modules/playerDates'
  import { parseReleve, collectPseudos, buildLocalReport, localGameDay } from '@/modules/customsLocalReport'
  import { buildSections } from '@/modules/customsPaste'
  import { defaultCityId } from '@/modules/customsCity'
  import customsApi from '@/use/customsApi'
  import useCustomsAccess from '@/use/useCustomsAccess'
  import CustomsReportView from '@/components/customs/CustomsReportView.vue'
  import CustomsExport from '@/components/customs/CustomsExport.vue'

  /*
    Le Relevé de guet — POINT DE COLLAGE UNIQUE du module Sécurité (fil admin/echanges/module-securite 12 à 14, décisions de Greg du 22/11/2026).
    On y colle les cinq types : la liste des villageois (hier et aujourd'hui), les visions en chemin, les armées, les groupes et le contrôle de la zone.
    Même écran, même parseur (frontend, comme les mines), même mise en forme pour tous. Ce que le compte ajoute :
    - sans compte : tout se lit dans le navigateur ; avec le consentement « Préférences », le dernier collage de chaque type est gardé (jamais d'historique) ;
    - avec un titre de sécurité reconnu : les COULEURS des listes rouge et verte (appel `customs-preview`, qui ne reçoit que des pseudos et n'écrit rien),
      le différentiel du guet fait avec le DERNIER BILAN de la ville, et l'inscription au Registre de douane.
    ⚠️ Aucune règle côté site : droits, villes et jours viennent de `customs-access` ; un refus s'affiche tel quel, en FR ou EN.
  */
  const { t, locale } = useI18n()
  const cookieStore = useCookieStore()
  const authStore = useAuthStore()
  const api = customsApi()

  // Clés du stockage « confort » : le dernier collage de chaque type, remplacé à chaque nouveau (texte légal du 22/11/2026).
  const GUET_LAST_LIST_KEY = 'guet_last_list'
  const VISIONS_LAST_KEY = 'guet_last_visions'
  const ARMIES_LAST_KEY = 'guet_last_armies_groups'

  // ── Le titre de sécurité, s'il y en a un (le serveur décide) ──
  const character = computed(() => (authStore.isLoggedIn ? authStore.activeCharacter : null))
  const { access } = useCustomsAccess(() => character.value?.id ?? null)
  const cities = computed(() => access.value?.readable_cities ?? [])
  const cityId = ref(null)
  const day = ref(null)
  const city = computed(() => cities.value.find(c => c.id === cityId.value) ?? null)
  const canColour = computed(() => !!access.value?.read_lists)
  /** Mode « douanier » (Greg, 23/11/2026) : le titre permet d'inscrire au Registre, pas seulement de lire les marques. */
  const customsMode = computed(() => !!access.value?.write_reports && (access.value.writable_cities?.length ?? 0) > 0)
  const canSave = computed(() => !!access.value?.write_reports && !!city.value && access.value.writable_cities.some(c => c.id === city.value.id))

  watch(access, (value) => {
    cityId.value = defaultCityId(value?.readable_cities, character.value)
    day.value = value?.today ?? null
  }, { immediate: true })

  // Jours proposés à qui corrige (prévôt, connétable) : du plus ancien permis à aujourd'hui, que le serveur annonce.
  const dayOptions = computed(() => {
    if (!access.value?.correct_reports) return []
    const days = []
    for (let d = access.value.earliest_day; d <= access.value.today; d = nextIso(d)) days.push(d)
    return days.reverse()
  })
  function nextIso(iso) {
    const next = new Date(`${iso}T00:00:00Z`)
    next.setUTCDate(next.getUTCDate() + 1)
    return next.toISOString().slice(0, 10)
  }
  const dayLabel = iso => formatFieldDate('customs_report_day', iso, locale.value)

  // ── Les collages ──
  const yesterday = ref('')
  const today = ref('')
  const visions = ref('')
  const armiesGroups = ref('')
  const prefilledYesterday = ref(false)
  // Un collage retrouvé d'une visite précédente n'est JAMAIS inscrit au Registre tant qu'on ne l'a pas modifié.
  const restored = reactive({ visions: false, armiesGroups: false })

  onMounted(() => {
    const saved = cookieStore.getComfortData(GUET_LAST_LIST_KEY)
    if (saved) {
      yesterday.value = saved
      prefilledYesterday.value = true
    }
    const savedVisions = cookieStore.getComfortData(VISIONS_LAST_KEY)
    if (savedVisions) { visions.value = savedVisions; restored.visions = true }
    const savedArmies = cookieStore.getComfortData(ARMIES_LAST_KEY)
    if (savedArmies) { armiesGroups.value = savedArmies; restored.armiesGroups = true }
  })

  // ── Le résultat ──
  const parsed = ref(null)
  const report = ref(null)
  const busy = ref(false)
  const saving = ref(false)
  const previewError = ref('')

  const problems = computed(() => {
    const p = parsed.value
    if (!p) return []
    const found = []
    if (today.value.trim() && !p.guet?.villagers.length) found.push('guet_empty')
    if (visions.value.trim() && !p.visions?.kept.length) found.push('visions_none')
    if (armiesGroups.value.trim() && !(p.block?.armies.length || p.block?.groups.length || p.block?.zone)) found.push('armies_groups_empty')
    return found
  })
  const yesterdayMismatch = computed(() => (parsed.value?.yesterday?.totalMatches === false ? { declared: parsed.value.yesterday.declaredTotal, read: parsed.value.yesterday.villagers.length } : null))
  const guet = computed(() => report.value?.sections.guet ?? null)

  async function generate() {
    if (busy.value) return
    busy.value = true
    previewError.value = ''
    const withTitle = !!access.value
    const next = parseReleve({ guet: today.value, yesterday: yesterday.value, visions: visions.value, armiesGroups: armiesGroups.value }, withTitle ? day.value : null)
    parsed.value = next

    // Couleurs et dernier bilan de la ville : seulement avec un titre de sécurité, et seulement des PSEUDOS (le serveur n'écrit rien).
    let colours = null
    let previous = null
    const pseudos = collectPseudos(next)
    if (withTitle && pseudos.length && (canColour.value || city.value)) {
      try {
        const data = await api.preview(character.value.id, { pseudos, ...(city.value ? { city_id: city.value.id } : {}) })
        colours = data.colours
        previous = data.previous
      } catch (error) {
        previewError.value = apiMessage(error, locale.value, t('Auth.Errors.NetworkError'))
      }
    }
    report.value = buildLocalReport(next, { day: withTitle ? day.value : localGameDay(), colours, previous })

    // Confort : le dernier collage de chaque type. No-op silencieux sans le consentement « Préférences » : le Relevé reste utilisable.
    if (today.value.trim()) cookieStore.setComfortData(GUET_LAST_LIST_KEY, today.value)
    if (visions.value.trim()) cookieStore.setComfortData(VISIONS_LAST_KEY, visions.value)
    if (armiesGroups.value.trim()) cookieStore.setComfortData(ARMIES_LAST_KEY, armiesGroups.value)
    busy.value = false
  }

  // ── Inscription au Registre de douane (titre d'écriture, ville dite avant l'envoi) ──
  const sendable = computed(() => buildSections({
    guet: today.value,
    visions: restored.visions ? '' : visions.value,
    armiesGroups: restored.armiesGroups ? '' : armiesGroups.value,
  }, day.value ?? ''))

  async function save() {
    if (saving.value || !canSave.value || !Object.keys(sendable.value.sections).length) return
    saving.value = true
    try {
      const body = { city_id: city.value.id, sections: sendable.value.sections }
      if (day.value !== access.value.today) body.date = day.value
      const result = await api.saveReport(character.value.id, body)
      push.success(t(`SecurityCustoms.Form.Sent.${result.mode}`))
    } catch (error) {
      push.error(apiMessage(error, locale.value, t('Auth.Errors.NetworkError')))
    } finally {
      saving.value = false
    }
  }

  // ── Export du guet (format historique du Relevé : liste, entrées, sorties) ──
  const pseudoLines = list => list.map(entry => entry.pseudo)
  function toExport() {
    const villagers = pseudoLines(guet.value.villagers)
    const arrivals = pseudoLines(guet.value.diff?.arrivals ?? [])
    const departures = pseudoLines(guet.value.diff?.departures ?? [])
    const link = name => `[url=https://www.lesroyaumes.com/FichePersonnage.php?login=${name}]${name}[/url]`
    const text = `[size=15][color=blue][i]Liste des villageois (${villagers.length})[/i][/color][/size][quote]${villagers.map(link).join('\n')}[/quote]\n`
      + `[size=15][color=blue][i]Entrées (${arrivals.length})[/i][/color][/size]\n[quote]${arrivals.map(n => `[char]${n}[/char]`).join('\n')}[/quote]\n`
      + `[size=15][color=blue][i]Sorties (${departures.length})[/i][/color][/size]\n[quote]${departures.map(n => `[char]${n}[/char]`).join('\n')}[/quote]`
    navigator.clipboard.writeText(text)
  }
</script>

<template>
  <div class="w-full space-y-4" data-testid="guet-page">
    <div class="-mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
      <h1 class="!mt-0 bg-none text-3xl laptop:text-4xl text-rose-600" data-testid="guet-title">{{ t('Security.PageTitle') }}</h1>
      <p v-if="customsMode" class="mt-1 flex items-center gap-2 rounded-full border border-rose-300 bg-rose-50 px-4 py-1 text-sm font-semibold text-rose-800 dark:text-rose-800" data-testid="guet-customs-mode">
        <v-icon name="fa-user-shield" class="!block" aria-hidden="true" />{{ t('Security.CustomsMode') }}
      </p>
    </div>

    <!-- Avec un titre de sécurité : où l'on regarde (ville) et, pour qui corrige, le jour. Le serveur dit tout. -->
    <div v-if="access && (cities.length || dayOptions.length)" class="flex flex-wrap items-center justify-center gap-x-4 gap-y-2" data-testid="guet-registry-bar">
      <label v-if="cities.length" class="flex items-center gap-2 text-sm text-slate-800"><span class="font-bold">{{ t('SecurityCustoms.City') }}</span>
        <select v-model.number="cityId" class="rounded p-1" data-testid="guet-city">
          <option v-for="c in cities" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </label>
      <label v-if="dayOptions.length" class="flex items-center gap-2 text-sm text-slate-800"><span class="font-bold">{{ t('SecurityCustoms.Day') }}</span>
        <select v-model="day" class="rounded p-1" data-testid="guet-day">
          <option v-for="d in dayOptions" :key="d" :value="d">{{ dayLabel(d) }}</option>
        </select>
      </label>
      <p v-if="customsMode" class="!my-0 text-sm text-slate-700 dark:text-slate-700" data-testid="guet-customs-mode-detail">{{ t('Security.CustomsModeDetail') }}</p>
    </div>

    <div class="grid grid-cols-1 tablet:grid-cols-2 laptop:grid-cols-4 gap-4">
      <div>
        <label class="form-label block w-full text-center text-rose-700" for="guet-yesterday">{{ t('Security.YesterdayLabel') }}</label>
        <span class="block text-xs text-slate-600 dark:text-slate-600 text-center mb-1">{{ t('Security.YesterdayHint') }}</span>
        <textarea id="guet-yesterday" v-model="yesterday" rows="12" class="textarea-autoresize w-full rounded-xl p-2" data-testid="paste-yesterday" @input="prefilledYesterday = false"></textarea>
        <span v-if="prefilledYesterday" class="block text-xs text-slate-500 dark:text-slate-400 text-center italic" data-testid="yesterday-prefilled">{{ t('Security.YesterdayPrefilled') }}</span>
      </div>
      <div>
        <label class="form-label block w-full text-center text-rose-700" for="guet-today">{{ t('Security.TodayLabel') }}</label>
        <span class="block text-xs text-slate-600 dark:text-slate-600 text-center mb-1">{{ t('Security.TodayHint') }}</span>
        <textarea id="guet-today" v-model="today" rows="12" class="textarea-autoresize w-full rounded-xl p-2" data-testid="paste-today"></textarea>
      </div>
      <div>
        <label class="form-label block w-full text-center text-rose-700" for="guet-visions">{{ t('Security.VisionsLabel') }}</label>
        <span class="block text-xs text-slate-600 dark:text-slate-600 text-center mb-1">{{ t('Security.VisionsHint') }}</span>
        <textarea id="guet-visions" v-model="visions" rows="12" class="textarea-autoresize w-full rounded-xl p-2" data-testid="paste-visions" @input="restored.visions = false"></textarea>
        <span v-if="restored.visions" class="block text-xs text-slate-500 dark:text-slate-400 text-center italic" data-testid="visions-restored">{{ t('Security.Restored') }}</span>
      </div>
      <div>
        <label class="form-label block w-full text-center text-rose-700" for="guet-armies">{{ t('Security.ArmiesGroupsLabel') }}</label>
        <span class="block text-xs text-slate-600 dark:text-slate-600 text-center mb-1">{{ t('Security.ArmiesGroupsHint') }}</span>
        <textarea id="guet-armies" v-model="armiesGroups" rows="12" class="textarea-autoresize w-full rounded-xl p-2" data-testid="paste-armies-groups" @input="restored.armiesGroups = false"></textarea>
        <span v-if="restored.armiesGroups" class="block text-xs text-slate-500 dark:text-slate-400 text-center italic" data-testid="armies-restored">{{ t('Security.Restored') }}</span>
      </div>
    </div>

    <div class="flex justify-center">
      <button type="button" class="odc-btn odc-btn--soft odc--green" :disabled="busy" data-testid="guet-generate" @click="generate"><v-icon name="gi-quill" aria-hidden="true" />{{ t('Security.GenerateButton') }}</button>
    </div>

    <section v-if="report" class="space-y-3" data-testid="guet-result">
      <h3 class="!mb-0 text-lg font-bold text-slate-800 dark:text-slate-800" data-testid="guet-result-title">
        {{ city ? t('Security.ResultTitleCity', { date: dayLabel(report.reported_on), city: city.name }) : t('Security.ResultTitle', { date: dayLabel(report.reported_on) }) }}
      </h3>

      <p v-if="previewError" role="alert" class="text-sm font-bold text-orange-800 dark:text-orange-800" data-testid="guet-preview-error">{{ t('Security.PreviewFailed', { message: previewError }) }}</p>
      <p v-if="yesterdayMismatch" role="alert" class="text-sm font-bold text-orange-800 dark:text-orange-800" data-testid="yesterday-mismatch">
        {{ t('Security.MismatchYesterday', yesterdayMismatch) }}
      </p>
      <p v-for="problem in problems" :key="problem" role="alert" class="text-sm font-bold text-orange-800 dark:text-orange-800" data-testid="guet-problem">{{ t(`SecurityCustoms.Form.Problem.${problem}`) }}</p>
      <p v-if="parsed?.visions?.assumed && parsed.visions.kept.length" class="text-xs text-slate-700 dark:text-slate-700" data-testid="guet-visions-assumed">{{ t('Security.VisionsAssumed', { date: dayLabel(parsed.visions.day) }) }}</p>
      <p v-if="!report.sections_present.length && !problems.length" class="text-sm text-slate-700 dark:text-slate-700" data-testid="guet-nothing">{{ t('Security.NothingToShow') }}</p>

      <CustomsReportView v-if="report.sections_present.length" :report="report" link-diff />

      <div v-if="report.sections_present.length" class="flex flex-wrap items-start gap-3">
        <button v-if="guet" type="button" class="odc-btn odc-btn--soft odc--green" data-testid="guet-export" @click="toExport"><v-icon name="gi-quill" aria-hidden="true" />{{ t('Security.ExportButton') }}</button>
        <CustomsExport :report="report" :city-name="city?.name ?? ''" :title="t('Security.ExportDefenceTitle')" class="flex-1 min-w-[18rem]" />
      </div>

      <!-- Inscription : seulement avec un titre d'écriture ; la ville et le jour sont DITS avant l'envoi. -->
      <div v-if="canSave" class="rounded-lg border border-slate-300 bg-white p-3 space-y-2" data-testid="guet-save-box">
        <p class="text-sm text-slate-800 dark:text-slate-800" data-testid="guet-save-target">{{ t('SecurityCustoms.Form.WritesIn', { city: city.name, date: dayLabel(day) }) }}</p>
        <p v-if="restored.visions || restored.armiesGroups" class="text-xs text-slate-700 dark:text-slate-700" data-testid="guet-save-restored">{{ t('Security.RestoredNotSaved') }}</p>
        <button type="button" class="odc-btn odc-btn--soft odc--green" :disabled="saving || !Object.keys(sendable.sections).length" data-testid="guet-save" @click="save">
          <v-icon name="gi-quill" aria-hidden="true" />{{ saving ? t('SecurityCustoms.Form.Sending') : t('SecurityCustoms.Form.Send') }}
        </button>
      </div>
    </section>
  </div>
</template>
