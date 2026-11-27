<script setup>
  import { ref, computed, provide, watch } from 'vue'
  import { RouterLink, RouterView } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import NavMenu from '../../../components/NavMenu.vue'
  import HelpModal from '@/components/HelpModal.vue'
  import { useAuthStore } from '@/stores/authStore'
  import useMineAccess from '@/use/useMineAccess'
  import { useInventoryStore } from '@/stores/inventoryStore'

  const { t } = useI18n()
  const authStore = useAuthStore()

  const showHelp = ref(false)
  const showInventoryHelp = ref(false)
  const showRegistryHelp = ref(false)
  const showBalanceHelp = ref(false)
  const showStockRegistryHelp = ref(false)
  const showBirthsHelp = ref(false)
  const birthsHelpSteps = computed(() => [1, 2, 3].map(n => t(`EconomyBirths.HelpStep${n}`)))
  const inventoryHelpSteps = computed(() => [1, 2, 3, 4, 5].map(n => t(`EconomyInventory.HelpStep${n}`)))
  const balanceHelpSteps = computed(() => [1, 2, 3, 4, 5].map(n => t(`EconomyBalance.HelpStep${n}`)))
  const stockRegistryHelpSteps = computed(() => [1, 2, 3, 4, 5].map(n => t(`EconomyInventoryRegistry.HelpStep${n}`)))
  const registryHelpSteps = computed(() => [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => t(`EconomyMines.RegistryPage.HelpStep${n}`)))
  const helpSteps = computed(() => [
    t('EconomyMines.HelpStep1'),
    t('EconomyMines.HelpStep2'),
    t('EconomyMines.HelpStep3'),
    t('EconomyMines.HelpStep4'),
    t('EconomyMines.HelpStep5'),
  ])

  // Registre des mines : le lien n'apparaît qu'à qui peut le consulter (commissaire aux mines, bailli,
  // dirigeant) — la règle vient de l'API (GET characters/{id}/mine-registry), jamais recalculée ici.
  const { access, ready } = useMineAccess(() => (authStore.isLoggedIn ? authStore.activeCharacter?.id : null))
  // Un ancien titulaire (mandat terminé, poste éligible) y relit ses bilans en lecture seule : `past_mandates` (fil bilans-passes-mines).
  const canReadRegistry = computed(() => !!access.value?.read || (access.value?.past_mandates?.length ?? 0) > 0)

  // Registre des stocks : le lien n'apparaît qu'à qui peut le lire (maire, commissaire au commerce, dirigeant) — la règle vient de l'API
  // (GET characters/{id}/inventory-scopes), jamais recalculée ici. Charge les niveaux une fois par personnage (inventoryStore).
  const inventoryStore = useInventoryStore()
  watch(() => (authStore.isLoggedIn ? authStore.activeCharacter?.id : null), id => { if (id) inventoryStore.loadScopes() }, { immediate: true })
  const canReadStockRegistry = computed(() => inventoryStore.serverMode && !!(inventoryStore.scopes?.city || inventoryStore.scopes?.province))

  // EconomyHomeView injecte ces valeurs pour éviter un double appel API (même pattern qu'Animation).
  provide('economyAccess', access)
  provide('economyAccessReady', ready)
  provide('economyStockRegistryAccess', canReadStockRegistry)
</script>

<template>
  <div class="page-card">
    <div class="w-full flex flex-col laptop:flex-row flex-grow mb-2">
      <div class="w-full laptop:w-52 laptop:shrink-0 flex flex-col justify-start text-yellow-600">
        <RouterLink :to="{ name: 'economy-home' }" class="block text-center hover:opacity-80 transition-opacity">
          <h3>{{ t('Economy.Title') }}</h3>
        </RouterLink>
        <span class="block mt-3 mb-1 border-b border-slate-300 dark:border-slate-600 pb-0.5 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400" data-testid="menu-group-mines">{{ t('EconomyMenu.MinesGroup') }}</span>
        <div class="inline-flex items-center gap-1.5">
          <RouterLink :to="{ name: 'economy-mines' }" class="inline-flex items-center font-bold">
            <v-icon name="gi-chest" scale="2" class="mr-1"/>
            {{ t('Economy.MinesLink') }}
          </RouterLink>
          <button
            type="button"
            @click="showHelp = true"
            class="text-slate-500 dark:text-slate-400 hover:text-yellow-600 dark:hover:text-yellow-500"
            :aria-label="t('EconomyMines.HelpButton')"
            :title="t('EconomyMines.HelpButton')"
          >
            <v-icon name="fa-info-circle" scale="0.9" />
          </button>
        </div>

        <div v-if="canReadRegistry" class="inline-flex items-center gap-1.5 mt-2">
          <RouterLink :to="{ name: 'economy-registry' }" class="inline-flex items-center font-bold" data-testid="registry-link">
            <v-icon name="gi-chest" scale="2" class="mr-1"/>
            {{ t('Economy.MineRegistryLink') }}
          </RouterLink>
          <!-- Même icône d'aide que le Bilan des mines, juste au-dessus. -->
          <button
            type="button"
            @click="showRegistryHelp = true"
            class="text-slate-500 dark:text-slate-400 hover:text-yellow-600 dark:hover:text-yellow-500"
            :aria-label="t('EconomyMines.RegistryPage.HelpButton')"
            :title="t('EconomyMines.RegistryPage.HelpButton')"
            data-testid="registry-help"
          >
            <v-icon name="fa-info-circle" scale="0.9" />
          </button>
        </div>

        <span class="block mt-3 mb-1 border-b border-slate-300 dark:border-slate-600 pb-0.5 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400" data-testid="menu-group-inventories">{{ t('EconomyMenu.InventoriesGroup') }}</span>
        <div class="inline-flex items-center gap-1.5 mt-2">
          <RouterLink :to="{ name: 'economy-inventory' }" class="inline-flex items-center font-bold">
            <v-icon name="gi-chest" scale="2" class="mr-1"/>
            {{ t('Economy.InventoryLink') }}
          </RouterLink>
          <button
            type="button"
            @click="showInventoryHelp = true"
            class="text-slate-500 dark:text-slate-400 hover:text-yellow-600 dark:hover:text-yellow-500"
            :aria-label="t('EconomyInventory.HelpButton')"
            :title="t('EconomyInventory.HelpButton')"
          >
            <v-icon name="fa-info-circle" scale="0.9" />
          </button>
        </div>

        <div class="inline-flex items-center gap-1.5 mt-2">
          <RouterLink :to="{ name: 'economy-inventory-balance' }" class="inline-flex items-center font-bold" data-testid="balance-link">
            <v-icon name="gi-chest" scale="2" class="mr-1"/>
            {{ t('Economy.BalanceLink') }}
          </RouterLink>
          <button
            type="button"
            @click="showBalanceHelp = true"
            class="text-slate-500 dark:text-slate-400 hover:text-yellow-600 dark:hover:text-yellow-500"
            :aria-label="t('EconomyBalance.HelpButton')"
            :title="t('EconomyBalance.HelpButton')"
            data-testid="balance-help"
          >
            <v-icon name="fa-info-circle" scale="0.9" />
          </button>
        </div>

        <div v-if="canReadStockRegistry" class="inline-flex items-center gap-1.5 mt-2">
          <RouterLink :to="{ name: 'economy-inventory-registry' }" class="inline-flex items-center font-bold" data-testid="stock-registry-link">
            <v-icon name="gi-chest" scale="2" class="mr-1"/>
            {{ t('Economy.RegistryStocksLink') }}
          </RouterLink>
          <button
            type="button"
            @click="showStockRegistryHelp = true"
            class="text-slate-500 dark:text-slate-400 hover:text-yellow-600 dark:hover:text-yellow-500"
            :aria-label="t('EconomyInventoryRegistry.HelpButton')"
            :title="t('EconomyInventoryRegistry.HelpButton')"
            data-testid="stock-registry-help"
          >
            <v-icon name="fa-info-circle" scale="0.9" />
          </button>
        </div>

        <span class="block mt-3 mb-1 border-b border-slate-300 dark:border-slate-600 pb-0.5 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400" data-testid="menu-group-finances">{{ t('EconomyMenu.FinancesGroup') }}</span>
        <div class="inline-flex items-center gap-1.5 mt-2">
          <RouterLink :to="{ name: 'economy-births' }" class="inline-flex items-center font-bold" data-testid="births-link">
            <v-icon name="gi-chest" scale="2" class="mr-1"/>
            {{ t('Economy.BirthsLink') }}
          </RouterLink>
          <button
            type="button"
            @click="showBirthsHelp = true"
            class="text-slate-500 dark:text-slate-400 hover:text-yellow-600 dark:hover:text-yellow-500"
            :aria-label="t('EconomyBirths.HelpButton')"
            :title="t('EconomyBirths.HelpButton')"
            data-testid="births-help"
          >
            <v-icon name="fa-info-circle" scale="0.9" />
          </button>
        </div>
      </div>
      <div class="w-full laptop:w-auto laptop:flex-1 laptop:min-w-0 mt-2 laptop:mt-0 laptop:ml-2 p-1">
        <RouterView />
      </div>
    </div>
    <NavMenu />

    <HelpModal
      :show="showHelp"
      :title="t('EconomyMines.HelpTitle')"
      :purpose="t('EconomyMines.HelpPurpose')"
      :overview="t('EconomyMines.HelpOverview')"
      :steps="helpSteps"
      @close="showHelp = false"
    />

    <HelpModal
      :show="showInventoryHelp"
      :title="t('EconomyInventory.HelpTitle')"
      :purpose="t('EconomyInventory.HelpPurpose')"
      :overview="t('EconomyInventory.HelpOverview')"
      :steps="inventoryHelpSteps"
      @close="showInventoryHelp = false"
    />

    <HelpModal
      :show="showBalanceHelp"
      :title="t('EconomyBalance.HelpTitle')"
      :purpose="t('EconomyBalance.HelpPurpose')"
      :overview="t('EconomyBalance.HelpOverview')"
      :steps="balanceHelpSteps"
      @close="showBalanceHelp = false"
    />

    <HelpModal
      :show="showStockRegistryHelp"
      :title="t('EconomyInventoryRegistry.HelpTitle')"
      :purpose="t('EconomyInventoryRegistry.HelpPurpose')"
      :overview="t('EconomyInventoryRegistry.HelpOverview')"
      :steps="stockRegistryHelpSteps"
      @close="showStockRegistryHelp = false"
    />

    <HelpModal
      :show="showBirthsHelp"
      :title="t('EconomyBirths.HelpTitle')"
      :purpose="t('EconomyBirths.HelpPurpose')"
      :overview="t('EconomyBirths.HelpOverview')"
      :steps="birthsHelpSteps"
      @close="showBirthsHelp = false"
    />

    <HelpModal
      :show="showRegistryHelp"
      :title="t('EconomyMines.RegistryPage.HelpTitle')"
      :purpose="t('EconomyMines.RegistryPage.HelpPurpose')"
      :overview="t('EconomyMines.RegistryPage.HelpOverview')"
      :steps="registryHelpSteps"
      @close="showRegistryHelp = false"
    />
  </div>
</template>
