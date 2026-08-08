<script setup>
  import { ref, computed } from 'vue'
  import { RouterLink, RouterView } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import NavMenu from '../../../components/NavMenu.vue'
  import HelpModal from '@/components/HelpModal.vue'
  import { useAuthStore } from '@/stores/authStore'

  const { t } = useI18n()
  const authStore = useAuthStore()

  const showHelp = ref(false)
  const helpSteps = computed(() => [
    t('EconomyMines.HelpStep1'),
    t('EconomyMines.HelpStep2'),
    t('EconomyMines.HelpStep3'),
    t('EconomyMines.HelpStep4'),
  ])
</script>

<template>
  <main>
    <div class="w-full flex flex-cols-2 flex-grow mb-2">
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

        <div v-if="authStore.isLoggedIn" class="inline-flex items-center gap-1.5 mt-2 opacity-70" :title="t('Economy.ComingSoon')">
          <v-icon name="gi-chest" scale="2" class="mr-1"/>
          <span class="font-bold">{{ t('Economy.MineRegistryLink') }}</span>
          <v-icon name="fa-hard-hat" scale="0.9" class="text-yellow-600" />
        </div>
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
  </main>
</template>
