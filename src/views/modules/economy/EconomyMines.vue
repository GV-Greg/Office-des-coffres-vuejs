<script setup>
/*
  imports
*/
  import { ref, reactive, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useCookieStore } from '@/stores/cookieStore'
  import {
    parseMinesText, mergeMinesData, computeBilan, checkWeekCompleteness,
    mostRecentDate, parseMineStates, formatDateFr, thresholdAlert,
    getWeekBounds, filterToWeek, shiftWeek, todayIso, lastCompletedWeek,
  } from '@/modules/mineParser'
  import { toGameDateIso } from '@/modules/gameCalendar'
  import { push } from 'notivue'
  import MineRegistrySave from '@/components/mines/MineRegistrySave.vue'

  const { t } = useI18n()

  // Toute date montrée à un joueur (interface ou export forum) porte l'année du jeu ;
  // les dates réelles ne servent qu'en interne (bornes de semaine, clés de cache).
  const formatGameDateFr = dateIso => formatDateFr(toGameDateIso(dateIso))
  const cookieStore = useCookieStore()

  const MINES_DATA_KEY = 'economy_mines_data'
  function weekStorageKey(monday) {
    return `${MINES_DATA_KEY}_${monday}`
  }
  // Dernières valeurs utilisées (prix, taux), point de départ d'une semaine neuve (fil bilan-mines, Q6).
  const SETTINGS_KEY = 'economy_mines_settings'

  // Prix du classeur v2 de Greg ; taux horaire actuel du jeu (réglage du bailli, 0,99 à l'époque du
  // classeur). Ce sont des DÉFAUTS : prix et taux se mémorisent avec chaque semaine (brief §3).
  const DEFAULT_PRICES = { PIERRE: 14.5, FER: 19.5, ARGILE: 4.5, SEL: 4.5 }
  const DEFAULT_RATE = 0.7
  const PRICE_FIELDS = [
    { resource: 'PIERRE', label: 'PriceStone' },
    { resource: 'FER', label: 'PriceIron' },
    { resource: 'ARGILE', label: 'PriceClay' },
    { resource: 'SEL', label: 'PriceSalt' },
  ]

/*
  données
*/
  const pastedText = ref('')
  const prefilledFromComfort = ref(false)
  const prices = reactive({ ...DEFAULT_PRICES })
  const rate = ref(DEFAULT_RATE)
  // Semaine mémorisée avant le 05/10/2026 : ni prix ni taux enregistrés avec elle (Q6).
  const rateNotStored = ref(false)
  const bilan = ref(null)
  const weekCheck = ref(null)

  // Semaine ciblée par le bilan — permet de reconstruire une semaine passée
  // (plusieurs collages successifs, chacun filtré à cette semaine avant fusion)
  // sans mélanger les jours avec la semaine en cours ou une autre semaine passée.
  // Par défaut, la dernière semaine ACHEVÉE : une semaine n'est complète que le lundi suivant (§2.4).
  const selectedMonday = ref(lastCompletedWeek(todayIso()))
  const selectedSunday = computed(() => getWeekBounds(selectedMonday.value).sunday)
  // Les heures du lundi suivant mesurent le dimanche de la semaine (décalage d'un jour, §2.1).
  const nextMonday = computed(() => shiftWeek(selectedMonday.value, 1))

  // Alerte de seuil (§4) : à l'ÉCRAN seulement, jamais dans un export (Greg, Q9 bis), et datée du
  // moment du collage, en heure de Paris — le collage ne porte pas sa propre heure.
  const pastedOn = ref(todayIso())
  watch(pastedText, () => { pastedOn.value = todayIso() })
  const thresholdAlerts = computed(() => parseMineStates(pastedText.value)
    .map(state => ({ state, alert: thresholdAlert(state) }))
    .filter(({ alert }) => alert))
  const pastedOnLabel = computed(() => pastedOn.value.slice(8, 10) + '/' + pastedOn.value.slice(5, 7))

  // Couleurs des titres de mine dans les exports BBcode, choisies sur deux critères :
  // évoquer la matière première, et rester lisibles sur le fond beige des [quote] du
  // forum du jeu (#d5bc84, relevé sur une capture réelle). Les teintes précédentes
  // (darkgoldenrod, seagreen, darkgray...) plafonnaient entre 1,27:1 et 2,3:1 de
  // contraste, soit illisibles ; celles-ci sont toutes au-dessus de 4,5:1 (WCAG AA).
  const RESOURCE_COLOR = {
    OR: '#574000',      // or brun foncé      — 5,31:1
    PIERRE: '#4a4a4a',  // gris ardoise       — 4,79:1
    FER: '#26414c',     // acier bleuté       — 5,84:1
    ARGILE: '#7d3309',  // terre cuite        — 4,83:1
    SEL: '#14507d',     // bleu marin         — 4,59:1
  }

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
  // Une semaine mémorisée : { mines, prices, rate } depuis le 05/10/2026, un simple tableau de mines
  // avant (ni prix ni taux). Tout passe par le stockage confort : no-op sans consentement, et une
  // semaine rouverte sans cookies repart des défauts — c'est normal (fil bilan-mines, Q6).
  function readWeek(monday) {
    const stored = cookieStore.getComfortData(weekStorageKey(monday))
    if (!stored) return null
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? { mines: parsed, prices: null, rate: null } : parsed
  }

  function applySettings(source) {
    Object.assign(prices, DEFAULT_PRICES, source?.prices ?? {})
    rate.value = source?.rate ?? DEFAULT_RATE
  }

  function loadWeekState() {
    pastedText.value = ''
    bilan.value = null
    weekCheck.value = null
    const week = readWeek(selectedMonday.value)
    prefilledFromComfort.value = !!week
    rateNotStored.value = !!week && week.rate == null
    // Une semaine déjà enregistrée se rouvre avec SES prix et SON taux : rejouer un vieux bilan au
    // taux d'aujourd'hui le fausserait (0,99 → 0,70 : 41 %). Sinon, les dernières valeurs utilisées.
    if (week?.rate != null) {
      applySettings(week)
    } else if (!week) {
      const last = cookieStore.getComfortData(SETTINGS_KEY)
      applySettings(last ? JSON.parse(last) : null)
    }
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

    // Jusqu'au lundi suivant inclus : ses heures mesurent le dimanche de la semaine (§2.1).
    const filtered = filterToWeek(parsed, selectedMonday.value, nextMonday.value)
    if (filtered.length === 0) {
      push.error(t('EconomyMines.NoDataForWeekError'))
      return
    }

    const merged = mergeMinesData(readWeek(selectedMonday.value)?.mines ?? [], filtered)
    const settings = { prices: { ...prices }, rate: Number(rate.value) || 0 }

    // Confort : mémorise le relevé fusionné de la semaine AVEC ses prix et son taux, pour ne rien
    // perdre au prochain collage et rejouer la semaine à ses propres valeurs.
    cookieStore.setComfortData(weekStorageKey(selectedMonday.value), JSON.stringify({ mines: merged, ...settings }))
    cookieStore.setComfortData(SETTINGS_KEY, JSON.stringify(settings))
    rateNotStored.value = false

    weekCheck.value = checkWeekCompleteness(merged, selectedMonday.value)
    bilan.value = computeBilan(merged, prices, settings.rate, selectedMonday.value)
  }

/*
  export BBcode
*/
  function formatNum(n) {
    return Number(n.toFixed(2)).toLocaleString('fr-FR')
  }

  // La production n'a pas d'unité commune (écus d'or, kg de fer, qx de pierre…) : l'unité suit le
  // nombre, dans chaque case.
  function productionWithUnit(line) {
    const unit = line.resource ? t(`EconomyMines.Units.${line.resource}`) : ''
    return `${formatNum(line.production)} ${unit}`.trim()
  }

  function bilanToBBcode(b, title) {
    // Les dates de la semaine couverte suivent le titre : un bilan repartagé sur le forum
    // doit pouvoir être daté sans dépendre du message qui l'accompagne. Même libellé que
    // le sélecteur de semaine de l'UI, pour qu'un lecteur retrouve la période à l'identique.
    const week = t('EconomyMines.WeekLabel', {
      monday: formatGameDateFr(selectedMonday.value),
      sunday: formatGameDateFr(selectedSunday.value),
    })
    // Une copie de ce que le titulaire a vu : la table par mine, la ligne Total et la convention
    // (fil bilan-mines, Q11). Jamais l'alerte de seuil (Q9 bis), jamais une semaine incomplète (Q10).
    // Mise en page : UN seul [quote] (un cadre par mine alourdissait le forum — Greg, 05/10/2026),
    // l'unité dite une fois en tête, quatre lignes par mine, le solde en évidence et coloré, puis le
    // Total et le net en grand.
    const bbt = (key, params) => t(`EconomyMines.Bb.${key}`, params ?? {})
    const upkeep = (pierre, fer) => `${formatNum(pierre)} ${t('EconomyMines.Units.PIERRE')} / ${formatNum(fer)} ${t('EconomyMines.Units.FER')}`

    // Couleurs du titre et de la semaine choisies par Greg (06/10/2026) : darkblue 12,5:1 et
    // darkgreen 6,1:1 sur le fond clair du [quote] (#f0e8d0).
    let bb = `[quote][center][b][size=20][color=darkblue]${title}[/color][/size][/b]\n[i][color=darkgreen]${week}[/color][/i]\n`
    bb += `[size=10]${bbt('Amounts', { rate: formatNum(b.rate) })}[/size][/center]\n`
    // Forme donnée par Greg (06/10/2026) : « [list][*] » collés, sans retour à la ligne entre les deux
    // — c'est ce retour, rendu en ligne vide par le forum, qui creusait un blanc sous chaque titre.
    const list = items => `[list][*]${items.join('\n[*]')}\n[/list]\n`
    for (const line of b.lines) {
      const color = RESOURCE_COLOR[line.resource] || 'black'
      bb += `[color=${color}][b][size=14]${line.label}[/size][/b][/color] [size=10](#${line.number}${line.noeud ? ' - Noeud ' + line.noeud : ''})[/size]\n`
      bb += list([
        // L'or produit des écus : sa production EST sa valeur, inutile de la répéter.
        `${bbt('Production')} : ${productionWithUnit(line)}${line.resource === 'OR' ? '' : ` — ${bbt('Value')} ${formatNum(line.valeur)}`}`,
        `${bbt('Wages')} : ${formatNum(line.salaire)} (${formatNum(line.heures)} h)`,
        `${bbt('Upkeep')} : ${formatNum(line.entretien)} (${upkeep(line.pierre, line.fer)})`,
        `[b]${bbt('Balance')} : ${signed(line.solde)}[/b]`,
      ])
    }
    // Le Total suit la forme d'une mine ; le net, à gauche, le conclut en grand.
    bb += `[b][size=14]${bbt('TotalTitle')}[/size][/b]\n`
    bb += list([
      `${bbt('ValueProduced')} : ${formatNum(b.total.valeur)}`,
      `${bbt('Wages')} : ${formatNum(b.total.salaire)} (${formatNum(b.total.heures)} h × ${formatNum(b.rate)})`,
      `${bbt('Upkeep')} : ${formatNum(b.total.entretien)} (${upkeep(b.total.pierre, b.total.fer)})`,
    ])
    bb += `[size=18][b]${t('EconomyMines.NetLabel')} : ${signed(b.net)} ${t('EconomyMines.Currency')}[/b][/size]\n`
    bb += `[size=9][i]${t('EconomyMines.Convention')}[/i][/size][/quote]`
    return bb
  }

  // Solde et net signés et colorés pour le forum : green / red, choix de Greg (06/10/2026).
  // ⚠️ Contraste sous 4,5:1 sur le fond clair du [quote] (#f0e8d0) : green 4,20:1, red 3,27:1 — le
  // texte est en gras, et le signe (+/−) porte l'information sans la couleur. Variantes foncées
  // mesurées si besoin : #14451a 9,05:1, #7a1010 8,99:1.
  function signed(n) {
    const color = n < 0 ? 'red' : 'green'
    return `[color=${color}]${n > 0 ? '+' : ''}${formatNum(n)}[/color]`
  }

  function toExport() {
    if (!bilan.value || !weekCheck.value?.complete) return
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
      .map(([date, v]) => `[*]${toGameDateIso(date)} : ${v[field]}`)
      .join('\n')
  }

  function formatConsoSeries(mine) {
    return Object.entries(mine.days)
      .filter(([, v]) => v.pierre != null || v.fer != null)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => `[*]${toGameDateIso(date)} : ${v.pierre ?? 0} qtx de pierre, ${v.fer ?? 0} kg de fer`)
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
    const dateLabel = day ? formatGameDateFr(day) : ''

    let bb = `[center][size=16][color=darkred][b]- Rapport sur les Mines - Journée du ${dateLabel} -[/b][/color][/size][/center]\n\n`
    for (const s of states) {
      const color = RESOURCE_COLOR[s.resource] || 'black'
      // Une mine = un [quote] : sur le forum, chaque bloc est visuellement encadré et
      // détaché du suivant, ce qui remplace les lignes vides qu'on insérait avant.
      bb += `[quote][color=${color}][b][u]#${s.number} ${s.label}${s.noeud ? ' - Noeud ' + s.noeud : ''}[/u][/b][/color]\n[list]\n`
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
        // Pas de saut de ligne avant les intertitres : [list] pose déjà sa propre marge,
        // et le \n qu'on ajoutait en plus doublait l'espace entre les sections d'une même
        // mine. Le gras compense la hiérarchie visuelle perdue.
        if (heures) bb += `[b]Nombre d'heures travaillées ces 7 derniers jours[/b]\n[list]\n${heures}\n[/list]\n`
        if (production) bb += `[b]Production des 7 derniers jours[/b]\n[list]\n${production}\n[/list]\n`
        bb += conso
          ? `[b]Ressources consommées par la mine ces 7 derniers jours[/b]\n[list]\n${conso}\n[/list]`
          : `[b]Ressources consommées par la mine ces 7 derniers jours[/b] : /`
      }
      bb += '[/quote]\n'
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
        {{ t('EconomyMines.WeekLabel', { monday: formatGameDateFr(selectedMonday), sunday: formatGameDateFr(selectedSunday) }) }}
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
    <!-- Texte de Greg, repris tel quel (brief §5) ; la chaîne EN porte la même phrase française. -->
    <!-- La carte reste claire dans les deux thèmes : couleur foncée répétée en dark: (règle `.dark p`). -->
    <p class="text-sm text-slate-700 dark:text-slate-700 mb-1">{{ t('EconomyMines.PasteHelp') }}</p>
    <span v-if="prefilledFromComfort" class="block text-xs text-slate-500 dark:text-slate-400 italic mb-1">
      {{ t('EconomyMines.PastePrefilled') }}
    </span>
    <div class="w-full grid grid-cols-4 gap-4">
      <textarea v-model="pastedText" rows="10" :placeholder="t('EconomyMines.PastePlaceholder')"
                class="textarea-autoresize col-span-3 w-full rounded-xl p-2"></textarea>
      <div v-if="pastedText.trim()" class="flex flex-col items-center justify-start mt-7">
        <button @click="formatDayForForum" class="odc-btn odc-btn--soft odc--slate">{{ t('EconomyMines.DayExportButton') }}</button>
      </div>
    </div>

    <!-- Alerte de seuil (§4) : constat daté, à l'écran seulement — jamais dans un export (Q9 bis). -->
    <ul v-if="thresholdAlerts.length" class="mt-3 space-y-1 text-sm" data-testid="threshold-alerts">
      <li v-for="{ state, alert } in thresholdAlerts" :key="state.noeud ?? state.number"
          :class="alert.level === 'reached' ? 'text-red-700 dark:text-red-700 font-bold' : 'text-orange-800 dark:text-orange-800'">
        #{{ state.number }} {{ state.label }} —
        {{ t(alert.level === 'reached' ? 'EconomyMines.ThresholdReached' : 'EconomyMines.ThresholdNear',
             { date: pastedOnLabel, pierre: alert.seuilPierre, fer: alert.seuilFer }) }}
      </li>
    </ul>

    <!-- Registre des mines : même collage, seconde destination — visible pour le seul commissaire
         aux mines ou bailli connu de l'Office (brief Registre §6). -->
    <MineRegistrySave :text="pastedText" :prices="prices" :rate="rate" />

    <!-- Champs courts, unité à droite : un prix ou un taux tient en quelques chiffres. -->
    <div class="mt-4 flex flex-wrap gap-x-6 gap-y-3">
      <div v-for="field in PRICE_FIELDS" :key="field.resource" class="form-group">
        <label :for="`price-${field.resource}`" class="form-label">{{ t(`EconomyMines.${field.label}`) }}</label>
        <div class="flex items-center gap-1">
          <input :id="`price-${field.resource}`" v-model.number="prices[field.resource]" type="number" step="0.1" min="0" class="form-field w-24" />
          <span class="text-sm">{{ t('EconomyMines.Currency') }}</span>
        </div>
      </div>
      <div class="form-group">
        <label for="mines-rate" class="form-label">{{ t('EconomyMines.RateLabel') }}</label>
        <div class="flex items-center gap-1">
          <input id="mines-rate" v-model.number="rate" type="number" step="0.01" min="0" class="form-field w-24" />
          <span class="text-sm">{{ t('EconomyMines.Currency') }}</span>
        </div>
      </div>
    </div>
    <p v-if="rateNotStored" class="mt-1 text-sm text-orange-800 dark:text-orange-800" data-testid="rate-not-stored">
      {{ t('EconomyMines.RateNotStored') }}
    </p>

    <div v-if="pastedText.trim()" class="mt-4">
      <button @click="generate" class="odc-btn odc-btn--soft odc--green">{{ t('EconomyMines.GenerateButton') }}</button>
    </div>

    <div v-if="weekCheck && !weekCheck.complete" class="mt-2 text-sm text-orange-600 dark:text-orange-400">
      {{ t('EconomyMines.WeekIncompleteWarning', { count: 7 - weekCheck.missingDates.length, monday: toGameDateIso(weekCheck.monday), sunday: toGameDateIso(weekCheck.sunday) }) }}
    </div>

    <div v-if="bilan" class="mt-6">
      <!-- Une semaine en cours ou incomplète s'affiche, marquée comme telle, mais ne s'exporte pas
           en bilan hebdomadaire (§2.4 ; Greg, fil bilan-mines Q10). -->
      <h4 v-if="!weekCheck.complete" class="font-bold mb-2 text-orange-800 dark:text-orange-800" data-testid="incomplete-week">
        {{ t('EconomyMines.IncompleteWeekTitle') }}
      </h4>
      <!-- Une seule table, par mine (§2.3) : chaque mine porte ses heures, son salaire et SON
           entretien ; la ligne Total met en commun la pierre et le fer de la province. -->
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-300 dark:border-gray-600 text-left">
              <th class="py-2">{{ t('EconomyMines.ColumnMine') }}</th>
              <th class="py-2 text-right">{{ t('EconomyMines.ColumnProduction') }}</th>
              <th class="py-2 text-right">{{ t('EconomyMines.ColumnValue') }}</th>
              <th class="py-2 text-right">{{ t('EconomyMines.ColumnHours') }}</th>
              <th class="py-2 text-right">{{ t('EconomyMines.ColumnSalary') }}</th>
              <th class="py-2 text-right">{{ t('EconomyMines.ColumnMaintenanceStoneIron') }}</th>
              <th class="py-2 text-right">{{ t('EconomyMines.ColumnMaintenanceValue') }}</th>
              <th class="py-2 text-right">{{ t('EconomyMines.ColumnBalance') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="line in bilan.lines" :key="line.noeud ?? line.number" class="border-b border-gray-100 dark:border-gray-700">
              <td class="py-2 font-bold">#{{ line.number }} {{ line.label }}</td>
              <td class="py-2 text-right">{{ productionWithUnit(line) }}</td>
              <td class="py-2 text-right">{{ formatNum(line.valeur) }}</td>
              <td class="py-2 text-right">{{ formatNum(line.heures) }}</td>
              <td class="py-2 text-right">{{ formatNum(line.salaire) }}</td>
              <td class="py-2 text-right">{{ formatNum(line.pierre) }} / {{ formatNum(line.fer) }}</td>
              <td class="py-2 text-right">{{ formatNum(line.entretien) }}</td>
              <td class="py-2 text-right font-bold">{{ formatNum(line.solde) }}</td>
            </tr>
            <tr class="font-bold" data-testid="total-row">
              <td class="py-2">{{ t('EconomyMines.TotalLabel') }}</td>
              <td class="py-2"></td>
              <td class="py-2 text-right">{{ formatNum(bilan.total.valeur) }}</td>
              <td class="py-2 text-right">{{ formatNum(bilan.total.heures) }}</td>
              <td class="py-2 text-right">{{ formatNum(bilan.total.salaire) }}</td>
              <td class="py-2 text-right">{{ formatNum(bilan.total.pierre) }} / {{ formatNum(bilan.total.fer) }}</td>
              <td class="py-2 text-right">{{ formatNum(bilan.total.entretien) }}</td>
              <!-- Vide : le solde total EST le net, affiché une seule fois juste dessous (fil bilan-mines/07, B2). -->
              <td class="py-2"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-3 font-bold text-lg" data-testid="net-line">
        {{ t('EconomyMines.NetLabel') }} : {{ formatNum(bilan.net) }} {{ t('EconomyMines.Currency') }}
      </div>
      <!-- Convention de valorisation, écrite à l'écran plutôt que sous-entendue (§2.5). -->
      <p class="mt-1 text-xs italic text-slate-700 dark:text-slate-700" data-testid="convention">{{ t('EconomyMines.Convention') }}</p>

      <button v-if="weekCheck.complete" @click="toExport" class="h-12 btn btn-primary mt-3">{{ t('EconomyMines.ExportButton') }}</button>
    </div>
  </div>
</template>
