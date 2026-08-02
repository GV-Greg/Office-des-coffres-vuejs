<script setup>
/*
 imports
*/
  import { useI18n } from 'vue-i18n'
  import NavMenu from '../../components/NavMenu.vue'
  import { useAuthStore } from '../../stores/authStore'

/*
 datas user
*/
  const { t } = useI18n()
  const authUser = useAuthStore()

</script>

<template>
  <main class="main md:w-3/4">
    <div class="overflow-y-auto flex flex-col flex-grow">
      <h2>{{ t('Profil.Title', { pseudo: authUser.getPseudo }) }}</h2>

      <p v-if="authUser.getIsValidated" class="text-green-600 dark:text-green-400 font-semibold">
        {{ t('Profil.Validated') }}
      </p>
      <div v-else class="bg-red-500 opacity-80 py-4 px-5 rounded-xl text-white">
        <p class="font-semibold">{{ t('Profil.Pending.Title') }}</p>
        <p>{{ t('Profil.Pending.Description') }}</p>
      </div>
    </div>
    <NavMenu />
  </main>
</template>