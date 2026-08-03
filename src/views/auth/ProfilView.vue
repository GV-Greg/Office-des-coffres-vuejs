<script setup>
/*
 imports
*/
  import { useI18n } from 'vue-i18n'
  import { RouterLink } from 'vue-router'
  import NavMenu from '@/components/NavMenu.vue'
  import { useAuthStore } from '@/stores/authStore'

/*
 datas user
*/
  const { t } = useI18n()
  const authStore = useAuthStore()

</script>

<template>
  <main class="main md:w-3/4">
    <div class="overflow-y-auto flex flex-col flex-grow">
      <h2>{{ t('Profil.Title') }}</h2>
      <p class="text-gray-500">{{ authStore.getUser?.email }}</p>

      <div v-if="!authStore.hasCharacters" class="w-10/12 my-4 bg-red-500 opacity-80 py-4 px-6 rounded-xl">
        <p class="text-white">{{ t('Profil.NoCharacter') }}</p>
      </div>

      <div
        v-for="character in authStore.getCharacters"
        :key="character.id"
        class="w-10/12 my-2 py-4 px-6 rounded-xl"
        :class="character.is_validated ? 'bg-green-500' : 'bg-red-500'"
        style="opacity: 0.8"
      >
        <p class="text-white font-bold">{{ character.pseudo }}</p>
        <p class="text-white">
          {{ character.is_validated ? t('Profil.Status.Validated') : t('Profil.Status.PendingMessage') }}
        </p>
      </div>

      <RouterLink to="/app/character/new" class="mt-4 font-bold text-blue-600">
        {{ t('Profil.AddCharacter') }}
      </RouterLink>
    </div>
    <NavMenu />
  </main>
</template>
