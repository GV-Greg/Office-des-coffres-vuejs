<script setup>
/*
 imports
*/
  import { ref, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { RouterLink, useRouter } from 'vue-router'
  import NavMenu from '@/components/NavMenu.vue'
  import CityCascadeSelect from '@/components/forms/CityCascadeSelect.vue'
  import DeleteAccountModal from '@/components/DeleteAccountModal.vue'
  import { useAuthStore } from '@/stores/authStore'
  import { translateKingdomName } from '@/modules/kingdomTranslations'
  import { push } from 'notivue'

/*
 datas user
*/
  const { t, locale } = useI18n()
  const router = useRouter()
  const authStore = useAuthStore()

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
    authStore.updateCharacterCity(characterId, Number(editCityId.value))
      .then(() => {
        push.success(t('Profil.ResidenceUpdated'))
        cancelEditResidence()
      })
      .catch(error => {
        push.error(error.response?.data?.message ?? t('Auth.Errors.NetworkError'))
      })
  }

/*
  suppression du compte (art. 17 RGPD)
*/
  const isDeleteModalOpen = ref(false)
  const characterNames = computed(() => authStore.getCharacters.map(c => c.pseudo))

  const confirmDeleteAccount = (password, { onError }) => {
    authStore.deleteAccount(password)
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
    <div class="w-full max-w-5xl flex flex-col flex-grow">
      <h2 class="mt-0 mb-1">{{ t('Profil.Title') }}</h2>
      <p class="mb-5 text-center text-sm text-slate-500 dark:text-slate-500 break-all">{{ authStore.getUser?.email }}</p>

      <div class="grid grid-cols-1 laptop:grid-cols-3 gap-6 items-start">
        <!-- Personnages -->
        <div class="laptop:col-span-2 flex flex-col gap-3">
          <!-- Ajout en tête de liste : sous la liste, il flottait et touchait le menu circulaire. -->
          <div class="flex justify-end">
            <RouterLink to="/app/character/new" class="odc-btn odc-btn--soft odc-btn--sm odc--orange">
              <v-icon name="fa-user-plus" />
              {{ t('Profil.AddCharacter') }}
            </RouterLink>
          </div>

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
            <div class="flex-1 p-4 flex gap-3">
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
                <div class="flex items-start justify-between gap-3">
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
                  <div class="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      class="odc-btn odc-btn--soft odc-btn--sm odc--orange"
                      @click="saveResidence(character.id)"
                    >
                      {{ t('Profil.SaveResidence') }}
                    </button>
                    <button
                      type="button"
                      class="odc-btn odc-btn--quiet odc-btn--sm odc--slate"
                      @click="cancelEditResidence"
                    >
                      {{ t('Profil.CancelEdit') }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </div>

        <!-- Suppression du compte : dépliant natif (clavier et lecteur d'écran sans script), replié
             par défaut. La modale en deux étapes redit de toute façon ce qui sera effacé. Le fond
             reste clair en permanence, textes répétés en `dark:` à cause de `.dark p`. -->
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

    <DeleteAccountModal
      :show="isDeleteModalOpen"
      :character-names="characterNames"
      @close="isDeleteModalOpen = false"
      @confirm="confirmDeleteAccount"
    />

    <NavMenu />
  </div>
</template>
