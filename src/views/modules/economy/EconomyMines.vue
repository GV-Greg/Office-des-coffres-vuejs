<script setup>
/*
  imports
*/
  import { ref, reactive, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useCookieStore } from '@/stores/cookieStore'
  import {
    parseMinesText, mergeMinesData, computeBilan, checkWeekCompleteness,
    mostRecentDate, parseMineStates, formatDateFr,
    getWeekBounds, filterToWeek, shiftWeek, todayIso,
  } from '@/modules/mineParser'
  import { push } from 'notivue'

  const { t } = useI18n()
  const cookieStore = useCookieStore()

  const MINES_DATA_KEY = 'economy_mines_data'
  function weekStorageKey(monday) {
    return `${MINES_DATA_KEY}_${monday}`
  }

/*
  données
*/
  const pastedText = ref('')
  const prefilledFromComfort = ref(false)
  const prices = reactive({ PIERRE: 14.5, FER: 19.5, ARGILE: 4.5, SEL: 4.5 })
  const salary = ref(0)
  const bilan = ref(null)
  const weekCheck = ref(null)

  // Semaine ciblée par le bilan — permet de reconstruire une semaine passée
  // (plusieurs collages successifs, chacun filtré à cette semaine avant fusion)
  // sans mélanger les jours avec la semaine en cours ou une autre semaine passée.
  const selectedMonday = ref(getWeekBounds(todayIso()).monday)
  const selectedSunday = computed(() => getWeekBounds(selectedMonday.value).sunday)

  const RESOURCE_COLOR = { OR: 'darkgoldenrod', PIERRE: 'seagreen', FER: 'darkgray', ARGILE: 'firebrick', SEL: 'steelblue' }

/*
  navigation semaine
*/
  function previousWeek() {
    selectedMonday.value = shiftWeek(selectedMonday.value, -1)
  }
  function nextWeek() {
    selectedMonday.value = shiftWeek(selectedMonday.value, 1)
  }

  // Recharge l'état affiché pour la semaine sélectionnée — appelé au montage
  // et à chaque changement de semaine (le texte collé/bilan d'une semaine ne
  // doit pas rester affiché en changeant de semaine).
  function loadWeekState() {
    pastedText.value = ''
    bilan.value = null
    weekCheck.value = null
    prefilledFromComfort.value = !!cookieStore.getComfortData(weekStorageKey(selectedMonday.value))
  }
  watch(selectedMonday, loadWeekState, { immediate: true })

/*
  calcul
*/
  function generate() {
    const parsed = parseMinesText(pastedText.value)
    if (parsed.length === 0) {
      push.error(t('EconomyMines.NoDataError'))
      return
    }

    const filtered = filterToWeek(parsed, selectedMonday.value, selectedSunday.value)
    if (filtered.length === 0) {
      push.error(t('EconomyMines.NoDataForWeekError'))
      return
    }

    const key = weekStorageKey(selectedMonday.value)
    const stored = cookieStore.getComfortData(key)
    const existing = stored ? JSON.parse(stored) : []
    const merged = mergeMinesData(existing, filtered)

    // Confort : mémorise le relevé fusionné (pour cette semaine) pour ne rien
    // perdre au prochain collage. No-op silencieux sans consentement "comfort".
    cookieStore.setComfortData(key, JSON.stringify(merged))

    weekCheck.value = checkWeekCompleteness(merged)
    bilan.value = computeBilan(merged, prices, Number(salary.value) || 0)
  }

/*
  export BBcode
*/
  function formatNum(n) {
    return Number(n.toFixed(2)).toLocaleString('fr-FR')
  }

  function bilanToBBcode(b, title) {
    let bb = '[quote][center][b][size=20]' + title + '[/size][/b][/center]\n[list]\n'
    for (const line of b.lines) {
      const color = RESOURCE_COLOR[line.resource] || 'black'
      bb += `[color=${color}][b][u]${line.label} (#${line.number})[/u][/b][/color]\n`
      bb += `[list][b]${t('EconomyMines.ColumnHours')}[/b] : ${formatNum(line.heures)}\n`
      bb += `[b]${t('EconomyMines.ColumnProduction')}[/b] : ${formatNum(line.production)}\n`
      bb += `[b]${t('EconomyMines.MaintenanceLabel')}[/b] : ${formatNum(line.pierre)} ${t('EconomyMines.PriceStone')} / ${formatNum(line.fer)} ${t('EconomyMines.PriceIron')}[/list]\n\n`
    }
    bb += '[/list]\n[center][b][size=16]' + t('EconomyMines.SyntheseTitle') + '[/size][/b][/center]\n[list]\n'
    for (const s of b.synthese) {
      const label = t(`EconomyMines.Resources.${s.resource}`)
      const priceSuffix = s.prixUnitaire != null ? ` (${formatNum(s.prixUnitaire)} écus)` : ''
      bb += `[b]${label}[/b]${priceSuffix}\n`
      bb += `${t('EconomyMines.ColumnProduction')} : ${formatNum(s.production)} — ${t('EconomyMines.ColumnMaintenanceSalary')} : ${formatNum(s.entretienSalaires)}\n`
      bb += `${t('EconomyMines.ColumnResultQuantity')} : ${formatNum(s.resultatQuantite)} — ${t('EconomyMines.ColumnResultValue')} : ${formatNum(s.resultatValeur)} écus\n\n`
    }
    bb += `[/list]\n[center][i]${t('EconomyMines.NetLabel')} : [b]${formatNum(b.net)}[/b] écus[/i][/center][/quote]`
    return bb
  }

  function toExport() {
    if (!bilan.value) return
    copyToClipboard(bilanToBBcode(bilan.value, t('EconomyMines.Title')))
  }

  // navigator.clipboard.writeText() ne donne aucun signal visuel par défaut :
  // on confirme explicitement (succès/échec) pour que l'utilisateur sache si
  // le collage sur le forum a une chance de fonctionner.
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
      .then(() => push.success(t('EconomyMines.CopiedSuccess')))
      .catch(() => push.error(t('EconomyMines.CopyError')))
  }

  // Reconstruit une table "Date : valeur" à partir des relevés jour par jour
  // d'une mine, sans la phrase explicative répétée par le jeu avant chaque
  // tableau ("Les valeurs relatives à un jour donné sont prises... France.").
  function formatSeries(mine, field) {
    return Object.entries(mine.days)
      .filter(([, v]) => v[field] != null)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => `[*]${date} : ${v[field]}`)
      .join('\n')
  }

  function formatConsoSeries(mine) {
    return Object.entries(mine.days)
      .filter(([, v]) => v.pierre != null || v.fer != null)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => `[*]${date} : ${v.pierre ?? 0} qtx de pierre, ${v.fer ?? 0} kg de fer`)
      .join('\n')
  }

  // Met en forme l'état de chaque mine (niveau, rendement, créneaux, seuil de
  // rupture, entretien) et ses relevés des 7 derniers jours, tels qu'affichés
  // dans le jeu — pas un bilan calculé, pas de prix. Les libellés de boutons
  // du jeu ("Diminuer le niveau de la mine", "Fermer la mine") et les phrases
  // explicatives répétitives sont volontairement exclus, ce n'est pas de la
  // donnée. Le texte brut complet part dans un [spoiler][code] pour
  // référence/partage.
  //
  // BBcode en français fixe : posté tel quel sur le forum du jeu (francophone),
  // indépendant de la langue de l'UI — même exception que SecurityGuet.vue.
  function formatDayForForum() {
    const raw = pastedText.value.trim()
    if (!raw) return

    const states = parseMineStates(raw)
    if (states.length === 0) {
      push.error(t('EconomyMines.NoDataError'))
      return
    }

    const mines = parseMinesText(raw)
    const minesByNumber = new Map(mines.map(m => [m.number, m]))
    const day = mostRecentDate(mines)
    const dateLabel = day ? formatDateFr(day) : ''

    let bb = `[center][size=16][color=darkred][b]- Rapport sur les Mines - Journée du ${dateLabel} -[/b][/color][/size][/center]\n\n`
    for (const s of states) {
      const color = RESOURCE_COLOR[s.resource] || 'black'
      bb += `[color=${color}][b][u]#${s.number} ${s.label}${s.noeud ? ' - Noeud ' + s.noeud : ''}[/u][/b][/color]\n[list]\n`
      if (s.niveau) bb += `[*]Niveau : ${s.niveau}\n`
      if (s.rendement) bb += `[*]Rendement : ${s.rendement}\n`
      if (s.creneaux) bb += `[*]Créneaux horaires : ${s.creneaux}\n`
      if (s.seuilRupture) bb += `[*]Seuil de rupture : ${s.seuilRupture}\n`
      if (s.entretienNormal) bb += `[*]Entretien normal : ${s.entretienNormal}\n`
      if (s.entretienAmelioration) bb += `[*]Entretien et amélioration : ${s.entretienAmelioration}\n`
      bb += '[/list]\n'

      const mine = minesByNumber.get(s.number)
      if (mine) {
        const heures = formatSeries(mine, 'heures')
        const production = formatSeries(mine, 'production')
        const conso = formatConsoSeries(mine)
        if (heures) bb += `\nNombre d'heures travaillées ces 7 derniers jours\n[list]\n${heures}\n[/list]\n`
        if (production) bb += `\nProduction des 7 derniers jours\n[list]\n${production}\n[/list]\n`
        bb += conso
          ? `\nRessources consommées par la mine ces 7 derniers jours\n[list]\n${conso}\n[/list]\n`
          : '\nRessources consommées par la mine ces 7 derniers jours : /\n'
      }
      bb += '\n'
    }
    bb += `[spoiler][code]${raw}[/code][/spoiler]`
    copyToClipboard(bb)
  }
</script>

<template>
  <div class="w-full">
    <div class="w-full flex items-center justify-center gap-3 mb-4">
      <button
        type="button"
        @click="previousWeek"
        class="btn-grad-slate p-2 rounded-md"
        :aria-label="t('EconomyMines.PreviousWeek')"
      >
        <v-icon name="fa-chevron-left" scale="0.9" />
      </button>
      <span class="font-bold text-center">
        {{ t('EconomyMines.WeekLabel', { monday: formatDateFr(selectedMonday), sunday: formatDateFr(selectedSunday) }) }}
      </span>
      <button
        type="button"
        @click="nextWeek"
        class="btn-grad-slate p-2 rounded-md"
        :aria-label="t('EconomyMines.NextWeek')"
      >
        <v-icon name="fa-chevron-right" scale="0.9" />
      </button>
    </div>

    <label class="w-full font-bold">{{ t('EconomyMines.PasteLabel') }}</label>
    <span v-if="prefilledFromComfort" class="block text-xs text-slate-500 dark:text-slate-400 italic mb-1">
      {{ t('EconomyMines.PastePrefilled') }}
    </span>
    <div class="w-full grid grid-cols-4 gap-4">
      <textarea v-model="pastedText" rows="10" :placeholder="t('EconomyMines.PastePlaceholder')"
                class="textarea-autoresize col-span-3 w-full rounded-xl p-2"></textarea>
      <div v-if="pastedText.trim()" class="flex flex-col items-center justify-start mt-7">
        <button @click="formatDayForForum" class="h-12 btn btn-grad-slate">{{ t('EconomyMines.DayExportButton') }}</button>
      </div>
    </div>

    <div class="mt-4 grid grid-cols-2 laptop:grid-cols-5 gap-3">
      <div class="form-group">
        <label class="form-label laptop:min-h-[2.5rem]">{{ t('EconomyMines.PriceStone') }}</label>
        <input v-model.number="prices.PIERRE" type="number" step="0.1" class="form-field" />
      </div>
      <div class="form-group">
        <label class="form-label laptop:min-h-[2.5rem]">{{ t('EconomyMines.PriceIron') }}</label>
        <input v-model.number="prices.FER" type="number" step="0.1" class="form-field" />
      </div>
      <div class="form-group">
        <label class="form-label laptop:min-h-[2.5rem]">{{ t('EconomyMines.PriceClay') }}</label>
        <input v-model.number="prices.ARGILE" type="number" step="0.1" class="form-field" />
      </div>
      <div class="form-group">
        <label class="form-label laptop:min-h-[2.5rem]">{{ t('EconomyMines.PriceSalt') }}</label>
        <input v-model.number="prices.SEL" type="number" step="0.1" class="form-field" />
      </div>
      <div class="form-group">
        <label class="form-label laptop:min-h-[2.5rem]">{{ t('EconomyMines.SalaryLabel') }}</label>
        <input v-model.number="salary" type="number" step="0.1" class="form-field" />
      </div>
    </div>

    <div v-if="pastedText.trim()" class="mt-4">
      <button @click="generate" class="h-12 btn btn-grad-green">{{ t('EconomyMines.GenerateButton') }}</button>
    </div>

    <div v-if="weekCheck && !weekCheck.complete" class="mt-2 text-sm text-amber-600 dark:text-amber-400">
      {{ t('EconomyMines.WeekIncompleteWarning', { count: 7 - weekCheck.missingDates.length, monday: weekCheck.monday, sunday: weekCheck.sunday }) }}
    </div>

    <div v-if="bilan" class="mt-6">
      <h4 class="font-bold mb-2">{{ t('EconomyMines.ColumnMine') }}</h4>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-300 dark:border-gray-600 text-left">
              <th class="py-2">{{ t('EconomyMines.ColumnMine') }}</th>
              <th class="py-2 text-right">{{ t('EconomyMines.ColumnHours') }}</th>
              <th class="py-2 text-right">{{ t('EconomyMines.ColumnProduction') }}</th>
              <th class="py-2 text-right">{{ t('EconomyMines.ColumnStone') }}</th>
              <th class="py-2 text-right">{{ t('EconomyMines.ColumnIron') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="line in bilan.lines" :key="line.number" class="border-b border-gray-100 dark:border-gray-700">
              <td class="py-2 font-bold">#{{ line.number }} {{ line.label }}</td>
              <td class="py-2 text-right">{{ formatNum(line.heures) }}</td>
              <td class="py-2 text-right">{{ formatNum(line.production) }}</td>
              <td class="py-2 text-right">{{ formatNum(line.pierre) }}</td>
              <td class="py-2 text-right">{{ formatNum(line.fer) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h4 class="font-bold mt-6 mb-2">{{ t('EconomyMines.SyntheseTitle') }}</h4>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-300 dark:border-gray-600 text-left">
              <th class="py-2">{{ t('EconomyMines.ColumnResource') }}</th>
              <th class="py-2 text-right">{{ t('EconomyMines.ColumnUnitPrice') }}</th>
              <th class="py-2 text-right">{{ t('EconomyMines.ColumnProduction') }}</th>
              <th class="py-2 text-right">{{ t('EconomyMines.ColumnMaintenanceSalary') }}</th>
              <th class="py-2 text-right">{{ t('EconomyMines.ColumnResultQuantity') }}</th>
              <th class="py-2 text-right">{{ t('EconomyMines.ColumnResultValue') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in bilan.synthese" :key="s.resource" class="border-b border-gray-100 dark:border-gray-700">
              <td class="py-2 font-bold">{{ t(`EconomyMines.Resources.${s.resource}`) }}</td>
              <td class="py-2 text-right">{{ s.prixUnitaire != null ? formatNum(s.prixUnitaire) : '—' }}</td>
              <td class="py-2 text-right">{{ formatNum(s.production) }}</td>
              <td class="py-2 text-right">{{ formatNum(s.entretienSalaires) }}</td>
              <td class="py-2 text-right">{{ formatNum(s.resultatQuantite) }}</td>
              <td class="py-2 text-right">{{ formatNum(s.resultatValeur) }}</td>
            </tr>
            <tr class="font-bold">
              <td class="py-2" colspan="5">{{ t('EconomyMines.TotalLabel') }}</td>
              <td class="py-2 text-right">{{ formatNum(bilan.net) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-3 font-bold text-lg">
        {{ t('EconomyMines.NetLabel') }} : {{ formatNum(bilan.net) }} écus
      </div>

      <button @click="toExport" class="h-12 btn btn-primary mt-3">{{ t('EconomyMines.ExportButton') }}</button>
    </div>
  </div>
</template>
