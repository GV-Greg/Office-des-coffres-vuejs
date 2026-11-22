<script setup>
/*
  imports
*/
  import { RouterView } from 'vue-router'
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import NavMenu from '../../../components/NavMenu.vue'
  import { useAuthStore } from '@/stores/authStore'
  import useCustomsAccess from '@/use/useCustomsAccess'
  import useCustomsOfficer from '@/use/useCustomsOfficer'

  const { t } = useI18n()
  const authStore = useAuthStore()

  // Registre de douane : le lien n'apparaît qu'à qui l'Office connaît un rôle dans la sécurité d'une province — la règle vient de l'API
  // (GET characters/{id}/customs-access), jamais recalculée ici.
  const { access } = useCustomsAccess(() => (authStore.isLoggedIn ? authStore.activeCharacter?.id : null))
  const canOpenCustoms = computed(() => !!access.value)
  // « Douaniers » : la page de VALIDATION n'apparaît qu'à qui valide (prévôt, connétable ; en repli capitaine, dirigeant, maire) — la règle vient de l'API
  // (GET characters/{id}/customs → decider). La DEMANDE du rôle se fait dans le Profil.
  const { state: officerState } = useCustomsOfficer(() => (authStore.isLoggedIn ? authStore.activeCharacter?.id : null))
  const canOpenOfficers = computed(() => !!officerState.value?.decider)
</script>

<template>
  <div class="page-card">
    <div class="w-full flex flex-col laptop:flex-row flex-grow mb-2">
      <div class="w-full laptop:w-1/6 flex flex-col justify-start text-rose-600">
        <h3 class="text-center">{{ t('Security.Title') }}</h3>
          <RouterLink :to="{ name: 'security-guet'}" class="inline-flex items-center font-bold">
            <v-icon name="gi-chest" scale="2" class="mr-1"/>
            {{ t('Security.EntriesExits') }}
          </RouterLink>
          <RouterLink v-if="canOpenCustoms" :to="{ name: 'security-customs' }" class="inline-flex items-center font-bold mt-2" data-testid="customs-link">
            <v-icon name="gi-chest" scale="2" class="mr-1"/>
            {{ t('SecurityCustoms.Link') }}
          </RouterLink>
          <!-- Valider les douaniers : seulement pour qui valide ; le rôle se demande dans le Profil. -->
          <RouterLink v-if="canOpenOfficers" :to="{ name: 'security-officers' }" class="inline-flex items-center font-bold mt-2" data-testid="officers-link">
            <v-icon name="gi-chest" scale="2" class="mr-1"/>
            {{ t('SecurityOfficers.Link') }}
          </RouterLink>
      </div>
      <div class="w-full laptop:w-5/6 mt-2 laptop:mt-0 laptop:ml-2 p-1">
        <RouterView />
      </div>
    </div>
    <NavMenu />
  </div>
</template>