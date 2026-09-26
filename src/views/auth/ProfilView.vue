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
  import { useCookieStore } from '@/stores/cookieStore'
  import { translateKingdomName } from '@/modules/kingdomTranslations'
  import { push } from 'notivue'

/*
 datas user
*/
  const { t, locale } = useI18n()
  const router = useRouter()
  const authStore = useAuthStore()
  const cookieStore = useCookieStore()

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
    <div class="w-full max-w-2xl overflow-y-auto flex flex-col flex-grow items-center">
      <h2>{{ t('Profil.Title') }}</h2>
      <p class="text-gray-500 dark:text-gray-500 mb-4">{{ authStore.getUser?.email }}</p>

      <button
        type="button"
        class="odc-btn odc-btn--quiet odc-btn--sm odc--slate mb-4"
        @click="cookieStore.openPreferencesModal()"
      >
        {{ t('Cookies.Button.Preferences') }}
      </button>

      <div v-if="!authStore.hasCharacters" class="w-full bg-white rounded-xl shadow-md border border-gray-200 p-6 text-center">
        <p class="text-slate-700 dark:text-slate-700">{{ t('Profil.NoCharacter') }}</p>
      </div>

      <div
        v-for="character in authStore.getCharacters"
        :key="character.id"
        class="w-full my-2 flex rounded-xl bg-white shadow-md overflow-hidden transition-shadow hover:shadow-lg"
      >
        <div
          class="w-1.5 shrink-0"
          :class="character.is_validated ? 'bg-green-500' : 'bg-red-400'"
        />
        <div class="flex-1 p-4">
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-center gap-3">
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
              <div>
                <p class="font-extrabold text-slate-800 dark:text-slate-800 text-lg leading-tight">{{ character.pseudo }}</p>
                <p v-if="character.city_name" class="text-xs text-gray-500 dark:text-gray-500 inline-flex items-center gap-1">
                  <v-icon name="fa-map-marker-alt" scale="0.7" />
                  {{ character.city_name }}<template v-if="character.province_name">, {{ character.province_name }}</template><template v-if="character.kingdom_name">, {{ translateKingdomName(character.kingdom_name, locale) }}</template>
                </p>
              </div>
            </div>
            <!-- Badge d'état, pas un bouton : cartouche plat, sans relief ni ombre ni survol, pour
                 ne pas se confondre avec les actions odc-*. L'étoile (« choisi par défaut ») répond à la pastille de l'avatar ; ni coche (statut Validé), ni heaume (déjà l'avatar).
                 orange-800 sur orange-50 ≈ 6,9:1. -->
            <span
              v-if="authStore.defaultCharacter?.id === character.id"
              class="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-800 whitespace-nowrap"
            >
              <v-icon name="fa-star" class="w-3.5 h-3.5 text-orange-600" />
              {{ t('Profil.ActiveCharacter') }}
            </span>
          </div>

          <div class="mt-3 flex items-center justify-between gap-3 flex-wrap">
            <div class="flex items-center gap-3">
              <span
                class="inline-flex items-center gap-1 text-xs font-semibold"
                :class="character.is_validated ? 'text-green-700' : 'text-red-600'"
              >
                <v-icon :name="character.is_validated ? 'fa-check-circle' : 'fa-clock'" scale="0.75" />
                {{ character.is_validated ? t('Profil.Status.ValidatedBadge') : t('Profil.Status.PendingBadge') }}
              </span>
              <button
                v-if="editingCharacterId !== character.id"
                type="button"
                class="odc-btn odc-btn--soft odc-btn--sm odc--blue"
                @click="startEditResidence(character)"
              >
                <v-icon name="fa-edit" />
                {{ t('Profil.EditResidence') }}
              </button>
            </div>
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

          <p v-if="!character.is_validated" class="mt-2 text-sm text-gray-500 dark:text-gray-500">
            {{ character.pending_residence_change
              ? t('Profil.Status.PendingResidenceChangeMessage')
              : t('Profil.Status.PendingMessage') }}
          </p>

          <div v-if="editingCharacterId === character.id" class="mt-3 pt-3 border-t border-gray-200">
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

      <RouterLink
        to="/app/character/new"
        class="odc-btn odc-btn--soft odc--orange mt-4"
      >
        <v-icon name="fa-user-plus" />
        {{ t('Profil.AddCharacter') }}
      </RouterLink>

      <!-- Zone dangereuse — en bas du profil, après la gestion des personnages : on ne tombe pas
           dessus par accident en venant gérer ses personnages. -->
      <section
        data-testid="danger-zone"
        class="w-full mt-10 mb-4 flex rounded-xl bg-white shadow-md overflow-hidden"
      >
        <!-- Liseré latéral : même motif que les cartes personnages ci-dessus, en rouge plus
             saturé que le red-400 d'un personnage en attente, pour que les deux ne se confondent
             pas. Le fond reste clair en permanence (pas de variante `dark:`), comme le reste de
             cette vue : les cartes y sont à fond clair fixe et neutralisent le thème sombre en
             répétant la même couleur de texte en `dark:`. -->
        <div class="w-1.5 shrink-0 bg-red-600" />

        <div class="flex-1 bg-red-50 p-4">
          <h3 class="flex items-center gap-2 font-extrabold text-red-700 dark:text-red-700">
            <v-icon name="fa-exclamation-triangle" scale="1" class="shrink-0" />
            {{ t('Profil.DeleteAccount.SectionTitle') }}
          </h3>

          <p class="mt-2 max-w-prose text-sm text-slate-700 dark:text-slate-700">
            {{ t('Profil.DeleteAccount.Warning') }}
          </p>

          <button
            type="button"
            class="odc-btn odc-btn--soft odc-btn--sm odc--red mt-4"
            data-testid="delete-account-open"
            @click="isDeleteModalOpen = true"
          >
            <v-icon name="fa-trash-alt" />
            {{ t('Profil.DeleteAccount.Button') }}
          </button>
        </div>
      </section>
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
