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
  import { rememberLists, yesterdaysList, shiftIso } from '@/modules/customsLists'
  import customsApi from '@/use/customsApi'
  import useCustomsAccess from '@/use/useCustomsAccess'
  import { customsReportToBBCode, CUSTOMS_EXPORT_DEFAULTS } from '@/modules/customsBBcode'
  import CustomsRegistrySave from '@/components/customs/CustomsRegistrySave.vue'
import ExistingReportNotice from '@/components/customs/ExistingReportNotice.vue'

  /*
    Le Relevé de guet — POINT DE COLLAGE UNIQUE du module Sécurité (22/11/2026).
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
  const GUET_LISTS_KEY = 'guet_lists' // { jour du jeu: liste } — aujourd'hui et hier seulement (modules/customsLists.js)
  const GUET_OLD_LIST_KEY = 'guet_last_list' // ancienne clé : une liste SANS jour, abandonnée
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
    // La liste d'hier est celle gardée avec le jour d'HIER : celle d'aujourd'hui, déjà collée, ne la remplace plus au rechargement.
    cookieStore.removeComfortData(GUET_OLD_LIST_KEY)
    const lists = cookieStore.getComfortData(GUET_LISTS_KEY, {})
    const gameToday = localGameDay()
    const saved = yesterdaysList(lists, gameToday)
    if (saved) {
      yesterday.value = saved
      prefilledYesterday.value = true
    }
    // Collée plus tôt AUJOURD'HUI : la liste du jour revient dans sa case, comme les visions et les armées du jour (on peut inscrire après un rechargement).
    if (lists[gameToday]) today.value = lists[gameToday]
    // Visions et armées sont gardées AVEC leur jour du jeu. Collées plus tôt AUJOURD'HUI, elles sont bien d'aujourd'hui : remplies, et inscriptibles.
    // Les ARMÉES d'un autre jour (ou sans jour : ancienne forme) sont « retrouvées » : la mention le dit, mais elles s'inscrivent TELLES QUELLES (Greg, 23/11/2026).
    // Les VISIONS, elles, sont celles d'UNE nuit : la case repart VIDE chaque jour (Greg, 24/11/2026 : « reprendre ceux de la veille ne sert à rien »), et
    // celles d'un autre jour sont effacées du navigateur plutôt que gardées pour rien.
    const restore = (key, target, flag, sameDayOnly = false) => {
      const saved = cookieStore.getComfortData(key)
      const entry = typeof saved === 'string' ? { day: null, text: saved } : saved
      if (!entry?.text) return
      if (sameDayOnly && entry.day !== gameToday) {
        cookieStore.removeComfortData(key)
        return
      }
      target.value = entry.text
      restored[flag] = entry.day !== gameToday
    }
    restore(VISIONS_LAST_KEY, visions, 'visions', true)
    restore(ARMIES_LAST_KEY, armiesGroups, 'armiesGroups')
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
  // Le message pour le forum (BBCode, français fixe, dates en année du jeu) : « Confier au scribe » le fabrique ET le copie. Rien n'est enregistré.
  const bbcode = ref('')
  const copyFailed = ref(false)
  const sealed = ref(null)
  // Les collages reconnus, dans l'ordre des champs : ils accompagnent le message en spoiler.
  const recognisedPastes = (next, pastes) => [
    next.yesterday?.villagers.length && pastes.yesterday,
    next.guet?.villagers.length && pastes.guet,
    next.visions?.kept.length && pastes.visions,
    (next.block?.armies.length || next.block?.groups.length || next.block?.zone) && pastes.armiesGroups,
  ].filter(Boolean)
  function buildBBCode(built, sources) {
    const diff = built.sections?.guet?.diff
    const withDates = diff?.compared_to
      ? { ...built, sections: { ...built.sections, guet: { ...built.sections.guet, diff: { ...diff, comparedLabel: formatFieldDate('customs_report_day', diff.compared_to, 'fr') } } } }
      : built
    return customsReportToBBCode(withDates, {
      cityName: city.value?.name ?? '',
      dayLabel: formatFieldDate('customs_report_day', built.reported_on, 'fr'),
      nightFromLabel: formatFieldDate('customs_report_day', shiftIso(built.reported_on, -1), 'fr'),
      options: { ...CUSTOMS_EXPORT_DEFAULTS },
      sources,
    })
  }
  async function copyBBCode() {
    copyFailed.value = false
    try {
      await navigator.clipboard.writeText(bbcode.value)
      push.success(t('SecurityCustoms.Export.Copied'))
    } catch {
      // presse-papiers indisponible (contexte non sécurisé, iframe…) : le message est alors montré, à copier à la main
      copyFailed.value = true
    }
  }

  async function generate() {
    if (busy.value) return
    busy.value = true
    previewError.value = ''
    const withTitle = !!access.value
    const pastes = { guet: today.value, yesterday: yesterday.value, visions: visions.value, armiesGroups: armiesGroups.value }
    const next = parseReleve(pastes, withTitle ? day.value : null)
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
    sealed.value = null
    bbcode.value = report.value.sections_present.length ? buildBBCode(report.value, recognisedPastes(next, pastes)) : ''
    if (bbcode.value) await copyBBCode()

    // Confort : le dernier collage de chaque type. No-op silencieux sans le consentement « Préférences » : le Relevé reste utilisable.
    if (today.value.trim() || yesterday.value.trim()) {
      cookieStore.setComfortData(GUET_LISTS_KEY, rememberLists(cookieStore.getComfortData(GUET_LISTS_KEY, {}), {
        day: withTitle ? day.value : localGameDay(), today: localGameDay(), todayText: today.value, yesterdayText: yesterday.value,
      }))
    }
    const pastedDay = withTitle ? day.value : localGameDay()
    // Un collage RETROUVÉ n'est pas réenregistré sous le jour d'aujourd'hui : il n'a pas été collé aujourd'hui tant qu'on ne l'a pas modifié.
    if (visions.value.trim() && !restored.visions) cookieStore.setComfortData(VISIONS_LAST_KEY, { day: pastedDay, text: visions.value })
    if (armiesGroups.value.trim() && !restored.armiesGroups) cookieStore.setComfortData(ARMIES_LAST_KEY, { day: pastedDay, text: armiesGroups.value })
    busy.value = false
  }

  // ── Inscription au Registre de douane (titre d'écriture, ville dite avant l'envoi) ──
  const sendable = computed(() => buildSections({
    guet: today.value,
    visions: visions.value,
    armiesGroups: armiesGroups.value,
  }, day.value ?? ''))

  // ── Le relevé de ce jour existe-t-il déjà ? (Greg, 24/11/2026 : « que ce soit visible dans le relevé du guet ») — lecture seule, avant l'envoi ──
  const existing = ref(null)
  const existingKey = () => `${character.value?.id}|${city.value?.id}|${day.value}`
  async function loadExisting() {
    existing.value = null
    if (!canSave.value || !character.value || !day.value) return
    const asked = existingKey()
    try {
      const data = await api.reports(character.value.id, city.value.id, day.value)
      if (asked !== existingKey()) return // une réponse périmée (autre ville ou autre jour entre-temps)
      if (data?.report) existing.value = { date: dayLabel(day.value), sections: data.report.sections_present ?? [] }
    } catch {
      existing.value = null // sans droit de lecture ou hors ligne : rien n'est dit, l'inscription reste possible
    }
  }
  watch([() => character.value?.id, cityId, day, canSave, sealed], loadExisting, { immediate: true })

  // Une case VIDÉE retire sa section du relevé existant (Greg, 24/11/2026 : des visions inscrites par mégarde restaient) — seulement les visions et les armées/groupes
  // (jamais le guet), seulement si le relevé du jour les contient, et seulement pour une case laissée vide. Le serveur dit si on en a le droit.
  const removals = computed(() => ['visions', 'armies_groups'].filter(key => existing.value?.sections.includes(key) && !sendable.value.sections[key]))
  const nothingToSend = computed(() => !Object.keys(sendable.value.sections).length && !removals.value.length)

  async function save() {
    if (saving.value || !canSave.value || nothingToSend.value) return
    saving.value = true
    try {
      const body = { city_id: city.value.id, sections: sendable.value.sections }
      if (removals.value.length) body.remove_sections = removals.value
      if (day.value !== access.value.today) body.date = day.value
      const result = await api.saveReport(character.value.id, body)
      push.success(t(`SecurityCustoms.Form.Sent.${result.mode}`))
      sealed.value = { city: city.value.name, date: dayLabel(day.value) }
    } catch (error) {
      push.error(apiMessage(error, locale.value, t('Auth.Errors.NetworkError')))
    } finally {
      saving.value = false
    }
  }

  // ── Export du guet (format historique du Relevé : liste, entrées, sorties) ──
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
      <!-- Un relevé de ce jour existe déjà (Greg, 24/11/2026) : sur la ligne de la ville, DEVANT elle, bien en vue et sans détail — ni dans la plaque d'inscription, ni sur sa propre ligne. -->
      <ExistingReportNotice v-if="existing" :message="t('SecurityCustoms.Registry.Existing', { date: existing.date })" />
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

    <!-- « Confier au scribe » (l'export) et, à sa droite, l'inscription au registre : jamais automatique, la même plaque que le Bilan des mines, ville et jour DITS avant l'envoi. -->
    <div class="flex flex-wrap items-center justify-center gap-4">
      <button type="button" class="odc-btn odc-btn--soft odc--green" :disabled="busy" data-testid="guet-generate" @click="generate"><v-icon name="gi-quill" aria-hidden="true" />{{ t('Security.GenerateButton') }}</button>
      <CustomsRegistrySave
        v-if="canSave"
        :city-name="city.name"
        :day-label="dayLabel(day)"
        :saving="saving"
        :disabled="nothingToSend"
        :sealed="sealed"
        @save="save"
      />
    </div>

    <section v-if="report" class="space-y-3" data-testid="guet-result">
      <p v-if="previewError" role="alert" class="text-sm font-bold text-orange-800 dark:text-orange-800" data-testid="guet-preview-error">{{ t('Security.PreviewFailed', { message: previewError }) }}</p>
      <p v-if="yesterdayMismatch" role="alert" class="text-sm font-bold text-orange-800 dark:text-orange-800" data-testid="yesterday-mismatch">
        {{ t('Security.MismatchYesterday', yesterdayMismatch) }}
      </p>
      <p v-for="problem in problems" :key="problem" role="alert" class="text-sm font-bold text-orange-800 dark:text-orange-800" data-testid="guet-problem">{{ t(`SecurityCustoms.Form.Problem.${problem}`) }}</p>
      <p v-if="!report.sections_present.length && !problems.length" class="text-sm text-slate-700 dark:text-slate-700" data-testid="guet-nothing">{{ t('Security.NothingToShow') }}</p>

      <!-- « Confier au scribe » est l'EXPORT : le message est copié (Greg, 23/11/2026). Il n'est montré QUE si la copie a échoué, pour qu'on puisse le copier à la main. -->
      <div v-if="bbcode && copyFailed" class="space-y-2">
        <p role="alert" class="text-sm font-bold text-orange-800 dark:text-orange-800" data-testid="guet-copy-failed">{{ t('Security.CopyFailed') }}</p>
        <textarea readonly rows="10" class="w-full rounded-xl p-2 font-mono text-xs" :value="bbcode" data-testid="guet-bbcode" @focus="$event.target.select()"></textarea>
      </div>

    </section>
  </div>
</template>
