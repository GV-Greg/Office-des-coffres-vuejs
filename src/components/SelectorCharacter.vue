<template>
  <!-- Bouton « relief 3D » habillant un <select> natif. Un <select> ne rend pas les
       pseudo-éléments ::before/::after qui dessinent le relief : c'est donc le conteneur qui
       porte les classes odc-*, et le <select> est posé par-dessus, transparent, sur toute la
       surface. Il reste l'élément réel : clavier, lecteur d'écran et liste native du système.
       Le pseudo affiché est une copie visuelle (aria-hidden), le nom accessible vient de
       l'aria-label et de l'option sélectionnée. -->
  <div
    v-if="authStore.isLoggedIn && authStore.getCharacters.length > 1"
    class="odc-btn odc-btn--soft odc-btn--rect odc--orange odc-select z-50"
  >
    <v-icon name="gi-barbute" />
    <span aria-hidden="true">{{ authStore.activeCharacter?.pseudo }}</span>
    <v-icon name="fa-chevron-down" class="odc-caret" />
    <select
      :value="authStore.activeCharacter?.id"
      @change="authStore.setActiveCharacter(Number($event.target.value))"
      :aria-label="t('NavBar.CharacterSelector')"
    >
      <option v-for="character in authStore.getCharacters" :key="character.id" :value="character.id" class="text-slate-800 bg-white">
        {{ character.pseudo }}
      </option>
    </select>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/authStore'

const { t } = useI18n()
const authStore = useAuthStore()
</script>

<style scoped>
.odc-select > select {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  font: inherit;
}
/* Le focus arrive sur le <select> invisible : l'anneau se dessine sur le bouton visible. */
.odc-select:has(> select:focus-visible) {
  outline: 3px solid #fde68a;
  outline-offset: 5px;
}
</style>
