<script setup>
  import { ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import customsApi from '@/use/customsApi'
  import OfficerStatusPanel from '@/components/customs/OfficerStatusPanel.vue'
  import { customsVersion } from '@/use/customsRefresh'

  /*
    Bloc « Douanier » d'une carte de personnage (Profil), sous les postes : il n'apparaît qu'une fois la demande faite (en attente) ou l'accès accordé.
    La demande se fait dans la modale « Demander un poste » (Greg, 22/11/2026). Le douanier n'existe pas en jeu : c'est un rôle de l'Office, validé par le
    trio de sécurité de la province (page « Douaniers » de la Salle des gardes, pour qui valide). ⚠️ Aucune règle ici : tout vient de
    GET characters/{id}/customs ; une panne laisse le bloc muet, sans bloquer le Profil. Fond toujours clair : textes répétés en `dark:` (`.dark p`).
  */
  const props = defineProps({ character: { type: Object, required: true } })
  const { t } = useI18n()
  const api = customsApi()

  const state = ref(null)

  async function load() {
    try {
      state.value = await api.officer(props.character.id)
    } catch {
      state.value = null
    }
  }

  // Relu à l'arrivée sur le personnage et chaque fois qu'une demande part de la modale (customsVersion).
  watch(() => [props.character.id, customsVersion.value], load, { immediate: true })
</script>

<template>
  <!-- Une carte de poste, comme celles des mandats : pas de titre de rubrique séparé. -->
  <section v-if="state?.officer" :aria-label="t('SecurityOfficers.Profile.Title')" data-testid="customs-block">
    <OfficerStatusPanel :character="character" :state="state" @changed="load" />
  </section>
</template>
