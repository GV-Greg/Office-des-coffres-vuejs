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
                  <v-icon name="gi-crown-coin" scale="0.55" class="text-white" />
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
            <span
              v-if="authStore.defaultCharacter?.id === character.id"
              class="shrink-0 text-[0.65rem] uppercase tracking-wide font-bold text-orange-600 whitespace-nowrap"
            >
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
                class="btn btn-grad-blue btn-sm"
                @click="startEditResidence(character)"
              >
                <v-icon name="fa-edit" class="w-3.5 h-3.5" />
                {{ t('Profil.EditResidence') }}
              </button>
            </div>
            <button
              v-if="authStore.defaultCharacter?.id !== character.id"
              type="button"
              class="btn btn-grad-slate btn-sm"
              @click="authStore.setDefaultCharacter(character.id)"
            >
              <v-icon name="gi-barbute" class="w-3.5 h-3.5" />
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
                class="btn btn-primary btn-sm"
                @click="saveResidence(character.id)"
              >
                {{ t('Profil.SaveResidence') }}
              </button>
              <button
                type="button"
                class="btn btn-grad-slate btn-sm"
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
        class="btn btn-primary mt-4"
      >
        <v-icon name="fa-user-plus" scale="1" />
        {{ t('Profil.AddCharacter') }}
      </RouterLink>
    </div>
    <NavMenu />
  </main>
</template>
