<script setup>
/*
 imports
*/
  import { RouterLink, useRouter } from 'vue-router'

  const router = useRouter()

</script>

<template>
  <header class="w-full mx-0 flex flex-col">
    <div class="w-full">
      <div class="flex items-center justify-end p-4">
        <nav class="w-full grid grid-cols-3 justify-items-stretch">
          <div class="space-x-3 justify-self-start flex items-center">
            <RouterLink :to="{ name: 'home' }" class="flex items-center rounded-lg pl-1.5 pr-3 py-0.5 no-underline font-semibold bg-blue-600 text-slate-800 hover:bg-blue-300 hover:text-slate-900">
              <v-icon name="gi-medieval-pavilion" scale="2" class="mr-1"/><span class="font-bold text-xl">Accueil</span>
            </RouterLink>
          </div>
          <div class="space-x-3 justify-self-center flex items-center">
            <div class="text-3xl font-bold text-transparent"
                 :class="{ 'bg-clip-text bg-gradient-to-br from-orange-400 to-red-600': router.currentRoute._value.name !== 'home' }">
              Office des coffres
            </div>
          </div>
          <div class="space-x-3 justify-self-end flex items-center">

          </div>
        </nav>
      </div>
    </div>
  </header>
</template>