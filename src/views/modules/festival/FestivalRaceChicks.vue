<script setup>
/*
 imports
*/
  import { RouterLink } from 'vue-router'
  import { reactive, onBeforeMount } from 'vue'
  import AnimService from '../../../services/anim.service.js'

/*
 Axe des Y
*/
  const axeY = reactive([])
  function createY() {
    for(let i=30; i >= 0; i--) {
      axeY.push(i)
    }
  }

  onBeforeMount(() => {
    createY()
  })

/*
 Axe des X et récupération des poussins
*/
  const axeX = reactive({ x: 0 })
  const chicks = reactive([])

  onBeforeMount(async() => {
    await AnimService.raceChicks('FaSiFest').then((response) => {
      if(response.success === true) {
        chicks.value = response.data.chicks
        axeX.x = 11 + (3 * response.data.chicks.length)
      }
    })
  })

/*
 Tooltip
*/
  const showTooltip = reactive({ view: false })

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
        <h2 class="flex flex-col -mt-2">
          <div><v-icon name="fa-kiwi-bird" scale="3"/></div>
          <div class="font-extrabold text-2xl -mt-2 uppercase">Course de poussins</div>
        </h2>
      </div>
    </div>
    <div class="pr-5">
      <div class="text-center uppercase font-bold mb-4">Arriv&eacute;e</div>
      <hr class="border-2 border-opacity-50 border-blue-600">
      <div v-for="(y,index) in axeY" :key="index">
        <hr class="border-2 border-opacity-50 border-blue-600" v-show="y === 0">
        <div class="line-race-chicks" >
          <span :class="{ 'cell-race-chick border-b' : y === 0, 'cell-race-chick' : y !== 0  }">{{ y }}</span>
          <div :class="{ 'box-race-chick border-b' : y === 0, 'box-race-chick' : y !== 0  }" v-for="(x, index) in axeX.x" :key="index">
            <div v-for="chick in chicks.value" :key="chick.id">
              <div class="tooltip-box-race-chick" v-if="chick.position_x === x && chick.position_y === y">
                <button :class="'w-full h-5 flex justify-center items-center bg-blue-500 text-' + chick.color + '-300'"
                  @mouseover="showTooltip.view = true" @mouseleave="showTooltip.view = false">
                  <v-icon name="fa-kiwi-bird" scale="1" />
                </button>
                <div class="tooltip-race-chick" v-show="showTooltip.view">
                  {{ chick.name_chick }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="text-center uppercase font-bold">D&eacute;part</div>
    </div>
  </div>
</template>