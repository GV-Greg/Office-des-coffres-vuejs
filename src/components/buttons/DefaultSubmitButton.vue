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
    <button type="submit" class="odc-btn odc-btn--soft odc--green" @click="handleButtonClick"><v-icon name="fa-plus" aria-hidden="true" />{{ props.text }}</button>
  </div>
</template>

