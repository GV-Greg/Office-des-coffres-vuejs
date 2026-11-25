<script setup>
  import { ref, reactive, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { apiMessage } from '@/stores/mandateStore'
  import { useAuthStore } from '@/stores/authStore'
  import { formatFieldDate } from '@/modules/playerDates'
  import customsApi from '@/use/customsApi'
  import useCustomsAccess from '@/use/useCustomsAccess'
  import ChestLoader from '@/components/loading/ChestLoader.vue'
  import AccessDenied from '@/components/loading/AccessDenied.vue'
  import AccessLoader from '@/components/loading/AccessLoader.vue'
  import CustomsPseudo from '@/components/customs/CustomsPseudo.vue'

  /*
    La Table des douanes (module Sécurité, « La Salle des gardes » ; PR 5) : la table de commandement où
    le trio étale les registres de la province. Pour CHAQUE ville lisible, le dernier bilan en résumé — arrivées et départs (les pseudos), pseudos des listes
    rouge et verte avec leur rôle, groupes à surveiller, armées — dans un bloc dépliable ; les villes sans bilan en bas, grisées. LECTURE SEULE : un Registre de
    douane étendu, les mêmes données présentées ensemble.

    🔴 Chaque ligne porte le jour de SON bilan, JAMAIS de différentiel entre villes : un pseudo vu dans deux villes apparaît deux fois, chacune avec sa ville
    et son jour (on déduit le mouvement, on ne le dit pas). Le serveur agrège (`GET characters/{id}/customs-province`) : jamais le brut, l'auteur ni les listes
    complètes d'habitants.

    ⚠️ Aucune règle côté site : qui voit la table (au moins DEUX villes lisibles), quelles villes, le serveur le dit. Rien n'est gardé dans le navigateur.
  */
  const { t, locale } = useI18n()
  const authStore = useAuthStore()
  const api = customsApi()

  const character = computed(() => (authStore.isLoggedIn ? authStore.activeCharacter : null))
  const { access, ready } = useCustomsAccess(() => character.value?.id ?? null)
  const allowed = computed(() => (access.value?.readable_cities?.length ?? 0) >= 2)

  const overview = ref(null)
  const day = ref(null) // jour demandé ; null = aujourd'hui (le serveur dit lequel)
  const loading = ref(false)
  const error = ref('')
  const dayLabel = iso => formatFieldDate('customs_report_day', iso, locale.value)

  async function load() {
    if (!character.value || !allowed.value) return
    loading.value = true
    error.value = ''
    try {
      overview.value = await api.province(character.value.id, day.value)
    } catch (e) {
      // Un échec en naviguant garde la table affichée (et la barre pour réessayer) ; au premier chargement, il n'y a rien à garder.
      error.value = apiMessage(e, locale.value, t('Auth.Errors.NetworkError'))
    } finally {
      loading.value = false
    }
  }
  watch(allowed, (value) => { if (value) load() }, { immediate: true })

  // Naviguer dans les jours (Greg, 24/11/2026) : la situation AU jour choisi — pour chaque ville, son dernier bilan jusqu'à ce jour. Les jours viennent du
  // serveur (ceux qui ont un bilan dans une ville lisible) plus aujourd'hui, comme dans le Registre.
  const current = computed(() => overview.value?.as_of ?? null)
  const isToday = computed(() => !!overview.value && overview.value.as_of === overview.value.today)
  const dayOptions = computed(() => (overview.value ? [...new Set([...overview.value.days, overview.value.today, overview.value.as_of])].sort().reverse() : []))
  const dayIndex = computed(() => dayOptions.value.indexOf(current.value))
  const olderDay = computed(() => dayOptions.value[dayIndex.value + 1] ?? null)
  const newerDay = computed(() => (dayIndex.value > 0 ? dayOptions.value[dayIndex.value - 1] : null))
  function go(target) {
    day.value = !target || target === overview.value.today ? null : target
    load()
  }

  // Une ville n'a son bloc QUE si elle a un bilan CE JOUR-LÀ (Greg, 24/11/2026 : « aujourd'hui Ventadour n'a pas de bilan, hier oui, mais à la date du
  // jour il ne doit pas y en apparaître un ») ; sinon elle descend dans « Villes sans bilan ». Le dernier bilan plus ancien se retrouve en changeant de jour.
  const hasReportOn = city => city.last_report_day === overview.value?.as_of
  const withReport = computed(() => (overview.value?.cities ?? []).filter(hasReportOn))
  const withoutReport = computed(() => (overview.value?.cities ?? []).filter(c => !hasReportOn(c)))
  const of = (list, city) => (list ?? []).filter(item => item.city.id === city.id)
  const marksOf = city => of(overview.value?.marks, city)
  // TOUS les groupes de la ville (Greg, 24/11/2026), ceux à surveiller en tête.
  const groupsOf = city => [...of(overview.value?.groups, city)].sort((a, b) => Number(b.alert) - Number(a.alert))
  // La plaque dit déjà la date du dernier bilan : la colonne « Bilan » d'une rubrique n'apparaît que si une de ses lignes vient d'un AUTRE bilan, plus ancien.
  const showDay = (rows, city) => rows.some(row => row.day !== city.last_report_day)
  const armiesOf = city => of(overview.value?.armies, city)
  // Les habitants de l'accordéon : SANS ceux qui figurent déjà dans le tableau des listes, juste au-dessus (Greg, 24/11/2026).
  const unlistedOf = city => (city.villagers ?? []).filter(v => !v.colour)
  // Ce que contient le bilan, même quand rien n'est à surveiller : habitants, groupes (jamais leur détail), arrivées et départs — un bilan se VOIT.
  const countsOf = (city) => [
    city.inhabitants !== null && city.inhabitants !== undefined ? t('SecurityCustoms.Report.Summary.Inhabitants', { count: city.inhabitants }, city.inhabitants) : null,
    city.groups !== null && city.groups !== undefined ? t('SecurityCustoms.Report.Summary.Groups', { count: city.groups }, city.groups) : null,
    // Les arrivées et les départs, seulement s'il y en a (Greg, 24/11/2026) — mêmes mots que la synthèse du Registre ; `null` : pas de bilan antérieur à comparer.
    city.arrivals?.length ? t('SecurityCustoms.Report.Summary.Arrivals', { count: city.arrivals.length }, city.arrivals.length) : null,
    city.departures?.length ? t('SecurityCustoms.Report.Summary.Departures', { count: city.departures.length }, city.departures.length) : null,
  ].filter(Boolean).join(' · ')
  // Ce qui demande l'attention d'une ville : pseudos sur la liste ROUGE et groupes à surveiller.
  const alertsOf = city => marksOf(city).filter(m => m.colour === 'red').length + groupsOf(city).filter(g => g.alert).length

  // Synthèse de la province : seulement ce qui compte pour la sécurité, et seulement s'il y en a.
  // Seulement les villes affichées : une ville sans bilan ce jour-là n'apporte rien.
  const shown = id => withReport.value.some(c => c.id === id)
  const totals = computed(() => ({
    red: (overview.value?.marks ?? []).filter(m => shown(m.city.id) && m.colour === 'red').length,
    green: (overview.value?.marks ?? []).filter(m => shown(m.city.id) && m.colour === 'green').length,
    watch: (overview.value?.groups ?? []).filter(g => shown(g.city.id) && g.alert).length,
  }))

  // Tout voir d'un coup, ou se concentrer sur une ville : un état par ville (ouvert par défaut).
  const opened = reactive({})
  const isOpen = id => opened[id] !== false
  const setOpen = (id, value) => { opened[id] = value }
  const setAll = (value) => { for (const city of withReport.value) opened[city.id] = value }
</script>

<template>
  <div class="w-full" data-testid="table-page">
    <ChestLoader :loading="!ready || (loading && !overview)" accent="rose" error-testid="table-chest-error">
      <AccessDenied v-if="!allowed" :message="t('SecurityCustomsTable.NoAccess')" testid="table-denied" />

      <div v-else class="space-y-4" :aria-busy="loading">
        <div class="-mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <h1 class="!mt-0 bg-none text-3xl laptop:text-4xl text-rose-600" data-testid="table-title">{{ t('SecurityCustomsTable.Title') }}</h1>
        </div>

        <p v-if="error" role="alert" class="font-bold text-red-800 dark:text-red-800" data-testid="table-error">{{ error }}</p>

        <template v-if="overview">
          <!-- Barre : la province (dite par le serveur, pas un choix), la synthèse, déplier ou replier tout. -->
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-yellow-700/40 bg-white px-4 py-2.5" data-testid="table-bar">
            <label class="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-800"><span class="font-bold">{{ t('SecurityCustoms.Province') }}</span>
              <select disabled class="rounded p-1 disabled:opacity-100 disabled:text-slate-800" data-testid="table-province">
                <option>{{ overview.province.name }}</option>
              </select>
            </label>
            <div class="flex items-center gap-1" data-testid="table-days">
              <button type="button" class="odc-btn odc-btn--soft odc-btn--icon odc-btn--sm odc--slate" :disabled="!olderDay || loading" :aria-label="t('SecurityCustoms.OlderDay')" :title="t('SecurityCustoms.OlderDay')" data-testid="table-older" @click="go(olderDay)">
                <v-icon name="fa-chevron-left" aria-hidden="true" />
              </button>
              <label class="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-800"><span class="font-bold">{{ t('SecurityCustoms.Day') }}</span>
                <select :value="current" :disabled="loading" class="rounded p-1" data-testid="table-day" @change="go($event.target.value)">
                  <option v-for="d in dayOptions" :key="d" :value="d">{{ dayLabel(d) }}</option>
                </select>
              </label>
              <button type="button" class="odc-btn odc-btn--soft odc-btn--icon odc-btn--sm odc--slate" :disabled="!newerDay || loading" :aria-label="t('SecurityCustoms.NewerDay')" :title="t('SecurityCustoms.NewerDay')" data-testid="table-newer" @click="go(newerDay)">
                <v-icon name="fa-chevron-right" aria-hidden="true" />
              </button>
              <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--slate" :disabled="isToday || loading" data-testid="table-today" @click="go(null)">{{ t('SecurityCustoms.Today') }}</button>
            </div>
            <p class="!my-0 text-sm text-slate-700 dark:text-slate-700" data-testid="table-note">{{ t('SecurityCustomsTable.Note') }}</p>
            <ul v-if="totals.red || totals.green || totals.watch" class="flex flex-wrap gap-2" data-testid="table-totals">
              <li v-if="totals.red" class="rounded-full border border-red-500 bg-red-100 px-3 py-0.5 text-sm font-semibold text-red-900" data-tone="red">{{ t('SecurityCustoms.Report.Summary.RedMarks', { count: totals.red }) }}</li>
              <li v-if="totals.green" class="rounded-full border border-green-600 bg-green-100 px-3 py-0.5 text-sm font-semibold text-green-900" data-tone="green">{{ t('SecurityCustoms.Report.Summary.GreenMarks', { count: totals.green }) }}</li>
              <li v-if="totals.watch" class="rounded-full border border-orange-600 bg-orange-100 px-3 py-0.5 text-sm font-semibold text-orange-900" data-tone="alert">{{ t('SecurityCustoms.Report.Summary.GroupsToWatch', { count: totals.watch }, totals.watch) }}</li>
            </ul>
            <span class="flex-1"></span>
            <div v-if="withReport.length" class="flex gap-2">
              <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--slate" data-testid="table-expand" @click="setAll(true)">{{ t('SecurityCustomsTable.ExpandAll') }}</button>
              <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--slate" data-testid="table-collapse" @click="setAll(false)">{{ t('SecurityCustomsTable.CollapseAll') }}</button>
            </div>
          </div>

          <!-- Changer de jour : le petit loader de composant du Bilan des mines (AccessLoader : le cadenas, aux couleurs de la Sécurité, aligné en haut) à la place des blocs ; la barre de navigation reste. -->
          <AccessLoader v-if="loading" icon-class="text-rose-700 dark:text-rose-700" min-height="16rem" top />
          <template v-else>
            <!-- Aucun bilan ce jour-là : un état à part entière, centré (Greg, 24/11/2026), pas une simple ligne de texte. -->
            <div v-if="!withReport.length" class="mx-auto flex max-w-md flex-col items-center gap-2 rounded-xl border border-yellow-700/40 bg-white px-6 py-6 text-center" data-testid="table-empty">
              <v-icon name="gi-scroll-unfurled" scale="2" class="text-rose-700 dark:text-rose-700" aria-hidden="true" />
              <p class="!my-0 text-base font-bold text-slate-800 dark:text-slate-800">{{ t('SecurityCustomsTable.NoReportAtAll') }}</p>
            </div>

            <!-- Une ville = un bloc dépliable : la plaque (nom, ce qui demande l'attention, âge du bilan), puis le résumé de son dernier bilan. -->
            <!-- Au large (1500 px et plus) deux villes côte à côte ; chaque bloc garde ses DEUX colonnes de rubriques (Greg, 24/11/2026). -->
            <div v-if="withReport.length" class="grid grid-cols-1 items-start gap-4 min-[1500px]:grid-cols-2" data-testid="table-blocks">
              <details
                v-for="city in withReport"
                :key="city.id"
                class="city-block group"
                :open="isOpen(city.id)"
                :data-testid="`table-city-${city.id}`"
                @toggle="setOpen(city.id, $event.target.open)"
              >
                <summary class="city-plate flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-4 py-2.5" data-testid="table-summary">
                  <v-icon name="fa-chevron-right" scale="0.8" class="city-chevron shrink-0" aria-hidden="true" />
                  <v-icon name="gi-tower-flag" scale="1.2" class="plate-kicker shrink-0" aria-hidden="true" />
                  <span class="plate-title text-lg font-bold" data-testid="table-city-name">{{ city.name }}</span>
                  <span v-if="countsOf(city)" class="plate-note text-sm" data-testid="table-counts">{{ countsOf(city) }}</span>
                  <span v-if="alertsOf(city)" class="rounded-full border border-orange-300 bg-orange-100 px-2 text-xs font-bold text-orange-900" data-testid="table-alert">
                    <v-icon name="fa-exclamation-triangle" scale="0.7" aria-hidden="true" /> {{ alertsOf(city) }}
                  </span>
                  <span class="flex-1"></span>
                </summary>

                <div class="rounded-b-xl border border-t-0 border-yellow-700/40 bg-white px-4 py-4" data-testid="table-body">
                  <div class="grid grid-cols-1 gap-x-6 gap-y-5 laptop:grid-cols-2">
                    <!-- Arrivées et départs : les PSEUDOS, comparés au bilan antérieur de la MÊME ville. -->
                    <section data-testid="table-moves">
                      <h4 class="section-title"><v-icon name="gi-entry-door" scale="0.9" aria-hidden="true" />{{ t('SecurityCustomsTable.Moves') }}</h4>
                      <template v-if="city.arrivals !== null">
                        <p class="text-sm text-slate-700 dark:text-slate-700">{{ t('SecurityCustoms.Report.ComparedTo', { date: dayLabel(city.compared_to) }) }}</p>
                        <div class="mt-2 grid gap-3 tablet:grid-cols-2">
                          <div>
                            <p class="flex items-center gap-1.5 text-sm font-bold text-teal-900 dark:text-teal-900"><span class="h-2.5 w-2.5 rounded-full bg-teal-500" aria-hidden="true"></span>{{ t('SecurityCustoms.Report.Arrivals', { count: city.arrivals.length }) }}</p>
                            <p class="pseudo-list mt-1 flex flex-wrap gap-x-1 text-sm text-slate-800 dark:text-slate-800" data-testid="table-arrivals">
                              <CustomsPseudo plain v-for="p in city.arrivals" :key="p.pseudo" :pseudo="p.pseudo" :colour="p.colour" />
                              <span v-if="!city.arrivals.length" class="text-sm text-slate-600 dark:text-slate-600">{{ t('SecurityCustoms.Report.None') }}</span>
                            </p>
                          </div>
                          <div>
                            <p class="flex items-center gap-1.5 text-sm font-bold text-violet-900 dark:text-violet-900"><span class="h-2.5 w-2.5 rounded-full bg-violet-500" aria-hidden="true"></span>{{ t('SecurityCustoms.Report.Departures', { count: city.departures.length }) }}</p>
                            <p class="pseudo-list mt-1 flex flex-wrap gap-x-1 text-sm text-slate-800 dark:text-slate-800" data-testid="table-departures">
                              <CustomsPseudo plain v-for="p in city.departures" :key="p.pseudo" :pseudo="p.pseudo" :colour="p.colour" />
                              <span v-if="!city.departures.length" class="text-sm text-slate-600 dark:text-slate-600">{{ t('SecurityCustoms.Report.None') }}</span>
                            </p>
                          </div>
                        </div>
                  </template>
                  <p v-else class="text-sm text-slate-600 dark:text-slate-600">{{ t('SecurityCustoms.Report.NoPrevious') }}</p>
                  </section>

                  <!-- Habitants et listes : les pseudos des listes rouge et verte (leur rôle, le jour du bilan si différent) et, repliée, la liste des habitants. -->
                  <section data-testid="table-marks">
                    <h4 class="section-title"><v-icon name="gi-scroll-unfurled" scale="0.9" aria-hidden="true" />{{ t('SecurityCustomsTable.Marks.Title') }}</h4>
                    <div v-if="marksOf(city).length" class="overflow-x-auto">
                      <table class="text-sm">
                        <thead><tr><th>{{ t('SecurityCustomsTable.Marks.Pseudo') }}</th><th>{{ t('SecurityCustomsTable.Marks.As') }}</th><th v-if="showDay(marksOf(city), city)">{{ t('SecurityCustomsTable.Day') }}</th></tr></thead>
                        <tbody class="text-slate-800 dark:text-slate-800">
                          <tr v-for="(mark, index) in marksOf(city)" :key="index" data-testid="table-mark">
                            <td class="!px-2 !py-1.5"><CustomsPseudo plain :pseudo="mark.pseudo" :colour="mark.colour" /></td>
                            <td class="!px-2 !py-1.5">{{ t(`SecurityCustomsTable.Marks.Roles.${mark.as}`) }}</td>
                            <td v-if="showDay(marksOf(city), city)" class="!px-2 !py-1.5 whitespace-nowrap tabular-nums">{{ dayLabel(mark.day) }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p v-else class="text-sm text-slate-600 dark:text-slate-600">{{ t('SecurityCustomsTable.Marks.Empty') }}</p>
                    <!-- Les habitants (Greg, 24/11/2026), sous les marques, dans un accordéon FERMÉ — sans ceux des listes, déjà au-dessus. -->
                    <details v-if="unlistedOf(city).length" class="mt-3" data-testid="table-villagers">
                      <summary class="cursor-pointer text-sm font-bold underline text-slate-800 dark:text-slate-800">{{ t('SecurityCustoms.Report.Villagers', { count: unlistedOf(city).length }) }}</summary>
                      <ul class="mt-2 grid gap-x-4 gap-y-1 text-sm text-slate-800 dark:text-slate-800 [grid-template-columns:repeat(auto-fill,minmax(10rem,1fr))]">
                        <li v-for="v in unlistedOf(city)" :key="v.pseudo" data-testid="table-villager">
                          <CustomsPseudo plain :pseudo="v.pseudo" :colour="v.colour" />
                          <span v-if="v.noblesse" class="ml-1 text-slate-700 dark:text-slate-700">{{ v.noblesse }}</span>
                        </li>
                      </ul>
                    </details>
                  </section>

                  <!-- Groupes : TOUS (Greg, 24/11/2026) ; seul « Groupe de … » alerte (« groupe à surveiller », jamais « brigand »). Le détail d'un groupe n'est pas montré. -->
                  <section data-testid="table-groups">
                    <h4 class="section-title"><v-icon name="gi-swords-emblem" scale="0.9" aria-hidden="true" />{{ t('SecurityCustoms.Report.Groups') }}</h4>
                    <!-- Une LISTE de phrases (Greg, 24/11/2026) : « Lance composée de … », « Groupe de maréchaux composé de … ». Seul « Groupe composé de … » est mis en exergue. -->
                    <ul v-if="groupsOf(city).length" class="list-disc space-y-1 pl-5 text-sm text-slate-800 marker:text-slate-600 dark:text-slate-800">
                      <li
                        v-for="(group, index) in groupsOf(city)"
                        :key="index"
                        class="rounded py-0.5 pl-1 pr-2"
                        :class="group.alert ? 'bg-orange-100 font-semibold text-orange-950 marker:text-orange-700 dark:text-orange-950' : ''"
                        data-testid="table-group"
                        :data-alert="group.alert ? 'true' : 'false'"
                      >
                        <span class="mr-1" :class="group.alert ? 'font-bold' : ''" data-testid="table-group-lead">
                          <v-icon v-if="group.alert" name="fa-exclamation-triangle" scale="0.8" class="mr-1" aria-hidden="true" data-testid="table-group-alert" />{{ t(`SecurityCustomsTable.Groups.Lead.${group.type}`) }}
                        </span>
                        <span v-if="group.members.length" class="pseudo-list"><CustomsPseudo plain v-for="member in group.members" :key="member.pseudo" :pseudo="member.pseudo" :colour="member.colour" /></span>
                        <span v-if="showDay(groupsOf(city), city)" class="ml-1 tabular-nums text-slate-600 dark:text-slate-600" data-testid="table-group-day">({{ dayLabel(group.day) }})</span>
                      </li>
                    </ul>
                    <p v-else class="text-sm text-slate-600 dark:text-slate-600">{{ t('SecurityCustoms.Report.NoGroups') }}</p>
                  </section>

                  <!-- Armées. -->
                  <section data-testid="table-armies">
                    <h4 class="section-title"><v-icon name="gi-bugle-call" scale="0.9" aria-hidden="true" />{{ t('SecurityCustoms.Report.Armies') }}</h4>
                    <div v-if="armiesOf(city).length" class="overflow-x-auto">
                      <table class="text-sm">
                        <thead><tr><th>{{ t('SecurityCustomsTable.Armies.Army') }}</th><th>{{ t('SecurityCustomsTable.Armies.Leader') }}</th><th v-if="showDay(armiesOf(city), city)">{{ t('SecurityCustomsTable.Day') }}</th></tr></thead>
                        <tbody class="text-slate-800 dark:text-slate-800">
                          <tr v-for="(army, index) in armiesOf(city)" :key="index" data-testid="table-army">
                            <td class="!px-2 !py-1.5 font-bold">{{ army.name }}</td>
                            <td class="!px-2 !py-1.5"><CustomsPseudo plain :pseudo="army.commander.pseudo" :colour="army.commander.colour" /></td>
                            <td v-if="showDay(armiesOf(city), city)" class="!px-2 !py-1.5 whitespace-nowrap tabular-nums">{{ dayLabel(army.day) }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p v-else class="text-sm text-slate-600 dark:text-slate-600">{{ t('SecurityCustomsTable.Armies.Empty') }}</p>
                  </section>
                </div>

              </div>
            </details>
          </div>

          <!-- Les villes sans bilan, en bas et grisées : l'absence d'information se voit. -->
          <section v-if="withoutReport.length" class="space-y-1" data-testid="table-without">
            <h4 class="section-title !text-slate-600 dark:!text-slate-600">{{ t('SecurityCustomsTable.WithoutReport') }}</h4>
            <ul class="grid gap-x-6 [grid-template-columns:repeat(auto-fill,minmax(13rem,1fr))]">
              <li v-for="city in withoutReport" :key="city.id" class="flex items-center gap-2 py-0.5 text-sm text-slate-600 dark:text-slate-600" :data-testid="`table-city-${city.id}`">
                <v-icon name="gi-tower-flag" scale="0.9" aria-hidden="true" />
                <span class="font-bold">{{ city.name }}</span>
                <span data-testid="table-age">{{ t('SecurityCustomsTable.NoReport') }}</span>
              </li>
            </ul>
          </section>
          </template>
        </template>
      </div>
    </ChestLoader>
  </div>
</template>

<style scoped>
  /* Des pseudos sans cadre, séparés par des virgules : la place compte. */
  .pseudo-list > * { margin-right: 0.25rem; }
  /* La virgule colle au pseudo : le pseudo est un bloc en ligne à gap de 0,25 rem, on le rattrape. */
  .pseudo-list > :not(:last-child)::after { content: ','; margin-left: -0.25rem; }
  /* Plaque de ville : la matière des plaques du menu (charte §3.1) — ardoise bordée d'ambre, texte crème. Couleurs en CSS scopé : la spécificité passe
     devant la règle globale `.dark p`. */
  .city-plate {
    background: linear-gradient(160deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid #d97706;
    box-shadow: inset 0 1px 0 rgb(253 230 138 / 0.18), 0 6px 16px -8px rgb(69 26 3 / 0.55);
    list-style: none;
  }
  .city-plate::-webkit-details-marker { display: none; }
  .city-block[open] > .city-plate { border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
  .city-chevron { color: #fde68a; transition: transform 0.15s ease; }
  .city-block[open] .city-chevron { transform: rotate(90deg); }
  .plate-kicker { color: #fde68a; }
  .plate-title { color: #fef3c7; }
  .plate-note { color: #cbd5e1; }

  /* Titre de section d'un bloc : un h4 global est un grand titre en dégradé — ici un intertitre sobre. */
  .section-title {
    margin: 0 0 0.4rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.95rem;
    font-weight: 700;
    color: #9f1239;
    background: none;
    -webkit-text-fill-color: currentColor;
  }
  @media (prefers-reduced-motion: reduce) { .city-chevron { transition: none; } }
</style>
