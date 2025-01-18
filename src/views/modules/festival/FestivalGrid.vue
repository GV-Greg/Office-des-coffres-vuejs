<script setup>
/*
 imports
*/
  import { RouterLink } from 'vue-router'
  import { reactive, onBeforeMount, ref } from 'vue'
  import AnimService from '../../../services/anim.service.js'

/*
 Axes et récupération des lots
*/
  const axeX = reactive({ x: 0 })
  const axeY = reactive({ y: 0 })
  const rewards = reactive({})
  const rewardsPerPlayer = reactive({})

  onBeforeMount(async() => {
    await AnimService.gridRewards('FaSiFest').then((response) => {
      if(response.success === true) {
        axeX.x = response.data.grid.width
        axeY.y = response.data.grid.height
        rewards.value = response.data.rewards
        rewardsPerPlayer.value = response.data.rewardsPerPlayer
      }
    })
  })

/*
  Liste des récompenses
*/

  const typeList = ref(true)
</script>

<template>
  <div class="w-full h-full overflow-y-auto flex flex-col justify-items-start">
    <div class="grid justify-items-stretch grid-cols-3 -mb-4">
      <div class="justify-self-start flex items-center -mt-10">
        <RouterLink :to="{ name: 'festival-home' }" class="bg-slate-800 text-slate-50 py-1 pr-1.5 pl-2 rounded">
          <v-icon name="fa-reply" scale="2"/>
        </RouterLink> <span class="font-extrabold uppercase text-lg ml-1">Retour</span>
      </div>
      <div class="justify-self-center">
        <h2 class="flex flex-col">
          <div><v-icon name="gi-trophy-cup" scale="3"/></div>
          <div class="font-extrabold text-2xl -mt-2 uppercase">Grille des lots</div>
        </h2>
      </div>
      <div class="justify-self-center mt-2">
        <button @click="typeList = !typeList" class="btn btn-primary">
          <span v-if="typeList">Liste des lots par personne</span>
          <span v-else>Liste des lots</span>
        </button>
      </div>
    </div>
    <div class="mt-5 grid grid-cols-3">
      <div class="col-span-2 flex justify-center items-start">
        <div class="grid grid-cols-15 grid-rows-15 gap-2 shrink">
          <div v-for="reward in rewards.value" :key="reward.id"
               :class="{ 'box-grid-rewards-inside' : reward.is_taken !== true,
                      'box-grid-rewards-inside-is-taken' : reward.is_taken === true }">
            {{ reward.place }}
          </div>
        </div>
      </div>
      <div class="col-span-1" v-if="typeList">
        <ul class="grid auto-rows-auto auto-cols-auto">
          <li v-for="reward in rewards.value" :key="reward.id">
            <span v-if="reward.is_taken === true">
              <v-icon name="gi-trophy-cup" scale="1"/> Lot N° <span class="font-bold">{{ reward.place }} > {{ reward.player }}</span> : {{ reward.name }}
            </span>
          </li>
        </ul>
      </div>
      <div class="col-span-1" v-else>
        <div v-for="(player, index) in rewardsPerPlayer.value" :key="index" class="mb-2">
          <span class="font-bold uppercase text-blue-500 text-lg">{{  player[0].player }}</span>
          <ul class="ml-3">
            <li v-for="(reward, index) in player" :key="index">
              <v-icon name="gi-trophy-cup" scale="1"/>{{ reward.name }}
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>