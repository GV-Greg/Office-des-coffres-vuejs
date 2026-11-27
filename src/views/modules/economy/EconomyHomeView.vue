<script setup>
import { inject, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ModuleHomeCards from '@/components/ModuleHomeCards.vue'
import ChestLoader from '@/components/loading/ChestLoader.vue'

const { t } = useI18n()

const access = inject('economyAccess', null)
const ready = inject('economyAccessReady', true)
const stockRegistryAccess = inject('economyStockRegistryAccess', null)

// `past_mandates` : un ancien titulaire relit ses bilans en lecture seule (fil bilans-passes-mines).
const canAccessMandateTools = computed(() => !!(access?.value?.read || access?.value?.write || (access?.value?.past_mandates?.length ?? 0) > 0))

// Les mêmes groupes que le menu de gauche : Mines, Inventaires, puis Finances. Un groupe sans carte n'est pas affiché.
// Un groupe d'une seule carte n'occupe qu'une colonne ; deux cartes ou plus, deux colonnes.
const columnsOf = group => Math.min(group.items.length, 2)

const groups = computed(() => {
  const mines = [
    {
      key: 'mines',
      title: t('Economy.Cards.mines.Name'),
      description: t('Economy.Cards.mines.Description'),
      to: { name: 'economy-mines' },
      icon: 'gi-chest',
    },
  ]

  if (canAccessMandateTools.value) {
    mines.push({
      key: 'registry',
      title: t('Economy.Cards.registry.Name'),
      description: t('Economy.Cards.registry.Description'),
      to: { name: 'economy-registry' },
      icon: 'gi-scroll-unfurled',
    })
  }

  const inventories = [
    {
      key: 'inventory',
      title: t('Economy.Cards.inventory.Name'),
      description: t('Economy.Cards.inventory.Description'),
      to: { name: 'economy-inventory' },
      icon: 'gi-tied-scroll',
    },
    {
      key: 'balance',
      title: t('Economy.Cards.balance.Name'),
      description: t('Economy.Cards.balance.Description'),
      to: { name: 'economy-inventory-balance' },
      icon: 'gi-scales',
    },
  ]

  // Le Registre des stocks : seulement pour qui peut le lire (maire, commissaire au commerce, dirigeant) — le serveur le dit.
  if (stockRegistryAccess?.value) {
    inventories.push({
      key: 'inventoryRegistry',
      title: t('Economy.Cards.inventoryRegistry.Name'),
      description: t('Economy.Cards.inventoryRegistry.Description'),
      to: { name: 'economy-inventory-registry' },
      icon: 'gi-scroll-unfurled',
    })
  }

  const finances = [
    {
      key: 'births',
      title: t('Economy.Cards.births.Name'),
      description: t('Economy.Cards.births.Description'),
      to: { name: 'economy-births' },
      icon: 'gi-cow',
    },
  ]

  return [
    { key: 'mines', title: t('EconomyMenu.MinesGroup'), items: mines },
    { key: 'inventories', title: t('EconomyMenu.InventoriesGroup'), items: inventories },
    { key: 'finances', title: t('EconomyMenu.FinancesGroup'), items: finances },
  ].filter(g => g.items.length > 0)
})
</script>

<template>
  <div class="w-full max-w-6xl mx-auto">
    <header class="text-center mb-6">
      <h2 class="!mt-0 !mb-1 text-4xl tablet:text-5xl font-extrabold tracking-tight text-yellow-800 dark:text-yellow-800">{{ t('Economy.Home.Title') }}</h2>
      <div class="flex items-center justify-center gap-3 text-yellow-700 dark:text-yellow-700" aria-hidden="true">
        <span class="h-px w-16 bg-yellow-700/40"></span>
        <v-icon name="gi-crown-coin" scale="1.4" />
        <span class="h-px w-16 bg-yellow-700/40"></span>
      </div>
      <p class="!mt-1 !mb-0 text-base tablet:text-lg tablet:whitespace-nowrap italic leading-relaxed text-slate-600 dark:text-slate-600">{{ t('Economy.Home.Intro') }}</p>
    </header>

    <ChestLoader :loading="!ready" accent="gold" illustration="gate">
      <!-- Les groupes se rangent côte à côte, chacun large de ses colonnes : une seule carte = une seule colonne, deux cartes ou plus = deux colonnes
           (un troisième ensemble passera à la ligne). Largeur proportionnelle au nombre de colonnes, en style : une classe construite serait purgée. -->
      <div class="flex flex-wrap items-start gap-x-8 gap-y-6" data-testid="economy-groups">
        <section
          v-for="group in groups"
          :key="group.key"
          class="min-w-0"
          :style="{ flex: `${columnsOf(group)} 1 ${columnsOf(group) * 15}rem` }"
          :aria-labelledby="`economy-group-${group.key}`"
          :data-testid="`economy-group-${group.key}`"
        >
          <h3
            :id="`economy-group-${group.key}`"
            class="!mt-0 !mb-3 border-b border-yellow-700/40 pb-1 text-sm font-bold uppercase tracking-wider text-yellow-800 dark:text-yellow-800"
          >{{ group.title }}</h3>
          <ModuleHomeCards :items="group.items" accent="gold" :layout="columnsOf(group) === 1 ? 'single' : 'duo'" :testid="`economy-home-cards-${group.key}`" />
        </section>
      </div>
      <p v-if="groups.length === 0" class="text-center text-sm text-slate-400 dark:text-slate-500 italic py-6">
        {{ t('Economy.Home.Empty') }}
      </p>
    </ChestLoader>
  </div>
</template>
