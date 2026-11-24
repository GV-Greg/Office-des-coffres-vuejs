<script setup>
/*
  imports
*/
  import { RouterView } from 'vue-router'
  import { ref, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import NavMenu from '../../../components/NavMenu.vue'
  import HelpModal from '@/components/HelpModal.vue'
  import { useAuthStore } from '@/stores/authStore'
  import useCustomsAccess from '@/use/useCustomsAccess'
  
  const { t } = useI18n()
  const authStore = useAuthStore()

  // Registre de douane : le lien n'apparaît qu'à qui l'Office connaît un rôle dans la sécurité d'une province — la règle vient de l'API
  // (GET characters/{id}/customs-access), jamais recalculée ici.
  const { access } = useCustomsAccess(() => (authStore.isLoggedIn ? authStore.activeCharacter?.id : null))
  const canOpenCustoms = computed(() => !!access.value)
  // Vue de la province : seulement si le serveur dit AU MOINS DEUX villes lisibles (un maire simple a le Registre pour sa ville) — jamais recalculé ici.
  const canOpenProvince = computed(() => (access.value?.readable_cities?.length ?? 0) >= 2)

  // Aides « i » du menu (même gabarit que les modules d'Économie) : une modale par page.
  const showGuetHelp = ref(false)
  const showCustomsHelp = ref(false)
  const showProvinceHelp = ref(false)
  const guetHelpSteps = computed(() => [1, 2, 3, 4, 5, 6].map(n => t(`Security.HelpStep${n}`)))
  const customsHelpSteps = computed(() => [1, 2, 3, 4, 5].map(n => t(`SecurityCustoms.HelpStep${n}`)))
  const provinceHelpSteps = computed(() => [1, 2, 3, 4].map(n => t(`SecurityProvince.HelpStep${n}`)))
  </script>

<template>
  <div class="page-card">
    <div class="w-full flex flex-col laptop:flex-row flex-grow mb-2">
      <div class="w-full laptop:w-1/6 flex flex-col justify-start text-rose-600">
        <h3 class="text-center">{{ t('Security.Title') }}</h3>
          <div class="inline-flex items-center gap-1.5">
            <RouterLink :to="{ name: 'security-guet'}" class="inline-flex items-center font-bold">
              <v-icon name="gi-chest" scale="2" class="mr-1"/>
              {{ t('Security.EntriesExits') }}
            </RouterLink>
            <button type="button" class="text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-500"
                    :aria-label="t('Security.HelpButton')" :title="t('Security.HelpButton')" data-testid="guet-help" @click="showGuetHelp = true">
              <v-icon name="fa-info-circle" scale="0.9" />
            </button>
          </div>
          <div v-if="canOpenCustoms" class="inline-flex items-center gap-1.5 mt-2">
            <RouterLink :to="{ name: 'security-customs' }" class="inline-flex items-center font-bold" data-testid="customs-link">
              <v-icon name="gi-chest" scale="2" class="mr-1"/>
              {{ t('SecurityCustoms.Link') }}
            </RouterLink>
            <button type="button" class="text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-500"
                    :aria-label="t('SecurityCustoms.HelpButton')" :title="t('SecurityCustoms.HelpButton')" data-testid="customs-help" @click="showCustomsHelp = true">
              <v-icon name="fa-info-circle" scale="0.9" />
            </button>
          </div>
          <div v-if="canOpenProvince" class="inline-flex items-center gap-1.5 mt-2">
            <RouterLink :to="{ name: 'security-province' }" class="inline-flex items-center font-bold" data-testid="province-link">
              <v-icon name="gi-chest" scale="2" class="mr-1"/>
              {{ t('SecurityProvince.Link') }}
            </RouterLink>
            <button type="button" class="text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-500"
                    :aria-label="t('SecurityProvince.HelpButton')" :title="t('SecurityProvince.HelpButton')" data-testid="province-help" @click="showProvinceHelp = true">
              <v-icon name="fa-info-circle" scale="0.9" />
            </button>
          </div>
      </div>
      <div class="w-full laptop:w-5/6 mt-2 laptop:mt-0 laptop:ml-2 p-1">
        <RouterView />
      </div>
    </div>
    <NavMenu />
    <HelpModal
      :show="showGuetHelp"
      :title="t('Security.HelpTitle')"
      :purpose="t('Security.HelpPurpose')"
      :overview="t('Security.HelpOverview')"
      :steps="guetHelpSteps"
      @close="showGuetHelp = false"
    />
    <HelpModal
      :show="showCustomsHelp"
      :title="t('SecurityCustoms.HelpTitle')"
      :purpose="t('SecurityCustoms.HelpPurpose')"
      :overview="t('SecurityCustoms.HelpOverview')"
      :steps="customsHelpSteps"
      @close="showCustomsHelp = false"
    />
    <HelpModal
      :show="showProvinceHelp"
      :title="t('SecurityProvince.HelpTitle')"
      :purpose="t('SecurityProvince.HelpPurpose')"
      :overview="t('SecurityProvince.HelpOverview')"
      :steps="provinceHelpSteps"
      @close="showProvinceHelp = false"
    />
  </div>
</template>