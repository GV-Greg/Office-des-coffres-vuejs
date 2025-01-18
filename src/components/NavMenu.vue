<script setup>
/*
  imports
*/
  import { RouterLink } from 'vue-router'

/*
  User data
*/

/*
  Menu items
*/
  const pages = [
    { name: "Accueil", link: "/app/", icon:"gi-medieval-pavilion", color: "gray", status: "public"},
    { name: "Éco", link: "/app/eco", icon:"gi-crown-coin", color: "yellow", status: "public"},
    { name: "Sécu", link: "/app/secu/guet", icon:"gi-swords-emblem", color: "salmon", status: "public"},
    { name: "Anim", link: "/app/anim", icon:"gi-rolling-dice-cup", color: "teal", status: "public"},
    { name: "Profil", link: "/app/profil", icon:"gi-barbute", color: "slate", status: "private"},
  ]
</script>

<template>
  <nav class="flex flex-wrap justify-center">

  </nav>
</template>