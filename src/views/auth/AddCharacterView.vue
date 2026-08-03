<script setup>
/*
  imports
*/
  import { ref, computed, onMounted } from 'vue'
  import { useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import DefaultSubmitButton from '@/components/buttons/DefaultSubmitButton.vue'
  import { useAuthStore } from '@/stores/authStore'
  import validation from '@/directives/validation'
  import { http } from '@/api.js'
  import { push } from 'notivue'

  const { t } = useI18n()
  const router = useRouter()
  const authStore = useAuthStore()

/*
  form data
*/
  const pseudo = ref('')
  const kingdoms = ref([])
  const selectedKingdomId = ref('')
  const selectedProvinceId = ref('')
  const selectedCityId = ref('')
  const loadingMap = ref(true)

  const selectedKingdom = computed(() => kingdoms.value.find(k => k.id === Number(selectedKingdomId.value)))
  const provinces = computed(() => selectedKingdom.value?.provinces ?? [])
  const selectedProvince = computed(() => provinces.value.find(p => p.id === Number(selectedProvinceId.value)))
  const cities = computed(() => selectedProvince.value?.cities ?? [])

  const onKingdomChange = () => {
    selectedProvinceId.value = ''
    selectedCityId.value = ''
  }
  const onProvinceChange = () => {
    selectedCityId.value = ''
  }

/*
  charger la carte
*/
  onMounted(async () => {
    try {
      const response = await http.get('map')
      kingdoms.value = response.data.kingdoms
    } catch (error) {
      push.error(t('AddCharacter.MapError'))
    } finally {
      loadingMap.value = false
    }
  })

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
            push.error(error.response.data.message)
          })
    }
  }
</script>

<template>
  <main class="md:w-3/4">
    <div class="page-content grid grid-cols-3 gap-0 justify-items-center">
      <div class="col-start-2 col-span-1 w-full">
        <div class="w-full my-5 bg-gray-200 flex flex-col items-center justify-center border-2 border-gray-300 border-dashed rounded-xl">
          <div class="w-full mt-2 md:mt-5 px-7 overflow-y-auto">
            <h2>{{ t('AddCharacter.Heading') }}</h2>

            <form class="mt-6" @submit.prevent="submit">
              <div class="form-group">
                <label class="form-label">{{ t('username') }}</label>
                <input v-model="pseudo" type="text" :placeholder="t('Auth.UsernamePlaceholder')" class="form-field" />
              </div>

              <div v-if="loadingMap" class="text-center text-sm text-gray-500 my-4">
                {{ t('AddCharacter.LoadingMap') }}
              </div>

              <template v-else>
                <div class="form-group">
                  <label class="form-label">{{ t('AddCharacter.KingdomLabel') }}</label>
                  <select v-model="selectedKingdomId" @change="onKingdomChange" class="form-field">
                    <option value="" disabled>{{ t('AddCharacter.KingdomPlaceholder') }}</option>
                    <option v-for="kingdom in kingdoms" :key="kingdom.id" :value="kingdom.id">
                      {{ kingdom.kingdom_name }}
                    </option>
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label">{{ t('AddCharacter.ProvinceLabel') }}</label>
                  <select v-model="selectedProvinceId" @change="onProvinceChange" :disabled="!selectedKingdomId" class="form-field">
                    <option value="" disabled>{{ t('AddCharacter.ProvincePlaceholder') }}</option>
                    <option v-for="province in provinces" :key="province.id" :value="province.id">
                      {{ province.province_name }}
                    </option>
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label">{{ t('AddCharacter.CityLabel') }}</label>
                  <select v-model="selectedCityId" :disabled="!selectedProvinceId" class="form-field">
                    <option value="" disabled>{{ t('AddCharacter.CityPlaceholder') }}</option>
                    <option v-for="city in cities" :key="city.id" :value="city.id">
                      {{ city.city_name }}
                    </option>
                  </select>
                </div>
              </template>

              <DefaultSubmitButton :text="t('AddCharacter.SubmitButton')" />
            </form>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
