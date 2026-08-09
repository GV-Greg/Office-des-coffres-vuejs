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

// Une seule catégorie visible : les préférences (thème, langue, saisies mémorisées).
// L'ancienne catégorie "Session" a disparu — le jeton d'auth est strictement nécessaire
// au service demandé, donc exempté de consentement et documenté comme tel dans la
// politique. Voir ODC-strategie-cookies.md.
const preferences = computed(() => [
  {
    title: t('Cookies.Preferences.Comfort.Title'),
    description: t('Cookies.Preferences.Comfort.Description'),
    items: [
      {
        label: t('Cookies.Preferences.Comfort.Label'),
        value: 'preferences',
        isRequired: false,
      },
    ],
  },
]);

const handleAcceptAll = () => {
  cookieStore.acceptPreferences();
  showBanner.value = false;
};

const handleDeclineAll = () => {
  cookieStore.declinePreferences();
  showBanner.value = false;
};

// Gérer la fermeture de la modale
const handleModalClose = () => {
  cookieStore.closePreferencesModal();
  // La bannière reste visible si on ferme la modale sans sauvegarder
  showBanner.value = true;
};

// Sauvegarder les préférences depuis la modale
const handleSavePreferences = (selectedCookies) => {
  cookieStore.setConsent(selectedCookies.includes('preferences'));
  cookieStore.closePreferencesModal();
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
            <PrimaryButton @click="cookieStore.openPreferencesModal()">
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
    :show="cookieStore.isPreferencesModalOpen"
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