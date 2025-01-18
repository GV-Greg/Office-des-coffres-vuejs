<script setup>
/*
 props
*/
  const props = defineProps({
    text: {
      type: String,
      default: 'No text'
    },
  })

/*
  emits
*/
  const emit = defineEmits(['submit'])

/*
  handle button click
*/
  const handleButtonClick = () => {
    emit('submit')
  }
</script>

<template>
  <div class="form-group mt-5">
    <button class="btn-default py-2 uppercase" @click="handleButtonClick">{{ props.text }}</button>
  </div>
</template>

