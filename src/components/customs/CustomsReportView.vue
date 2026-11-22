<script setup>
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { formatFieldDate } from '@/modules/playerDates'
  import CustomsPseudo from '@/components/customs/CustomsPseudo.vue'

  /*
    Un bilan de défense, tel que le serveur le sert : JAMAIS le brut, JAMAIS l'auteur (`by_me` seulement, politique §6). Les couleurs sont
    calculées par le serveur à la date du bilan, à partir des listes de la province ; ce composant ne compare aucun pseudo.
    « Groupe à surveiller », jamais « brigand » (Greg, P8) : seul le type `groupe` alerte.
  */
  const props = defineProps({
    report: { type: Object, required: true },
  })
  const { t, locale } = useI18n()

  const sections = computed(() => props.report.sections ?? {})
  const guet = computed(() => sections.value.guet ?? null)
  const visions = computed(() => sections.value.visions ?? null)
  const block = computed(() => sections.value.armies_groups ?? null)
  const day = iso => formatFieldDate('customs_report_day', iso, locale.value)
  const coloured = computed(() => (guet.value?.villagers ?? []).filter(v => v.colour))
</script>

<template>
  <div class="space-y-5" data-testid="customs-report">
    <section v-if="guet" data-testid="report-guet">
      <h3 class="!mb-0 text-base font-bold text-slate-800 dark:text-slate-800">{{ t('SecurityCustoms.Report.Villagers', { count: guet.read_total }) }}</h3>
      <p v-if="guet.total_matches === false" role="alert" class="text-sm font-bold text-orange-800 dark:text-orange-800" data-testid="total-mismatch">
        {{ t('SecurityCustoms.Report.TotalMismatch', { declared: guet.declared_total, read: guet.read_total }) }}
      </p>

      <!-- Les pseudos colorés d'abord : c'est ce que le registre sert à voir. -->
      <p v-if="coloured.length" class="mt-1 flex flex-wrap gap-1 text-slate-800 dark:text-slate-800" data-testid="coloured-villagers">
        <CustomsPseudo v-for="v in coloured" :key="v.pseudo" :pseudo="v.pseudo" :colour="v.colour" />
      </p>
      <details class="mt-2">
        <summary class="cursor-pointer text-sm underline">{{ t('SecurityCustoms.Report.AllVillagers') }}</summary>
        <ul class="mt-2 grid gap-x-4 gap-y-1 text-sm [grid-template-columns:repeat(auto-fill,minmax(14rem,1fr))]">
          <li v-for="v in guet.villagers" :key="v.pseudo">
            <CustomsPseudo :pseudo="v.pseudo" :colour="v.colour" />
            <span v-if="v.noblesse" class="ml-1 text-slate-700">{{ v.noblesse }}</span>
          </li>
        </ul>
      </details>

      <div class="mt-3" data-testid="guet-diff">
        <template v-if="guet.diff">
          <p class="text-sm text-slate-700 dark:text-slate-700">{{ t('SecurityCustoms.Report.ComparedTo', { date: day(guet.diff.compared_to) }) }}</p>
          <div class="grid gap-3 mt-1 laptop:grid-cols-2">
            <div>
              <p class="font-bold text-sm text-slate-800 dark:text-slate-800">{{ t('SecurityCustoms.Report.Arrivals', { count: guet.diff.arrivals.length }) }}</p>
              <p class="flex flex-wrap gap-1 mt-1 text-slate-800 dark:text-slate-800">
                <CustomsPseudo v-for="p in guet.diff.arrivals" :key="p.pseudo" :pseudo="p.pseudo" :colour="p.colour" />
                <span v-if="!guet.diff.arrivals.length" class="text-sm text-slate-600">{{ t('SecurityCustoms.Report.None') }}</span>
              </p>
            </div>
            <div>
              <p class="font-bold text-sm text-slate-800 dark:text-slate-800">{{ t('SecurityCustoms.Report.Departures', { count: guet.diff.departures.length }) }}</p>
              <p class="flex flex-wrap gap-1 mt-1 text-slate-800 dark:text-slate-800">
                <CustomsPseudo v-for="p in guet.diff.departures" :key="p.pseudo" :pseudo="p.pseudo" :colour="p.colour" />
                <span v-if="!guet.diff.departures.length" class="text-sm text-slate-600">{{ t('SecurityCustoms.Report.None') }}</span>
              </p>
            </div>
          </div>
        </template>
        <p v-else class="text-sm text-slate-600 dark:text-slate-600">{{ t('SecurityCustoms.Report.NoPrevious') }}</p>
      </div>
    </section>

    <section v-if="visions" data-testid="report-visions">
      <h3 class="!mb-0 text-base font-bold text-slate-800 dark:text-slate-800">{{ t('SecurityCustoms.Report.Visions') }}</h3>
      <ul class="mt-1 space-y-1">
        <li v-for="(entry, index) in visions.entries" :key="index" class="flex flex-wrap items-center gap-1">
          <CustomsPseudo v-for="p in entry.singles" :key="p.pseudo" :pseudo="p.pseudo" :colour="p.colour" />
          <span v-for="(group, gi) in entry.groups" :key="`g${gi}`" class="inline-flex flex-wrap items-center gap-1 rounded border border-slate-300 px-1.5 py-0.5">
            <span class="text-xs font-bold uppercase text-slate-700">{{ t('SecurityCustoms.Report.VisionGroup') }}</span>
            <CustomsPseudo v-for="p in group" :key="p.pseudo" :pseudo="p.pseudo" :colour="p.colour" />
          </span>
        </li>
      </ul>
      <p v-if="visions.other_days" class="text-sm text-slate-600 mt-1 dark:text-slate-600">{{ t('SecurityCustoms.Report.VisionsOtherDays', { count: visions.other_days }) }}</p>
    </section>

    <section v-if="block" data-testid="report-armies-groups">
      <template v-if="block.armies.length">
        <h3 class="!mb-0 text-base font-bold text-slate-800 dark:text-slate-800">{{ t('SecurityCustoms.Report.Armies') }}</h3>
        <ul class="mt-1 space-y-2">
          <li v-for="army in block.armies" :key="army.name" class="text-sm">
            <span class="font-bold">{{ army.name }}</span> — {{ t('SecurityCustoms.Report.ArmyLeader') }}
            <CustomsPseudo :pseudo="army.commander.pseudo" :colour="army.commander.colour" />
            <p v-if="army.status" class="text-slate-700 whitespace-pre-line dark:text-slate-700">{{ army.status }}</p>
          </li>
        </ul>
      </template>

      <template v-if="block.groups.length">
        <h3 class="!mb-0 mt-3 text-base font-bold text-slate-800 dark:text-slate-800">{{ t('SecurityCustoms.Report.Groups') }}</h3>
        <ul class="mt-1 space-y-2">
          <li v-for="(group, index) in block.groups" :key="index" class="text-sm" :data-alert="group.alert ? 'true' : 'false'">
            <span class="font-bold">{{ t(`SecurityCustoms.Report.GroupTypes.${group.type}`) }}</span>
            <span v-if="group.alert" class="ml-1 inline-flex items-center gap-1 rounded border border-orange-600 bg-orange-100 px-1.5 text-xs font-bold text-orange-900" data-testid="group-alert">
              <v-icon name="fa-exclamation-triangle" scale="0.7" aria-hidden="true" />
              {{ t('SecurityCustoms.Report.GroupAlert') }}
            </span>
            <span class="ml-1 inline-flex flex-wrap gap-1">
              <CustomsPseudo v-for="p in group.members" :key="p.pseudo" :pseudo="p.pseudo" :colour="p.colour" />
            </span>
            <p v-if="group.status" class="text-slate-700 whitespace-pre-line dark:text-slate-700">{{ group.status }}</p>
          </li>
        </ul>
      </template>

      <template v-if="block.zone">
        <h3 class="!mb-0 mt-3 text-base font-bold text-slate-800 dark:text-slate-800">{{ t('SecurityCustoms.Report.Zone') }}</h3>
        <p class="text-sm whitespace-pre-line text-slate-800 dark:text-slate-800">{{ block.zone }}</p>
      </template>
    </section>
  </div>
</template>
