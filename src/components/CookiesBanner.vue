<script setup>
import { useI18n } from "vue-i18n";
import { useCookieStore } from '@/stores/cookieStore';
import { onMounted, ref, computed } from 'vue';
import PrimaryButton from './buttons/PrimaryButton.vue';
import SuccessButton from './buttons/SuccessButton.vue';
import DangerButton from './buttons/DangerButton.vue';
import CookiesModal from './CookiesModal.vue';

const { t } = useI18n();
const cookieStore = useCookieStore();
const showBanner = ref(false);
const showModal = ref(false);

// Préférence des cookies définies une seule fois
const preferences = computed(() => [
  {
    title: t('Cookies.Preferences.Functional.Title'),
    description: t('Cookies.Preferences.Functional.Description'),
    items: [
      {
        label: t('Cookies.Preferences.Functional.Label'),
        value: 'functional',
        isRequired: true,
      },
    ],
  },
  {
    title: t('Cookies.Preferences.Session.Title'),
    description: t('Cookies.Preferences.Session.Description'),
    items: [
      {
        label: t('Cookies.Preferences.Session.Label'),
        value: 'session',
        isRequired: false,
      },
    ],
  }
]);

// Accepter tous les cookies
const handleAcceptAll = () => {
  const allCookies = preferences.value.flatMap(cat => cat.items.map(item => item.value));
  cookieStore.acceptAllCookies(allCookies);
  showBanner.value = false;
};

// Refuser automatiquement (garder uniquement les essentiels)
const handleDeclineAll = () => {
  const requiredCookies = preferences.value
    .flatMap(cat => cat.items)
    .filter(item => item.isRequired)
    .map(item => item.value);
  cookieStore.declineAllCookies(requiredCookies);
  showBanner.value = false;
};

// Gérer la fermeture de la modale
const handleModalClose = () => {
  showModal.value = false;
  // La bannière reste visible si on ferme la modale sans sauvegarder
  showBanner.value = true;
};

// Sauvegarder les préférences depuis la modale
const handleSavePreferences = (selectedCookies) => {
  cookieStore.savePreferences(selectedCookies);
  showModal.value = false;
  showBanner.value = false;
};

onMounted(() => {
  cookieStore.initializeCookies();
  showBanner.value = !cookieStore.hasUserChoice;
});
</script>

<template>
  <Transition name="slide-up">
    <div v-if="showBanner" class="fixed bottom-0 left-0 right-0 p-4 bg-slate-300 dark:bg-slate-900 shadow-lg z-50">
      <div class="max-w-screen-lg mx-auto">
        <div class="flex flex-row items-center justify-between gap-4">
          <!-- Message (aligné à gauche) -->
          <div class="flex-grow text-slate-700 dark:text-slate-200 text-center">
            <h2 class="text-lg font-semibold mb-2">{{ t('Cookies.Banner.Title') }}</h2>
            <p class="text-sm">{{ t('Cookies.Banner.Description') }}</p>
          </div>

          <!-- Boutons (alignés à droite) -->
          <div class="flex flex-row gap-x-8">
            <PrimaryButton @click="showModal = true">
              {{ t('Cookies.Button.Preferences') }}
            </PrimaryButton>
            <DangerButton @click="handleDeclineAll">
              {{ t('Cookies.Button.Decline') }}
            </DangerButton>
            <SuccessButton @click="handleAcceptAll">
              {{ t('Cookies.Button.Accept') }}
            </SuccessButton>
          </div>
        </div>
      </div>
    </div>
  </Transition>

  <!-- Modal des préférences -->
  <CookiesModal
    :show="showModal"
    :preferences="preferences"
    @close="handleModalClose"
    @save="handleSavePreferences"
  />
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease-out;
}

.slide-up-enter-from {
  transform: translateY(100%);
  opacity: 0;
}

.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>