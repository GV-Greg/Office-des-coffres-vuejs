<script setup>
/*
  imports
*/
  import useFormValidation from "../../use/useFormValidation.js"

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
      default: ''
    },
    max: {
      type: Number,
      default: 190
    }
  })

/*
  Validations
*/
  const { validateEmailField, errors } = useFormValidation()

  const validateInput = () => {
    validateEmailField(props.name, props.modelValue, props.max)
  }
</script>

<template>
  <div class="form-group">
    <label :for="name" class="form-label">{{ label }}</label>
    <input type="email" :value="modelValue" :name="name" :placeholder="placeholder" v-bind="$attrs"
           :class="{ 'form-field-error' : errors[props.name], 'form-field' : !errors[props.name] }"
           @keyup="validateInput" @blur="validateInput"
           @input="$emit('update:modelValue', $event.target.value)" />
    <span class="form-error" v-show="errors[props.name]">{{ errors[props.name] }}</span>
  </div>
</template>