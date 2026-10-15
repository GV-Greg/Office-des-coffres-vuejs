<script setup>
  import { useI18n } from 'vue-i18n'

  /*
    Croix de fermeture d'une modale — UNE seule pour toutes (Greg, 15/10/2026 : « uniformiser les modales,
    la croix plus ronde et en rouge »). Standard (`--soft`), rouge comme tout ce qui annule ou ferme, icône
    seule : un disque de 34 px (pilule + `--icon`), `aria-label` traduit obligatoire (charte §5).
    À poser en haut à droite de la modale, sur la ligne du titre.
  */
  defineEmits(['click'])
  const { t } = useI18n()
</script>

<template>
  <button type="button" class="odc-btn odc-btn--soft odc-btn--icon odc-btn--sm odc--red shrink-0"
          :aria-label="t('Common.CloseModal')" :title="t('Common.CloseModal')" data-testid="modal-close" @click="$emit('click')">
    <v-icon name="fa-times" aria-hidden="true" />
  </button>
</template>
