<script setup>
  /*
    Accès refusé EN LIGNE : un cadenas fermé et le message du serveur à la place de la zone, pour un refus (pas une panne :
    aucun « Réessayer »). Même langage que AccessLoader, qui dit l'attente de ce même droit.
  */
  defineProps({ message: { type: String, required: true }, testid: { type: String, default: 'access-denied' } })
</script>

<template>
  <div class="flex items-start gap-3 py-2" role="alert" :data-testid="testid">
    <v-icon name="gi-padlock" scale="1.6" class="mt-0.5 shrink-0 text-yellow-700 dark:text-yellow-700" aria-hidden="true" />
    <p class="font-bold text-slate-800 dark:text-slate-800">{{ message }}</p>
  </div>
</template>
