<template>
    <!-- Interrupteur accessible (27/09/2026) : `type="button"` (dans un formulaire, un bouton sans
         type le soumettrait), `role="switch"` + `aria-checked` (l'état est annoncé), `disabled`
         natif pour un choix obligatoire. Un `id` passé par l'appelant tombe sur ce <button> :
         un <label for> s'y rattache et le bascule au clic.
         Rail éteint slate-500 / slate-400 en sombre : l'ancien slate-300 passait sous 3:1
         (contraste non textuel) sur fond blanc. -->
    <button
        type="button"
        role="switch"
        :aria-checked="checked ? 'true' : 'false'"
        :disabled="disabled"
        :class="[
        'relative inline-flex h-6 w-11 flex-none items-center rounded-full transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600',
        'disabled:cursor-not-allowed disabled:opacity-60',
        checked ? 'bg-green-600' : 'bg-slate-500 dark:bg-slate-400',
        ]"
        @click="toggle"
    >
        <span
        :class="[
            'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5',
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
