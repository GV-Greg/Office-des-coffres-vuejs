<template>
    <button
        :class="[
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none',
        checked ? 'bg-green-600' : 'bg-slate-300 dark:bg-slate-600',
        ]"
        @click="toggle"
    >
        <span
        :class="[
            'inline-block h-5 w-5 transform rounded-full bg-white transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1',
        ]"
        />
    </button>
</template>
  
<script setup>
import { ref, watch } from 'vue';

// Définir les props
const props = defineProps({
checked: {
    type: Boolean,
    required: true,
},
disabled: {
    type: Boolean,
    default: false,
},
});

// Émettre un événement pour mettre à jour l'état
const emit = defineEmits(['update:checked']);

// Gérer l'état interne du switch
const isChecked = ref(props.checked);

// Mettre à jour l'état interne lorsque la prop `checked` change
watch(
() => props.checked,
(newValue) => {
    isChecked.value = newValue;
}
);

// Basculer l'état du switch
const toggle = () => {
if (!props.disabled) {
    isChecked.value = !isChecked.value;
    emit('update:checked', isChecked.value);
}
};
</script>
  
<style scoped>
/* Styles supplémentaires si nécessaire */
</style>