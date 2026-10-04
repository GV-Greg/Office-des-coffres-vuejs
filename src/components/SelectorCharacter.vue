<template>
  <!-- Sélecteur de personnage de la session (03/10/2026). La liste native d'un <select> est dessinée
       par le système, impossible à habiller : étroite, grise, sans rapport avec le bouton. Liste
       dessinée par le site, au motif « listbox » de l'APG W3C : bouton aria-haspopup="listbox",
       liste role="listbox" focalisée, option active par aria-activedescendant. Clavier : ↑ ↓
       Début Fin, Entrée/Espace pour choisir, Échap ou Tab pour fermer (le focus revient au
       bouton). Clic à l'extérieur : fermeture.
       ⚠️ La liste retire son contour de focus : c'est l'option ACTIVE qui le porte, par un liseré
       orange-700 (5,18:1 sur blanc, WCAG 1.4.11 ≥ 3:1). Un simple fond orange-50 (1,06:1) était
       invisible — relevé à la relecture a11y du 03/10/2026. -->
  <div
    v-if="authStore.isLoggedIn && authStore.getCharacters.length > 1"
    ref="root"
    class="relative z-50"
  >
    <button
      ref="trigger"
      type="button"
      class="odc-btn odc-btn--soft odc-btn--rect odc--orange"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="listId"
      :aria-label="`${t('NavBar.CharacterSelector')} : ${authStore.activeCharacter?.pseudo ?? ''}`"
      data-testid="character-selector"
      @click="toggle"
      @keydown.down.prevent="openList"
      @keydown.up.prevent="openList"
    >
      <v-icon name="gi-barbute" />
      <span>{{ authStore.activeCharacter?.pseudo }}</span>
      <v-icon name="fa-chevron-down" class="transition-transform" :class="{ 'rotate-180': open }" />
    </button>

    <ul
      v-show="open"
      :id="listId"
      ref="list"
      role="listbox"
      tabindex="-1"
      :aria-label="t('NavBar.CharacterSelector')"
      :aria-activedescendant="open ? optionId(activeIndex) : undefined"
      class="absolute right-0 mt-2 min-w-full w-max max-w-[16rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl focus:outline-none"
      data-testid="character-options"
      @keydown.down.prevent="move(1)"
      @keydown.up.prevent="move(-1)"
      @keydown.home.prevent="activeIndex = 0"
      @keydown.end.prevent="activeIndex = characters.length - 1"
      @keydown.enter.prevent="choose(activeIndex)"
      @keydown.space.prevent="choose(activeIndex)"
      @keydown.esc.prevent="close(true)"
      @keydown.tab="close(false)"
    >
      <li
        v-for="(character, index) in characters"
        :id="optionId(index)"
        :key="character.id"
        role="option"
        :aria-selected="character.id === authStore.activeCharacter?.id"
        class="flex items-center gap-2 border-l-4 px-3 py-2 text-sm cursor-pointer"
        :class="index === activeIndex ? 'border-orange-700 bg-orange-100 text-orange-900' : 'border-transparent text-slate-800'"
        @mousemove="activeIndex = index"
        @click="choose(index)"
      >
        <v-icon name="gi-barbute" class="w-4 h-4 shrink-0 text-slate-500" />
        <span class="flex-1 font-semibold truncate">{{ character.pseudo }}</span>
        <!-- Personnage choisi par défaut à la connexion (même étoile que le Profil). -->
        <v-icon v-if="character.id === authStore.defaultCharacter?.id" name="fa-star" class="w-3 h-3 text-orange-500" :title="t('Profil.ActiveCharacter')" />
        <!-- La coche dit le personnage de la session ; aria-selected le dit aux lecteurs d'écran. -->
        <v-icon v-if="character.id === authStore.activeCharacter?.id" name="fa-check-circle" class="w-4 h-4 text-green-700" />
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/authStore'

const { t } = useI18n()
const authStore = useAuthStore()

const root = ref(null)
const trigger = ref(null)
const list = ref(null)
const open = ref(false)
const activeIndex = ref(0)

const listId = 'character-listbox'
const optionId = (index) => `character-option-${index}`
const characters = computed(() => authStore.getCharacters)

const onOutside = (event) => {
  if (root.value && !root.value.contains(event.target)) close(false)
}

const openList = async () => {
  activeIndex.value = Math.max(0, characters.value.findIndex(c => c.id === authStore.activeCharacter?.id))
  open.value = true
  document.addEventListener('mousedown', onOutside)
  await nextTick()
  list.value?.focus()
}

const close = (restoreFocus) => {
  open.value = false
  document.removeEventListener('mousedown', onOutside)
  if (restoreFocus) trigger.value?.focus()
}

const toggle = () => (open.value ? close(true) : openList())
const move = (step) => {
  const count = characters.value.length
  activeIndex.value = (activeIndex.value + step + count) % count
}
const choose = (index) => {
  const character = characters.value[index]
  if (character) authStore.setActiveCharacter(character.id)
  close(true)
}

onBeforeUnmount(() => document.removeEventListener('mousedown', onOutside))
</script>
