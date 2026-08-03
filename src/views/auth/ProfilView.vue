<script setup>
/*
 imports
*/
  import { useI18n } from 'vue-i18n'
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
      <h2>{{ t('Profil.Title', { pseudo: authStore.getPseudo }) }}</h2>

      <div
        v-if="authStore.getIsValidated"
        class="w-10/12 my-4 bg-green-500 opacity-80 py-4 px-6 rounded-xl"
      >
        <p class="text-white">{{ t('Profil.Status.Validated') }}</p>
      </div>
      <div
        v-else
        class="w-10/12 my-4 bg-red-500 opacity-80 py-4 px-6 rounded-xl"
      >
        <p class="text-white font-bold">{{ t('Profil.Status.PendingTitle') }}</p>
        <p class="text-white">{{ t('Profil.Status.PendingMessage') }}</p>
      </div>
    </div>
    <NavMenu />
  </main>
</template>