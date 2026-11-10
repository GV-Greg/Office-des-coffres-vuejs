<script setup>
  import { ref, computed, onMounted } from 'vue'
  import { useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { RouterLink } from 'vue-router'
  import SelectorMenu from '@/components/SelectorMenu.vue'
  import RewardsGridHero from '@/components/anim/RewardsGridHero.vue'
  import RewardsGridBoard from '@/components/anim/RewardsGridBoard.vue'
  import logoHorizontal from '@/assets/logo/logo-horizontal.svg'
  import useRewardsGrid from '@/use/useRewardsGrid'
  import { apiMessage } from '@/stores/mandateStore'

  /*
    Grille des lots — page PUBLIQUE à partager (convention `/public/activite/grille/<slug>`).
    Visible à partir du statut `drawed`. Lecture seule.
    Hors de l'application : pas de NavBar ni de menu du module, thème et langue accessibles,
    footer « site non officiel ».
  */
  const { t, locale } = useI18n()
  const route = useRoute()
  const api = useRewardsGrid()

  const grid = ref(null)
  const loading = ref(true)
  const error = ref('')

  onMounted(async () => {
    try {
      grid.value = await api.show(route.params.slug)
    } catch (e) {
      error.value = apiMessage(e, locale.value, t('Animation.Public.NotFound'))
    } finally {
      loading.value = false
    }
  })

  function placeLine(place) {
    if (!place) return ''
    if (place.kind === 'kingdom') return t('Animation.Public.PlaceKingdom', { name: place.name })
    if (place.kind === 'province') return t('Animation.Public.PlaceProvince', { name: place.name })
    return t('Animation.Public.PlaceCity', { name: place.name })
  }

  const heroTitle = computed(() =>
    grid.value ? `${t('Animation.Types.rewards.Name')} « ${grid.value.name} »` : ''
  )

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
  <div class="flex-1 flex flex-col min-h-screen">
    <!-- Menu de la page publique -->
    <header class="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-3" data-testid="public-grid-menu">
      <span aria-hidden="true"></span>
      <RouterLink :to="{ name: 'welcome' }" class="justify-self-center" data-testid="public-grid-logo">
        <img :src="logoHorizontal" :alt="t('Common.SiteName')" class="h-10 tablet:h-12 w-auto" />
      </RouterLink>
      <div class="justify-self-end flex flex-wrap items-center justify-end gap-2">
        <RouterLink :to="{ name: 'animation' }" class="odc-btn odc-btn--soft odc-btn--sm odc--slate" data-testid="public-grid-organize">
          <v-icon name="gi-open-gate" aria-hidden="true" />{{ t('Animation.Public.Organize') }}
        </RouterLink>
        <SelectorMenu />
      </div>
    </header>

    <div class="px-2 flex-1">
      <div class="page-card">
        <!-- Chargement -->
        <div v-if="loading" class="text-center py-10" data-testid="public-grid-loading">
          <v-icon name="gi-chest" class="text-teal-600" scale="3" aria-hidden="true" />
          <p class="mt-2 text-sm text-slate-500">{{ t('Animation.Grid.Loading') }}</p>
        </div>

        <!-- Erreur -->
        <div v-else-if="error" class="text-center py-10" role="alert" data-testid="public-grid-error">
          <v-icon name="gi-padlock" scale="2" class="text-slate-400" aria-hidden="true" />
          <p class="mt-2 text-slate-600">{{ error }}</p>
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

          <!-- Corps : plateau (2/3) + sidebar lots (1/3) -->
          <div class="grid laptop:grid-cols-3 gap-5 items-start text-slate-800 dark:text-slate-200">

            <!-- Plateau -->
            <section class="laptop:col-span-2" data-testid="public-grid-board">
              <h2 class="text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">{{ t('Animation.Grid.BoardTitle') }}</h2>
              <RewardsGridBoard :grid="grid" :editable="false" />
            </section>

            <!-- Lots attribués -->
            <aside class="space-y-4">
              <div v-if="grid.lots.some(l => l.player)" class="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-4" data-testid="public-grid-claimed">
                <h2 class="!mt-0 text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">{{ t('Animation.Grid.ClaimedTitle') }}</h2>
                <ul class="space-y-1 text-sm">
                  <li v-for="lot in grid.lots.filter(l => l.player).sort((a,b) => a.place - b.place)" :key="lot.id" class="flex gap-2 flex-wrap">
                    <span class="font-mono text-slate-500 w-10 shrink-0">{{ t('Animation.Grid.Cell', { n: lot.place }) }}</span>
                    <span class="font-semibold text-orange-700 dark:text-orange-400">{{ lot.name }}</span>
                    <span class="text-slate-400">→</span>
                    <span class="text-slate-800 dark:text-slate-200">{{ lot.player }}</span>
                  </li>
                </ul>
              </div>
              <div v-else class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-center text-sm italic text-slate-500 dark:text-slate-400" data-testid="public-grid-no-claimed">
                {{ t('Animation.Grid.NoClaimed') }}
              </div>

              <p v-if="grid.status === 'closed'" class="text-sm italic text-slate-500 dark:text-slate-400" data-testid="public-grid-closed">{{ t('Animation.Public.ClosedNotice') }}</p>
            </aside>
          </div>
        </template>
      </div>
    </div>

    <p class="px-4 py-3 text-center text-xs text-slate-700 dark:text-slate-300" data-testid="public-grid-footer">{{ t('Animation.Public.Footer') }}</p>
  </div>
</template>
