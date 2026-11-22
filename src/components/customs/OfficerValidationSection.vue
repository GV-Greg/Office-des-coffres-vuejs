<script setup>
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useAuthStore } from '@/stores/authStore'
  import useCustomsOfficer from '@/use/useCustomsOfficer'
  import ChestLoader from '@/components/loading/ChestLoader.vue'
  import AccessDenied from '@/components/loading/AccessDenied.vue'
  import OfficerDecisionsPanel from '@/components/customs/OfficerDecisionsPanel.vue'

  /*
    Valider les douaniers — l'onglet « Douaniers » de MON BUREAU (Greg, 22/11/2026 ; module Sécurité, brief admin/content/brief-module-securite.md §4, fil
    admin/echanges/module-securite). Le douanier n'existe PAS en jeu : c'est un rôle de l'Office. Le joueur le DEMANDE depuis son PROFIL, dans « Demander
    un poste » ; ce panneau est celui de qui VALIDE : demandes en attente, douaniers en vigueur, durée d'inactivité. ⚠️ Aucune règle côté site : qui
    valide, à quel niveau, le serveur le dit (`GET characters/{id}/customs`) ; un refus s'affiche tel quel, en FR ou EN. Sans rôle de validation,
    l'onglet n'existe pas (Mon bureau le masque) et ce panneau n'affiche rien.
  */
  const { t } = useI18n()
  const authStore = useAuthStore()

  const character = computed(() => (authStore.isLoggedIn ? authStore.activeCharacter : null))
  const { state, ready, error, reload } = useCustomsOfficer(() => character.value?.id ?? null)
</script>

<template>
  <div class="w-full space-y-4" data-testid="officers-page">
    <ChestLoader :loading="!ready" :error="error ? t('Auth.Errors.NetworkError') : ''" accent="violet" error-testid="officers-chest-error">
      <AccessDenied v-if="!character" :message="t('SecurityOfficers.NoCharacter')" testid="officers-denied" />
      <OfficerDecisionsPanel v-else-if="state?.decider" :character="character" :decider="state.decider" @changed="reload" />
    </ChestLoader>
  </div>
</template>
