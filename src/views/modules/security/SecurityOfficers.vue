<script setup>
  import { computed } from 'vue'
  import { RouterLink } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { useAuthStore } from '@/stores/authStore'
  import useCustomsOfficer from '@/use/useCustomsOfficer'
  import ChestLoader from '@/components/loading/ChestLoader.vue'
  import AccessDenied from '@/components/loading/AccessDenied.vue'
  import OfficerDecisionsPanel from '@/components/customs/OfficerDecisionsPanel.vue'

  /*
    Valider les douaniers (module Sécurité, « La Salle des gardes » ; brief admin/content/brief-module-securite.md §4 ; fil admin/echanges/
    module-securite). Le douanier n'existe PAS en jeu : c'est un rôle de l'Office. Le joueur le DEMANDE depuis son PROFIL (Greg, 22/11/2026, comme un
    poste) ; cette page est celle de qui VALIDE : demandes en attente, douaniers en vigueur, durée d'inactivité. ⚠️ Aucune règle côté site : qui
    valide, à quel niveau, le serveur le dit (`GET characters/{id}/customs`) ; un refus s'affiche tel quel, en FR ou EN.
  */
  const { t } = useI18n()
  const authStore = useAuthStore()

  const character = computed(() => (authStore.isLoggedIn ? authStore.activeCharacter : null))
  const { state, ready, error, reload } = useCustomsOfficer(() => character.value?.id ?? null)
</script>

<template>
  <div class="w-full space-y-4" data-testid="officers-page">
    <h2 class="!mb-0 text-2xl font-bold text-slate-800 dark:text-slate-800">{{ t('SecurityOfficers.Title') }}</h2>

    <ChestLoader :loading="!ready" :error="error ? t('Auth.Errors.NetworkError') : ''" accent="rose" error-testid="officers-chest-error">
      <AccessDenied v-if="!character" :message="t('SecurityOfficers.NoCharacter')" testid="officers-denied" />
      <div v-else-if="state?.decider" class="space-y-4">
        <p class="text-sm text-slate-800 dark:text-slate-800">{{ t('SecurityOfficers.Intro') }}</p>
        <OfficerDecisionsPanel :character="character" :decider="state.decider" @changed="reload" />
      </div>
      <div v-else class="space-y-2" data-testid="officers-not-decider">
        <p class="text-sm text-slate-800 dark:text-slate-800">{{ t('SecurityOfficers.NotDecider') }}</p>
        <RouterLink :to="{ name: 'profil' }" class="odc-btn odc-btn--soft odc--slate" data-testid="officers-profile-link">{{ t('SecurityOfficers.ToProfile') }}</RouterLink>
      </div>
    </ChestLoader>
  </div>
</template>
