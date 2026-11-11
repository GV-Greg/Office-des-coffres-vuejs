<script setup>
  import { ref, computed, onMounted } from 'vue'
  import { useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { apiMessage } from '@/stores/mandateStore'
  import useRewardsGrid from '@/use/useRewardsGrid'
  import useAnimKind from '@/use/useAnimKind'
  import AnimPublicShell from '@/components/anim/AnimPublicShell.vue'
  import ChestLoader from '@/components/loading/ChestLoader.vue'
  import RewardsGridHero from '@/components/anim/RewardsGridHero.vue'
  import RewardsGridBoard from '@/components/anim/RewardsGridBoard.vue'
  import RewardsGridClaimed from '@/components/anim/RewardsGridClaimed.vue'
  import RewardsGridLegend from '@/components/anim/RewardsGridLegend.vue'

  /*
    Grille des lots — page PUBLIQUE à partager (convention `/public/activite/grille/<slug>`), en lecture seule. Visible à partir du tirage :
    avant, le serveur répond « introuvable », comme pour une adresse inconnue. La coquille (menu, thème, langue, mention « site non officiel »)
    est celle de toutes les pages publiques d'Animation (AnimPublicShell). ⚠️ Aucune règle ici : le serveur n'envoie jamais le contenu d'une case
    non réclamée tant que la grille n'est pas close.
  */
  const { t, locale } = useI18n()
  const { kt } = useAnimKind('rewards')
  const route = useRoute()
  const api = useRewardsGrid()

  const grid = ref(null)
  const loading = ref(false)
  const error = ref('')    // panne : le coffre se referme et propose « Réessayer »
  const notFound = ref(false) // inconnue ou pas encore tirée : un constat, rien à réessayer

  async function load() {
    grid.value = null
    error.value = ''
    notFound.value = false
    loading.value = true
    try {
      grid.value = await api.show(String(route.params.slug))
    } catch (e) {
      if (e?.response?.status === 404) notFound.value = true
      else error.value = apiMessage(e, locale.value, t('Auth.Errors.NetworkError'))
    } finally {
      loading.value = false
    }
  }
  onMounted(load)

  function placeLine(place) {
    if (!place) return ''
    if (place.kind === 'kingdom') return t('Animation.Public.PlaceKingdom', { name: place.name })
    if (place.kind === 'province') return t('Animation.Public.PlaceProvince', { name: place.name })
    return t('Animation.Public.PlaceCity', { name: place.name })
  }

  const heroTitle = computed(() => (grid.value ? `${t('Animation.Types.rewards.Name')} « ${grid.value.name} »` : ''))

  const heroSubtitle = computed(() => {
    if (!grid.value) return ''
    const org = grid.value.organizer
      ? t('Animation.Public.Organizer', { name: grid.value.organizer })
      : t('Animation.Public.OrganizerGone')
    const place = grid.value.place ? placeLine(grid.value.place) : ''
    return place ? `${org} — ${place}` : org
  })

  </script>

<template>
  <AnimPublicShell>
    <ChestLoader :loading="loading" :error="error" accent="teal" error-testid="public-grid-error" @retry="load">
      <!-- Inconnue, ou pas encore tirée -->
      <div v-if="notFound" class="text-center py-10" role="alert" data-testid="public-grid-notfound">
        <v-icon name="gi-padlock" scale="2" class="text-slate-500" aria-hidden="true" />
        <p class="mt-2 text-slate-700 dark:text-slate-700">{{ kt('Public.NotFound') }}</p>
      </div>

      <!-- La grille -->
      <template v-else-if="grid">
        <!-- Héros : titre, dimensions, statut, organisateur + lieu -->
        <RewardsGridHero
          :title="heroTitle"
          :status-label="t(`Animation.GridStatus.${grid.status}`)"
          :badge="`${grid.width} × ${grid.height}`"
          :subtitle="heroSubtitle"
          title-testid="public-grid-title"
          status-testid="public-grid-status"
          class="mb-5"
        />

        <!-- Corps : la liste des lots à gauche, la grille au milieu, la légende à droite (comme l'écran de l'organisateur). Les cases se réduisent avec la hauteur de la grille pour qu'elle tienne à l'écran. -->
        <div
          class="grid grid-cols-1 gap-5 laptop:gap-14 items-start text-slate-800 dark:text-slate-800 laptop:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
        >
          <section class="min-w-0 laptop:order-2" data-testid="public-grid-board">
            <h2 class="sr-only">{{ t('Animation.Grid.BoardTitle') }}</h2>
            <RewardsGridBoard :grid="grid" :editable="false" />
          </section>

          <div class="laptop:order-1" data-testid="public-grid-claimed">
            <RewardsGridClaimed :grid="grid" readonly bare columns />
          </div>

          <div class="space-y-4 laptop:order-3">
            <RewardsGridLegend bare />
            <p v-if="grid.status === 'closed'" class="!mb-0 text-sm italic text-slate-700 dark:text-slate-700" data-testid="public-grid-closed">{{ kt('Public.ClosedNotice') }}</p>
          </div>
        </div>
      </template>
    </ChestLoader>
  </AnimPublicShell>
</template>
