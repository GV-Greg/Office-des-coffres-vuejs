<script setup>
/*
  imports
*/
  import { RouterView } from 'vue-router'
  import NavMenu from '../../../components/NavMenu.vue'
</script>

<template>
  <main class="md:w-3/4">
    <div class="w-full flex flex-cols-2 flex-grow mb-2">
      <div class="w-1/6 flex flex-col justify-start text-salmon-600">
        <h3 class="text-center">Coffres S&eacute;curit&eacute;</h3>
          <RouterLink :to="{ name: 'security-guet'}" class="inline-flex items-center font-bold">
            <v-icon name="gi-chest" scale="2" class="mr-1"/>
            Entr&eacute;es/sorties
          </RouterLink>
      </div>
      <div class="w-5/6 ml-2 p-1">
        <RouterView />
      </div>
    </div>
    <NavMenu />
  </main>
</template>