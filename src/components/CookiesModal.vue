<script setup>
import { useI18n } from "vue-i18n";
import { useCookieStore } from '@/stores/cookieStore';
import { computed, watch, ref } from 'vue';
import PrimaryButton from './buttons/PrimaryButton.vue';
import SuccessButton from './buttons/SuccessButton.vue';
import DangerButton from './buttons/DangerButton.vue';

const props = defineProps({
  show: {
    type: Boolean,
    required: true
  },
  preferences: {
    type: Array,
    required: true
  }
});

const emit = defineEmits(['save', 'close']);

const { t } = useI18n();
const cookieStore = useCookieStore();

// État local des choix de cookies
const localCookieChoices = ref([]);

// Vérifier si un cookie est requis
const isRequired = computed(() => (item) => item.isRequired);

// Vérifier si un cookie est coché
const isCookieChecked = computed(() => (item) => {
  return item.isRequired || localCookieChoices.value.includes(item.value);
});

// Obtenir tous les cookies requis
const requiredCookies = computed(() => {
  return props.preferences
    .flatMap(category => category.items)
    .filter(item => item.isRequired)
    .map(item => item.value);
});

// Gérer le changement d'état d'un cookie
const handleCookieChange = (item, checked) => {
  if (item.isRequired) return;
  
  if (checked) {
    if (!localCookieChoices.value.includes(item.value)) {
      localCookieChoices.value.push(item.value);
    }
  } else {
    localCookieChoices.value = localCookieChoices.value.filter(
      cookie => cookie !== item.value
    );
  }
};

// Initialiser les choix locaux quand la modale s'ouvre
watch(() => props.show, (newValue) => {
  if (newValue) {
    // Copier les choix actuels du store
    localCookieChoices.value = [...cookieStore.acceptedCookies];
  }
});

// Sauvegarder les préférences
const handleSave = () => {
  // S'assurer que les cookies requis sont inclus
  const allSelectedCookies = [...new Set([...requiredCookies.value, ...localCookieChoices.value])];
  emit('save', allSelectedCookies);
};

// Fermer sans sauvegarder
const handleCancel = () => {
  emit('close');
};
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="fixed inset-0 z-50 overflow-y-auto">
      <!-- Overlay -->
      <div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity" @click="handleCancel"></div>

      <!-- Modal -->
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="relative transform overflow-hidden rounded-lg bg-white dark:bg-slate-800 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
          <!-- Header -->
          <div class="bg-slate-50 dark:bg-slate-700 px-4 py-3">
            <h3 class="text-lg font-medium leading-6 text-slate-900 dark:text-slate-100">
              {{ t('Cookies.Modal.Title') }}
            </h3>
          </div>

          <!-- Content -->
          <div class="bg-white dark:bg-slate-800 px-4 py-5">
            <div class="space-y-6">
              <div v-for="(category, index) in preferences" :key="index" class="space-y-4">
                <div>
                  <h4 class="text-base font-medium text-slate-900 dark:text-slate-100">
                    {{ category.title }}
                  </h4>
                  <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {{ category.description }}
                  </p>
                </div>

                <div class="space-y-4">
                  <div v-for="item in category.items" :key="item.value" class="flex items-start">
                    <div class="flex h-5 items-center">
                      <input
                        :id="item.value"
                        type="checkbox"
                        :checked="isCookieChecked(item)"
                        :disabled="isRequired(item)"
                        @change="handleCookieChange(item, $event.target.checked)"
                        class="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
                      >
                    </div>
                    <div class="ml-3">
                      <label :for="item.value" class="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {{ item.label }}
                      </label>
                      <span v-if="isRequired(item)" class="ml-2 text-xs text-slate-500 dark:text-slate-400">
                        ({{ t('Cookies.Required') }})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="bg-slate-50 dark:bg-slate-700 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 gap-2">
            <SuccessButton @click="handleSave">
              {{ t('Cookies.Button.Save') }}
            </SuccessButton>
            <DangerButton @click="handleCancel">
              {{ t('Cookies.Button.Cancel') }}
            </DangerButton>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>
