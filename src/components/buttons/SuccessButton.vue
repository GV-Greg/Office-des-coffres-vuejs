<script setup>
defineProps({
  type: {
    type: String,
    default: 'button'
  },
  disabled: {
    type: Boolean,
    default: false
  }
})
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="btn btn-success"
  >
    <slot></slot>
  </button>
</template>

<style scoped>

</style>
