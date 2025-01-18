<script setup>
/*
  imports
*/
  import useFormValidation from "../../use/useFormValidation"

/*
  props
*/
  const props = defineProps({
    label: {
      type: String,
      default: ''
    },
    name: {
      type: String,
      default: ''
    },
    placeholder: {
      type: String,
      default: ''
    },
    modelValue: {
      type: [String, Number],
      required: true,
      default: ''
    },
    min: {
      type: Number,
      default: 3
    },
    max: {
      type: Number,
      default: 190
    }
  })

/*
  Validations
*/
  const { validateMinMaxField, errors } = useFormValidation()

  const validateInput = () => {
    validateMinMaxField(props.name, props.modelValue, props.min, props.max)
  }



</script>

<template>
  <div class="form-group">
    <label :for="name" class="form-label">{{ label }}</label>
    <input type="text" :value="modelValue" :name="name" :placeholder="placeholder"
           :class="{ 'form-field-error' : errors[props.name], 'form-field' : !errors[props.name] }"
           @keyup="validateInput" @blur="validateInput"
           @input="$emit('update:modelValue', $event.target.value)" />
    <span class="form-error" v-show="errors[props.name]">{{ errors[props.name] }}</span>
  </div>
</template>