<script setup>
/*
 imports
*/
  import { ref, computed, onMounted } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { RouterLink, useRouter } from 'vue-router'
  import NavMenu from '@/components/NavMenu.vue'
  import CityCascadeSelect from '@/components/forms/CityCascadeSelect.vue'
  import DeleteAccountModal from '@/components/DeleteAccountModal.vue'
  import ChangeEmailModal from '@/components/ChangeEmailModal.vue'
  import ChangePasswordModal from '@/components/ChangePasswordModal.vue'
  import CharacterMandates from '@/components/mandates/CharacterMandates.vue'
  import { useMandateStore } from '@/stores/mandateStore'
  import { useAuthStore } from '@/stores/authStore'
  import useNavigationLoading from '@/use/useNavigationLoading'
  import { translateKingdomName } from '@/modules/kingdomTranslations'
  import { push } from 'notivue'
  import { http } from '@/api.js'

/*
 datas user
*/
  const { t, locale } = useI18n()
  const router = useRouter()
  const authStore = useAuthStore()
  const { trackApiCall } = useNavigationLoading()

/*
  mandats (lot 2) : chargés une fois au montage ; chaque geste les recharge.
*/
  const mandateStore = useMandateStore()
  onMounted(() => {
    if (authStore.hasCharacters) {
      Promise.resolve(mandateStore.fetchAll()).catch(() => push.error(t('Profil.Mandates.LoadError')))
    }
  })

/*
  édition de la résidence
*/
  const editingCharacterId = ref(null)
  const editCityId = ref('')

  const startEditResidence = (character) => {
    editingCharacterId.value = character.id
    editCityId.value = character.city_id ?? ''
  }
  const cancelEditResidence = () => {
    editingCharacterId.value = null
    editCityId.value = ''
  }
  const saveResidence = (characterId) => {
    trackApiCall(authStore.updateCharacterCity(characterId, Number(editCityId.value)))
      .then(() => {
        push.success(t('Profil.ResidenceUpdated'))
        cancelEditResidence()
      })
      .catch(error => {
        push.error(error.response?.data?.message ?? t('Auth.Errors.NetworkError'))
      })
  }

/*
  export de données (art. 20 RGPD)
*/
  const isDownloading = ref(false)

  const downloadData = async () => {
    isDownloading.value = true
    try {
      const response = await http.get('auth/account/export/pdf', {
        headers: { Authorization: `Bearer ${authStore.getToken}` },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(response.data)
      const today = new Date().toISOString().slice(0, 10)
      const a = document.createElement('a')
      a.href = url
      a.download = `office-des-coffres-export-${today}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      push.success(t('Profil.DataExport.SuccessToast'))
    } catch (error) {
      if (error.response?.status === 429) {
        push.error(t('Profil.DataExport.RateLimitToast'))
      } else {
        push.error(t('Profil.DataExport.ErrorToast'))
      }
    } finally {
      isDownloading.value = false
    }
  }

/*
  gestion du compte (email, mot de passe — back #75)
*/
  const isChangeEmailOpen = ref(false)
  const isChangePasswordOpen = ref(false)

  const confirmEmailChange = ({ currentPassword, newEmail }, { onSuccess, onError }) => {
    trackApiCall(authStore.requestEmailChange(currentPassword, newEmail))
      .then(() => onSuccess())
      .catch(error => {
        onError(error.response?.data?.message ?? t('Auth.Errors.NetworkError'))
      })
  }

  const confirmPasswordChange = ({ currentPassword, newPassword, passwordConfirmation }, { onError }) => {
    trackApiCall(authStore.changePassword(currentPassword, newPassword, passwordConfirmation))
      .then(() => {
        isChangePasswordOpen.value = false
        push.success(t('Profil.Account.PasswordModal.SuccessToast'))
      })
      .catch(error => {
        onError(error.response?.data?.message ?? t('Auth.Errors.NetworkError'))
      })
  }

/*
  suppression du compte (art. 17 RGPD)
*/
  const isDeleteModalOpen = ref(false)
  const characterNames = computed(() => authStore.getCharacters.map(c => c.pseudo))

  const confirmDeleteAccount = (password, { onError }) => {
    trackApiCall(authStore.deleteAccount(password), { navigates: true })
      .then(() => {
        isDeleteModalOpen.value = false
        push.success(t('Profil.DeleteAccount.SuccessToast'))
        router.push({ name: 'welcome' })
      })
      .catch(error => {
        // Mot de passe incorrect : le backend répond 403 avec son message français. La modale
        // reste ouverte sur l'étape 2 pour permettre une seconde tentative, plutôt que de tout
        // refermer et d'obliger à reparcourir l'avertissement.
        onError(error.response?.data?.message ?? t('Auth.Errors.NetworkError'))
      })
  }

</script>

<template>
  <div class="page-card">
    <!-- Structure revue le 27/09/2026 (critique de design) : deux colonnes à partir de laptop pour
         tenir sans défilement sur ordinateur. Personnages à gauche (2/3), suppression du compte
         REPLIÉE à droite (1/3) — dépliée en grand, elle attirait l'œil juste après le titre. Sur
         mobile, tout reste empilé, personnages d'abord. -->
    <div class="w-full max-w-7xl flex flex-col flex-grow">
      <h2 class="mt-0 mb-5">{{ t('Profil.Title') }}</h2>

      <!-- Bouton ajout hors grille : même niveau de départ pour les deux colonnes. -->
      <div class="flex justify-start mb-3">
        <RouterLink to="/app/character/new" class="odc-btn odc-btn--soft odc-btn--sm odc--orange">
          <v-icon name="fa-user-plus" />
          {{ t('Profil.AddCharacter') }}
        </RouterLink>
      </div>

      <div class="grid grid-cols-1 laptop:grid-cols-4 gap-6 items-start">
        <!-- Personnages -->
        <div class="laptop:col-span-3 flex flex-col gap-3">
          <div v-if="!authStore.hasCharacters" class="w-full bg-white rounded-xl shadow-md border border-gray-200 p-6 text-center">
            <p class="text-slate-700 dark:text-slate-700">{{ t('Profil.NoCharacter') }}</p>
          </div>

          <!-- Carte : identité en haut (pseudo + statut, résidence), explication du statut juste en
               dessous, actions groupées en bas. Le statut vivait dans la ligne des actions, collé au
               premier bouton, et changeait de place selon les boutons présents. -->
          <article
            v-for="character in authStore.getCharacters"
            :key="character.id"
            class="w-full flex rounded-xl bg-white shadow-md overflow-hidden"
          >
            <div
              class="w-1.5 shrink-0"
              :class="character.is_validated ? 'bg-green-500' : 'bg-red-400'"
            />
            <!-- Deux zones à partir de laptop : le personnage à gauche, ses postes à droite (panneau
                 teinté, filet vertical). Empilées en dessous, postes après les actions. -->
            <div class="flex-1 min-w-0 grid grid-cols-1 laptop:grid-cols-5">
            <div class="laptop:col-span-2 p-4 flex gap-3">
              <div class="relative h-11 w-11 shrink-0">
                <div class="h-11 w-11 rounded-full bg-slate-700 flex items-center justify-center">
                  <v-icon name="gi-barbute" scale="1.2" class="text-white" />
                </div>
                <div
                  v-if="authStore.defaultCharacter?.id === character.id"
                  class="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-gradient-to-br from-orange-400 to-red-600 ring-2 ring-white flex items-center justify-center"
                  :title="t('Profil.ActiveCharacter')"
                >
                  <v-icon name="fa-star" scale="0.55" class="text-white" />
                </div>
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="font-extrabold text-slate-800 dark:text-slate-800 text-lg leading-tight">{{ character.pseudo }}</p>
                    <!-- Statut : badge plat à côté du pseudo, même famille que « Personnage actif ».
                         Texte + icône, pas la couleur seule. green-800/red-800 sur fond -50 ≥ 6:1. -->
                    <span
                      class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold"
                      :class="character.is_validated
                        ? 'border-green-200 bg-green-50 text-green-800'
                        : 'border-red-200 bg-red-50 text-red-800'"
                    >
                      <v-icon :name="character.is_validated ? 'fa-check-circle' : 'fa-clock'" class="w-3 h-3" />
                      {{ character.is_validated ? t('Profil.Status.ValidatedBadge') : t('Profil.Status.PendingBadge') }}
                    </span>
                  </div>
                  <!-- Badge d'état, pas un bouton : cartouche plat, sans relief ni ombre ni survol, pour
                       ne pas se confondre avec les actions odc-*. L'étoile (« choisi par défaut ») répond
                       à la pastille de l'avatar ; ni coche (statut Validé), ni heaume (déjà l'avatar).
                       orange-800 sur orange-50 ≈ 6,9:1. -->
                  <span
                    v-if="authStore.defaultCharacter?.id === character.id"
                    class="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-800 whitespace-nowrap"
                  >
                    <v-icon name="fa-star" class="w-3.5 h-3.5 text-orange-600" />
                    {{ t('Profil.ActiveCharacter') }}
                  </span>
                </div>

                <p v-if="character.city_name" class="mt-1 text-xs text-gray-500 dark:text-gray-500 inline-flex items-center gap-1">
                  <v-icon name="fa-map-marker-alt" scale="0.7" />
                  {{ character.city_name }}<template v-if="character.province_name">, {{ character.province_name }}</template><template v-if="character.kingdom_name">, {{ translateKingdomName(character.kingdom_name, locale) }}</template>
                </p>

                <p v-if="!character.is_validated" class="mt-2 text-sm text-red-800 dark:text-red-800">
                  {{ character.pending_residence_change
                    ? t('Profil.Status.PendingResidenceChangeMessage')
                    : t('Profil.Status.PendingMessage') }}
                </p>

                <div v-if="editingCharacterId !== character.id" class="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    class="odc-btn odc-btn--soft odc-btn--sm odc--blue"
                    @click="startEditResidence(character)"
                  >
                    <v-icon name="fa-edit" />
                    {{ t('Profil.EditResidence') }}
                  </button>
                  <button
                    v-if="authStore.defaultCharacter?.id !== character.id"
                    type="button"
                    class="odc-btn odc-btn--soft odc-btn--sm odc--slate"
                    @click="authStore.setDefaultCharacter(character.id)"
                  >
                    <v-icon name="gi-barbute" />
                    {{ t('Profil.SetActive') }}
                  </button>
                </div>

                <div v-else class="mt-3 pt-3 border-t border-gray-200">
                  <CityCascadeSelect v-model="editCityId" />
                  <div class="flex items-center justify-between gap-2 mt-2">
                    <button
                      type="button"
                      class="odc-btn odc-btn--soft odc-btn--sm odc--red"
                      @click="cancelEditResidence"
                    >
                      <v-icon name="fa-times" />
                      {{ t('Profil.CancelEdit') }}
                    </button>
                    <button
                      type="button"
                      class="odc-btn odc-btn--soft odc-btn--sm odc--green"
                      @click="saveResidence(character.id)"
                    >
                      <v-icon name="fa-save" />
                      {{ t('Profil.SaveResidence') }}
                    </button>
                  </div>
                </div>

              </div>
            </div>

            <!-- Postes (mandats, lot 2) : demande, suivi, renouvellement, déclaration de poste. -->
            <CharacterMandates
              :character="character"
              class="laptop:col-span-3 p-4 bg-slate-50 border-t laptop:border-t-0 laptop:border-l border-slate-200"
            />
            </div>
          </article>
        </div>

        <!-- Colonne droite : compte, export de données, suppression. -->
        <div class="flex flex-col gap-4">
          <!-- Mon compte (email, mot de passe — back #75) -->
          <div
            data-testid="account-section"
            class="w-full rounded-xl border border-slate-200 bg-white shadow-md overflow-hidden"
          >
            <!-- Filet coloré en tête, identique aux modales. -->
            <div class="h-1 bg-gradient-to-r from-orange-400 via-red-500 to-violet-500"></div>
            <h3 class="mt-0 mb-0 flex items-center gap-2 px-4 py-3 font-bold text-slate-700 dark:text-slate-700 border-b border-slate-100">
              <v-icon name="ri-user-settings-line" class="w-4 h-4 shrink-0" />
              {{ t('Profil.Account.SectionTitle') }}
            </h3>

            <!-- Rangée email : toute la rangée est cliquable (pattern settings). -->
            <button
              type="button"
              class="w-full flex items-center gap-3 px-4 py-3 border-b border-slate-100 hover:bg-orange-50 active:bg-orange-100 transition-colors text-left"
              data-testid="change-email-open"
              @click="isChangeEmailOpen = true"
            >
              <v-icon name="ri-mail-line" class="w-4 h-4 shrink-0 text-slate-400" />
              <div class="flex-1 min-w-0">
                <p class="text-xs text-slate-500 dark:text-slate-500 leading-none mb-0.5">{{ t('Profil.Account.Email') }}</p>
                <p class="text-sm font-medium text-slate-700 dark:text-slate-700 break-all leading-snug">{{ authStore.getUser?.email }}</p>
              </div>
              <v-icon name="fa-chevron-right" class="w-3 h-3 shrink-0 text-slate-300" />
            </button>

            <!-- Rangée mot de passe. -->
            <button
              type="button"
              class="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 active:bg-blue-100 transition-colors text-left"
              data-testid="change-password-open"
              @click="isChangePasswordOpen = true"
            >
              <v-icon name="ri-lock-password-line" class="w-4 h-4 shrink-0 text-slate-400" />
              <div class="flex-1 min-w-0">
                <p class="text-xs text-slate-500 dark:text-slate-500 leading-none mb-0.5">{{ t('Profil.Account.Password') }}</p>
                <p class="text-sm font-medium text-slate-700 dark:text-slate-700 leading-snug tracking-widest select-none">••••••••</p>
              </div>
              <v-icon name="fa-chevron-right" class="w-3 h-3 shrink-0 text-slate-300" />
            </button>
          </div>

          <!-- Mes données (art. 20 RGPD) : dépliant natif, replié par défaut. -->
          <details
            data-testid="data-export-section"
            class="group w-full rounded-xl border border-slate-200 bg-white shadow-md overflow-hidden"
          >
            <summary class="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-bold text-slate-700 dark:text-slate-700 [&::-webkit-details-marker]:hidden">
              <v-icon name="ri-download-2-line" class="w-4 h-4 shrink-0" />
              <span class="flex-1">{{ t('Profil.DataExport.SectionTitle') }}</span>
              <v-icon name="fa-chevron-down" class="w-3 h-3 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <div class="px-4 pb-4">
              <p class="text-sm text-slate-600 dark:text-slate-600">
                {{ t('Profil.DataExport.Text') }}
              </p>
              <button
                type="button"
                class="odc-btn odc-btn--soft odc-btn--sm odc--slate mt-3"
                :disabled="isDownloading"
                :aria-busy="isDownloading ? 'true' : 'false'"
                data-testid="export-data-button"
                @click="downloadData"
              >
                <v-icon name="ri-download-2-line" />
                {{ isDownloading ? t('Profil.DataExport.Preparing') : t('Profil.DataExport.Button') }}
              </button>
            </div>
          </details>

          <!-- Suppression du compte : dépliant natif (clavier et lecteur d'écran sans script),
               replié par défaut. La modale en deux étapes redit de toute façon ce qui sera effacé.
               Le fond reste clair en permanence, textes répétés en `dark:` à cause de `.dark p`. -->
          <details
            data-testid="danger-zone"
            class="group w-full rounded-xl border border-red-200 bg-red-50 shadow-md overflow-hidden"
          >
            <summary class="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-bold text-red-700 dark:text-red-700 [&::-webkit-details-marker]:hidden">
              <v-icon name="fa-exclamation-triangle" class="w-4 h-4 shrink-0" />
              <span class="flex-1">{{ t('Profil.DeleteAccount.SectionTitle') }}</span>
              <v-icon name="fa-chevron-down" class="w-3 h-3 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <div class="px-4 pb-4">
              <p class="text-sm text-slate-700 dark:text-slate-700">
                {{ t('Profil.DeleteAccount.Warning') }}
              </p>
              <button
                type="button"
                class="odc-btn odc-btn--soft odc-btn--sm odc--red mt-3"
                data-testid="delete-account-open"
                @click="isDeleteModalOpen = true"
              >
                <v-icon name="fa-trash-alt" />
                {{ t('Profil.DeleteAccount.Button') }}
              </button>
            </div>
          </details>
        </div>
      </div>
    </div>

    <ChangeEmailModal
      :show="isChangeEmailOpen"
      :current-email="authStore.getUser?.email ?? ''"
      @close="isChangeEmailOpen = false"
      @confirm="confirmEmailChange"
    />

    <ChangePasswordModal
      :show="isChangePasswordOpen"
      @close="isChangePasswordOpen = false"
      @confirm="confirmPasswordChange"
    />

    <DeleteAccountModal
      :show="isDeleteModalOpen"
      :character-names="characterNames"
      @close="isDeleteModalOpen = false"
      @confirm="confirmDeleteAccount"
    />

    <NavMenu />
  </div>
</template>
