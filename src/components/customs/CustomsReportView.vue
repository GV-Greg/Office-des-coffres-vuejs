<script setup>
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { formatFieldDate } from '@/modules/playerDates'
  import CustomsPseudo from '@/components/customs/CustomsPseudo.vue'
  import ReportCard from '@/components/customs/ReportCard.vue'
  import ReportGroupList from '@/components/customs/ReportGroupList.vue'

  /*
    Un bilan de défense, tel que le serveur le sert : JAMAIS le brut, JAMAIS l'auteur (`by_me` seulement, politique §6). Les couleurs sont
    calculées par le serveur à la date du bilan, à partir des listes de la province ; ce composant ne compare aucun pseudo.
    « Groupe à surveiller », jamais « brigand » (Greg, P8) : seul le type `groupe` alerte.
  */
  const props = defineProps({
    report: { type: Object, required: true },
    // Entrées et sorties du guet avec lien vers la fiche du personnage (Relevé de guet).
    linkDiff: { type: Boolean, default: false },
  })
  const { t, locale } = useI18n()

  const sections = computed(() => props.report.sections ?? {})
  const guet = computed(() => sections.value.guet ?? null)
  const visions = computed(() => sections.value.visions ?? null)
  const block = computed(() => sections.value.armies_groups ?? null)
  const day = iso => formatFieldDate('customs_report_day', iso, locale.value)
  const coloured = computed(() => (guet.value?.villagers ?? []).filter(v => v.colour))

  // La ligne de synthèse : ce qui compte pour la sécurité ressort (marques des listes, groupes à surveiller), seulement s'il y en a.
  const groups = computed(() => block.value?.groups ?? [])
  const watched = computed(() => groups.value.filter(g => g.alert))
  const summary = computed(() => {
    const chips = []
    if (guet.value) chips.push({ key: 'Inhabitants', count: guet.value.read_total, tone: 'blue' })
    if (guet.value?.diff) {
      chips.push({ key: 'Arrivals', count: guet.value.diff.arrivals.length, tone: 'teal' })
      chips.push({ key: 'Departures', count: guet.value.diff.departures.length, tone: 'violet' })
    }
    if (block.value) chips.push({ key: 'Groups', count: groups.value.length, tone: 'rose' })
    const red = coloured.value.filter(v => v.colour === 'red').length
    const green = coloured.value.filter(v => v.colour === 'green').length
    const watch = groups.value.filter(g => g.alert).length
    if (red) chips.push({ key: 'RedMarks', count: red, tone: 'red' })
    if (green) chips.push({ key: 'GreenMarks', count: green, tone: 'green' })
    if (watch) chips.push({ key: 'GroupsToWatch', count: watch, tone: 'alert' })
    return chips
  })
  const chipClass = tone => ({
    blue: 'border-blue-400 bg-blue-100 text-blue-900',
    teal: 'border-teal-500 bg-teal-100 text-teal-900',
    violet: 'border-violet-400 bg-violet-100 text-violet-900',
    rose: 'border-rose-400 bg-rose-100 text-rose-900',
    red: 'border-red-500 bg-red-100 text-red-900',
    green: 'border-green-600 bg-green-100 text-green-900',
    alert: 'border-orange-600 bg-orange-100 text-orange-900',
  })[tone]
</script>

<template>
  <div class="space-y-4" data-testid="customs-report">
    <!-- Synthèse : seul ce qui demande l'attention prend une couleur. -->
    <ul v-if="summary.length" class="flex flex-wrap gap-2" data-testid="report-summary">
      <li v-for="chip in summary" :key="chip.key" class="rounded-full border px-3 py-0.5 text-sm font-semibold" :class="chipClass(chip.tone)" :data-tone="chip.tone">
        {{ t(`SecurityCustoms.Report.Summary.${chip.key}`, { count: chip.count }, chip.count) }}
      </li>
    </ul>

    <!-- Trois colonnes au large : habitants et visions | entrées et sorties | groupes, armées, zone. Deux sur laptop (la dernière colonne dessous), une en dessous. -->
    <div class="grid grid-cols-1 items-start gap-4 laptop:grid-cols-2 min-[1500px]:grid-cols-3">
      <div class="space-y-4">
      <!-- Habitants : les pseudos marqués d'abord, c'est ce que le registre sert à voir. -->
      <ReportCard v-if="guet" :title="t('SecurityCustoms.Report.Villagers', { count: guet.read_total })" tone="blue" testid="report-guet">
        <p v-if="guet.total_matches === false" role="alert" class="mb-2 text-sm font-bold text-orange-800 dark:text-orange-800" data-testid="total-mismatch">
          {{ t('SecurityCustoms.Report.TotalMismatch', { declared: guet.declared_total, read: guet.read_total }) }}
        </p>
        <p v-if="coloured.length" class="flex flex-wrap gap-1 text-slate-800 dark:text-slate-800" data-testid="coloured-villagers">
          <CustomsPseudo v-for="v in coloured" :key="v.pseudo" :pseudo="v.pseudo" :colour="v.colour" />
        </p>
        <details class="mt-2">
          <summary class="cursor-pointer text-sm underline text-slate-800 dark:text-slate-800">{{ t('SecurityCustoms.Report.AllVillagers') }}</summary>
          <ul class="mt-2 grid gap-x-4 gap-y-1 text-sm [grid-template-columns:repeat(auto-fill,minmax(12rem,1fr))]">
            <li v-for="v in guet.villagers" :key="v.pseudo">
              <CustomsPseudo :pseudo="v.pseudo" :colour="v.colour" />
              <span v-if="v.noblesse" class="ml-1 text-slate-700 dark:text-slate-700">{{ v.noblesse }}</span>
            </li>
          </ul>
        </details>
      </ReportCard>
      <ReportCard v-else :title="t('SecurityCustoms.Report.Villagers', { count: 0 })" tone="muted">
        <p class="text-sm text-slate-600 dark:text-slate-600">{{ t('SecurityCustoms.Report.NotRecorded') }}</p>
      </ReportCard>

      <!-- Visions : la nuit précédente (l'en-tête du jour du bilan). -->
      <ReportCard v-if="visions" :title="t('SecurityCustoms.Report.Visions')" testid="report-visions">
        <ul class="space-y-1">
          <li v-for="(entry, index) in visions.entries" :key="index" class="flex flex-wrap items-center gap-1 text-slate-800 dark:text-slate-800">
            <CustomsPseudo v-for="p in entry.singles" :key="p.pseudo" :pseudo="p.pseudo" :colour="p.colour" />
            <span v-for="(group, gi) in entry.groups" :key="`g${gi}`" class="inline-flex flex-wrap items-center gap-1 rounded border border-slate-300 px-1.5 py-0.5">
              <span class="text-xs font-bold uppercase text-slate-700 dark:text-slate-700">{{ t('SecurityCustoms.Report.VisionGroup') }}</span>
              <CustomsPseudo v-for="p in group" :key="p.pseudo" :pseudo="p.pseudo" :colour="p.colour" />
            </span>
          </li>
        </ul>
        <p v-if="visions.other_days" class="mt-1 text-sm text-slate-600 dark:text-slate-600">{{ t('SecurityCustoms.Report.VisionsOtherDays', { count: visions.other_days }) }}</p>
      </ReportCard>
      <ReportCard v-else :title="t('SecurityCustoms.Report.Visions')" tone="muted">
        <p class="text-sm text-slate-600 dark:text-slate-600">{{ t('SecurityCustoms.Report.NotRecorded') }}</p>
      </ReportCard>

      </div>
      <div class="space-y-4">
      <!-- Entrées et sorties : comparées au bilan antérieur de la ville (ou à la liste d'hier collée). -->
      <ReportCard v-if="guet" :title="t('SecurityCustoms.Report.Movements')" tone="teal" testid="guet-diff">
        <template v-if="guet.diff">
          <p class="text-sm text-slate-700 dark:text-slate-700">{{ guet.diff.compared_to ? t('SecurityCustoms.Report.ComparedTo', { date: day(guet.diff.compared_to) }) : t('SecurityCustoms.Report.ComparedToYesterday') }}</p>
          <div class="mt-2 grid gap-3 tablet:grid-cols-2">
            <div>
              <p class="flex items-center gap-1.5 text-sm font-bold text-teal-900 dark:text-teal-900"><span class="h-2.5 w-2.5 rounded-full bg-teal-500" aria-hidden="true"></span>{{ t('SecurityCustoms.Report.Arrivals', { count: guet.diff.arrivals.length }) }}</p>
              <p class="mt-1 flex flex-wrap gap-1 text-slate-800 dark:text-slate-800">
                <CustomsPseudo v-for="p in guet.diff.arrivals" :key="p.pseudo" :pseudo="p.pseudo" :colour="p.colour" :linked="linkDiff" />
                <span v-if="!guet.diff.arrivals.length" class="text-sm text-slate-600 dark:text-slate-600">{{ t('SecurityCustoms.Report.None') }}</span>
              </p>
            </div>
            <div>
              <p class="flex items-center gap-1.5 text-sm font-bold text-violet-900 dark:text-violet-900"><span class="h-2.5 w-2.5 rounded-full bg-violet-500" aria-hidden="true"></span>{{ t('SecurityCustoms.Report.Departures', { count: guet.diff.departures.length }) }}</p>
              <p class="mt-1 flex flex-wrap gap-1 text-slate-800 dark:text-slate-800">
                <CustomsPseudo v-for="p in guet.diff.departures" :key="p.pseudo" :pseudo="p.pseudo" :colour="p.colour" :linked="linkDiff" />
                <span v-if="!guet.diff.departures.length" class="text-sm text-slate-600 dark:text-slate-600">{{ t('SecurityCustoms.Report.None') }}</span>
              </p>
            </div>
          </div>
        </template>
        <p v-else class="text-sm text-slate-600 dark:text-slate-600">{{ t('SecurityCustoms.Report.NoPrevious') }}</p>
      </ReportCard>

      </div>
      <div class="space-y-4 laptop:col-span-2 min-[1500px]:col-span-1">
      <!-- Groupes : seul « Groupe de … » alerte (« groupe à surveiller », jamais « brigand »). Le détail d'un groupe n'est pas montré. -->
      <ReportCard v-if="block && groups.length" :title="t('SecurityCustoms.Report.Groups')" :tone="groups.some(g => g.alert) ? 'alert' : 'rose'" testid="report-armies-groups">
        <template v-if="groups.length > 3">
          <ReportGroupList v-if="watched.length" :groups="watched" />
          <details :class="watched.length ? 'mt-2' : ''">
            <summary class="cursor-pointer text-sm underline text-slate-800 dark:text-slate-800">{{ t('SecurityCustoms.Report.AllGroups', { count: groups.length }) }}</summary>
            <ReportGroupList :groups="groups" class="mt-2" />
          </details>
        </template>
        <ReportGroupList v-else :groups="groups" />
      </ReportCard>
      <ReportCard v-else :title="t('SecurityCustoms.Report.Groups')" tone="muted">
        <p class="text-sm text-slate-600 dark:text-slate-600">{{ t(block ? 'SecurityCustoms.Report.NoGroups' : 'SecurityCustoms.Report.NotRecorded') }}</p>
      </ReportCard>

      <!-- Armées. -->
      <ReportCard v-if="block && block.armies.length" :title="t('SecurityCustoms.Report.Armies')" testid="report-armies">
        <ul class="space-y-2">
          <li v-for="army in block.armies" :key="army.name" class="text-sm text-slate-800 dark:text-slate-800">
            <span class="font-bold">{{ army.name }}</span> — {{ t('SecurityCustoms.Report.ArmyLeader') }}
            <CustomsPseudo :pseudo="army.commander.pseudo" :colour="army.commander.colour" />
            <p v-if="army.status" class="whitespace-pre-line text-slate-700 dark:text-slate-700">{{ army.status }}</p>
          </li>
        </ul>
      </ReportCard>
      <ReportCard v-else :title="t('SecurityCustoms.Report.Armies')" tone="muted">
        <p class="text-sm text-slate-600 dark:text-slate-600">{{ t(block ? 'SecurityCustoms.Report.NoArmies' : 'SecurityCustoms.Report.NotRecorded') }}</p>
      </ReportCard>

      <!-- Contrôle de la zone. -->
      <ReportCard v-if="block && block.zone" :title="t('SecurityCustoms.Report.Zone')" testid="report-zone">
        <p class="whitespace-pre-line text-sm text-slate-800 dark:text-slate-800">{{ block.zone }}</p>
      </ReportCard>
      <ReportCard v-else :title="t('SecurityCustoms.Report.Zone')" tone="muted">
        <p class="text-sm text-slate-600 dark:text-slate-600">{{ t('SecurityCustoms.Report.NotRecorded') }}</p>
      </ReportCard>
      </div>
    </div>
  </div>
</template>
