<script setup>
  import { ref, computed, watch } from 'vue'
  import { RouterLink, RouterView } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import NavMenu from '../../../components/NavMenu.vue'
  import HelpModal from '@/components/HelpModal.vue'
  import { useAuthStore } from '@/stores/authStore'
  import { http } from '@/api.js'

  const { t } = useI18n()
  const authStore = useAuthStore()

  const showHelp = ref(false)
  const helpSteps = computed(() => [
    t('EconomyMines.HelpStep1'),
    t('EconomyMines.HelpStep2'),
    t('EconomyMines.HelpStep3'),
    t('EconomyMines.HelpStep4'),
  ])

  // Registre des mines : le lien n'apparaît qu'à qui peut le consulter (commissaire aux mines, bailli,
  // dirigeant) — la règle vient de l'API (GET characters/{id}/mine-registry), jamais recalculée ici.
  const canReadRegistry = ref(false)
  watch(
    () => (authStore.isLoggedIn ? authStore.activeCharacter?.id : null),
    async (id) => {
      canReadRegistry.value = false
      if (!id) return
      try {
        const { data } = await http.get(`characters/${id}/mine-registry`, { headers: { Authorization: `Bearer ${authStore.getToken}` } })
        canReadRegistry.value = !!data?.read
      } catch {
        canReadRegistry.value = false
      }
    },
    { immediate: true },
  )
</script>

<template>
  <div class="page-card">
    <div class="w-full flex flex-grow mb-2">
      <div class="w-1/6 flex flex-col justify-start text-yellow-600">
        <h3 class="text-center">{{ t('Economy.Title') }}</h3>
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

        <RouterLink v-if="canReadRegistry" :to="{ name: 'economy-registry' }" class="inline-flex items-center mt-2 font-bold" data-testid="registry-link">
          <v-icon name="gi-chest" scale="2" class="mr-1"/>
          {{ t('Economy.MineRegistryLink') }}
        </RouterLink>
      </div>
      <div class="w-5/6 ml-2 p-1">
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
  </div>
</template>
