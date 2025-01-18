<template>
  <div class="overflow-y-auto flex flex-col flex-grow items-center">
    <h2 class="flex flex-col">
      <div><v-icon name="gi-bugle-call" scale="5"/></div>
      <div class="font-extrabold text-4xl -mt-4">FaSi Fest</div>
    </h2>
    <span class="text-center">
        Un festival itin&eacute;rant organis&eacute; en Franche-Comt&eacute; et en Savoie avec diverses activit&eacute;s organis&eacute;es chaque jour.<br />
        Voici la liste des activit&eacute;s actuellement organis&eacute;es :
      </span>
    <div class="flex flex-row space-x-6 mt-5">
      <RouterLink :to="{ name: 'festival-grid'}" class="card-anim">
        <v-icon name="gi-trophy-cup" scale="3"/>
        <div class="card-anim-title">Grille des lots</div>
      </RouterLink>
      <RouterLink :to="{ name: 'festival-decode'}" class="card-anim">
        <v-icon name="ri-lock-password-fill" scale="3"/>
        <div class="card-anim-title">D&eacute;code le code</div>
      </RouterLink>
      <RouterLink :to="{ name: 'festival-race-chicks'}" class="card-anim">
        <v-icon name="fa-kiwi-bird" scale="3"/>
        <div class="card-anim-title">Course de poussins</div>
      </RouterLink>
    </div>
  </div>
</template>