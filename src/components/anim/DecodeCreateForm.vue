<script setup>
  import AnimCreateForm from '@/components/anim/AnimCreateForm.vue'

  /*
    Création d'une activité de « Décode le code » (mode PRIVÉ ou SANS COMPTE) : le formulaire et son écran de confirmation sont ceux d'`AnimCreateForm`,
    commun à toutes les activités d'Animation. Cette enveloppe fixe le type et garde l'interface historique (props, évènement `confirm`).
  */
  defineProps({
    mode: { type: String, required: true, validator: v => ['private', 'anonymous'].includes(v) },
    errors: { type: Object, default: () => ({}) },
    submitting: { type: Boolean, default: false },
    slugDelay: { type: Number, default: 300 },
  })
  const emit = defineEmits(['confirm'])
</script>

<template>
  <AnimCreateForm kind="decode" v-bind="$props" @confirm="emit('confirm', $event)" />
</template>
