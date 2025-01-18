<script setup>
/*
 imports
*/
  import NavMenu from '../../components/NavMenu.vue'
  import { useAuthStore } from '../../stores/authStore'

/*
 datas user
*/
  const authUser = useAuthStore()

</script>

<template>
  <main class="main md:w-3/4">
    <div class="overflow-y-auto flex flex-col flex-grow">
      <h2>Profil de {{ authUser.getUsername }}</h2>
      <div v-show="authUser.getRoles">Vos r&ocirc;les :</div>
      <ul>
        <li v-for="(role, index) in authUser.getRoles" :key="index">{{ role }}</li>
      </ul>
    </div>
    <NavMenu />
  </main>
</template>