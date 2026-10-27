<script setup>
  import { ref, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute } from 'vue-router'
  import { apiMessage } from '@/stores/mandateStore'
  import { translateKingdomName } from '@/modules/kingdomTranslations'
  import useDecodeActivities from '@/use/useDecodeActivities'
  import ChestLoader from '@/components/loading/ChestLoader.vue'
  import AccessDenied from '@/components/loading/AccessDenied.vue'
  import DecodeStartPanel from '@/components/anim/DecodeStartPanel.vue'
  import DecodeHero from '@/components/anim/DecodeHero.vue'
  import DecodeAttemptsTable from '@/components/anim/DecodeAttemptsTable.vue'
  import DecodeOpenedChests from '@/components/anim/DecodeOpenedChests.vue'
  import DecodeRankingCard from '@/components/anim/DecodeRankingCard.vue'

  /*
    Décode le code — page PUBLIQUE d'une activité, en lecture seule (brief, lot 2). Sans nom : le panneau « Votre activité »
    (DecodeStartPanel) et les règles. Avec un nom : l'activité, ses règles (locales), le coffre en cours et ses tentatives,
    les coffres ouverts (combinaison révélée + découvreur) et le classement cumulé. ⚠️ Aucune règle ici et jamais
    le code d'un coffre scellé : le serveur ne l'envoie pas (seul l'organisateur le voit, dans « Ma salle »).
    Le lien est celui de l'export BBCode : /public/activite/decode/<slug> (page `DecodePublicView`) (l'adresse de l'activité, D8). Les deux modes (privé et sans compte).
    Une activité sans compte close se lit sur sa photo figée (D18) : nom, organisateur, lieu, codes trouvés et classement, rien d'autre.
    Vocabulaire (D34) : les noms inscrits sont ceux de PERSONNAGES.
  */
  const { t, locale } = useI18n()
  const route = useRoute()
  const api = useDecodeActivities()

  const name = computed(() => (route.params.slug ? String(route.params.slug) : ''))
  const activity = ref(null)
  const loading = ref(false)
  const error = ref('')    // panne : le coffre se referme et propose « Réessayer »
  const notFound = ref('') // activité inconnue : un constat, rien à réessayer

  async function load() {
    activity.value = null
    error.value = ''
    notFound.value = ''
    if (!name.value) return
    loading.value = true
    try {
      activity.value = await api.show(name.value)
    } catch (e) {
      if (e?.response?.status === 404) notFound.value = apiMessage(e, locale.value, t('Animation.Public.NotFound'))
      else error.value = apiMessage(e, locale.value, t('Auth.Errors.NetworkError'))
    } finally {
      loading.value = false
    }
  }
  watch(name, load, { immediate: true })

  const place = computed(() => {
    const p = activity.value?.place
    if (!p) return ''
    const key = { kingdom: 'PlaceKingdom', province: 'PlaceProvince', city: 'PlaceCity' }[p.kind]
    // Les noms de royaumes arrivent dans leur langue d'origine : on les traduit comme partout ailleurs.
    return t(`Animation.Public.${key}`, { name: p.kind === 'kingdom' ? translateKingdomName(p.name, locale.value) : p.name })
  })
  const subtitle = computed(() => (place.value ? `${organizer.value} — ${place.value}` : organizer.value))
  const organizer = computed(() => (activity.value?.organizer
    ? t('Animation.Public.Organizer', { name: activity.value.organizer })
    : t('Animation.Public.OrganizerGone')))
</script>

<template>
  <div class="w-full text-slate-800 dark:text-slate-800">
    <!-- Sans adresse : d'abord ce que CE visiteur peut faire (créer, reprendre, retrouver), puis les règles. -->
    <template v-if="!name">
      <!-- Le même encadré de tête que « Ma salle », réduit à l'essentiel : les cinq cases et le titre, ni badge ni nom de salle. -->
      <DecodeHero :title="t('Animation.Types.decode.Name')" :divider="false" title-testid="decode-title" cells-testid="decode-visual" />
      <div class="mt-5 grid gap-5 laptop:grid-cols-4 items-start">
        <div class="laptop:col-span-3">
          <DecodeStartPanel />
        </div>
        <section class="laptop:col-span-1 rounded-xl border border-slate-300 bg-white p-4 text-slate-800 dark:text-slate-800" data-testid="decode-rules-intro">
          <h3 class="!mt-0 text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-red-700 to-orange-600">{{ t('Animation.Types.decode.RulesTitle') }}</h3>
          <p class="!mb-0 text-sm text-slate-700 dark:text-slate-700">{{ t('Animation.Types.decode.Rules') }}</p>
        </section>
      </div>
    </template>

    <AccessDenied v-if="notFound" :message="notFound" testid="decode-not-found" />
    <ChestLoader v-else-if="name" :loading="loading" :error="error" accent="teal" illustration="gate" error-testid="decode-error" @retry="load">
      <article v-if="activity" data-testid="decode-activity">
        <!-- Pleine largeur : les trois quarts à gauche (l'encadré, puis les tentatives et les coffres ouverts côte à côte), un quart à droite (règles, classement). -->
        <div class="grid gap-5 laptop:grid-cols-4 items-start">
          <div class="laptop:col-span-3 space-y-5">
            <DecodeHero
              :title="activity.name"
              :status="activity.status"
              :subtitle="subtitle"
              :closed-notice="activity.status === 'closed' ? t('Animation.Public.ClosedNotice') : ''"
            />

            <div class="grid gap-5 tablet:grid-cols-2 items-start">
              <!-- Les tentatives du coffre en cours, sur une seule colonne. -->
              <section class="rounded-xl border border-slate-300 bg-white p-4" data-testid="decode-current">
                <template v-if="activity.current">
                  <p class="!m-0 flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-800"><v-icon name="gi-chest" scale="1.2" class="text-teal-700" aria-hidden="true" />{{ t('Animation.Public.CurrentChest', { number: activity.current.number }) }}</p>
                  <h3 class="!mt-0 text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-red-700 to-orange-600">{{ t('Animation.Public.AttemptsTitle') }}
                    <span class="text-sm font-normal text-slate-700 dark:text-slate-700" data-testid="decode-attempt-count">— {{ t('Animation.Mine.Attempts', { count: activity.current.proposals.length }, activity.current.proposals.length) }}</span>
                  </h3>
                  <p v-if="!activity.current.proposals.length" class="text-sm italic text-slate-700 dark:text-slate-700" data-testid="decode-no-attempts">{{ t('Animation.Public.NoAttempts') }}</p>
                  <DecodeAttemptsTable v-else :proposals="activity.current.proposals" />
                </template>
                <p v-else class="text-sm italic text-slate-700 dark:text-slate-700" data-testid="decode-no-chest">{{ t('Animation.Public.NoChest') }}</p>
              </section>

              <DecodeOpenedChests :opened="activity.opened" />
            </div>
          </div>

          <!-- À droite : les règles, puis le classement cumulé. -->
          <div class="laptop:col-span-1 space-y-5">
            <section class="rounded-xl border border-slate-300 bg-white p-4 text-slate-800 dark:text-slate-800" data-testid="decode-rules-card">
              <h3 class="!mt-0 text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-red-700 to-orange-600">{{ t('Animation.Types.decode.RulesTitle') }}</h3>
              <p class="!mb-0 text-sm text-slate-700 dark:text-slate-700" data-testid="decode-rules">{{ t('Animation.Types.decode.Rules') }}</p>
            </section>

            <DecodeRankingCard :ranking="activity.ranking" />
          </div>
        </div>
      </article>
    </ChestLoader>
  </div>
</template>
