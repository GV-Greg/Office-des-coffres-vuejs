<script setup>
/*
  imports
*/
  import { ref } from 'vue'
  import { RouterLink, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import DefaultSubmitButton from '@/components/buttons/DefaultSubmitButton.vue'
  import SelectorMenu from '@/components/SelectorMenu.vue'
  import CityCascadeSelect from '@/components/forms/CityCascadeSelect.vue'
  import { useAuthStore } from '@/stores/authStore'
  import validation from '@/directives/validation'
  import { push } from 'notivue'

  const { t } = useI18n()
  const router = useRouter()
  const authStore = useAuthStore()

/*
  form data
*/
  const pseudo = ref('')
  const selectedCityId = ref('')

/*
  submit form
*/
  const submit = () => {
    if (validation(!pseudo.value, t('AddCharacter.Errors.PseudoRequired'))) {
    } else if (validation(!selectedCityId.value, t('AddCharacter.Errors.CityRequired'))) {
    } else {
      authStore.createCharacter({ pseudo: pseudo.value, city_id: Number(selectedCityId.value) })
          .then(() => {
            router.push('/app/profil')
          })
          .catch(error => {
            push.error(error.response?.data?.message ?? t('Auth.Errors.NetworkError'))
          })
    }
  }
</script>

<template>
  <div class="page-container relative">
    <div class="absolute top-4 right-4">
      <SelectorMenu />
    </div>
    <h1>{{ t('Common.SiteName') }}</h1>
    <div class="page-content grid grid-cols-3 gap-0 justify-items-center">
      <div class="w-full col-start-2 col-span-1">
        <!-- Bouton retour -->
        <div class="w-full flex justify-center mb-1">
          <RouterLink to="/app/profil" class="btn btn-grad-slate">
            <v-icon name="fa-arrow-alt-circle-left" scale="1" />
            {{ t('AddCharacter.BackLink') }}
          </RouterLink>
        </div>

        <div class="w-12/12 my-5 bg-slate-700 dark:bg-gray-200 shadow-lg flex flex-col items-center justify-center rounded-xl">
          <div class="w-full mt-2 laptop:mt-5 px-7 overflow-y-auto">
            <h2 class="text-white dark:text-blue-800">{{ t('AddCharacter.Heading') }}</h2>

            <form class="mt-6" @submit.prevent="submit">
              <div class="form-group">
                <label class="form-label">{{ t('username') }} <span class="text-red-500">*</span></label>
                <input v-model="pseudo" type="text" :placeholder="t('Auth.UsernamePlaceholder')" class="form-field" :class="{ 'border-green-500': pseudo, 'border-red-300': !pseudo }" />
              </div>

              <CityCascadeSelect v-model="selectedCityId" />

              <DefaultSubmitButton :text="t('AddCharacter.SubmitButton')" />
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
