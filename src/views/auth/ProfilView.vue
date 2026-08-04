<script setup>
/*
 imports
*/
  import { ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { RouterLink } from 'vue-router'
  import NavMenu from '@/components/NavMenu.vue'
  import CityCascadeSelect from '@/components/forms/CityCascadeSelect.vue'
  import { useAuthStore } from '@/stores/authStore'
  import { translateKingdomName } from '@/modules/kingdomTranslations'
  import { push } from 'notivue'

/*
 datas user
*/
  const { t, locale } = useI18n()
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

</script>

<template>
  <main>
    <div class="w-full max-w-2xl overflow-y-auto flex flex-col flex-grow items-center">
      <h2>{{ t('Profil.Title') }}</h2>
      <p class="text-gray-500 dark:text-gray-500 mb-4">{{ authStore.getUser?.email }}</p>

      <div v-if="!authStore.hasCharacters" class="w-full bg-white rounded-xl shadow-md border border-gray-200 p-6 text-center">
        <p class="text-slate-700 dark:text-slate-700">{{ t('Profil.NoCharacter') }}</p>
      </div>

      <div
        v-for="character in authStore.getCharacters"
        :key="character.id"
        class="w-full my-2 p-4 rounded-xl bg-white shadow-md border border-gray-200"
      >
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="h-10 w-10 shrink-0 rounded-full bg-slate-700 flex items-center justify-center">
              <v-icon name="gi-barbute" scale="1.1" class="text-white" />
            </div>
            <div>
              <p class="font-bold text-slate-800 dark:text-slate-800">{{ character.pseudo }}</p>
              <p v-if="character.city_name" class="text-xs text-gray-500 dark:text-gray-500 inline-flex items-center gap-1">
                <v-icon name="fa-map-marker-alt" scale="0.7" />
                {{ character.city_name }}<template v-if="character.province_name">, {{ character.province_name }}</template><template v-if="character.kingdom_name">, {{ translateKingdomName(character.kingdom_name, locale) }}</template>
                <button
                  v-if="editingCharacterId !== character.id"
                  type="button"
                  class="ml-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors"
                  @click="startEditResidence(character)"
                >
                  <v-icon name="fa-edit" scale="0.7" />
                  {{ t('Profil.EditResidence') }}
                </button>
              </p>
            </div>
          </div>
          <span
            class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase whitespace-nowrap"
            :class="character.is_validated ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'"
          >
            <v-icon :name="character.is_validated ? 'fa-check-circle' : 'fa-clock'" scale="0.8" />
            {{ character.is_validated ? t('Profil.Status.ValidatedBadge') : t('Profil.Status.PendingBadge') }}
          </span>
        </div>
        <p class="mt-3 text-sm text-gray-500 dark:text-gray-500">
          {{ character.is_validated
            ? t('Profil.Status.Validated')
            : character.pending_residence_change
              ? t('Profil.Status.PendingResidenceChangeMessage')
              : t('Profil.Status.PendingMessage') }}
        </p>

        <div v-if="editingCharacterId === character.id" class="mt-3 pt-3 border-t border-gray-200">
          <CityCascadeSelect v-model="editCityId" />
          <div class="flex items-center gap-2 mt-2">
            <button
              type="button"
              class="px-3 py-1.5 rounded-md text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              @click="saveResidence(character.id)"
            >
              {{ t('Profil.SaveResidence') }}
            </button>
            <button
              type="button"
              class="px-3 py-1.5 rounded-md text-sm font-semibold text-slate-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              @click="cancelEditResidence"
            >
              {{ t('Profil.CancelEdit') }}
            </button>
          </div>
        </div>
      </div>

      <RouterLink
        to="/app/character/new"
        class="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-md font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
      >
        <v-icon name="fa-user-plus" scale="1" />
        {{ t('Profil.AddCharacter') }}
      </RouterLink>
    </div>
    <NavMenu />
  </main>
</template>
