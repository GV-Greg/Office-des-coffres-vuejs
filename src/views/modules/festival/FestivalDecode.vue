<script setup>
/*
 imports
*/
  import { RouterLink } from 'vue-router'
  import { reactive, onBeforeMount } from 'vue'
  import AnimService from '../../../services/anim.service.js'

/*
 Récupération des codes et de leurs combinaisons
*/
  const activity = reactive({})
  const codes = reactive({})

  onBeforeMount(async() => {
    await AnimService.activityDecode('FaSiFest').then((response) => {
      if(response.success === true) {
        activity.value = response.data.activity
        codes.value = response.data.codes
      }
    })
  })
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
          <div><v-icon name="ri-lock-password-fill" scale="3"/></div>
          <div class="font-extrabold text-2xl -mt-2 uppercase">Activit&eacute; "D&eacute;code le code"</div>
        </h2>
      </div>
    </div>
    <div class="mt-5 w-full grid grid-flow-col gap-5 justify-items-center">
      <div class="col-span-1" v-for="code in codes.value" :key="code.id">
        <div class="inline-block">
          <span class="align-middle uppercase font-bold mr-1"><v-icon name="fa-unlock-alt" scale="1"/></span>
          <span class="align-middle font-bold text-2xl text-blue-500">{{ code.code }}</span>
        </div>
        <ul class="ml-3">
          <li v-for="(proposal, index) in code.proposals" :key="index">
            <span class="font-bold">{{ proposal.combination }}</span> :
            <span class="font-bold" :class="{
              'text-green-600' : proposal.points === 20,
              'text-teal-400' : proposal.points > 5 && proposal.points < 20,
              'text-indigo-500' : proposal.points > 2 && proposal.points <= 5,
              'text-orange-500' : proposal.points > 0 && proposal.points <= 2,
              'text-red-500' : proposal.points === 0 }">{{ proposal.points }} point<span v-if="proposal.points > 1" class="font-bold">s</span></span> ( {{ proposal.player }} )
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>