<script setup>
import { useI18n } from "vue-i18n";
import { useCookieStore } from '@/stores/cookieStore';
import { onMounted, ref, computed } from 'vue';
import { push } from 'notivue';
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

// Gérer la fermeture de la modale sans sauvegarder. La bannière ne doit réapparaître
// que si l'utilisateur n'a encore jamais répondu (choiceMadeAt null) — sinon "Annuler"
// depuis la modale ouverte via NavBar/ProfilView (post-choix) la ferait réapparaître à tort.
const handleModalClose = () => {
  cookieStore.closePreferencesModal();
  showBanner.value = !cookieStore.hasUserChoice;
};

// Sauvegarder les préférences depuis la modale
const handleSavePreferences = (selectedCookies) => {
  const saved = cookieStore.setConsent(selectedCookies.includes('preferences'));
  cookieStore.closePreferencesModal();
  showBanner.value = false;

  if (saved) {
    push.success(t('Cookies.Saved'));
  } else {
    push.error(t('Cookies.SaveError'));
  }
};

onMounted(() => {
  cookieStore.initializeCookies();
  showBanner.value = !cookieStore.hasUserChoice;
});
</script>

<template>
  <Transition name="slide-up">
    <div v-if="showBanner" class="fixed bottom-0 left-0 right-0 p-4 bg-slate-300 dark:bg-slate-900 shadow-lg z-50">
      <div class="max-w-screen-laptop mx-auto">
        <!-- Colonne sur mobile, ligne à partir de laptop ; les boutons ne passent jamais à la ligne
             entre eux (« Accepter » seul dessous cassait la symétrie avec « Refuser »). -->
        <div class="flex flex-col laptop:flex-row items-center justify-between gap-4">
          <!-- Message (aligné à gauche) -->
          <div class="flex-grow text-slate-700 dark:text-slate-200 text-center">
            <!-- Couleur explicite : le bleu-800 hérité des <h2> du site était illisible sur le fond
                 slate-900 de la bannière en thème sombre. -->
            <h2 class="text-lg font-semibold mb-2 text-slate-800 dark:text-slate-100">{{ t('Cookies.Banner.Title') }}</h2>
            <p class="text-sm">{{ t('Cookies.Banner.Description') }}</p>
          </div>

          <!-- Boutons odc-* (27/09/2026). « Refuser » et « Accepter » au MÊME niveau et dans le
               même style : la CNIL demande un refus aussi simple et visible que l'acceptation —
               l'ancien rouge « danger » présentait le refus comme une faute. « Gérer mes
               préférences » en discret. -->
          <div class="flex flex-none flex-col tablet:flex-row justify-center gap-3">
            <button type="button" class="odc-btn odc-btn--quiet odc--slate" @click="cookieStore.openPreferencesModal()">
              <v-icon name="fa-sliders-h" />
              {{ t('Cookies.Button.Preferences') }}
            </button>
            <button type="button" class="odc-btn odc-btn--soft odc--slate" @click="handleDeclineAll">
              {{ t('Cookies.Button.Decline') }}
            </button>
            <button type="button" class="odc-btn odc-btn--soft odc--slate" @click="handleAcceptAll">
              {{ t('Cookies.Button.Accept') }}
            </button>
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