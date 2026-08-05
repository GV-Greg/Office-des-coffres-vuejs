<template>
  <div v-if="authStore.isLoggedIn && authStore.getCharacters.length > 1" class="relative z-50">
    <v-icon
      name="gi-barbute"
      scale="1.2"
      class="absolute z-10 left-2 top-1/2 -translate-y-1/2 text-white pointer-events-none"
    />
    <select
      :value="authStore.activeCharacter?.id"
      @change="authStore.setActiveCharacter(Number($event.target.value))"
      class="appearance-none pl-9 pr-7 py-2 cursor-pointer bg-gradient-to-br from-orange-400 to-red-600 hover:from-orange-500 hover:to-red-700 rounded-md border border-orange-300 focus:outline-none text-white font-bold text-sm"
      :aria-label="t('NavBar.CharacterSelector')"
    >
      <option v-for="character in authStore.getCharacters" :key="character.id" :value="character.id" class="text-slate-800 bg-white">
        {{ character.pseudo }}
      </option>
    </select>
    <v-icon
      name="fa-chevron-down"
      scale="0.6"
      class="absolute z-10 right-2.5 top-1/2 -translate-y-1/2 text-white pointer-events-none"
    />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/authStore'

const { t } = useI18n()
const authStore = useAuthStore()
</script>
